---
title: "HTB Strutted"
description: "Strutted runs an Apache Struts2 app vulnerable to CVE-2024-53677, a file-upload path-traversal flaw."
kind: writeup
category: "Web & API Security"
tags: [web, api, htb, struts, writeup]
order: 10
status: published
source: repo
---

<div class="callout info">

TL;DR: Strutted runs an Apache Struts2 app vulnerable to CVE-2024-53677, a file-upload path-traversal flaw. I used it to drop a JSP web shell in the web root, read Tomcat config for credentials, logged in over SSH, and escalated to root through a sudo `tcpdump` rule using the GTFOBins technique.

</div>

| Category | Difficulty | Platform | Tools | Mapping |
|---|---|---|---|---|
| Web exploitation, Linux privesc | Medium | Retired HTB machine | Nmap, public CVE-2024-53677 PoC, sshpass, tcpdump (GTFOBins) | Exploit Public-Facing Application (T1190), Server Software Component: Web Shell (T1505.003), Credentials In Files (T1552.001), Remote Services: SSH (T1021.004), Abuse Elevation Control: Setuid/Setgid (T1548.001) |

![Hack The Box machine card for Strutted, a retired medium Linux machine](/images/writeups/htb-strutted/01.png)

## Scope and environment

Strutted is a retired HTB Linux machine, so this is practice on a known target with a public walkthrough. The target sat at `10.10.11.59`. Nothing here is a disclosure.

## Recon and approach

I started with an aggressive Nmap scan to get services and a rough OS read.

```bash title="recon.sh"
nmap -sV -O -A 10.10.11.59
```

![Nmap scan of 10.10.11.59 showing ports 22 (OpenSSH) and 80 (nginx 1.18.0) open with a redirect to strutted.htb](/images/writeups/htb-strutted/02.png)

Two ports were open: 22 (OpenSSH) and 80 (nginx 1.18.0). The HTTP service redirected to `http://strutted.htb/`, which told me a virtual host was in play, so I mapped `strutted.htb` to the target IP in `/etc/hosts` and browsed to it.

![Strutted web app showing the Image Upload Successful page after a test upload](/images/writeups/htb-strutted/03.png)

The site offered a downloadable ZIP of the application. That is the kind of thing I always pull apart, because shipped source tells you the stack. Inside the `pom.xml` the Struts version was pinned:

```
<struts2.version>6.3.0.1</struts2.version>
```

![pom.xml from the downloaded ZIP showing struts2.version set to 6.3.0.1](/images/writeups/htb-strutted/04.png)

Apache Struts2 6.3.0.1 lines up with CVE-2024-53677, a file-upload vulnerability. The upload handler does not validate the `uploadFileName` parameter properly, so an attacker can use path traversal to write an uploaded file outside the intended directory, including into the web root. Write a JSP file there and you have remote code execution.

## Exploitation

I used a public proof-of-concept for CVE-2024-53677. The technique is: craft a JSP web shell, disguise it as an image so it clears the upload filter, then abuse the filename parameter to traverse into the web root.

![Terminal output of git clone for the EQSTLab CVE-2024-53677 proof-of-concept repository](/images/writeups/htb-strutted/06.png)

The disguise is a prepended JPEG magic-byte header on the shell file, so the content sniff sees an image while the server still writes `.jsp`. The PoC drives the upload and sets the traversal path.

![PoC script open in VSCodium showing the JSP web shell payload that runs the cmd parameter](/images/writeups/htb-strutted/07.png)

![Terminal commands writing a JPEG header to kiber.jpg and appending shell.jsp to it](/images/writeups/htb-strutted/08.png)

```bash title="upload.sh"
python3 CVE-2024-53677.py -u http://strutted.htb/upload.action -p "../../<shell>.jsp" -f <image>.jpg
```

![PoC script running against upload.action with the traversal path ../../kiber.jsp](/images/writeups/htb-strutted/09.png)

Requesting the uploaded `.jsp` first returned `Unknown action.`, which confirmed the shell was live and just needed its command parameter. From there I could run commands through the web shell and enumerate the box: listing the Tomcat `conf` directory surfaced `tomcat-users.xml`, and reading `/etc/passwd` showed a real user account, `james`, with a `/bin/bash` shell. That combination (a config file likely holding credentials plus a named user) is the lateral-movement path.

![Browser at strutted.htb/kiber.jsp returning Unknown action.](/images/writeups/htb-strutted/10.png)

![Web shell output of ls conf listing the Tomcat config files including tomcat-users.xml](/images/writeups/htb-strutted/11.png)

![Web shell output of cat /etc/passwd showing the james account with a /bin/bash shell](/images/writeups/htb-strutted/13.png)

The credentials recovered from the Tomcat configuration let me authenticate over SSH as `james`.

```bash title="ssh.sh"
sshpass -p '<redacted>' ssh -o StrictHostKeyChecking=no james@strutted.htb
```

### Privilege escalation

`sudo -l` showed `james` could run `tcpdump` as root. `tcpdump` is on GTFOBins because its `-z postrotate-command` option runs an arbitrary script as the user `tcpdump` is running as. Running it under sudo means that script runs as root. I pointed it at a script that copies `/bin/bash` and sets the SUID bit, then launched the resulting SUID shell with `-p` to keep the elevated privileges. `id` then reported `uid=0(root)`.

![Terminal as james running sudo tcpdump with the -z script, then launching the SUID bash copy with -p](/images/writeups/htb-strutted/15.png)

![Root shell in /root listing root.txt, with the flag value blurred](/images/writeups/htb-strutted/16.png)

HTB then marked the machine as pwned on my account.

![Hack The Box confirmation that Strutted has been pwned, dated 29 Jan 2025](/images/writeups/htb-strutted/17.png)

## Detection and mitigation

This is my after-the-fact analysis of how each stage would surface and what stops it. I did not build or test these detections.

**Struts file-upload RCE (Exploit Public-Facing Application, T1190; Web Shell, T1505.003).**
- Telemetry: web server and application logs (nginx access logs, Struts/Tomcat logs), plus file-integrity monitoring on the web root.
- Detection would key on: POST requests to the upload action carrying `uploadFileName` values with traversal sequences (`../`), and the appearance of a new `.jsp` (or other executable) file in a served directory, followed by GET requests to that new path. A sudden first-seen script file in the web root is a strong signal.
- Fix: patch to a fixed Struts2 release (the advisory covers 6.3.0.2 and later on the 6.x line, and the 7.x fix), and move file uploads off the Interceptor API that the CVE abuses. Validate and canonicalize upload filenames, store uploads outside the web root, and deny execution in the upload directory.

**Credential theft from Tomcat config (Credentials In Files, T1552.001).**
- Telemetry: the web shell reads config files, which shows up as the web server process spawning shell commands (`cat`, `ls`) and reading `tomcat-users.xml` and `/etc/passwd`. On a host with command-line auditing (auditd execve, or EDR process telemetry) that chain is visible.
- Detection would key on: the web server service account executing a shell or reading sensitive config and `/etc/passwd`. Web servers should rarely spawn interactive shells.
- Fix: do not store reusable credentials in world-readable config, do not reuse a Tomcat password for an SSH account, and run Tomcat under a dedicated low-privilege account.

**SSH login as james (Remote Services: SSH, T1021.004; Valid Accounts, T1078).**
- Telemetry: `sshd` auth logs (`/var/log/auth.log`), source IP and timing.
- Detection would key on: an interactive SSH login for a service-adjacent account from an unusual source, close in time to web-layer compromise.
- Fix: enforce key-based SSH, disable password auth, and separate credentials between tiers.

**Sudo tcpdump to root (Abuse Elevation Control: Setuid/Setgid, T1548.001; Exploitation for Privilege Escalation, T1068).**
- Telemetry: `sudo` logs showing `tcpdump` run with `-z`, auditd execve for the postrotate script, and file-system events creating a SUID binary under a home directory.
- Detection would key on: `tcpdump` invoked with the `-z` postrotate option, and any new SUID root binary appearing outside standard paths. Both are rare on a normal host.
- Fix: remove `tcpdump` from the user's sudoers entry. If packet capture is genuinely needed, grant `CAP_NET_RAW` to a wrapper instead of full sudo, and never allow options that execute external commands.

## Key takeaways

- Shipped application source (the downloadable ZIP and its `pom.xml`) gave away the exact vulnerable component version. Reading dependency manifests is often faster than fingerprinting.
- The upload filter only checked content that looked like an image header; it never constrained the written filename or path. Validation has to cover the destination, not just the bytes.
- Credential reuse between the Tomcat config and the `james` SSH account turned a web RCE into interactive access. Tier separation would have broken the chain.
- A single over-broad sudo entry (`tcpdump`) was enough for root because the binary can execute arbitrary commands. GTFOBins exists precisely to catalog these.

## References

- NVD, CVE-2024-53677: https://nvd.nist.gov/vuln/detail/CVE-2024-53677
- Apache Struts2 security bulletin S2-067: https://cwiki.apache.org/confluence/display/WW/S2-067
- GTFOBins, tcpdump: https://gtfobins.github.io/gtfobins/tcpdump/
- MITRE ATT&CK, Exploit Public-Facing Application (T1190): https://attack.mitre.org/techniques/T1190/
- MITRE ATT&CK, Abuse Elevation Control Mechanism: Setuid and Setgid (T1548.001): https://attack.mitre.org/techniques/T1548/001/
