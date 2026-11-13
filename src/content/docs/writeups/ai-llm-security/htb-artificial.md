---
title: "HTB Artificial"
description: "Artificial hosts a web app that loads user-uploaded TensorFlow models."
kind: writeup
category: "AI / LLM Security"
tags: [llm, ai, htb, writeup]
order: 40
status: published
source: repo
---

<div class="callout info">

TL;DR: Artificial hosts a web app that loads user-uploaded TensorFlow models. A Keras model with a Lambda layer runs arbitrary code when the backend loads it, which gives a foothold. From there I looted a SQLite user database, cracked hashes, pivoted over SSH, cracked a bcrypt secret from a backup archive, and abused Backrest's Restic integration to read root-owned files.

</div>

| Category | Difficulty | Platform | Tools | Mapping |
|---|---|---|---|---|
| AI/ML web security, Linux privesc | Easy | Retired HTB machine | Nmap, Docker, TensorFlow/Keras, netcat, sqlite3, hashcat, ssh, scp, Backrest/Restic | Exploit Public-Facing Application (T1190), Command and Scripting Interpreter (T1059), Credentials In Files (T1552.001), Brute Force: Password Cracking (T1110.002), Valid Accounts (T1078), Remote Services: SSH (T1021.004), Abuse Elevation Control (T1548) |

Note: an earlier draft listed the difficulty as both Medium and Easy. The official HTB rating is Easy, so I use Easy here.

## Scope and environment

Artificial is a retired HTB Linux machine with a public walkthrough. What makes it worth writing up is the entry point: insecure loading of a machine-learning model, which is a real and current class of bug as more apps accept user-supplied models. The target sat at `10.10.11.74`.

![HackTheBox details card for Artificial, rated Easy on Linux and retired](/images/writeups/htb-artificial/01.png)

## Recon and approach

A service and version scan showed a very small surface: SSH and a single web service on port 80.

```bash title="recon.sh"
nmap -sV -sC -Pn 10.10.11.74
```

![Nmap scan showing only SSH on port 22 and nginx on port 80 open](/images/writeups/htb-artificial/02.png)

With SSH the only other service, the way in was going to be the web layer. I mapped `artificial.htb` into `/etc/hosts` and browsed to it. The site is a platform for uploading and running AI models. It let me register an account with no email verification, so I created one and landed on `/dashboard`.

![Artificial landing page advertising AI model building and deployment](/images/writeups/htb-artificial/03.png)

The dashboard exposed two downloadable files, `requirements.txt` and a `Dockerfile`. Reading them told me the backend loads TensorFlow CPU 2.13.1 on Python 3.8, and the app accepts `.h5` model uploads. That combination is the vulnerability: TensorFlow/Keras will execute arbitrary Python when it loads a model containing a Lambda layer, because the layer's function is deserialized and called. An upload form that accepts `.h5` and then loads the model server-side is a direct path to code execution.

![Dashboard with downloadable requirements and Dockerfile links and a model upload form](/images/writeups/htb-artificial/04.png)

## Exploitation

### Insecure model deserialization to RCE

To build a model the target would load cleanly, I mirrored its environment using the Dockerfile and requirements the site handed me, so my model matched its TensorFlow and Python versions.

```bash title="build-env.sh"
sudo docker build -t artificial-exploit .
```

Inside that environment I created a minimal Keras `Sequential` model whose only meaningful component is a `Lambda` layer. The Lambda layer wraps a Python function, and when Keras loads the saved `.h5`, it reconstructs and invokes that function. I set the function to spawn a reverse shell back to a listener on my machine, saved the model to `.h5`, uploaded it through the dashboard, and triggered the load by selecting "View Predictions." The backend loaded the model, executed the Lambda function, and I caught a shell as the application user. (The weaponized payload itself is not reproduced here; the mechanism is the Lambda layer executing on load.)

### Looting the application database

The shell landed in the web app's context. A Flask app usually keeps its SQLite database under `instance/`, and sure enough there was `instance/users.db`. I opened it with `sqlite3`, listed tables, and found a `user` table with id, username, email, and hashed password columns. Dumping it gave me all users and their password hashes.

```bash title="loot.sh"
sqlite3 instance/users.db
# .tables ; PRAGMA table_info(user); SELECT * FROM user;
```

### Cracking hashes and SSH pivot

I cracked the recovered hashes offline with Hashcat and a wordlist. Two of them cracked to usable passwords (redacted). One of those credentials worked for SSH as the user `gael`, which gave me a real interactive account on the box and the user flag. A second account existed but had no valid shell.

```bash title="crack-and-ssh.sh"
hashcat -m 0 hash.txt /usr/share/wordlists/rockyou.txt
ssh gael@10.10.11.74
```

### Backup archive to internal service

Local enumeration turned up an internal service listening on `127.0.0.1:9898` and a backup archive at `/var/backups/backrest_backup.tar.gz`. I copied the archive off with `scp` and extracted it (it was a plain tar despite the name). Inside was a Backrest configuration file holding a base64-encoded bcrypt password hash. I decoded it and cracked the bcrypt hash with Hashcat, which recovered the password (redacted) for the admin account of the internal Backrest service on port 9898.

```bash title="backup.sh"
scp gael@10.10.11.74:/var/backups/backrest_backup.tar.gz .
# extract, pull the bcrypt hash from config.json, then:
hashcat -m 3200 bcrypt.hash /usr/share/wordlists/rockyou.txt
```

### Restic abuse for root-owned data

I forwarded the internal service over SSH and logged into the Backrest web interface with the cracked admin credentials.

```bash title="forward.sh"
ssh -L 9898:127.0.0.1:9898 gael@10.10.11.74
```

![Backrest login page served on localhost port 9898 over the SSH forward](/images/writeups/htb-artificial/06.png)

![Backrest Getting Started page after logging into the management interface](/images/writeups/htb-artificial/07.png)

Backrest wraps Restic, and Restic appears on GTFOBins because its backup and restore operations can be pointed at attacker-controlled storage and run with the privileges of the backup process. Through the Backrest panel I added a repository pointing at a Restic server on my machine and ran a backup of the root filesystem, then listed and restored the snapshot locally to read root-owned files, including the root flag.

![Backrest Add Restic Repository form pointing at an attacker-defined repository](/images/writeups/htb-artificial/08.png)

![HackTheBox completion screen showing Artificial has been Pwned](/images/writeups/htb-artificial/09.png)

## Detection and mitigation

This is my after-the-fact analysis, not detections I built or tested.

**Insecure model deserialization / Lambda RCE (Exploit Public-Facing Application, T1190; Command and Scripting Interpreter, T1059).**
- Telemetry: the model-loading service process spawning child processes or making outbound network connections, plus application logs of model uploads.
- Detection would key on: the ML worker process launching a shell or opening an outbound socket right after a model upload. A model-serving process should never spawn a shell.
- Fix: do not load untrusted models with code-executing layers. Load with `safe_mode` enabled (which blocks Lambda deserialization in modern Keras), reject or strip Lambda layers, load models in a sandboxed, network-isolated, non-privileged container, and validate uploads. Treat an uploaded model as untrusted code, because that is what it is.

**Exposed downloadable Dockerfile and requirements (information disclosure).**
- Telemetry: web access logs showing downloads of `Dockerfile` and `requirements.txt`.
- Detection would key on: serving build and dependency files to anonymous or low-privilege users.
- Fix: do not expose build artifacts that reveal exact framework versions; they let an attacker match the environment precisely.

**Credential theft from SQLite and cracking (Credentials In Files, T1552.001; Password Cracking, T1110.002).**
- Telemetry: file reads of the app database by unexpected processes; offline cracking is not visible on the host, so the control is hash strength.
- Detection would key on: the app service account reading and exporting the user table outside normal query paths.
- Fix: store passwords with a slow, salted algorithm (bcrypt or Argon2) rather than fast unsalted hashes, and keep the database file out of a predictable, app-readable path where a web shell lands.

**SSH pivot with reused credentials (Valid Accounts, T1078; Remote Services: SSH, T1021.004).**
- Telemetry: `sshd` auth logs showing a password login for `gael` shortly after web compromise.
- Detection would key on: a successful SSH login whose credential was just recovered from the app database.
- Fix: do not reuse application passwords for system accounts, prefer key-based SSH, and disable password auth.

**Backrest/Restic privilege escalation (Abuse Elevation Control Mechanism, T1548).**
- Telemetry: the backup service running restore/backup against a non-local, attacker-specified repository, and reads of root-owned files by the backup process.
- Detection would key on: a backup job targeting an external or unexpected repository endpoint, and backup operations initiated from a newly added repository configuration.
- Fix: run backup tooling with the least privilege it needs, restrict which repositories it may target, protect the management interface with strong unique credentials, and bind it to localhost only with access controlled, not exposed through a crackable default.

## Key takeaways

- An uploaded ML model is executable input. TensorFlow/Keras Lambda layers run on load, so accepting `.h5` files from users is accepting code. Load with `safe_mode` and sandbox it.
- The app handed out its own Dockerfile and requirements, which let me build a byte-compatible payload. Leaking your exact build environment lowers the bar for an attacker.
- Fast, unsalted password hashes in the SQLite database fell quickly to Hashcat and gave the SSH pivot. Hash choice is a real control.
- Backup tooling that can be pointed at arbitrary storage and runs with high privilege is a privilege-escalation primitive, exactly the Restic GTFOBins pattern.

## References

- Keras, Lambda layer serialization and `safe_mode`: https://keras.io/api/layers/core_layers/lambda/
- GTFOBins, restic: https://gtfobins.github.io/gtfobins/restic/
- OWASP Machine Learning Security Top 10: https://owasp.org/www-project-machine-learning-security-top-10/
- MITRE ATT&CK, Exploit Public-Facing Application (T1190): https://attack.mitre.org/techniques/T1190/
- MITRE ATT&CK, Brute Force: Password Cracking (T1110.002): https://attack.mitre.org/techniques/T1110/002/
