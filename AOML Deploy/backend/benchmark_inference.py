"""Measure deployment runtime separately from the heavy training process."""
import argparse
import json
import os
from pathlib import Path
import time

parser = argparse.ArgumentParser()
parser.add_argument("--model", type=Path, required=True)
parser.add_argument("--image", type=Path, required=True)
parser.add_argument("--requests", type=int, default=100)
args = parser.parse_args()
os.environ["MODEL_PATH"] = str(args.model.resolve())
from app.predict import predict_from_image_bytes
import psutil
process = psutil.Process()
peak = 0
times = []
image = args.image.read_bytes()
for _ in range(args.requests):
    started = time.perf_counter()
    predict_from_image_bytes(image)
    times.append(time.perf_counter()-started)
    peak = max(peak, process.memory_info().rss)
result = {"requests": args.requests, "peak_sampled_rss_mb": peak/1024**2,
    "mean_seconds": sum(times)/len(times), "fits_384mb_budget": peak < 384*1024**2,
    "limitation": "Sampled inference RSS only; confirm full API process memory on Render Linux."}
print(json.dumps(result, indent=2))
if not result["fits_384mb_budget"]:
    raise SystemExit(1)
