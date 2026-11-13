---
title: "API10:2023 Unsafe Consumption of APIs"
description: "This is the one item on the list that is about the API consumer rather than the provider. It is a trust problem."
kind: note
category: "API Security"
tags: [api-security, owasp-api, notes]
order: 90
status: published
source: repo
---

This is the one item on the list that is about the API consumer rather than the provider. It is a trust problem. Data from a third-party API should be treated with the same suspicion as end-user input, meaning little to no trust. If the third party is compromised, the connection back to the consumer becomes a new path for the attacker, and an organization that consumes that data insecurely can be compromised through it.

## Why it happens

Exploiting it means identifying the services the target API integrates with and possibly compromising them. That information is often not public, and the integrated service is often not easy to exploit. Developers tend to trust and not verify the endpoints that talk to external APIs, with weaker requirements for transport security, authentication and authorization, and input validation. The impact depends on what the API does with the pulled data: sensitive information exposure, many kinds of injection, or denial of service.

Most of the 2023 list is about the provider side. An API is often the path of least resistance, so a compromised third-party provider can become another attack vector into every business connected to it. If the connection is unencrypted, the data can be captured in clear text. If the third party is not held to the same standards as an Internet-facing API, it can also be vulnerable to injection, authorization flaws, and other attacks.

## Mitigation

* Assess the API security posture of service providers before integrating.
* Make sure all interactions with integrated APIs use TLS.
* Validate and sanitize data received from integrated APIs before using it.
* Keep an allowlist of the locations an integrated API may redirect yours to, and do not follow redirects blindly.

## References

* [Web Service Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Web_Service_Security_Cheat_Sheet.html)
* [Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
* [Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html)
* [Transport Layer Protection Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html)
* [Unvalidated Redirects and Forwards Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html)
* [CWE-20: Improper Input Validation](https://cwe.mitre.org/data/definitions/20.html)
* [CWE-200: Exposure of Sensitive Information to an Unauthorized Actor](https://cwe.mitre.org/data/definitions/200.html)
* [CWE-319: Cleartext Transmission of Sensitive Information](https://cwe.mitre.org/data/definitions/319.html)
