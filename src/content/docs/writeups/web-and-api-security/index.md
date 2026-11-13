---
title: "Web and API security"
description: "Writeups where the way in is the web or API layer. These three are all retired Hack The Box machines with public walkthroughs."
kind: index
category: "Web & API Security"
tags: [web, api, writeup]
order: 10
status: published
source: repo
---

- [HTB Strutted](/writeups/web-and-api-security/htb-strutted/): an Apache Struts2 file-upload RCE (CVE-2024-53677), then a sudo `tcpdump` misconfiguration to root.
- [HTB MonitorsFour](/writeups/web-and-api-security/htb-monitorsfour/): a PHP type-juggling auth bypass into Cacti, RCE (CVE-2025-24367), then a container escape through an exposed Docker Remote API.
- [HTB Cap](/writeups/web-and-api-security/htb-cap/): an IDOR that leaks packet captures, FTP credentials pulled from a `.pcap`, and a Linux capability (`cap_setuid`) for root.
