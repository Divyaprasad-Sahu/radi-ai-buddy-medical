import shutil
import numpy as np
import pandas as pd
from PIL import Image
from clean_nih import clean, HashTree
from train import validate_manifest, metrics, calibrate

def test_hash_nearby():
    tree=HashTree();tree.add(0,0);tree.add(255,1)
    assert list(tree.nearby(1))==[0]

def test_clean_reproducible_patient_safe(tmp_path):
    raw=tmp_path/"raw";raw.mkdir()
    images=raw/"images";images.mkdir()
    rng=np.random.default_rng(42)
    records=[];train=[];test=[]
    for index in range(30):
        name=f"{index:08d}_000.png"
        Image.fromarray(rng.integers(0,255,(224,224),dtype=np.uint8)).save(images/name)
        records.append({"Image Index":name,"Patient ID":index,"Finding Labels":"Pneumonia" if index%2 else "No Finding",
            "Patient Age":30,"Patient Gender":"M","View Position":"PA"})
        (test if index>=24 else train).append(name)
    duplicate="duplicate.png";shutil.copyfile(images/train[0],images/duplicate)
    records.append({**records[0],"Image Index":duplicate});train.append(duplicate)
    corrupt="corrupt.png";(images/corrupt).write_bytes(b"bad")
    records.append({**records[1],"Image Index":corrupt});train.append(corrupt)
    pd.DataFrame(records).to_csv(raw/"Data_Entry_2017_v2020.csv",index=False)
    (raw/"train_val_list.txt").write_text("\n".join(train))
    (raw/"test_list.txt").write_text("\n".join(test))
    first,info=clean(raw,tmp_path/"first")
    second,_=clean(raw,tmp_path/"second")
    assert first[["image","split"]].equals(second[["image","split"]])
    assert info["excluded"]["exact_or_near_duplicate"]==1
    assert info["excluded"]["corrupt_or_oversized_image"]==1
    validate_manifest(first)
    assert (tmp_path/"first/eda.html").exists()

def test_metrics_and_calibration():
    labels=np.array([0,0,1,1]);logits=np.array([[4.,0],[3.,0],[0,3.],[0,4.]])
    result=metrics(labels,logits)
    assert result["sensitivity"]==1 and result["specificity"]==1
    assert .05<=calibrate(logits,labels)<=20
