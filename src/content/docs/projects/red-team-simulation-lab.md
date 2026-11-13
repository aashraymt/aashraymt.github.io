---
title: "Red Team Simulation Lab"
description: "An attack path from an internet-facing web server to full compromise of a two-domain Active Directory forest, done in an isolated lab between Sep and Dec 2025."
kind: project
tags: [red-team, project]
order: 40
status: published
source: repo
---

An attack path from an internet-facing web server to full compromise of a two-domain Active Directory forest, done in an isolated lab between Sep and Dec 2025. The second half of this page is the part I care about more now: what a defender could have seen at each step.

## Why I built it

Most of my practice before this was single machines. Real intrusions are chains: a web bug gets a foothold, the foothold gives credentials, the credentials open the internal network. I wanted to run a whole chain once, across a network boundary and a domain trust, so I understood how each step sets up the next one.

Everything here ran in a controlled lab. Nothing on this page was done against a system I did not have permission to test.

## What I built

Three zones: an external Linux web server, an internal network that is not reachable from outside, and an Active Directory forest with a child domain and a parent domain.

```
  internet
     |
     v
  [ web server ]  --- command injection ---> read a sensitive file
     |  recovered credentials
     v
  [ Linux host ] --- SSH, then browser artifacts ---> more credentials
     |  Ligolo-ng tunnel
     v
  == internal network ==
     |
     v
  [ child domain controller ] --- credential spraying, LSA secrets
     |  KRBTGT hash -> forged ticket
     v
  [ parent domain controller ] ---> forest compromise
```

## The attack chain

1. **Recon.** Nmap against the external host to find the exposed web service.
2. **Initial access.** A command injection bug in the web application let me run commands on the server and read a file I should not have been able to read.
3. **Credential recovery.** That file held credentials, which worked for SSH onto the perimeter Linux host.
4. **More credentials.** On that host I went through browser artifacts (saved logins in a Firefox profile, read with SQLite) and recovered another set of credentials.
5. **Pivot.** The internal network was not routable from where I started, so I set up a tunnel with Ligolo-ng and enumerated the internal hosts through it.
6. **Internal privilege escalation.** CrackMapExec for credential spraying across the internal hosts, then dumping LSA secrets to pick up new credentials.
7. **Child domain.** Those credentials got me onto the child domain controller.
8. **Forging access.** I pulled the KRBTGT hash from the child DC and used it to forge a Kerberos Golden Ticket.
9. **Forest compromise.** The ticket let me move to the parent domain controller and dump the domain administrator credentials, which is full control of the forest.

Tools: Nmap, Burp Suite, Ligolo-ng, CrackMapExec, the Impacket suite (secretsdump, ticketer, psexec, getST, lookupsid), and SQLite for the browser artifacts. All hashes, tickets, and passwords from the lab are left out of this writeup on purpose; where a step used one, read it as `<redacted>`.

## Detection opportunities

I did not build detections during this lab. This section is my own after-the-fact analysis of where each step would leave a trace and what a defender should look for. I wrote it to make myself think from the blue side, which is the direction I actually want to work in.

| Stage | ATT&CK technique | What a defender would look for |
|---|---|---|
| Nmap recon | Active Scanning (T1595), Network Service Discovery (T1046) | A single external source touching many ports or hosts in a short window, in web server and firewall connection logs. |
| Web command injection | Exploit Public-Facing Application (T1190), Command and Scripting Interpreter: Unix Shell (T1059.004) | Web server or WAF logs showing shell metacharacters in parameters, and the web service process spawning a shell as a child. |
| Reading a sensitive file | Data from Local System (T1005) | The web service user reading files outside the web root, if file access auditing is on. |
| SSH with recovered creds | Valid Accounts (T1078), Remote Services: SSH (T1021.004) | A successful SSH login for an account that normally does not log in that way, or from the web host itself. |
| Browser artifact theft | Credentials from Password Stores: Credentials from Web Browsers (T1555.003) | A non-browser process opening the Firefox profile or its SQLite credential databases. |
| Ligolo-ng pivot | Protocol Tunneling (T1572), Proxy (T1090) | A long-lived outbound tunnel from a server that should not initiate one, and internal traffic arriving from an unexpected source host. |
| Credential spraying | Brute Force: Password Spraying (T1110.003) | Many failed logons for different accounts from one source in a short time (Windows Event ID 4625 clustered by source). |
| LSA secrets dump | OS Credential Dumping: LSA Secrets (T1003.004) | Suspicious access to the SECURITY registry hive or LSASS, which EDR flags. |
| Golden Ticket | Steal or Forge Kerberos Tickets: Golden Ticket (T1558.001) | Kerberos tickets with anomalous lifetimes, and TGS requests with no matching prior AS request. |
| Lateral movement to the parent DC | Remote Services: SMB/Windows Admin Shares (T1021.002), Lateral Tool Transfer (T1570) | Remote service creation and admin-share writes between domain controllers (Event IDs 7045 and 5145). |
| Domain credential dump on the DC | OS Credential Dumping: DCSync (T1003.006) or NTDS (T1003.003) | Replication requests from a host that is not a domain controller, which is the classic DCSync tell. |

The theme across the chain is that each step is quiet on its own but loud in sequence. Password spraying plus an LSA dump plus replication traffic from a non-DC, close together, is the story.

## What I'd do next

Rebuild the same chain with logging turned on (Sysmon on the Windows hosts, a SIEM collecting it) and actually write the detections above, then see which of my own steps I can catch. That turns this from an offensive walkthrough into the purple-team loop I am aiming for.

Repo: [github.com/aashraymt/Red-Teaming-Simulation](https://github.com/aashraymt/Red-Teaming-Simulation)
