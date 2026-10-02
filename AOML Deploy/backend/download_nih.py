"""Download directly from NIH's Box release; never silently use a mirror."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import tarfile
import requests

RELEASE = "https://nihcc.app.box.com/v/ChestXray-NIHCC"
FILES = {"Data_Entry_2017_v2020.csv": "219760887468", "train_val_list.txt": "256056636701",
         "test_list.txt": "256055473534", "README_CHESTXRAY.pdf": "220660789610",
         "batch_download_zips.py": "371647823217"}

def download(url, destination):
    destination = Path(destination)
    if destination.exists():
        digest = hashlib.sha256()
        with destination.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()
    part = destination.with_suffix(destination.suffix + ".part")
    with requests.get(url, stream=True, timeout=(15, 60)) as response:
        response.raise_for_status()
        if "text/html" in response.headers.get("content-type", ""):
            raise RuntimeError("NIH Box returned a web page instead of a file; use the official Download button")
        digest = hashlib.sha256()
        downloaded = 0
        with part.open("wb") as handle:
            for chunk in response.iter_content(1024 * 1024):
                if not chunk:
                    continue
                handle.write(chunk)
                digest.update(chunk)
                downloaded += len(chunk)
                if downloaded % (128 * 1024 * 1024) < len(chunk):
                    print(f"  {destination.name}: {downloaded / 1024**3:.2f} GiB downloaded", flush=True)
    part.replace(destination)
    return digest.hexdigest()

def is_extracted(archive, root):
    root = Path(root).resolve()
    try:
        with tarfile.open(archive) as handle:
            members = [member for member in handle if member.isfile()]
        return bool(members) and all((root / member.name).is_file() for member in members)
    except (OSError, tarfile.TarError):
        return False

def extract(archive, root):
    root = Path(root).resolve()
    with tarfile.open(archive) as handle:
        for member in handle:
            target = (root / member.name).resolve()
            if not target.is_relative_to(root) or not member.isfile() or member.size > 100_000_000:
                if member.isdir() and target.is_relative_to(root):
                    continue
                raise ValueError("Unsafe archive member")
            target.parent.mkdir(parents=True, exist_ok=True)
            with handle.extractfile(member) as source, target.open("wb") as destination:
                import shutil
                shutil.copyfileobj(source, destination)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=Path("data/raw"))
    parser.add_argument("--archives", type=int, default=1, choices=range(0, 13),
        help="Start with one archive; use 12 for the complete release")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    provenance = {"source": RELEASE, "files": {}, "errors": {}, "scope": "partial"}
    for name, identifier in FILES.items():
        url = f"https://nihcc.app.box.com/index.php?rm=box_download_shared_file&vanity_name=ChestXray-NIHCC&file_id=f_{identifier}"
        try:
            provenance["files"][name] = {"url": url, "sha256": download(url, args.out / name)}
        except Exception as exc:
            provenance["errors"][name] = str(exc)
    script = args.out / "batch_download_zips.py"
    if args.archives and script.exists():
        # Extract URLs as data. Do not execute the downloaded script.
        links = re.findall(r"https://nihcc\.box\.com/shared/static/[a-zA-Z0-9]+\.gz", script.read_text())
        for index, url in enumerate(dict.fromkeys(links)):
            if index >= args.archives:
                break
            name = f"images_{index + 1:03d}.tar.gz"
            try:
                archive = args.out / name
                print(f"\nArchive {index + 1}/{args.archives}: {name}", flush=True)
                sha256 = download(url, archive)
                provenance["files"][name] = {"url": url, "sha256": sha256}
                if is_extracted(archive, args.out):
                    print(f"  {name} is already fully extracted", flush=True)
                else:
                    print(f"  Extracting {name}", flush=True)
                    extract(archive, args.out)
            except Exception as exc:
                provenance["errors"][name] = str(exc)
    provenance["scope"] = "complete" if args.archives == 12 and not provenance["errors"] else "partial"
    (args.out / "provenance.json").write_text(json.dumps(provenance, indent=2), encoding="utf-8")
    print(json.dumps(provenance, indent=2))
    if provenance["errors"]:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
