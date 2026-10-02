# Data and model

For the dataset card, saved cohort breakdown, and full download-to-training procedure, see [Dataset and reproducible procedure](dataset-and-procedure.md).

## Dataset provenance

The intended source is the official NIH Clinical Center ChestX-ray14 release: [NIH ChestX-ray14 on Box](https://nihcc.app.box.com/v/ChestXray-NIHCC). The dataset contains frontal chest radiographs and labels mined from associated reports. Those labels are weak labels and may be incomplete or incorrect. Review the NIH release documentation and terms before redistribution.

`download_nih.py` downloads the metadata, official train/validation and test lists, release README, download-list script, and image archives directly from NIH's Box release. It records source URLs and SHA-256 hashes in `data/raw/provenance.json`, extracts regular files only, enforces path and size checks, and does not execute the downloaded NIH helper script.

```powershell
cd 'AOML Deploy/backend'
.\.venv\Scripts\python.exe download_nih.py --archives 1
# Full release (large download and substantial local storage):
.\.venv\Scripts\python.exe download_nih.py --archives 12
.\.venv\Scripts\python.exe clean_nih.py
```

Use a full download for a complete cohort. One archive is only a partial sample and may not contain enough positive examples for every split. Raw data and row-level manifests are ignored by Git and must not be added to a deployment.

The complete release requires tens of gigabytes of storage once downloaded and extracted. After training and evaluation, raw archives and images can be deleted to reclaim space, but reproducing cleaning, EDA, or training will then require downloading them again.

## Cleaning and EDA

`clean_nih.py` reads the NIH metadata and official split lists, then:

1. Joins metadata to local PNG images and excludes missing, ambiguous, duplicate-metadata, malformed, and out-of-scope records.
2. Decodes each image, checks its dimensions, and records width, height, image mode, mean grayscale brightness, age, sex, and view position. Unusual but valid images receive a review flag.
3. Computes SHA-256 and perceptual hashes. Exact and close perceptual duplicates are grouped; conflicting duplicate labels are excluded, and test copies are preferred so development duplicates cannot leak across partitions.
4. Assigns the official test partition and creates a seeded, patient-level stratified validation partition from development patients.
5. Writes `manifest.csv`, `exclusions.csv`, `cleaning.json`, EDA plots, `eda.html`, and `eda.ipynb` under `data/processed`.

The binary scope is deliberately narrow: Pneumonia labels are positive; exact “No Finding” records are comparison negatives; records with other findings and no pneumonia are excluded. “No Finding” means no label was reported in the dataset, not that the patient was healthy.

## Reproducibility limitation in the current model snapshot

The aggregate `data/processed/cleaning.json` committed with the serving model reports 112,120 images found and 61,792 cohort images from 25,052 patients (1,431 pneumonia examples). It also contains a note that the model cohort came from a fast pass that skipped exhaustive decoding, checksums, and near-duplicate scans. The current `clean_nih.py` implements those checks, but the raw images and patient-level manifest have been removed/omitted. Therefore, the current model's exact training cohort cannot be independently re-audited from this repository alone.

For a fully reproducible future run, download the official source again, rerun cleaning with the current script, archive the generated provenance and manifest privately for the research record, compare the new manifest hash and counts with the model metadata, then train and evaluate against those exact files. Do not describe the shipped aggregate report as an exhaustive integrity audit.

## Training

`train.py` performs transfer learning with pretrained ResNet18. It freezes the earlier backbone, trains `layer4` and the final classifier, uses inverse-frequency class-weighted cross-entropy, a small rotation augmentation, AdamW, fixed seeds, deterministic PyTorch operations, and early stopping based on validation balanced accuracy. Batch size, epoch count, seed, manifest, output path, and baseline checkpoint are configurable.

```powershell
cd 'AOML Deploy/backend'
.\.venv\Scripts\python.exe train.py --epochs 10 --batch-size 128 --seed 42
```

The command needs a cleaned manifest and image files at their recorded paths. On a GPU machine, PyTorch selects CUDA automatically; otherwise it runs on CPU. The default comparison checkpoint path is `models/pneumonia_model.pth`; pass `--baseline PATH` to select another local checkpoint. If no usable baseline is present, the candidate can still be trained, but the baseline comparison and validation gate are unavailable. When present, the baseline is loaded with `weights_only=True`; its provenance is unknown, so historical overlap cannot be excluded. It is a comparison only, not a safe inference fallback.

Install `requirements-dev.lock.txt` in the backend virtual environment before cleaning or training; the serving lock intentionally omits PyTorch, pandas, plotting, and other research dependencies.

Selection is made using validation balanced accuracy, with the candidate required not to reduce validation sensitivity relative to a usable baseline. Temperature scaling is fit using validation data only. The selected model is then measured on the held-out test split. The test split must not be used to tune the model or choose a threshold.

The output includes `evaluation.json`, candidate checkpoints, an ONNX export, and a JSON metadata sidecar. The exporter checks PyTorch/ONNX logit parity on eight validation images. Promote an artifact only after reviewing the evaluation and parity, then install the ONNX and sidecar together in `models/`.

## Serving model and recorded evaluation

The API serves ONNX Runtime CPU inference only. Model load requires:

- A sibling JSON metadata file with `validated: true`, supported classes, version, and calibration temperature.
- A SHA-256 checksum match between the ONNX file and sidecar.
- Successful ONNX Runtime session creation.

Current model version: `nih-resnet18-15aada8cb8ca`. Current selected-test metrics:

| Metric | Candidate |
|---|---:|
| Sensitivity (recall) | 75.1% |
| Specificity | 58.2% |
| Precision | 9.2% |
| F1 | 16.4% |
| Balanced accuracy | 66.7% |
| ROC-AUC | 0.731 |

The confusion matrix in row-major order `[[TN, FP], [FN, TP]]` is `[[5740, 4121], [138, 417]]`. Low precision reflects the class imbalance and operating point: many positive model calls were not positive in this report-derived test label set.

The legacy baseline on the same recorded test split had 60.7% balanced accuracy, 81.8% sensitivity, 39.6% specificity, 7.1% precision, 13.0% F1, and 0.661 ROC-AUC. The candidate raises balanced accuracy and specificity but lowers sensitivity by 6.7 percentage points. That tradeoff is material.

The model first chooses a class at probability 0.5, after validation-fitted temperature scaling. If the maximum class score is below 0.8, the user-facing finding is `Uncertain`. “Calibrated” means a temperature parameter was fit on the project's validation split; it does not mean calibration or clinical utility has been established in a new population.

## Known limitations

- NIH labels are report-derived, not independent expert image adjudications.
- Class imbalance is substantial; precision and metrics depend on prevalence and threshold.
- The cohort's fast-pass provenance limits independent reproducibility of this exact model.
- The data do not establish generalization to other hospitals, machines, populations, or image types.
- The code does not establish that an uploaded image is a chest X-ray.
- This is a research/educational demo, not a medical device or clinical decision support system.

Primary paper: Wang X, Peng Y, Lu L, Lu Z, Bagheri M, Summers RM. “ChestX-ray8: Hospital-scale Chest X-ray Database and Benchmarks on Weakly-Supervised Classification and Localization of Common Thorax Diseases.” CVPR 2017, pp. 3462–3471. [Paper](https://arxiv.org/abs/1705.02315).
