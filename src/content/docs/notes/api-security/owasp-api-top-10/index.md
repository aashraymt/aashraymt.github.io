---
title: "OWASP API Security Top 10 (2023)"
description: "Study notes on the OWASP API Security Top 10 (2023 edition), one page per category."
kind: index
category: "API Security"
tags: [api-security, owasp-api, notes]
order: 20
status: published
source: repo
---

Study notes on the OWASP API Security Top 10 (2023 edition), one page per category. After the list there are short notes on three topics from the 2019 edition and beyond the list: injection, insufficient logging and monitoring, and business logic flaws.

## The 2023 list

1. API1:2023 Broken Object Level Authorization
2. [API2:2023 Broken Authentication](/notes/api-security/owasp-api-top-10/api2-broken-authentication/)
3. [API3:2023 Broken Object Property Level Authorization](/notes/api-security/owasp-api-top-10/api3-broken-object-property-level-authorization/)
4. [API4:2023 Unrestricted Resource Consumption](/notes/api-security/owasp-api-top-10/api4-unrestricted-resource-consumption/)
5. [API5:2023 Broken Function Level Authorization](/notes/api-security/owasp-api-top-10/api5-broken-function-level-authorization/)
6. [API6:2023 Unrestricted Access to Sensitive Business Flows](/notes/api-security/owasp-api-top-10/api6-unrestricted-access-to-sensitive-business-flows/)
7. [API7:2023 Server Side Request Forgery](/notes/api-security/owasp-api-top-10/api7-server-side-request-forgery/)
8. [API8:2023 Security Misconfiguration](/notes/api-security/owasp-api-top-10/api8-security-misconfiguration/)
9. [API9:2023 Improper Inventory Management](/notes/api-security/owasp-api-top-10/api9-improper-inventory-management/)
10. [API10:2023 Unsafe Consumption of APIs](/notes/api-security/owasp-api-top-10/api10-unsafe-consumption-of-apis/)

## Injection

Injection was API8:2019. It happens when the API passes client input to a backend interpreter without separating data from commands. The usual forms are SQL injection, NoSQL injection, and operating system command injection.

The API does not filter the input, so the supporting infrastructure treats data from the request as code and runs it. If an attacker sends SQL in a field and the API hands it to a SQL database, the database executes it.

Clues that injection is possible are verbose error messages, odd HTTP status codes, and unexpected behavior. For example, sending `' OR 1=0--` as an address during registration may produce a database error:

```
POST /api/v1/register HTTP/1.1
Host: example.com

{
  "Fname": "hAPI",
  "Lname": "Hacker",
  "Address": "' OR 1=0--"
}
```

A response such as "Error: You have an error in your SQL syntax" means the input reached the database. Any response that comes straight from a database or supporting system points the same way.

Finding injection means testing endpoints, watching how the API responds, and crafting requests that try to manipulate the backend.

### Mitigation

* Keep data separate from commands and queries.
* Prefer a safe API with a parameterized interface.
* Validate, filter, and sanitize all client-provided data and all data from integrated systems, using one well-maintained library.
* Define data types and strict patterns for every string parameter.
* Limit the number of records returned, so an injection cannot dump everything.

## Insufficient logging and monitoring

This was API10:2019. Without logging and monitoring, attacks on an API go unnoticed until it is far too late, and there is no evidence to work from afterwards.

Logs show patterns in API usage and how an API is abused. They give an audit trail that compliance often requires, and the logs need integrity so an attacker cannot alter them. Monitoring helps spot suspicious activity and anomalous user behavior.

### Mitigation

* Log failed authentication attempts, denied access, and input validation errors.
* Use a log format that a log management system can consume, with enough detail to identify the actor.
* Treat logs as sensitive data and protect their integrity at rest and in transit.
* Aggregate logs from the whole stack in a SIEM, and monitor the infrastructure, network, and API.
* Build dashboards and alerts for suspicious activity.

## Business logic flaws

Business logic flaws (BLF) are intended features of an application that an attacker can use maliciously. They are specific to each API provider's policies and features, so there is no one-size-fits-all test, and automated scanners struggle to find them because the flaw is part of normal use.

Two common causes are misplaced trust and the assumption that clients only use the browser UI. For example, if an API has an upload feature that tells users to upload only certain encoded payloads but does not validate them, a user can upload any file as long as it is encoded.

Credentials such as API keys, tokens, and passwords also get stolen and leaked. A trusted consumer whose credentials are stolen becomes a way in.

Signs of a possible flaw in the API documentation are statements like:

* "Only use feature X to perform function Y."
* "Do not do X with endpoint Y."
* "Only admins should perform request X."

Those statements suggest the provider is trusting you to behave. An attacker can simply ignore them and see whether a technical control exists.

If a login request carries a flag such as `MFA=true`, changing it to `false` is worth trying:

```
POST /api/v1/login HTTP/1.1
Host: example.com

UserId=hapihacker&password=arealpassword!&MFA=true
```

To test for these flaws, study how the business and the API work, then try to break the assumptions the design makes.

### Mitigation

* Threat model the business processes and workflows the API supports during design.
* Reduce or remove trust relationships between users, systems, and components.
* Train developers on secure coding and on spotting logic flaws while designing and coding.
* Offer a bug bounty program, third-party penetration testing, or a disclosure policy, so people outside the project can report flaws.
