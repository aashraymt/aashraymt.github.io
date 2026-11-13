---
title: "RiskRank"
description: "RiskRank is my team's senior design (capstone) project at the University of Cincinnati."
kind: project
tags: [vulnerability-management, project]
order: 30
status: in-progress
source: repo
---

RiskRank is my team's senior design (capstone) project at the University of Cincinnati. It prioritizes vulnerabilities by combining CVSS, EPSS, and the CISA Known Exploited Vulnerabilities (KEV) catalog. It is in progress, not finished.

## Why we are building it

A CVSS score says how bad a vulnerability could be. It does not say how likely anyone is to exploit it. A team that sorts its backlog by CVSS alone ends up with a long list of "critical" items and no good reason to pick one over another.

The three inputs answer different questions:

* **CVSS:** how severe is this if it is exploited?
* **EPSS:** how likely is exploitation in the near term, as a probability?
* **CISA KEV:** is it already being exploited in the wild?

RiskRank puts the three together so the list a team works from reflects both impact and likelihood.

## Where it stands

The repository is private while the project is ongoing, so there is no link here yet.
