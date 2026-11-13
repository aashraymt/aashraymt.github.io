---
title: "Multi-Cloud Detection Lab"
description: "A central SIEM that pulls logs out of AWS, Azure, and GCP into one Elastic Stack, with TheHive for case management."
kind: project
tags: [cloud, detection, project]
order: 50
status: published
source: repo
---

A central SIEM that pulls logs out of AWS, Azure, and GCP into one Elastic Stack, with TheHive for case management. I built it between Jul and Aug 2025 while working through the Multi-Cloud Blue Team Analyst (MCBTA) certification.

## Why I built it

Teams rarely live in one cloud. When an incident spans AWS and Azure, the logs sit in two different consoles with two different schemas, and nobody wants to pivot between tabs mid-investigation. The point of this lab was to get all three providers landing in one place I could query, and to run investigations the way an analyst actually would: alert, triage, case.

## What I built

An ELK stack on a cloud instance, fed by Filebeat, with each cloud provider wired in as a log source, and TheHive sitting on top for case tracking.

```
  AWS CloudTrail --> S3 bucket --> SQS queue --> Filebeat --+
  Azure logs ----------------------------------------------+--> Elasticsearch --> Kibana
  GCP logs ------------------------------------------------+        |
                                                                    v
                                                                 TheHive (cases)
```

The AWS path is the one I built out most fully:

1. **CloudTrail** records the account's API activity and writes it to a private **S3** bucket.
2. The S3 bucket sends an event notification to an **SQS** queue every time a new log object lands. SQS decouples the producer from the consumer so nothing is lost if the reader is busy.
3. **Filebeat**, running on the monitoring instance with its AWS module enabled, reads from the SQS queue and ships the logs into **Elasticsearch**.
4. **Kibana** is where I queried and visualized them.

Azure and GCP came in as their own modules into the same stack, so AWS, Azure, and GCP logs could be correlated side by side.

I stood up the stack itself on an EC2 instance: installed Elasticsearch and Kibana from the Elastic apt repository, configured `elasticsearch.yml` and `kibana.yml`, opened the service ports, and installed Filebeat from the Elastic package.

## Technical highlights

**S3 to SQS wiring.** The piece that is easy to get wrong is the SQS access policy. S3 can only drop messages on the queue if the queue policy allows `SQS:SendMessage` from that bucket, scoped by source account and source ARN. Get that wrong and logs silently never arrive, which is its own lesson about log-source health.

**Why a queue at all.** I could have pointed Filebeat straight at the bucket. The queue means log delivery survives a slow or restarted reader, and it is how the managed pipeline is meant to be built.

**TheHive for investigations.** Rather than just staring at Kibana, I ran the detections through TheHive as cases, correlating the artifacts from a scenario (IPs, accounts, actions) in one place. That is closer to how a SOC works than ad-hoc querying.

## Results and evidence

Against the MCBTA material I worked through 15+ simulated cloud breach scenarios (lateral movement, privilege escalation, data exfiltration patterns) using TheHive, and 30+ hands-on log-analysis challenges across the three providers. I earned the MCBTA certification at the end.

What this proves: I can stand up a multi-cloud logging pipeline, wire native cloud log sources into it, and run investigations across it. What it does not prove: these were provided scenarios in a training environment, not live detections I authored against production traffic.

Repo: [github.com/aashraymt/SIEM-Log-Analysis-Threat-Detection-Lab](https://github.com/aashraymt/SIEM-Log-Analysis-Threat-Detection-Lab)

## What I'd do next

Write my own detection rules on top of the ingested logs instead of working through provided scenarios, and add a log-source health check so a broken pipeline (like a misconfigured SQS policy) shows up as an alert rather than as silence.
