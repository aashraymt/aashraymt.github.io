---
title: "Detection Engineering"
description: "The defensive half of my work: finding the telemetry a technique leaves behind and writing a rule that catches it without burying analysts in noise."
kind: index
category: "Detection Engineering"
tags: [detection, writeup]
order: 40
status: in-progress
source: repo
---

<div class="callout info">

In progress. One lab writeup so far, with more on the way.

</div>

These pages are about the defensive half of my work: taking a technique, finding the telemetry it leaves behind, and writing a rule that fires on the attack without burying analysts in noise.

Each page ends with an "Attacker's perspective and evasion" section. I like breaking things first and then building the detection that catches it, so every rule gets the same question: how would I get around this, and what does that mean for the rule?

| Page | Platform | What it covers |
|---|---|---|
| [Multi-cloud log pipeline: CloudTrail to Elastic](/writeups/detection-engineering/multi-cloud-log-pipeline/) | Personal lab, built during the MCBTA certification | CloudTrail to S3 to SQS to Filebeat to Elastic, why the queue sits in the middle, and what I would alert on first |

For the detection work I did during my internship, see the [Vertiv experience page](/experience/vertiv/).
