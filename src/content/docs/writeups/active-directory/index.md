---
title: "Active Directory"
description: "Writeups on attacking Windows Active Directory, from first foothold to full domain and forest compromise."
kind: index
category: "Active Directory"
tags: [active-directory, writeup]
order: 20
status: published
source: repo
---

- [HTB EscapeTwo](/writeups/active-directory/htb-escapetwo/): a retired HTB machine. SMB enumeration, credentials in spreadsheet XML, MSSQL `xp_cmdshell`, password spraying, ACL abuse, and an ADCS ESC4 certificate-template misconfiguration for Domain Admin.
- [Forest compromise lab](/writeups/active-directory/forest-compromise-lab/): my own controlled lab. External web compromise, pivot with Ligolo-ng, credential spraying, LSA secrets, and a KRBTGT Golden Ticket to cross from a child domain to the parent and compromise the forest. This is a lab I built, not an HTB machine.
