---
title: "API8:2023 Security Misconfiguration"
description: "Security misconfiguration is a catch-all for weaknesses in the systems that host an API."
kind: note
category: "API Security"
tags: [api-security, owasp-api, notes]
order: 70
status: published
source: repo
---

Security misconfiguration is a catch-all for weaknesses in the systems that host an API. It can happen at any level of the stack, from the network to the application, and the impact ranges from information disclosure to a full server compromise. Attackers look for unpatched flaws, common endpoints, and unprotected files and directories, and automated tools exist to find unnecessary services and legacy options.

## What it includes

* Misconfigured headers
* Misconfigured transit encryption
* Default accounts
* Unnecessary HTTP methods
* Missing input sanitization
* Verbose error messages

If the configuration reveals an unpatched vulnerability, a published exploit may be enough to compromise the API and its host.

### Input handling

Missing input sanitization can let attackers upload malicious payloads. If an upload endpoint stores files in a web directory, an uploaded script can be run by browsing to its URL, which gives shell access to the web server. It can also cause unexpected application behavior.

### Headers

Providers use headers to tell the consumer how to handle a response and what the security requirements are. Misconfigured headers can lead to information disclosure, downgrade attacks, and cross-site scripting. Extra services running alongside the API often add headers for metrics or as a sign of assurance.

* `X-Powered-By` reveals the backend technology, often with the exact service and version. That is enough to search for published exploits for it.
* `X-XSS-Protection` is meant to control the browser's XSS filter. A value of `0` means it is off and `1` means it is on. Headers like this show whether a control is in place.
* `X-Response-Time` comes from middleware that reports usage metrics (566.43 milliseconds in the screenshot). If the API is configured poorly, it becomes a side channel. Suppose a made-up account like `/user/account/thisdefinitelydoesnotexist` always returns about 25.5 ms, while a real account like `/user/account/1021` returns about 510 ms. An attacker can brute force account numbers and watch for the slower responses to learn which ones exist.

### Transport encryption

Any API that returns sensitive information should use TLS, even if it is only internal, private, or for partners. Missing or misconfigured encryption sends data in cleartext, and an attacker who intercepts traffic with a tool like Wireshark in a man-in-the-middle position can read it.

### Default accounts and methods

If a service keeps default credentials and they are known, an attacker can use them to take on that account's role, reach sensitive data or admin functions, and compromise the supporting systems. Unnecessary HTTP methods raise the risk that the application handles them badly or discloses information.

## Detection

Security misconfiguration is one of the few categories that web application scanners can detect. Scanners such as Burp Suite, Nessus, Qualys, OWASP ZAP, and Nikto check responses for version information, headers, cookies, transit encryption configuration, and parameters, and flag missing security measures. The same checks can be done by hand by inspecting headers, the TLS certificate, cookies, and parameters.

## Mitigation

* Build a repeatable hardening process that produces a locked-down environment quickly.
* Review and update configuration across the whole stack, including orchestration files, API components, and cloud services (for example S3 bucket permissions), and automate continuous checks in every environment.
* Use TLS for all communication between client, API, and any upstream or downstream components, internal or public.
* Allow only the HTTP verbs each API needs, and disable the rest.
* For browser-facing APIs, set a proper CORS policy and the applicable security headers.
* Restrict incoming content types to what the functionality requires.
* Make every server in the HTTP chain (load balancers, proxies, back ends) process requests the same way, to avoid desync issues.
* Define and enforce schemas for response payloads, including error responses, so exception traces do not leak.

## References

* [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
* [Configuration and Deployment Management Testing, Web Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/README)
* [Testing for Error Handling, Web Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/08-Testing_for_Error_Handling/README)
* [CWE-16: Configuration](https://cwe.mitre.org/data/definitions/16.html)
* [CWE-209: Generation of Error Message Containing Sensitive Information](https://cwe.mitre.org/data/definitions/209.html)
* [CWE-319: Cleartext Transmission of Sensitive Information](https://cwe.mitre.org/data/definitions/319.html)
* [CWE-444: Inconsistent Interpretation of HTTP Requests](https://cwe.mitre.org/data/definitions/444.html)
* [CWE-942: Permissive Cross-domain Policy with Untrusted Domains](https://cwe.mitre.org/data/definitions/942.html)
* [Guide to General Server Security, NIST SP 800-123](https://csrc.nist.gov/publications/detail/sp/800-123/final)
