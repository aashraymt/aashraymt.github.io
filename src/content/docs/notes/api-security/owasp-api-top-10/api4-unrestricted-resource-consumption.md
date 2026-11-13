---
title: "API4:2023 Unrestricted Resource Consumption"
description: "The provider has no safeguards against excessive use of the API. That opens the door to denial of service (DoS) and to unnecessary cost."
kind: note
category: "API Security"
tags: [api-security, owasp-api, notes]
order: 30
status: published
source: repo
---

The provider has no safeguards against excessive use of the API. That opens the door to denial of service (DoS) and to unnecessary cost. This category is the updated version of API4:2019 Lack of Resources and Rate Limiting.

## Why it matters

Every API request has a technical and a financial cost. Without limits there is a higher risk of DoS and DDoS, higher bills, and worse service for other users. Rate limiting also matters for monetization, since many providers sell higher request quotas to paying customers. Where infrastructure scales automatically with traffic, unlimited requests turn directly into a larger and easily preventable bill.

Exploitation needs only simple requests, which can be sent concurrently from one machine or from cloud resources. To find the problem, craft requests with parameters that control how many resources come back, then analyze response status, time, and length. The same applies to batched operations. An attacker cannot see the cost, but can infer it from the provider's pricing model.

## What can be missing

An API is vulnerable if at least one of these limits is missing or set badly (too low or too high):

* Execution timeouts
* Maximum allocable memory
* Maximum number of file descriptors
* Maximum number of processes
* Maximum upload file size
* Number of operations in a single client request (for example GraphQL batching)
* Number of records per page in a single response
* Spending limits with third-party service providers

## Mitigation

* Limit memory, CPU, restarts, file descriptors, and processes at the container level.
* Limit how often a client can call the API in a defined time frame.
* Tell the client when the limit is exceeded, with the limit and when it resets.
* Validate query string and body parameters on the server, especially the one that controls how many records are returned.
* Enforce maximum sizes on all incoming parameters and payloads, such as string length and array element count.

## References

* ["Availability", Web Service Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Web_Service_Security_Cheat_Sheet.html#availability)
* ["DoS Prevention", GraphQL Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/GraphQL_Cheat_Sheet.html#dos-prevention)
* ["Mitigating Batching Attacks", GraphQL Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/GraphQL_Cheat_Sheet.html#mitigating-batching-attacks)
* [CWE-770: Allocation of Resources Without Limits or Throttling](https://cwe.mitre.org/data/definitions/770.html)
* [CWE-400: Uncontrolled Resource Consumption](https://cwe.mitre.org/data/definitions/400.html)
* [CWE-799: Improper Control of Interaction Frequency](https://cwe.mitre.org/data/definitions/799.html)
* "Rate Limiting (Throttling)" in [Security Strategies for Microservices-based Application Systems](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-204.pdf), NIST
