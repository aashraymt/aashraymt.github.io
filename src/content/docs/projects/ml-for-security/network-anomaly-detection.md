---
title: "Network Anomaly Detection"
description: "A multi-class Random Forest that labels network connections as normal or as one of four attack categories, trained on NSL-KDD."
kind: project
tags: [detection, machine-learning, project]
order: 10
status: published
source: repo
---

A multi-class Random Forest that labels network connections as normal or as one of four attack categories, trained on NSL-KDD. I built it to understand how a defensive ML model decides what is normal, and where its blind spots are.

## Why

I think understanding defensive mechanisms is part of getting good at offense. Modern perimeters lean on machine learning to flag intrusions, so if you want to find the gaps in one, you need to know how it thinks: how a baseline of normal traffic is built, and where the confidence scoring goes soft.

Building a Random Forest detector from scratch gave me that white-box view. This page is as much about the limits of the approach as about the model itself.

The code is on GitHub: [github.com/aashraymt/network-anomaly-detection](https://github.com/aashraymt/network-anomaly-detection)

## The honest caveat, up front

NSL-KDD is an easy benchmark. It is a cleaned-up version of a 1999 dataset, and models score very high on it with little effort. The 99.49% accuracy below is on a held-out split of the same training data (the `KDD+` file), not on the harder, separately distributed `KDDTest+` set that is meant to contain novel attacks. So read 99.49% as "the model learned this dataset well," not as "this would catch real intrusions." On the rare classes the numbers already show the strain: the Privilege class gets 0.24 recall on the test split.

## Concept: Random Forests for anomaly detection

A Random Forest builds many decision trees and aggregates their votes instead of trusting one tree. Three ideas drive it:

* **Bootstrapping:** each tree trains on a random subset of the data sampled with replacement, so the trees see different slices.
* **Feature subsets at each split:** a node considers only a random subset of features, which keeps the trees from all keying on the same dominant feature.
* **Aggregation:** for classification the forest takes the majority vote across trees.

$$
\hat{y} = \text{mode}\{h_1(x), h_2(x), \dots, h_B(x)\}
$$

The anomaly-detection angle is that traffic which does not fit the pathways the trees learned, or that produces high disagreement between trees, is the traffic worth flagging. A low proportion of trees voting "normal" is a low confidence score, and that is your alert signal.

## The NSL-KDD dataset

NSL-KDD refines the KDD Cup 1999 data by removing duplicate records and rebalancing classes. Each connection has 41 features plus an attack label and a difficulty level. The features fall into groups:

| Feature category | Examples | What they describe |
|---|---|---|
| Basic | `duration`, `protocol_type`, `src_bytes`, `dst_bytes` | Attributes of a single connection. |
| Content | `hot`, `num_failed_logins`, `logged_in`, `num_compromised` | Payload-derived signals, like repeated failed logins. |
| Traffic | `count`, `srv_count`, `serror_rate`, `same_srv_rate` | Statistics over a time window to the same host or service. |
| Labels | `attack`, `level` | The target: normal, or an attack type. |

Getting and labeling the data:

```python
import requests, zipfile, io

url = "https://academy.hackthebox.com/storage/modules/292/KDD_dataset.zip"
response = requests.get(url)
z = zipfile.ZipFile(io.BytesIO(response.content))
z.extractall('.')
```

The raw file has no header, so the 43 columns are mapped explicitly before anything else.

<p>The labeled NSL-KDD dataframe.</p>

## Training

The attack labels are grouped into five classes (Normal, DoS, Probe, Privilege, Access) and the forest is trained for multi-class classification. The `random_state` is fixed so the run reproduces.

```python
from sklearn.ensemble import RandomForestClassifier

rf_model_multi = RandomForestClassifier(random_state=1337)
rf_model_multi.fit(multi_train_X, multi_train_y)
```

Evaluation uses accuracy, precision, recall, and F1, plus a confusion matrix so I can see which classes get mixed up (a Probe read as Normal, for instance) rather than trusting one headline number.

```python
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, classification_report, confusion_matrix

test_multi_predictions = rf_model_multi.predict(test_X)
print(f"Accuracy: {accuracy_score(test_y, test_multi_predictions):.4f}")
print(classification_report(test_y, test_multi_predictions, target_names=['Normal','DoS','Probe','Privilege','Access']))
```

## Results and evidence

On the held-out split:

```
Test Set Evaluation:
Accuracy: 0.9949
Precision: 0.9947
Recall: 0.9949
F1-Score: 0.9947

              precision    recall  f1-score   support
      Normal       0.99      1.00      1.00     15402
         DoS       1.00      1.00      1.00     10721
       Probe       0.99      1.00      1.00      2796
   Privilege       0.62      0.24      0.34        21
      Access       0.96      0.92      0.94       764
```

<p>Confusion matrix for the test split.</p>

The two big classes (Normal, DoS) are essentially solved. The Privilege class, with 21 examples in the split, is where the model falls apart: 0.24 recall means it misses three out of four. That gap between the headline accuracy and the rare-class recall is the whole point. A detector that scores 99% but misses the privilege-escalation attempts is missing the attacks you most want to catch, and a single accuracy number hides that.

The model serializes to a `.joblib` file. As part of the HTB Academy module this came from, the saved model is submitted to an evaluation portal running on a lab VM, which scores it against a hidden holdout and returns a token on success.

## What I'd do next

Evaluate against `KDDTest+`, the split that holds attack types absent from training, and watch the accuracy fall. That number would be the honest one. I would also resample or reweight the rare classes so the Privilege recall is not a rounding error.
