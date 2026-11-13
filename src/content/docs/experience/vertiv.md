---
title: "Vertiv: IT Security Intern"
description: "Vertiv Co., Westerville, OH. May 2026 to Aug 2026. I worked on the security engineering team within Global Security Operations."
kind: page
tags: [internship, experience]
order: 10
status: published
source: repo
---

**Vertiv Co., Westerville, OH. May 2026 to Aug 2026.** I worked on the security engineering team within Global Security Operations.

<div class="callout info">

Everything on this page is described at technique level. Internal systems, people, and rule text are left out on purpose.

</div>

## What I did

Most of my summer was detection engineering in Google SecOps, writing and tuning YARA-L 2.0 rules on Microsoft Defender for Endpoint telemetry. The rest was split between a pentest, a triage automation project, and shadowing the SOC.

* **Tuned a noisy detection.** An encoded-PowerShell rule (T1059.001) was producing about 3,794 alerts in 3 days, roughly 1,265 a day. I traced most of that to legitimate IT automation, isolated it, and got the rule down to about 7 alerts a day.
* **Wrote a named pipe impersonation detection (T1134.001).** I reproduced the technique on an isolated Windows host, worked out the rule logic from what Defender for Endpoint recorded, and baselined it against production so it would not fire on admin tooling.
* **Threat-modeled IP-KVM hardware (PiKVM v4, NanoKVM).** USB vendor and product IDs can be changed by whoever controls the device, so a signature on them does not hold up. I validated 3 signals in Google SecOps and shipped behavioral detections on USB-gadget enumeration bursts and removable-media activity.
* **Built a log-source health dashboard.** It sits over a 4 TB/day ingestion pipeline and exposed silent collection failures in 6 log sources. Before that, a gap only showed up when an investigation needed the data.
* **Integrated the 7AI agentic triage platform into Tier 1 triage.** I wrote skill files covering hostname conventions, log-source quirks, and escalation paths so the agent could gather evidence on its own, then fed the blind spots I found back into those files.
* **Pentested a web application and its REST API with a senior engineer.** We combined AI-assisted source code review with manual validation and reported 15+ findings (3 Critical, including RCE and IDOR). I co-authored the report that went to leadership.
* **Triaged alerts alongside SOC analysts:** identity, malicious PowerShell, and endpoint alerts.

## What I took from it

Writing a rule is the quick part. Most of the work is finding out what normal looks like in a real environment, and checking that the logs you are counting on are arriving at all.

## Related writeups

My public detection work is in [Detection Engineering](/writeups/detection-engineering/).
