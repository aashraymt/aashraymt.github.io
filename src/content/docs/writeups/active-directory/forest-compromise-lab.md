---
title: "Forest compromise lab: external to Domain Admin"
description: "A lab I built myself: web command injection on the perimeter, a Ligolo-ng pivot, and a Golden Ticket from the child domain to the forest root."
kind: writeup
category: "Active Directory"
tags: [active-directory, writeup]
order: 20
status: published
source: repo
---

<div class="callout info">

TL;DR: This is a red team lab I built and ran in an isolated environment. It chains a public-facing web compromise into an internal pivot with Ligolo-ng, credential spraying and LSA secret extraction across the internal network, and a KRBTGT Golden Ticket to jump from a child domain controller to the parent and compromise the whole forest.

</div>

| Category | Difficulty | Platform | Date | Tools | Mapping |
|---|---|---|---|---|---|
| Active Directory, red team | Self-built lab | Personal lab (isolated) | Sep 2025 to Dec 2025 | Kali, Nmap, Burp Suite, Ligolo-ng, CrackMapExec, Impacket (secretsdump, ticketer, getST, psexec, lookupsid), SQLite3, Firefox artifact analysis | Exploit Public-Facing Application (T1190), Command and Scripting Interpreter (T1059), Remote Services: SSH (T1021.004), Credentials from Web Browsers (T1555.003), Protocol Tunneling (T1572), Password Spraying (T1110.003), OS Credential Dumping: LSA Secrets (T1003.004), Steal or Forge Kerberos Tickets: Golden Ticket (T1558.001) |

## Scope and environment

I built this as a self-contained, isolated lab to practice a full external-to-forest attack path. It is not a Hack The Box machine and not anyone else's system. The goal was to walk the whole chain end to end: breach a public-facing host, pivot into a segmented internal network, move laterally through Active Directory, and cross a domain boundary from a child domain to the parent. Everything ran in my own lab, and this writeup keeps to technique and reasoning. There are no real credentials or secrets to redact here because none leave the lab.

The design deliberately exercises segmentation and trust boundaries: a perimeter Linux host, an internal network reachable only through that host, and a two-tier domain (child and parent) inside an Active Directory forest.

## Recon and approach

I started from the outside with service discovery against the external web server, then looked for an application-layer flaw I could drive into code execution. The high-level plan was the standard adversary life cycle: initial access on the perimeter, credential recovery, a pivot into the internal network, lateral movement and privilege escalation in AD, then abuse of a domain trust to reach the forest root.

## Exploitation

### Initial access and perimeter foothold

The external web application was vulnerable to command injection, which I used to read sensitive files on the host and recover credentials. Those credentials gave me SSH access to the perimeter Linux host, turning a web flaw into an interactive foothold.

On the host I enumerated local artifacts for more credentials. Browser artifacts (a Firefox profile) held additional stored credentials, which I recovered by parsing the profile's SQLite databases. This is a common and realistic source of reusable secrets on a workstation-style host.

### Pivot into the internal network

The internal network was not routable from outside, so I set up a tunnel with Ligolo-ng through the compromised perimeter host. That gave my tooling a route into the isolated segment, where I could enumerate Active Directory hosts and users.

### Lateral movement and privilege escalation

With internal reachability, I used CrackMapExec for credential spraying across the internal hosts to find where the recovered credentials were valid and where they granted elevated access. On a host where I gained sufficient privilege, I dumped LSA secrets to recover further credentials. This credential-harvesting loop (spray, land, dump, repeat) is what carried me toward the domain controllers.

### Crossing the domain boundary with a Golden Ticket

I reached the child domain controller and extracted the KRBTGT account hash for the child domain. The KRBTGT hash lets you forge Kerberos ticket-granting tickets (a Golden Ticket) for that domain, with arbitrary group membership and validity. Using Impacket, I forged a Golden Ticket and used it to move laterally to the parent domain controller, then dumped the parent domain Administrator credentials. That gave full control of both the child and parent domains, and with the forest root compromised, the whole forest.

The privilege path was command injection, recovered and sprayed credentials, LSA secrets, and the Golden Ticket forgery.

## Detection and mitigation

This is my after-the-fact defender's read of the same chain. I built the offensive lab; I did not deploy or test these detections.

**Command injection on the web app (Exploit Public-Facing Application, T1190; Command and Scripting Interpreter, T1059).**
- Telemetry: web access and application logs, and host process-creation events showing the web service account spawning a shell.
- Detection would key on: the web server process launching `sh`/`bash` or reading sensitive files, and request parameters containing shell metacharacters.
- Fix: validate and parameterize input, never pass user input to a shell, run the web service as a low-privilege account, and keep secrets off the web host.

**Credentials from files and browser artifacts (Credentials In Files, T1552.001; Credentials from Web Browsers, T1555.003).**
- Telemetry: file access to browser profile databases and to credential-bearing config files by unexpected processes.
- Detection would key on: a non-browser process reading a Firefox profile's `logins.json` or key database, and reads of sensitive config by the web service account.
- Fix: do not store reusable secrets on perimeter hosts, use a password manager that does not expose plaintext at rest, and segment credentials by tier.

**Ligolo-ng pivot (Protocol Tunneling, T1572).**
- Telemetry: NetFlow and host network telemetry showing a long-lived tunnel and traffic from the perimeter host into the internal segment on unusual ports.
- Detection would key on: a perimeter host originating connections to internal hosts it has no business reaching, and tunneling patterns (persistent, multiplexed connections).
- Fix: strict egress and east-west segmentation, so a DMZ host cannot route into internal subnets; monitor for new internal reachability from perimeter systems.

**Credential spraying and LSA secrets (Password Spraying, T1110.003; LSA Secrets, T1003.004).**
- Telemetry: authentication logs (4625/4624) showing one credential across many hosts, and registry/`lsass` access (Security event 4663, Sysmon process access) for LSA secret dumping.
- Detection would key on: one-to-many auth attempts across internal hosts, and tools reading the `SECURITY` registry hive or accessing LSA storage.
- Fix: unique local and service passwords (LAPS for local admin), network segmentation to limit spray blast radius, Credential Guard to protect LSA secrets, and alerting on secret-dumping access patterns.

**KRBTGT Golden Ticket across the trust (Golden Ticket, T1558.001; Valid Accounts, T1078.002).**
- Telemetry: Kerberos logon events (4768/4769) with anomalies such as tickets with excessive lifetimes, missing preceding AS-REQ, or encryption-type mismatches, and TGS requests presenting tickets the DC did not issue.
- Detection would key on: tickets whose properties do not match normal issuance (lifetime, RID/group membership, account that no longer exists), and inter-domain authentications that do not fit normal trust use.
- Fix: protect domain controllers as Tier 0, rotate the KRBTGT password twice if DC compromise is suspected, enforce selective authentication on trusts, and strengthen forest/domain segmentation so a child DC cannot trivially reach the forest root.

## Key takeaways

- One application-layer flaw on the perimeter was enough to start the chain. Everything after it was credential recovery and movement, which is how real intrusions usually unfold.
- Browser artifacts and on-host files were a reliable credential source. Perimeter hosts should not hold reusable secrets.
- The pivot only worked because the internal network was reachable once the perimeter host fell. Proper east-west segmentation would have contained the foothold.
- The forest fell to a KRBTGT Golden Ticket, which is a domain-controller-compromise problem, not a password problem. Protecting Tier 0 and the trust boundary is the control that matters most here.

## References

- MITRE ATT&CK, Steal or Forge Kerberos Tickets: Golden Ticket (T1558.001): https://attack.mitre.org/techniques/T1558/001/
- MITRE ATT&CK, OS Credential Dumping: LSA Secrets (T1003.004): https://attack.mitre.org/techniques/T1003/004/
- MITRE ATT&CK, Protocol Tunneling (T1572): https://attack.mitre.org/techniques/T1572/
- Microsoft, KRBTGT account maintenance and Golden Ticket guidance: https://learn.microsoft.com/en-us/defender-for-identity/
- Repository: https://github.com/aashraymt/Red-Teaming-Simulation
