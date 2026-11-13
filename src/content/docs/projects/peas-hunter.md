---
title: "PEAS-Hunter"
description: "A Bash script that reads LinPEAS or WinPEAS output and pulls out the lines that look like secrets: AWS tokens, API keys, SSH keys, passwords."
kind: project
tags: [bash, project]
order: 80
status: published
source: repo
---

A Bash script that reads LinPEAS or WinPEAS output and pulls out the lines that look like secrets: AWS tokens, API keys, SSH keys, passwords. I wrote it in Oct 2025 as my Bash project for a Scripting Languages class.

## Why I built it

LinPEAS output is thousands of lines. In a CTF or a lab privilege escalation, the part I usually care about first is small: a readable `id_rsa`, a `.pem` file, a token in an environment file. I was scrolling for those by hand every time, so I made the class project something I would use.

## What I built

One script, `peas-hunter.sh`. It does three things:

1. Scans the PEAS output with keyword regexes (`password`, `token`, `aws`, `.pem`, `id_rsa`, and similar) and saves every matching line.
2. Parses likely file paths out of those matches into a separate list.
3. Optionally fetches each of those files with `wget` from a base URL, for the case where the target is serving its filesystem over HTTP in a lab.

```bash title="usage"
chmod +x peas-hunter.sh
./peas-hunter.sh -d loot -u http://10.10.10.10 linpeas.out
```

The output directory ends up with `matches.txt` (the raw hits), `found_paths.txt` (the extracted paths), any files that were downloaded, and a `success.log`.

## Limits

It is keyword matching, so it has false positives (any line that says "password") and it misses secrets that do not match a keyword. It is a triage shortcut for lab output, not a secret scanner. The download option needs `wget` and only makes sense on targets I am allowed to test.

Repo: [github.com/aashraymt/peas-hunter](https://github.com/aashraymt/peas-hunter)
