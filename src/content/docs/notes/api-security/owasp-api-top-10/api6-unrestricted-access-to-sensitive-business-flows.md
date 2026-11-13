---
title: "API6:2023 Unrestricted Access to Sensitive Business Flows"
description: "This category is about an attacker identifying and abusing an API-driven workflow."
kind: note
category: "API Security"
tags: [api-security, owasp-api, notes]
order: 50
status: published
source: repo
---

This category is about an attacker identifying and abusing an API-driven workflow. The abuse can mean spamming other users, buying up all the stock of a sought-after item, or stopping other people from using a feature. It is new in the 2023 list.

Exploitation usually starts with understanding the business model behind the API, finding the sensitive flows, and automating access to them. Little technical impact is expected. The harm lands on the business, for example by blocking legitimate customers from buying a product, or inflating the internal economy of a game. The issue is common because teams rarely look at the whole API against business requirements. Attackers work out which endpoints make up a workflow and how they fit together, and if protections exist, they look for ways around them.

## Flows

A flow is a series of requests and responses that lead to an operation. If a purchase flow does not restrict access, a scalper can automate requests to drain the stock of an item. A CAPTCHA that needs human interaction interrupts that automation and slows it down.

## Mitigation

Plan the mitigation in two layers. On the business side, identify the flows that could hurt the business if used excessively. On the engineering side, pick protections that fit that risk:

* Device fingerprinting: deny service to unexpected clients such as headless browsers, which pushes attackers toward costlier solutions.
* Human detection: CAPTCHA or more advanced methods such as typing patterns.
* Non-human pattern detection: for example, reaching "add to cart" and "complete purchase" in under a second.
* Consider blocking Tor exit nodes and well-known proxies.
* Secure and limit APIs consumed directly by machines (developer and B2B APIs). They often lack the protections other APIs have.

## References

* [OWASP Automated Threats to Web Applications](https://owasp.org/www-project-automated-threats-to-web-applications/)
* [API10:2019 Insufficient Logging & Monitoring](https://github.com/OWASP/API-Security/blob/master/2019/en/src/0xaa-insufficient-logging-monitoring.md)
