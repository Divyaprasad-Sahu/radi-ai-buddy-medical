"""Manifest-driven transfer learning, validation selection, calibration and ONNX export."""
import argparse
import copy
import hashlib
import json
import random
from pathlib import Path
import time

import numpy as np
import pandas as pd
from PIL import Image, ImageOps
from sklearn.metrics import (balanced_accuracy_score, confusion_matrix, f1_score,
    precision_score, recall_score, roc_auc_score, brier_score_loss)
import torch
from torch import nn
from torch.utils.data import DataLoader, Dataset
from torchvision import models, transforms

CLASSES = ["No Finding", "Pneumonia"]

class ManifestImages(Dataset):
    def __init__(self, frame, training=False):
        self.rows = frame.to_dict("records")
        # Identical resize implementation to deployed numpy/Pillow preprocessing.
        self.transform = transforms.Compose(
            ([transforms.RandomRotation(7)] if training else []) +
            [transforms.ToTensor(), transforms.Normalize([.485,.456,.406],[.229,.224,.225])])
    def __len__(self): return len(self.rows)
    def __getitem__(self, index):
        row = self.rows[index]
        with Image.open(row["path"]) as image:
            image = ImageOps.exif_transpose(image).convert("RGB").resize((224,224), Image.Resampling.BILINEAR)
            tensor = self.transform(image)
        return tensor, int(row["label"])

def build_model(pretrained=False):
    model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT if pretrained else None)
    model.fc = nn.Linear(model.fc.in_features, 2)
    return model

def probabilities(logits, temperature=1):
    scaled = logits / temperature
    scaled -= scaled.max(axis=1, keepdims=True)
    values = np.exp(scaled)
    return values[:,1] / values.sum(axis=1)

def metrics(labels, logits, temperature=1):
    scores = probabilities(logits, temperature)
    predicted = scores >= .5
    tn, fp, fn, tp = confusion_matrix(labels, predicted, labels=[0,1]).ravel()
    ece = 0.
    for low in np.linspace(0, .9, 10):
        members = (scores >= low) & (scores < low+.1 if low < .9 else scores <= 1)
        if members.any(): ece += members.mean() * abs(scores[members].mean() - labels[members].mean())
    return {"sensitivity":float(recall_score(labels,predicted,zero_division=0)),
        "specificity":float(tn / max(tn+fp,1)), "precision":float(precision_score(labels,predicted,zero_division=0)),
        "f1":float(f1_score(labels,predicted,zero_division=0)), "balanced_accuracy":float(balanced_accuracy_score(labels,predicted)),
        "roc_auc":float(roc_auc_score(labels,scores)) if len(np.unique(labels)) == 2 else None,
        "brier":float(brier_score_loss(labels,scores)), "ece":float(ece),
        "confusion_matrix":[[int(tn),int(fp)],[int(fn),int(tp)]],
        "abstention_fraction":float((np.maximum(scores,1-scores) < .8).mean())}

def collect(model, loader, device):
    outputs, labels = [], []
    model.eval()
    with torch.inference_mode():
        for images, targets in loader:
            outputs.append(model(images.to(device)).cpu().numpy()); labels.append(targets.numpy())
    return np.concatenate(labels), np.concatenate(outputs)

def calibrate(logits, labels):
    # Bounded temperature chosen by validation NLL only.
    candidates = np.geomspace(.05,20,200)
    losses = []
    for temperature in candidates:
        scores = np.clip(probabilities(logits.copy(),temperature),1e-7,1-1e-7)
        losses.append(float(-(labels*np.log(scores)+(1-labels)*np.log(1-scores)).mean()))
    return float(candidates[int(np.argmin(losses))])

def validate_manifest(frame):
    required = {"path","label","patient","split","sha256","duplicate_group"}
    if not required.issubset(frame.columns): raise ValueError("Run clean_nih.py first")
    for field in ["patient","sha256","duplicate_group"]:
        if frame.groupby(field).split.nunique().max() > 1: raise ValueError(f"{field} leakage")
    for split in ["train","val","test"]:
        if set(frame.loc[frame.split == split,"label"]) != {0,1}: raise ValueError(f"{split} lacks both classes")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=Path("data/processed/manifest.csv"))
    parser.add_argument("--out", type=Path, default=Path("artifacts"))
    parser.add_argument("--baseline", type=Path, default=Path("models/pneumonia_model.pth"))
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--evaluate-only", action="store_true")
    args = parser.parse_args()
    if args.epochs < 1 or args.batch_size < 1: parser.error("epochs and batch-size must be positive")
    torch.manual_seed(args.seed); random.seed(args.seed); np.random.seed(args.seed)
    torch.set_num_threads(2)
    torch.use_deterministic_algorithms(True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    frame = pd.read_csv(args.manifest)
    validate_manifest(frame)
    args.out.mkdir(parents=True, exist_ok=True)
    loaders = {split:DataLoader(ManifestImages(frame[frame.split==split], split=="train"),
        batch_size=args.batch_size,shuffle=split=="train",num_workers=0) for split in ["train","val","test"]}
    report = {"seed":args.seed,"device":str(device),
        "manifest_sha256":hashlib.sha256(args.manifest.read_bytes()).hexdigest(),
        "baseline_provenance":"Unknown; historic training overlap cannot be excluded", "epochs":[]}
    baseline, baseline_metrics = None, None
    try:
        baseline = build_model().to(device)
        state = torch.load(args.baseline, map_location=device, weights_only=True)
        baseline.load_state_dict(state)
        labels, logits = collect(baseline,loaders["val"],device)
        baseline_metrics = metrics(labels,logits)
        report["baseline_validation"] = baseline_metrics
    except Exception as exc:
        report["baseline_error"] = f"{type(exc).__name__}: {exc}"
        baseline = None
    if args.evaluate_only:
        if baseline is not None:
            labels, logits = collect(baseline,loaders["test"],device)
            report["baseline_test"] = metrics(labels,logits)
        (args.out/"evaluation.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
        return
    candidate = build_model(pretrained=True).to(device)
    for name, parameter in candidate.named_parameters():
        parameter.requires_grad = name.startswith(("layer4.","fc."))
    counts = frame.loc[frame.split=="train","label"].value_counts()
    weights = torch.tensor([1/counts[0],1/counts[1]],dtype=torch.float32,device=device)
    criterion = nn.CrossEntropyLoss(weight=weights/weights.mean())
    optimizer = torch.optim.AdamW(filter(lambda p:p.requires_grad,candidate.parameters()), lr=1e-4,weight_decay=1e-4)
    best, best_score, stale = None, -1., 0
    for epoch in range(args.epochs):
        candidate.eval() # Frozen backbone batchnorm statistics stay fixed.
        candidate.layer4.train(); candidate.fc.train()
        for images, labels in loaders["train"]:
            optimizer.zero_grad()
            loss = criterion(candidate(images.to(device)),labels.to(device))
            loss.backward(); optimizer.step()
        labels, logits = collect(candidate,loaders["val"],device)
        measured = metrics(labels,logits)
        report["epochs"].append({"epoch":epoch+1,**measured})
        print(json.dumps(report["epochs"][-1]),flush=True)
        if measured["balanced_accuracy"] > best_score:
            best, best_score, stale = copy.deepcopy(candidate.state_dict()), measured["balanced_accuracy"], 0
        else: stale += 1
        if stale >= 3: break
    candidate.load_state_dict(best)
    # Preserve the best research candidate even if it fails the promotion gate.
    torch.save(candidate.state_dict(),args.out/"candidate-research.pth")
    labels, logits = collect(candidate,loaders["val"],device)
    candidate_metrics = metrics(labels,logits)
    promote = baseline_metrics is None or (
        candidate_metrics["balanced_accuracy"] > baseline_metrics["balanced_accuracy"] and
        candidate_metrics["sensitivity"] >= baseline_metrics["sensitivity"])
    # Model selection is frozen here, before consulting test data.
    selected = candidate if promote else baseline
    labels, logits = collect(selected,loaders["val"],device)
    temperature = calibrate(logits,labels)
    report.update({"candidate_validation":candidate_metrics, "selected":"candidate" if promote else "baseline",
        "temperature":temperature,"calibrated_validation":metrics(labels,logits,temperature)})
    labels, logits = collect(selected,loaders["test"],device)
    report["selected_test"] = metrics(labels,logits,temperature)
    if not promote:
        report["deployment_blocked"] = "Legacy baseline retained for evaluation only: unknown provenance and historic Normal class semantics"
        (args.out/"evaluation.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
        return
    selected.cpu().eval()
    torch.save(selected.state_dict(),args.out/"candidate.pth")
    onnx_path = args.out/"pneumonia_model.onnx"
    torch.onnx.export(selected,torch.zeros(1,3,224,224),str(onnx_path),input_names=["image"],output_names=["logits"],
                      opset_version=17,dynamo=False)
    import onnxruntime as ort
    session = ort.InferenceSession(str(onnx_path),providers=["CPUExecutionProvider"])
    max_error = 0.
    for row in frame[frame.split=="val"].head(8).to_dict("records"):
        from app.predict import preprocess_image
        array = preprocess_image(Path(row["path"]).read_bytes())
        with torch.inference_mode(): expected = selected(torch.from_numpy(array)).numpy()
        actual = session.run(None,{"image":array})[0]
        max_error = max(max_error,float(np.max(np.abs(actual-expected))))
    if max_error > 1e-4: raise RuntimeError(f"ONNX parity failed: {max_error}")
    report["onnx_max_absolute_error"] = max_error
    version = "nih-resnet18-" + report["manifest_sha256"][:12]
    metadata = {"validated":True,"version":version,"classes":CLASSES,"temperature":temperature,
        "calibrated":True,"sha256":hashlib.sha256(onnx_path.read_bytes()).hexdigest(),
        "manifest_sha256":report["manifest_sha256"],"test_metrics":report["selected_test"],
        "limitations":"NIH report-derived labels. No Finding is not confirmed healthy. Educational screening only."}
    onnx_path.with_suffix(".json").write_text(json.dumps(metadata,indent=2),encoding="utf-8")
    (args.out/"evaluation.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    print(f"Validated artifacts exported to {args.out}; run benchmark_inference.py before deployment.")

if __name__ == "__main__": main()

