---
title: "API5:2023 Broken Function Level Authorization"
description: "Broken Function Level Authorization (BFLA) means API functions have insufficient access controls."
kind: note
category: "API Security"
tags: [api-security, owasp-api, notes]
order: 40
status: published
source: repo
---

Broken Function Level Authorization (BFLA) means API functions have insufficient access controls. Broken Object Level Authorization (BOLA) is about which data you can reach. BFLA is about which actions you can perform, such as altering or deleting data or using another role's functions, including administrative ones.

A fintech API with a BOLA flaw would let an attacker see another user's account balance. The same API with a BFLA flaw would let them transfer funds out of that account.

Exploitation means sending legitimate API calls to an endpoint that an anonymous or regular user should not reach. These flaws are easier to find in APIs than in web pages because APIs are structured and their functions are predictable. Authorization checks are hard to get right because modern applications have many roles, groups, and hierarchies (sub-users, users with more than one role).

## How it works

A user of one privilege level can use the API functions of another user, group, or level. Providers often have several levels, such as public users, merchants, partners, vendors, and administrators. BFLA can be used for lateral access to a similar group's functions, or for privilege escalation into a more privileged group. The most interesting functions handle sensitive information, resources that belong to another group, and administration such as user account management.

Privileged actions often live on different endpoints. A bank might use `/{userid}/account/balance` for customers and `/admin/account/{userid}` for administrators. If access control is missing on the admin path, an attacker can perform administrative actions and take over accounts.

Administrative functionality does not always sit on an admin path. It can depend on the HTTP method (GET, POST, PUT, DELETE). If the provider does not restrict methods, making a request with a different method may show a BFLA flaw.

When testing, look for anything an attacker could use: altering user accounts, deleting user resources, and reaching restricted endpoints. If an API lets partners add users to the partner group but does not restrict who can call that function, any user could add themselves to any group, and would likely reach that group's resources.

## Example

In this request the DELETE method is used in place of PUT.

The response says "This is an admin function. Try to access the admin API". That points the attacker to an admin path in the DELETE request (`/identity/api/v2/admin/videos/758`).

The admin path and method had no authorization controls, so the request succeeded.

## Mitigation

* Use one consistent authorization module that every business function calls, often provided by a component outside the application code.
* Deny all access by default and require explicit grants to specific roles for each function.
* Review endpoints for function level flaws with the business logic and the group hierarchy in mind.
* Make administrative controllers inherit from an abstract administrative controller that checks the user's group or role.
* Check group and role inside any administrative function that lives in a regular controller.

## References

* [CWE-285: Improper Authorization](https://cwe.mitre.org/data/definitions/285.html)
* [Forced Browsing](https://owasp.org/www-community/attacks/Forced_browsing)
* "A7: Missing Function Level Access Control", [OWASP Top 10 2013](https://github.com/OWASP/Top10/raw/master/2013/OWASP%20Top%2010%20-%202013.pdf)
* [OWASP Community Guide for Access Control](https://owasp.org/www-community/Access_Control)
