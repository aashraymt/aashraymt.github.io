---
title: "HTB Cap"
description: "Cap exposes an IDOR that lets you read other users' packet captures."
kind: writeup
category: "Web & API Security"
tags: [web, api, htb, idor, writeup]
order: 30
status: published
source: repo
---

<div class="callout info">

TL;DR: Cap exposes an IDOR that lets you read other users' packet captures. One capture contains plaintext FTP credentials, those credentials are reused for SSH, and a Linux capability (`cap_setuid` on the Python binary) escalates to root.

</div>

| Category | Difficulty | Platform | Tools | Mapping |
|---|---|---|---|---|
| Web (IDOR), Linux privesc | Easy | Retired HTB machine | Nmap, Wireshark, FTP, SSH, LinPEAS, getcap | Exploit Public-Facing Application (T1190), Credentials In Files (T1552.001), Valid Accounts (T1078), Remote Services: SSH (T1021.004), Abuse Elevation Control: Setuid/Setgid (T1548.001) |

![Hack The Box machine card for Cap, a retired easy Linux machine](/images/writeups/htb-cap/01.png)

## Scope and environment

Cap is a retired HTB Linux machine with a public walkthrough. The target sat at `10.10.10.245`. The whole box is a lesson in access control and credential hygiene rather than any single exploit.

## Recon and approach

A quick Nmap scan showed FTP (21), SSH (22), and HTTP (80) open. I followed up with service and script detection on those ports.

```bash title="recon.sh"
nmap 10.10.10.245
nmap -p21,22,80 -sC -sV -Pn 10.10.10.245
```

![Nmap scan of 10.10.10.245 showing ports 21, 22 and 80 open](/images/writeups/htb-cap/02.png)

![Nmap service and script scan showing OpenSSH 8.2p1 on port 22 and a gunicorn server titled Security Dashboard on port 80](/images/writeups/htb-cap/03.png)

The web app on port 80 is a "Security Dashboard." Clicking "Security Snapshot" redirected to `/data/<id>`, for example `/data/0`. A sequential, user-controlled integer in the URL is the classic tell for an Insecure Direct Object Reference: the app is trusting the ID in the request to decide what you can see.

![Security Dashboard at /data/0 showing packet counts and a Download button](/images/writeups/htb-cap/04.png)

## Exploitation

### IDOR to other users' captures

Incrementing the `/data/<id>` value (`/data/1`, `/data/2`, and so on) returned other users' packet-capture results. There is no ownership check tying the record to the requesting session, so I could enumerate captures that were not mine and download the underlying `.pcap` files.

![Security Dashboard at /data/2 showing a different capture with one packet](/images/writeups/htb-cap/05.png)

### Credentials from the capture

I opened a downloaded `.pcap` in Wireshark and applied the display filter `ftp`. FTP is plaintext, so the login appears in the clear in the capture: a `USER` and a `PASS` command for the account `nathan` (password redacted). This is expected for non-FTPS servers, which is exactly why capturing FTP traffic is worth doing.

### FTP, then SSH reuse

The recovered credentials logged in over FTP. There was little to find there, but the same credentials were reused for SSH, which dropped me into `nathan`'s shell and the user flag.

```bash title="access.sh"
ftp 10.10.10.245
ssh nathan@10.10.10.245
```

![SSH login to 10.10.10.245 as nathan landing at the nathan@cap prompt](/images/writeups/htb-cap/07.png)

![nathan shell listing user.txt, with the flag value redacted](/images/writeups/htb-cap/08.png)

### Privilege escalation through a Linux capability

Enumerating with LinPEAS (or manually) I checked file capabilities.

```bash title="getcap.sh"
getcap -r / 2>/dev/null
```

The Python 3.8 binary carried `cap_setuid+ep`. That capability lets the process call `setuid(0)` and become root without sudo, so a one-liner that sets UID 0 and spawns a shell gave me a root shell. `whoami` returned `root`, and the root flag followed.

![Root shell on cap where whoami returns root and root.txt is read, with flag values redacted](/images/writeups/htb-cap/09.png)

HTB then marked the machine as pwned on my account.

![Hack The Box confirmation that Cap has been pwned, dated 28 Jan 2025](/images/writeups/htb-cap/10.png)

## Detection and mitigation

This is my after-the-fact analysis, not detections I built or tested.

**IDOR on `/data/<id>` (Exploit Public-Facing Application, T1190; Valid Accounts abuse of authorization).**
- Telemetry: web access logs showing one session requesting many sequential `/data/<id>` values, and application logs if they record the authenticated user per object access.
- Detection would key on: a single session walking a sequential ID range, and object accesses where the requesting user does not own the object. Enumeration shows up as a tight burst of incrementing IDs.
- Fix: enforce an authorization check on every object access (does this user own record N?). Use unpredictable identifiers (UUIDs) as a secondary measure, but the real fix is server-side access control, not obscurity.

**Plaintext FTP credentials in a capture (Credentials In Files, T1552.001; Unsecured Credentials).**
- Telemetry: network monitoring can flag cleartext FTP `USER`/`PASS` on the wire; the deeper issue is that capture files containing credentials were readable through the app.
- Detection would key on: cleartext authentication protocols in use at all, and capture artifacts stored where an application can serve them.
- Fix: use FTPS or SFTP so credentials are never sent in the clear, and do not store raw captures in an app-reachable location.

**Credential reuse into SSH (Remote Services: SSH, T1021.004; Valid Accounts, T1078).**
- Telemetry: `sshd` auth logs; a successful password login for `nathan` shortly after the web and FTP activity.
- Detection would key on: the same credential succeeding across FTP and SSH from the same source in a short window.
- Fix: do not reuse a service password for an interactive account, prefer SSH keys, and disable password auth.

**`cap_setuid` on Python (Abuse Elevation Control: Setuid/Setgid, T1548.001).**
- Telemetry: auditd or EDR process telemetry showing `python3.8` calling `setuid(0)` and spawning a shell; a periodic inventory of file capabilities.
- Detection would key on: an interpreter with `cap_setuid` set, and any non-root process transitioning to UID 0 via a capability.
- Fix: remove the capability (`setcap -r /usr/bin/python3.8`). Never grant `cap_setuid` to a general-purpose interpreter; it is equivalent to handing out root.

## Key takeaways

- Sequential IDs in a URL are a prompt to test authorization, not just a cosmetic detail. The vulnerability was the missing ownership check, and the predictable ID only made it faster.
- Plaintext protocols turn a traffic capture into a credential store. FTP's cleartext login is the entire pivot here.
- Credential reuse across FTP and SSH collapsed two services into one foothold.
- A file capability can be a quieter root path than a SUID binary or a sudo rule, and it is easy to miss unless you actively run `getcap`.

## References

- OWASP, Insecure Direct Object Reference prevention cheat sheet: https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html
- Linux manual, capabilities(7): https://man7.org/linux/man-pages/man7/capabilities.7.html
- GTFOBins, Python capabilities: https://gtfobins.github.io/gtfobins/python/#capabilities
- MITRE ATT&CK, Unsecured Credentials: Credentials In Files (T1552.001): https://attack.mitre.org/techniques/T1552/001/
