---
title: "Writeups"
description: "This is my portfolio of security writeups, grouped by what the work exercises. Two kinds of target show up here, and I keep them clearly labeled."
kind: index
tags: [writeup, security]
order: 50
status: published
source: repo
---

This is my portfolio of security writeups, grouped by what the work exercises. Two kinds of target show up here, and I keep them clearly labeled:

- **Retired Hack The Box machines.** These are training boxes that have been retired. They have official public walkthroughs, and my notes are my own path through them.
- **Labs I built or ran.** These are controlled, isolated environments I set up for practice. I say so on every page.

Each writeup follows the same shape: scope, recon and approach, exploitation, and then a "Detection and mitigation" section where I work backward from the attack and ask what telemetry would have caught it and what control would have stopped it. That last part is after-the-fact analysis, not detections I shipped.

## Categories

- [Web and API security](/writeups/web-and-api-security/): web application and API exploitation, from public-facing RCE to container escape. Retired HTB machines Strutted, MonitorsFour, and Cap.
- [Active Directory](/writeups/active-directory/): Windows domain attacks, from SMB enumeration to full domain and forest compromise. Retired HTB machine EscapeTwo and my own forest-compromise lab.
- [AI and LLM security](/writeups/ai-llm-security/htb-artificial/): attacking machine-learning features on the web layer. Retired HTB machine Artificial.
- Detection engineering: SIEM and detection labs. (Index to come.)
- Binary and firmware: fuzzing and low-level work. (Index to come.)
