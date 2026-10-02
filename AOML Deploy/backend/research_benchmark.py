"""Isolated ONNX benchmark, no clinical predictions or serving bypass."""
import json,time
from pathlib import Path
import onnxruntime as ort
import psutil
from app.predict import preprocess_image
root=Path(__file__).resolve().parent
options=ort.SessionOptions();options.intra_op_num_threads=1;options.inter_op_num_threads=1
session=ort.InferenceSession(str(root/'artifacts/legacy-research.onnx'),sess_options=options,providers=['CPUExecutionProvider'])
array=preprocess_image((root/'data/raw/images/00000001_000.png').read_bytes())
process=psutil.Process();peak=0;times=[]
for _ in range(100):
 started=time.perf_counter();session.run(None,{'image':array});times.append(time.perf_counter()-started);peak=max(peak,process.memory_info().rss)
result={'requests':100,'peak_sampled_rss_mb':peak/1024**2,'mean_seconds':sum(times)/len(times),'fits_384mb_budget':peak<384*1024**2,'model':'legacy-research-only','limitation':'Windows ONNX-only sampled RSS; excludes FastAPI/Groq and Linux hosting. Model is not validated for deployment.'}
(root/'artifacts/research-memory.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))
