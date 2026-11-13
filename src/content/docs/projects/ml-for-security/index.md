---
title: "ML for Security"
description: "Three small machine-learning builds I did to understand how defensive models actually work, written up honestly about what each one does and does not prove."
kind: index
tags: [machine-learning, project]
order: 90
status: published
source: repo
---

Three small machine-learning builds I did to understand how defensive models actually work, written up honestly about what each one does and does not prove. I care about this partly from the other direction: if modern perimeters lean on ML to flag intrusions, then knowing where those models are confident and where they are blind is useful to an attacker too.

| Page | Model | Data | Honest caveat |
|---|---|---|---|
| [Network Anomaly Detection](/projects/ml-for-security/network-anomaly-detection/) | Random Forest, multi-class | NSL-KDD | NSL-KDD is an easy benchmark, and the 99.49% is on a held-out split of the training data, not a harder set. |
| [SMS Spam Detector](/projects/ml-for-security/sms-spam-detector/) | Multinomial Naive Bayes | UCI SMS Spam Collection | Small, clean, well-studied dataset. A strong baseline, not a novel result. |
| [Malware Classification](/projects/ml-for-security/malware-classification/) | CNN (ResNet50 transfer learning) | malimg (malware as images) | Classifies images of PE files, never live binaries. 88.83% test accuracy on an imbalanced dataset. |

None of these are production detectors. They are builds I did to learn the mechanics: how a baseline of "normal" is set, where a confidence score comes from, and why a number on a benchmark does not transfer to real traffic.
