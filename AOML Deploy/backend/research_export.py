"""Export legacy weights for research parity only. Serving rejects validated=false."""
import hashlib,json
from pathlib import Path
import numpy as np
import pandas as pd
import torch
import onnxruntime as ort
from train import build_model
from app.predict import preprocess_image
root=Path(__file__).resolve().parent
model=build_model().eval()
model.load_state_dict(torch.load(root/'models/pneumonia_model.pth',map_location='cpu',weights_only=True))
torch.set_num_threads(2)
path=root/'artifacts/legacy-research.onnx'
torch.onnx.export(model,torch.zeros(1,3,224,224),str(path),input_names=['image'],output_names=['logits'],opset_version=17,dynamo=False)
session=ort.InferenceSession(str(path),providers=['CPUExecutionProvider'])
maximum=0.
for row in pd.read_csv(root/'data/processed/manifest.csv').query("split=='val'").head(8).to_dict('records'):
 array=preprocess_image(Path(row['path']).read_bytes())
 with torch.inference_mode():expected=model(torch.from_numpy(array)).numpy()
 maximum=max(maximum,float(np.abs(session.run(None,{'image':array})[0]-expected).max()))
if maximum>1e-4:raise RuntimeError('Parity failed')
metadata={'validated':False,'version':'legacy-research-only','sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'onnx_max_absolute_error':maximum,'limitations':'Unknown checkpoint provenance and class semantics. Never deploy.'}
path.with_suffix('.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
print(json.dumps(metadata,indent=2))
