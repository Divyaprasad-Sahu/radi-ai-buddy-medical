# Dataset and reproducible procedure

This guide records which data the model uses, how the project prepares it, and what is required to repeat the workflow. The pipeline is designed around the official NIH ChestX-ray14 release, downloaded directly from NIH's Box folder. It does not use Kaggle as the download source.

## Dataset card

| Property | Project value |
|---|---|
| Dataset | NIH ChestX-ray14 |
| Source used by the project downloader | [Official NIH Clinical Center Box release](https://nihcc.app.box.com/v/ChestXray-NIHCC) |
| Label origin | Findings extracted from radiology reports; labels can be incomplete or incorrect |
| Task in this project | Binary research classification: Pneumonia-tagged image vs exact “No Finding” comparison image |
| Included cohort in the committed aggregate summary | 61,792 images from 25,052 patients |
| Pneumonia-tagged images | 1,431 |
| “No Finding” comparison images | 60,361 |
| Images present in the recorded release inventory | 112,120 |
| Partitioning | Official NIH test list; development patients split into train and validation using seed 42 |

The class and partition totals below come from the committed aggregate `cleaning.json`. They describe the saved model's recorded cohort, not a newly regenerated manifest.

| Partition | No Finding (label 0) | Pneumonia (label 1) | Total |
|---|---:|---:|---:|
| Train | 40,368 | 701 | 41,069 |
| Validation | 10,132 | 175 | 10,307 |
| Official test | 9,861 | 555 | 10,416 |
| **Total** | **60,361** | **1,431** | **61,792** |

### Label interpretation

- An image is positive if `Pneumonia` is one of its report-derived tags, including records that also carry other findings.
- A negative example is used only when the label is exactly `No Finding`.
- Images with other finding tags and no Pneumonia tag are excluded. They are not silently relabeled as normal.
- “No Finding” is a dataset label; it is not a verified healthy control.

## Provenance and limits of the saved cohort

`download_nih.py` fetches NIH metadata, split lists, release documentation, and image archives from the NIH Box release. It writes a source URL and SHA-256 digest for each downloaded file to `data/raw/provenance.json`.

The committed aggregate cleaning summary names the NIH release as its source, but it also contains a validation note referring to a Kaggle mirror and says the fast pass skipped exhaustive image decoding, checksums, and near-duplicate scans. The model's source-of-truth row-level manifest, raw files, and original download provenance are not in Git. Therefore, the project can reproduce the intended workflow from the official NIH release, but this repository alone cannot prove that the exact saved model cohort was generated from a full, exhaustively verified official download.

This is why the counts and performance figures are identified as recorded research results. To make a future model fully auditable, rerun the procedure below from the official source and keep the new source checksums, cleaned manifest hash, exclusions, and evaluation report together with the candidate model record.

## Reproduce the data preparation

The complete release is large and requires tens of gigabytes after extraction. Confirm available disk space before starting. One archive is useful for a partial smoke test but is not guaranteed to contain both classes in every partition.

From PowerShell:

```powershell
cd 'AOML Deploy/backend'
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.lock.txt
.\.venv\Scripts\python.exe download_nih.py --archives 12
.\.venv\Scripts\python.exe clean_nih.py --seed 42
```

The downloader records checksums, validates archive paths and member types, limits unusually large members, and extracts regular files without executing the NIH helper script. The cleaner expects the NIH metadata CSV, `train_val_list.txt`, `test_list.txt`, and PNG images in `data/raw`.

### Cleaning procedure

For each metadata row, `clean_nih.py`:

1. Checks that the image index, label, patient ID, age, sex, and view fields are available and uses a unique image-index join to local PNG files.
2. Excludes ambiguous duplicate paths, missing images, invalid patient/label metadata, metadata duplicates, records missing an official split, and findings outside the binary task.
3. Decodes the image, rejects corrupt/oversized images, and records dimensions, mode, mean grayscale brightness, SHA-256, perceptual hash, patient ID, age, sex, and view position.
4. Flags unusual brightness, small dimensions, and implausible/missing ages for review without automatically excluding every flagged valid image.
5. Groups exact duplicates by SHA-256 and near duplicates by perceptual-hash Hamming distance. Conflicting duplicate labels are excluded. When a duplicate group spans development and test, the test image is retained and development duplicates are excluded.
6. Keeps the official test partition unchanged. Development records are split by patient into train and validation, stratified on each patient's positive/negative label summary, using the fixed seed.
7. Writes the cleaned manifest, exclusion log, aggregate JSON, EDA charts, HTML report, and notebook to `data/processed`.

The script fails if a patient, exact hash, or duplicate group crosses partitions, or if a required split lacks either class. Re-running with the same input and seed should reproduce the same manifest.

### Cleaning outputs

- `data/processed/manifest.csv`: image path, label, patient, duplicate group, split, metadata, and image measurements. Treat as sensitive research data; do not publish.
- `data/processed/exclusions.csv`: one row per excluded image and exclusion reason.
- `data/processed/cleaning.json`: counts, split totals, missing metadata, exclusions, provenance references, and manifest digest.
- `data/processed/eda.html` and `eda.ipynb`: dataset-specific EDA report/notebook.
- `data/processed/classes.png`, `dimensions.png`, `brightness.png`, `ages.png`, `views.png`, `samples.png`: report figures.

The EDA covers class counts by split, image dimensions, brightness distribution, age distribution, view position, descriptive summary values, and representative image samples. The report should be generated from the actual manifest for each new download, not copied from the current aggregate snapshot.

## Reproduce model training and evaluation

Run from `AOML Deploy/backend` after the full data-cleaning procedure:

```powershell
.\.venv\Scripts\python.exe train.py --manifest data/processed/manifest.csv --out artifacts --epochs 10 --batch-size 128 --seed 42
```

The script validates required manifest columns and patient/hash/duplicate-group separation before training. It fine-tunes pretrained ResNet18's final residual block and classifier, applies class-weighted loss and small random rotations, selects checkpoints using validation balanced accuracy with a sensitivity guard against a usable baseline, and fits temperature scaling using validation data.

The final held-out test evaluation happens after candidate selection is frozen. Do not tune epochs, score thresholds, or hyperparameters against test metrics. Review `artifacts/evaluation.json`, compare the candidate's validation score and sensitivity with the baseline, and retain the entire report as the audit record.

The exported `artifacts/pneumonia_model.onnx` is paired with `artifacts/pneumonia_model.json`. The JSON records the model version, class order, temperature, validation/calibration status, model checksum, manifest checksum, and test metrics. The export process checks PyTorch/ONNX numerical parity on eight validation images. Copy both files together into `models/` to serve them; do not include raw images or the row-level manifest in production.

For the current model metrics and clinical limitations, see [Data and model](data-and-model.md). For the public API behavior, see [API reference](api-reference.md).

## Storage and retention

Raw archives and extracted images are needed for cleaning, EDA, and retraining. They can be deleted after a model is trained and the reports needed for review are saved, reclaiming tens of gigabytes; reproducing those steps later requires downloading the release again. Keep the small aggregate evaluation, model metadata, checksums, source record, and reviewed methodology. Keep patient-level manifests and exclusion lists in an appropriately protected research location, not in the public frontend or Git history.
