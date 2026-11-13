---
title: "Active Directory Home Lab"
description: "An Active Directory domain built from scratch in VirtualBox: a Windows Server 2019 domain controller with DNS, DHCP, and NAT, plus a joined client."
kind: project
tags: [active-directory, project]
order: 70
status: published
source: repo
---

A working Active Directory domain built from scratch in VirtualBox: a Windows Server 2019 domain controller with DNS, DHCP, and NAT, a Windows 10 client joined to it, and over 1,000 users created by script. Built Jun 2025.

## Why I built it

I kept reading about AD attacks (Kerberos, lateral movement, domain trusts) without having a domain of my own to try them against or even to break. Before I could attack one, I wanted to stand one up and understand the moving parts: what the domain controller actually serves, how a client finds it, and how enterprises provision users at scale instead of by hand. This lab is the foundation the [Red Team Simulation Lab](/projects/red-team-simulation-lab/) builds on.

## What I built

```
  [ Windows Server 2019 ]              [ Windows 10 Pro client ]
    - AD DS (forest root)                - internal NIC only
    - DNS                                - joined to the domain
    - DHCP (172.16.0.100-200)      <-->  - gets IP from DHCP
    - RRAS / NAT  --> internet
       internal NIC  <------ internal network ------>  internal NIC
```

Two VMs on two virtual NICs. The server has one NIC on NAT for internet access and one on an internal network isolated from the host. The client sits only on the internal network, so all of its domain traffic stays inside the lab.

Steps I worked through:

1. Built the Windows Server 2019 VM with the two NICs, gave the internal NIC a static IP.
2. Installed Active Directory Domain Services and promoted the server to a domain controller as a new forest.
3. Created a domain admin account instead of staying on the built-in administrator.
4. Installed the Remote Access role and configured NAT through Routing and Remote Access, so internal clients reach the internet through the server without being exposed directly.
5. Installed the DHCP role and set a scope (172.16.0.100 to 172.16.0.200, 20-day lease) so clients get addresses automatically.
6. Built a Windows 10 Pro client (Home cannot join a domain), put it on the internal network, and joined it to the domain.
7. Logged in as a domain user from the client to confirm DNS, DHCP, and AD were all configured correctly together.

## The 1,000+ users

I did not create a thousand users by hand. I used a public PowerShell script, [joshmadakor1/AD_PS](https://github.com/joshmadakor1/AD_PS), which reads names and bulk-creates AD user accounts. The script is not mine; I ran it (after setting the execution policy to allow it) and confirmed the accounts appeared in Active Directory Users and Computers, then logged in as one of the generated users from the client.

The reason this matters for the lab is that a realistic domain is not three accounts. A thousand users makes later attack practice (enumeration, spraying, finding the one weak account) behave the way it would against something closer to a real directory.

## What this is and is not

This is a build-and-configure lab. It proves I can stand up a domain, segment its network, and get identity, DNS, and DHCP working together. It is not an attack writeup, and the bulk-user automation is someone else's script that I used, not code I wrote.
