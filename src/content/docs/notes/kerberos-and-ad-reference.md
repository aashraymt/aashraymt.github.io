---
title: "Kerberos and Active Directory: the parts I keep coming back to"
description: "These are study notes from preparing for the Certified Red Team Analyst course material and from my own labs, rewritten as a quick reference for myself."
kind: note
category: "Active Directory"
tags: [active-directory, notes]
order: 50
status: published
source: repo
---

## AD structure

A domain is the basic administrative unit: one directory database, one set of domain controllers, one Kerberos realm. A tree is a set of domains sharing a contiguous DNS namespace (corp.example.com and its child, emea.corp.example.com). A forest is one or more trees that share a schema, configuration, and global catalog. The forest, not the domain, is the security boundary.

What a defender watches for: membership changes in the highest-privilege groups, which show up as 4728 (global group), 4732 (local group), and 4756 (universal group, where Enterprise Admins lives).

## The Kerberos exchange

1. **AS-REQ / AS-REP.** The client asks the KDC (running on the domain controller) for a TGT. With pre-authentication, the request carries a timestamp encrypted with a key derived from the user's password. The reply holds the TGT, encrypted with the krbtgt account's key, plus a session key encrypted with the user's key.
2. **TGS-REQ / TGS-REP.** The client presents the TGT and an authenticator, and names the service it wants (an SPN). The KDC returns a service ticket encrypted with the key of the account running that service.
3. **AP-REQ.** The client hands the service ticket and a fresh authenticator to the service. The service decrypts the ticket with its own key. An optional AP-REP gives mutual authentication.

What a defender watches for: 4768 is a TGT request, 4769 is a service ticket request, 4771 is a failed pre-authentication, and 4624 on the target server records the logon that results from AP-REQ. RC4 (0x17) ticket encryption in an AES-only domain is also worth a look.

## Why the krbtgt key matters

Every TGT is encrypted and signed with the krbtgt key. Anyone holding it can build a TGT offline for any account, including one that does not exist, with any group memberships written into the ticket. That is why a krbtgt reset has to happen twice: the domain keeps the current and the previous key, so one reset leaves the old key valid.

What a defender watches for: a 4769 for an account with no matching 4768 beforehand, since a forged TGT skips the AS exchange. Also watch for ticket lifetimes longer than policy and for any change to the krbtgt account itself (4724, 4738).

## Delegation

Delegation lets a service act as a user toward a second service, for example a web tier calling a database as the signed-in user.

- **Unconstrained.** The user's forwardable TGT is placed inside the service ticket and cached on the server. Compromise that server and I can reuse the cached TGTs of whoever authenticated to it, which can include a domain admin. Domain controllers have it by default.
- **Constrained.** The service may impersonate users only to a listed set of SPNs. If the account is compromised, the attacker can impersonate users to those listed services.
- **Resource-based (RBCD).** The target resource says who may delegate to it, through an attribute on its own computer object. Anyone who can write that attribute, plus control of an account with an SPN, can delegate to that machine.

What a defender watches for: 4738 and 4742 changes that flip the delegation flag in the account control value, 4741 for new computer accounts, and 5136 when the RBCD attribute is modified (directory service auditing must be on for that one).

## SIDs and ACLs

Every principal has a SID: the domain SID plus a relative ID. RID 500 is the built-in administrator, 502 is krbtgt, 512 is Domain Admins, 519 is Enterprise Admins. At logon, the user's SID, group SIDs, and any SID history are collected into the access token, with the group data carried in the PAC inside the ticket. When I touch a resource, the system compares the token's SIDs against the ACEs in the resource's DACL. Authentication proves who I am. This comparison decides what I can do.

What a defender watches for: 4672 (special privileges assigned at logon), and 5136 or 4670 when an object's security descriptor is changed.

## Domain trusts

If domain A trusts domain B, then A is the trusting domain and B's users can reach A's resources. Parent-child and tree-root trusts inside a forest are automatic, two-way, and transitive. Forest trusts are created deliberately and can be one-way or two-way.

The part worth remembering: SID filtering is applied on trusts that cross a forest boundary, but not between domains in the same forest, because the forest is treated as one security boundary. So if I own a child domain's krbtgt key, I can forge a TGT whose SID history includes the forest root's Enterprise Admins SID, and the parent domain's controllers honor it. That is how a child compromise becomes a forest compromise. I walked this path (child DC, krbtgt Golden Ticket, parent DC) in my [Red Team Simulation lab](https://github.com/aashraymt/Red-Teaming-Simulation).

What a defender watches for: 4765 and 4766 for SID history being added or failing to be added, 4675 when SIDs are filtered, and TGS requests for the parent's krbtgt service from a child domain that do not line up with normal cross-domain activity.
