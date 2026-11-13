---
title: "HTB MonitorsFour"
description: "A retired HTB machine: a PHP type-juggling login bypass on Cacti, remote code execution, and a container escape through an exposed Docker API."
kind: writeup
category: "Web & API Security"
tags: [web, api, htb, docker, writeup]
order: 20
status: published
source: repo
---

<div class="callout info">

TL;DR: MonitorsFour chains a PHP type-juggling authentication bypass against a Cacti instance, a database leak and hash crack, remote code execution through CVE-2025-24367, and finally a container escape through an exposed, unauthenticated Docker Remote API that mounts the Windows host's drive.

</div>

| Category | Platform | Tools | Mapping |
|---|---|---|---|
| Web exploitation, container escape | Retired HTB machine | Nmap, Nikto, vhost fuzzing, public Cacti PoC, hash cracking, curl (Docker API) | Exploit Public-Facing Application (T1190), Exploitation for Credential Access (T1212), Brute Force: Password Cracking (T1110.002), Deploy Container (T1610), Escape to Host (T1611) |

## Scope and environment

MonitorsFour is a retired HTB machine with a public walkthrough. It is unusual in that the host OS is Windows while the vulnerable application runs inside a Linux container, which is what makes the final container escape interesting. The target sat at `10.10.11.98`.

I redact credentials in the commands on this page. Some screenshots still show the box's own lab passwords and hashes, which only ever existed on this retired machine.

Note on CVEs: the initial Cacti RCE path I used is CVE-2025-24367. An earlier reference in my raw notes to CVE-2024-25641 as an "unauthenticated RCE" is imprecise: CVE-2024-25641 is an authenticated arbitrary-file-write in Cacti's package import. I have left the working foothold as CVE-2025-24367 and dropped the mislabeled reference.

## Recon and approach

A SYN scan returned the service list. Port 5985 stood out: that is WinRM, and the `Microsoft HTTPAPI 2.0` banner means the request is handled by the Windows kernel-mode HTTP driver, so the host itself is Windows.

![Nmap SYN scan showing port 80 nginx and port 5985 Microsoft HTTPAPI on a Windows host](/images/writeups/htb-monitorsfour/01.png)

Port 80 redirected to `http://monitorsfour.htb/`, so I added the vhost to `/etc/hosts` and ran Nikto against it. The scan flagged PHP 8.3.27, an exposed `.env` file at the web root, missing security headers (`X-Frame-Options`, `X-Content-Type-Options`), and a `PHPSESSID` cookie issued without `HttpOnly`.

![MonitorsFour website landing page served on port 80](/images/writeups/htb-monitorsfour/02.png)

![Nikto scan output reporting PHP 8.3.27 and an exposed .env file at the web root](/images/writeups/htb-monitorsfour/03.png)

I pulled the exposed `.env` file directly from the web root to read it.

![Browser download notification for the .env file retrieved from the web root](/images/writeups/htb-monitorsfour/04.png)

The `.env` file was the useful find. Even with its credential values blanked, it named MariaDB as the database and an internal host named `mariadb`, which tells you this is a multi-container setup with the web, app, and database segmented.

![Contents of the .env file showing DB_HOST set to mariadb with credential values blanked](/images/writeups/htb-monitorsfour/05.png)

Fuzzing the Host header for virtual hosts surfaced `cacti.monitorsfour.htb`. Mapping that vhost gave me a Cacti 1.2.28 instance, which is the real attack surface.

![ffuf Host-header fuzzing returning a 302 for the cacti subdomain](/images/writeups/htb-monitorsfour/06.png)

![Cacti 1.2.28 user login page on cacti.monitorsfour.htb](/images/writeups/htb-monitorsfour/07.png)

## Exploitation

### Authentication bypass through PHP type juggling

The credential leak came from a magic-hash / type-juggling weakness. PHP's loose comparison operator (`==`) coerces strings that look like scientific notation into numbers, so a string like `0e1234` is read as `0 x 10^1234`, which is `0`. Any `0e`-and-digits string therefore compares equal to any other such string, and equal to integer `0`. When a hash or token is compared with `==` instead of the strict `===`, a crafted `0e...` value passes the check.

I first probed the `/user` endpoint to see how it handled the token parameter.

![curl request to the /user endpoint returning a missing token parameter error](/images/writeups/htb-monitorsfour/08.png)

![curl request with a plain token value returning an invalid or missing token error](/images/writeups/htb-monitorsfour/09.png)

![ffuf run where the token 0e1234 returns an HTTP 200 of size 1113, bypassing validation](/images/writeups/htb-monitorsfour/10.png)

Supplying a `0e`-form token to the `/user` endpoint bypassed token validation and dumped the user table: usernames, emails, roles, and MD5-hashed passwords. I cracked the MD5 hash for the `admin` account offline to recover its plaintext password (redacted).

![Lab user table dump with account records and hashes redacted](/images/writeups/htb-monitorsfour/11.png)

![Online MD5 reverse tool with the lab hash and recovered plaintext redacted](/images/writeups/htb-monitorsfour/12.png)

### Remote code execution: CVE-2025-24367

Cacti 1.2.28 is vulnerable to CVE-2025-24367, a high-severity RCE caused by improper input validation in how Cacti builds RRDTool graph commands. Using a public proof-of-concept with the admin session, I got a reverse shell back as the `www-data` user inside the container. The user flag sat in `/home/marcus/user.txt`.

![Cacti 1.2.28 console logged in as the marcus user](/images/writeups/htb-monitorsfour/13.png)

![CVE-2025-24367 proof-of-concept running and a netcat listener catching a www-data reverse shell](/images/writeups/htb-monitorsfour/14.png)

### Container escape through the Docker Remote API

Enumerating the network from the foothold showed I was inside a Docker container, and that the Docker Remote API was reachable and unauthenticated on TCP 2375. That is the whole ballgame: the Docker API lets you create and start containers, and a new container can bind-mount the host filesystem.

I defined a container that uses a local image and bind-mounts the host's Windows drive (exposed to the Docker VM as `/mnt/host`) to a path inside the new container, with a command that reads the Administrator desktop. Three API calls did it: create the container, start it, then read its logs to collect the output, since the container runs its command and exits.

![create_container.json payload binding /mnt/host to /host_root with a cat command against the Administrator desktop](/images/writeups/htb-monitorsfour/16.png)

```bash title="docker-api.sh"
# create a container that bind-mounts the host filesystem (payload JSON omitted)
curl -H 'Content-Type: application/json' -d @create_container.json \
  http://<docker-api-host>:2375/containers/create -o response.json
# start it
curl -X POST http://<docker-api-host>:2375/containers/<cid>/start
# read the command output from the container logs
curl "http://<docker-api-host>:2375/containers/<cid>/logs?stdout=1"
```

![Docker API calls creating and starting the container and reading its logs for the command output](/images/writeups/htb-monitorsfour/17.png)

Because the mount gives the container the host's drive, this reads files anywhere on the Windows host, which is a full host compromise from inside a low-privilege container.

![HackTheBox completion screen showing MonitorsFour has been Pwned](/images/writeups/htb-monitorsfour/18.png)

## Detection and mitigation

This is my after-the-fact analysis, not detections I built or tested.

**Exposed `.env` and missing headers (information disclosure).**
- Telemetry: web access logs showing successful GETs for `/.env`, `/.git/`, and similar dotfiles.
- Detection would key on: any 200 response for a dotfile path at the web root.
- Fix: deny dotfile paths at the web server. In nginx, `location ~ /\.(env|git) { deny all; }`. Keep secrets out of files served from the web root entirely, and set the missing security headers and `HttpOnly` on session cookies.

**Type-juggling auth bypass and DB dump (Exploitation for Credential Access, T1212).**
- Telemetry: application logs for the `/user` endpoint, particularly tokens that are `0e`-form strings, and an authenticated action immediately after an anonymous request.
- Detection would key on: token or hash parameters matching the pattern `^0e\d+$`, and a single request returning a bulk user record set.
- Fix: compare hashes and tokens with strict equality (`===`), use constant-time comparison for secrets (`hash_equals`), and store passwords with a modern algorithm (`password_hash` with bcrypt or Argon2), never raw MD5.

**Cacti RCE, CVE-2025-24367 (Exploit Public-Facing Application, T1190).**
- Telemetry: the web/app service account spawning child processes (shell, `rrdtool` with unexpected arguments), and outbound connections from the Cacti container (the reverse shell).
- Detection would key on: `www-data` (or the Cacti service account) launching a shell or making an outbound TCP connection to a non-standard port. Web app containers should not initiate egress shells.
- Fix: upgrade Cacti to 1.2.29 or later, run Cacti as a dedicated low-privilege user, and set `register_argc_argv` to `Off` in `php.ini` unless required.

**Docker Remote API escape (Deploy Container, T1610; Escape to Host, T1611).**
- Telemetry: network listeners on 2375, Docker daemon logs for container create/start events, and creation of containers with host bind mounts.
- Detection would key on: any container created with a bind mount of the host root or a broad host path, container creation originating from inside another container, and connections to the Docker API from unexpected sources.
- Fix: never expose the Docker API on an unauthenticated TCP port. Use the local Unix socket, or if remote access is required, require mutual TLS on 2376. Do not give workload containers reachability to the Docker socket or API, and restrict which host paths may be mounted.

## Key takeaways

- The `.env` file leaked the architecture before anything was exploited. Served dotfiles are a recurring, avoidable giveaway.
- `==` versus `===` in PHP is not a style nitpick when the compared value is a security token. Type juggling turned a comparison into an auth bypass.
- Segmentation into containers bought nothing here because the Docker control plane was exposed unauthenticated. The container boundary is only as strong as access to the daemon that manages it.
- Chaining matters: none of these flaws alone gives host takeover, but web bypass plus RCE plus an open Docker API walks from anonymous to the Windows host's filesystem.

## References

- NVD, CVE-2025-24367: https://nvd.nist.gov/vuln/detail/CVE-2025-24367
- NVD, CVE-2024-25641 (for contrast, authenticated file write): https://nvd.nist.gov/vuln/detail/CVE-2024-25641
- Docker, protect the Docker daemon socket: https://docs.docker.com/engine/security/protect-access/
- MITRE ATT&CK, Escape to Host (T1611): https://attack.mitre.org/techniques/T1611/
- MITRE ATT&CK, Deploy Container (T1610): https://attack.mitre.org/techniques/T1610/
