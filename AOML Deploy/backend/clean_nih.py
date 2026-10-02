"""Clean NIH images without modifying raw files; emit leakage-safe manifests and EDA."""
import argparse
from collections import Counter
import hashlib
import html
import json
from pathlib import Path
import warnings

import imagehash
import numpy as np
import pandas as pd
from PIL import Image
from sklearn.model_selection import train_test_split

class UnionFind:
    def __init__(self, n): self.parent = list(range(n))
    def find(self, n):
        while self.parent[n] != n:
            self.parent[n] = self.parent[self.parent[n]]
            n = self.parent[n]
        return n
    def join(self, a, b): self.parent[self.find(a)] = self.find(b)

class HashTree:
    """BK-tree for bounded Hamming-distance lookup (avoids all-pairs image checks)."""
    def __init__(self): self.root = None
    def add(self, value, index):
        if self.root is None:
            self.root = [value, index, {}]; return
        node = self.root
        while True:
            distance = (value ^ node[0]).bit_count()
            if distance not in node[2]:
                node[2][distance] = [value, index, {}]; return
            node = node[2][distance]
    def nearby(self, value, tolerance=2):
        stack = [self.root] if self.root else []
        while stack:
            node = stack.pop()
            distance = (value ^ node[0]).bit_count()
            if distance <= tolerance: yield node[1]
            stack.extend(child for edge, child in node[2].items() if distance-tolerance <= edge <= distance+tolerance)

def clean(raw, out, seed=42):
    raw, out = Path(raw), Path(out)
    out.mkdir(parents=True, exist_ok=True)
    # Official NIH downloads have used both names; Kaggle mirrors commonly keep
    # the original filename. Prefer the revised metadata when both are present.
    metadata_path = next(
        (candidate for candidate in (
            raw / "Data_Entry_2017_v2020.csv",
            raw / "Data_Entry_2017.csv",
        ) if candidate.is_file()),
        None,
    )
    if metadata_path is None:
        raise FileNotFoundError(
            "Expected Data_Entry_2017_v2020.csv or Data_Entry_2017.csv in the dataset root"
        )
    metadata = pd.read_csv(metadata_path)
    metadata = metadata.rename(columns={"Patient Sex": "Patient Gender"})
    required = {"Image Index", "Finding Labels", "Patient ID", "Patient Age", "Patient Gender", "View Position"}
    if not required.issubset(metadata.columns):
        raise ValueError("Missing NIH metadata columns")
    test_names = set((raw / "test_list.txt").read_text().splitlines())
    train_names = set((raw / "train_val_list.txt").read_text().splitlines())
    if test_names & train_names: raise ValueError("Official lists overlap")
    test_patients = set(metadata.loc[metadata["Image Index"].isin(test_names), "Patient ID"].astype(str))
    paths = {}
    duplicate_paths = set()
    for path in raw.rglob("*.png"):
        if path.name in paths: duplicate_paths.add(path.name)
        paths[path.name] = path
    rows, excluded = [], []
    completeness = metadata.isna().sum().to_dict()
    def reject(name, reason): excluded.append({"image": str(name), "reason":reason})
    seen_metadata = set()
    duplicate_metadata = set(metadata.loc[metadata["Image Index"].duplicated(keep=False), "Image Index"])
    for record in metadata.to_dict("records"):
        name = record["Image Index"]
        if name in duplicate_metadata:
            reject(name, "duplicate_metadata"); continue
        if name in seen_metadata:
            reject(name, "duplicate_metadata"); continue
        seen_metadata.add(name)
        if name in duplicate_paths:
            reject(name, "ambiguous_image_path"); continue
        if name not in paths:
            reject(name, "missing_image"); continue
        labels = str(record["Finding Labels"])
        patient = record["Patient ID"]
        if pd.isna(patient) or pd.isna(record["Finding Labels"]) or not str(patient).isdigit():
            reject(name, "invalid_metadata"); continue
        label = 1 if "Pneumonia" in labels.split("|") else 0 if labels == "No Finding" else None
        if label is None:
            reject(name, "outside_binary_scope"); continue
        if name not in test_names and name not in train_names:
            reject(name, "missing_official_split"); continue
        path = paths[name]
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(path) as image:
                    image.verify()
                with Image.open(path) as image:
                    if image.width * image.height > 20_000_000: raise ValueError("too many pixels")
                    gray = image.convert("L")
                    brightness = float(np.asarray(gray.resize((64, 64))).mean())
                    phash = int(str(imagehash.phash(gray)), 16)
                    width, height, mode = image.width, image.height, image.mode
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
        except Exception:
            reject(name, "corrupt_or_oversized_image"); continue
        rows.append({"image":name, "path":str(path.resolve()), "patient":str(patient), "label":label,
            "labels":labels, "official_split":"test" if name in test_names else "development",
            "width":width, "height":height, "mode":mode, "brightness":brightness, "sha256":digest,
            "phash":phash, "age":record["Patient Age"], "sex":record["Patient Gender"], "view":record["View Position"],
            "review":brightness < 5 or brightness > 250 or width < 224 or height < 224
                or pd.isna(record["Patient Age"]) or not 0 <= float(record["Patient Age"]) <= 120})
    uf, tree = UnionFind(len(rows)), HashTree()
    exact = {}
    for index, row in enumerate(rows):
        if row["sha256"] in exact: uf.join(index, exact[row["sha256"]])
        exact[row["sha256"]] = index
        for match in tree.nearby(row["phash"]): uf.join(index, match)
        tree.add(row["phash"], index)
    groups = {}
    for index in range(len(rows)): groups.setdefault(uf.find(index), []).append(index)
    kept = []
    for members in groups.values():
        group_rows = [rows[i] for i in members]
        if len({r["label"] for r in group_rows}) > 1:
            for row in group_rows: reject(row["image"], "conflicting_duplicate_labels")
            continue
        # Keep test preferentially. Remove all development members of cross-split duplicate groups.
        eligible = [r for r in group_rows if r["official_split"] == "test"]
        if not eligible: eligible = group_rows
        selected = sorted(eligible, key=lambda r:r["image"])[0]
        selected["duplicate_group"] = selected["image"]
        for row in group_rows:
            if row is not selected: reject(row["image"], "exact_or_near_duplicate")
        if selected["official_split"] != "test" and selected["patient"] in test_patients:
            reject(selected["image"], "patient_in_official_test"); continue
        kept.append(selected)
    if not kept: raise ValueError("No eligible decoded images; inspect download and exclusion log")
    frame = pd.DataFrame(kept)
    development = frame[frame.official_split == "development"]
    patient_labels = development.groupby("patient").label.max()
    if len(patient_labels) < 4 or patient_labels.value_counts().min() < 2 or len(patient_labels.unique()) != 2:
        raise ValueError("Insufficient development patients per class for a stratified split")
    _, val_patients = train_test_split(patient_labels.index, test_size=.2, random_state=seed, stratify=patient_labels.values)
    frame["split"] = np.where(frame.official_split == "test", "test", np.where(frame.patient.isin(val_patients), "val", "train"))
    assert frame.groupby("patient").split.nunique().max() == 1
    for split in ["train", "val", "test"]:
        if set(frame.loc[frame.split == split, "label"]) != {0, 1}:
            raise ValueError(f"{split} needs both classes; obtain more official archives")
    frame.to_csv(out / "manifest.csv", index=False)
    pd.DataFrame(excluded, columns=["image","reason"]).to_csv(out / "exclusions.csv", index=False)
    info = {"source":"https://nihcc.app.box.com/v/ChestXray-NIHCC", "seed":seed,
        "metadata_sha256":hashlib.sha256(metadata_path.read_bytes()).hexdigest(),
        "manifest_sha256":hashlib.sha256((out / "manifest.csv").read_bytes()).hexdigest(),
        "metadata_rows":len(metadata), "images_found":len(paths), "clean_rows":len(frame),
        "clean_patients":int(frame.patient.nunique()),
        "metadata_label_counts":metadata["Finding Labels"].str.split("|").explode().value_counts().to_dict(),
        "scope":"complete" if len(paths) == len(metadata) else "partial",
        "excluded":dict(Counter(r["reason"] for r in excluded)), "missing_metadata":completeness,
        "split_counts":{f"{split}:{label}":int(count) for (split,label),count in frame.groupby(["split","label"]).size().items()},
        "review_flags":int(frame.review.sum()), "label_limitation":"Report-derived labels; No Finding does not establish health."}
    (out / "cleaning.json").write_text(json.dumps(info, indent=2, default=int), encoding="utf-8")
    report(frame, info, out)
    return frame, info

def report(frame, info, out):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    figures = []
    plots = {
        "classes":lambda ax: frame.assign(label=frame.label.map({0:"No Finding",1:"Pneumonia"})).groupby(["split","label"]).size().unstack(fill_value=0).plot.bar(ax=ax),
        "dimensions":lambda ax: ax.scatter(frame.width, frame.height, s=4, alpha=.3),
        "brightness":lambda ax: frame.brightness.hist(ax=ax, bins=30),
        "ages":lambda ax: pd.to_numeric(frame.age, errors="coerce").hist(ax=ax, bins=30),
        "views":lambda ax: frame.view.value_counts().plot.bar(ax=ax),
    }
    for name, draw in plots.items():
        fig, ax = plt.subplots(figsize=(7,4)); draw(ax); ax.set_title(name)
        if name == "dimensions": ax.set_xlabel("Width (pixels)"); ax.set_ylabel("Height (pixels)")
        elif name == "brightness": ax.set_xlabel("Mean grayscale intensity (0–255)"); ax.set_ylabel("Images")
        elif name == "ages": ax.set_xlabel("Patient age (years)"); ax.set_ylabel("Images")
        else: ax.set_ylabel("Images")
        fig.tight_layout(); fig.savefig(out / f"{name}.png"); plt.close(fig)
        figures.append(f'<h2>{name}</h2><img src="{name}.png" alt="{name} chart" width="700">')
    fig, axes = plt.subplots(2, 4, figsize=(12,6))
    for label in [0,1]:
        samples = frame[frame.label == label].head(4)
        for ax, row in zip(axes[label], samples.to_dict("records")):
            with Image.open(row["path"]) as image: ax.imshow(image, cmap="gray")
            ax.set_title("Pneumonia" if label else "No Finding"); ax.axis("off")
    fig.tight_layout(); fig.savefig(out / "samples.png"); plt.close(fig)
    document = '<!doctype html><html lang="en"><meta charset="utf-8"><title>NIH cleaning and EDA</title><body><h1>NIH ChestX-ray14 cleaning and EDA</h1><p>Report-derived labels. This report describes the downloaded subset only. Unusual images are flagged, not removed solely for brightness.</p><pre>'
    document += html.escape(json.dumps(info, indent=2, default=int)) + '</pre>' + ''.join(figures) + '<h2>Representative samples</h2><img src="samples.png" width="900"></body></html>'
    (out / "eda.html").write_text(document, encoding="utf-8")
    import nbformat
    notebook = nbformat.v4.new_notebook(cells=[
        nbformat.v4.new_markdown_cell("# NIH ChestX-ray14 EDA\nReport-derived labels; patient-separated splits; raw data stays unchanged."),
        nbformat.v4.new_code_cell("from pathlib import Path\nimport pandas as pd\nfrom IPython.display import display, Image\nroot = Path('.')\ndf = pd.read_csv(root / 'manifest.csv')\ndisplay(df.groupby(['split', 'label']).size().unstack(fill_value=0))\ndisplay(df[['width','height','brightness','age']].describe())"),
        nbformat.v4.new_code_cell("for name in ['classes','dimensions','brightness','ages','views','samples']:\n    display(Image(filename=str(root / (name + '.png'))))")
    ])
    nbformat.write(notebook, out / "eda.ipynb")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw", type=Path, default=Path("data/raw"))
    parser.add_argument("--out", type=Path, default=Path("data/processed"))
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    _, info = clean(args.raw, args.out, args.seed)
    print(json.dumps(info, indent=2, default=int))

