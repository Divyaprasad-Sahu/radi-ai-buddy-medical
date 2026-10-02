"""Regenerate report presentation from an existing cleaned manifest."""
import json
from pathlib import Path
import pandas as pd
from clean_nih import report

out = Path("data/processed")
frame = pd.read_csv(out / "manifest.csv")
info = json.loads((out / "cleaning.json").read_text())
metadata = pd.read_csv("data/raw/Data_Entry_2017_v2020.csv")
info["clean_patients"] = int(frame.patient.nunique())
info["metadata_label_counts"] = metadata["Finding Labels"].str.split("|").explode().value_counts().to_dict()
info["split_counts"] = {f"{split}:{label}": int(count) for (split,label),count in frame.groupby(["split","label"]).size().items()}
(out / "cleaning.json").write_text(json.dumps(info,indent=2),encoding="utf-8")
report(frame, info, out)
