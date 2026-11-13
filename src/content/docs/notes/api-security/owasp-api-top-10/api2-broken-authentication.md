---
title: "API2:2023 Broken Authentication"
description: "Broken authentication covers any weakness in how an API verifies who is calling it, whether the caller is a person, a device, or another system."
kind: note
category: "API Security"
tags: [api-security, owasp-api, notes]
order: 10
status: published
source: repo
---

Broken authentication covers any weakness in how an API verifies who is calling it, whether the caller is a person, a device, or another system. Verification normally uses a username and password, a token, multi-factor authentication, or a combination. The weaknesses appear when the provider does not implement strong authentication or implements it incorrectly.

## Why it is common

The authentication mechanism is exposed to everyone, so it is an easy target, and exploitation tools are generally available. Engineers often misjudge where the authentication boundary is, and the implementation is more complex than it looks. If it fails, an attacker can take over accounts, read personal data, and perform sensitive actions as the user, and the system usually cannot tell the difference.

Authentication is often one of the first lines of defense for an API, so a weakness here can turn straight into a data breach.

<figure><img src="https://3542531408-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FSyIJeOUWOBybHBLrjf9m%2Fuploads%2FlFyfmCf8NjeCBxodzTIU%2Fimage.png?alt=media&amp;token=083bb214-b436-41ed-b640-01b1a616c811" alt=""><figcaption></figcaption></figure>

## Weak password policy

The policy does not force strong passwords or protect account management:

* Allows simple passwords.
* Allows brute force attempts against accounts.
* Lets users change a password or an account email without confirming the current password.
* Discloses a token or password in the URL.
* Allows many authentication attempts in one GraphQL request.
* Has no authentication on sensitive requests.

## Credential stuffing

Large numbers of username and password pairs, usually collected from earlier data breaches, are tried against the API. It works when the API allows unlimited attempts.

## Predictable tokens

Tokens produced by a weak generation process can be guessed, deduced, or calculated. Incremental or guessable token IDs are the typical case.

## Misconfigured JSON Web Tokens

JWTs let developers pick the signing algorithm, the key, and the payload contents, which leaves a lot of room for misconfiguration:

* The API accepts unsigned JWTs.
* The API does not check expiration.
* Sensitive information sits in the encoded payload.
* The JWT is signed with a weak key.

## Where the weaknesses come from

REST APIs are designed to be stateless, so the provider does not remember the consumer between requests. To make that work, APIs usually hand out a token at registration and expect it on later requests. That means the registration process, the token handling, and the token generator can each have their own weaknesses. If token generation does not use enough randomness (entropy), an attacker may be able to forge a token or hijack someone else's.

Password reset and multi-factor features have the same problem. Suppose a reset needs an email address and a six-digit code. If the API allows unlimited requests, guessing the code takes at most one million tries. A four-digit code takes at most ten thousand.

## Mitigation

* Know every flow that can authenticate to the API (mobile, web, deep links with one-click login) and ask engineers which ones were missed.
* Use standards for authentication, token generation, and password storage. OAuth is not authentication by itself, and neither are API keys.
* Treat password recovery endpoints like login endpoints for brute force, rate limiting, and lockout.
* Require re-authentication for sensitive operations such as changing the account email or 2FA phone number.
* Use multi-factor authentication where possible.
* Apply anti-brute-force controls that are stricter than normal rate limiting, plus account lockout or CAPTCHA and weak-password checks.
* Use API keys to authenticate API clients only, not users.

## References

* [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
* [Key Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html)
* [Credential Stuffing](https://owasp.org/www-community/attacks/Credential_stuffing)
* [CWE-204: Observable Response Discrepancy](https://cwe.mitre.org/data/definitions/204.html)
* [CWE-307: Improper Restriction of Excessive Authentication Attempts](https://cwe.mitre.org/data/definitions/307.html)
* [CWE-798: Use of Hard-coded Credentials](https://cwe.mitre.org/data/definitions/798.html)
* [Web Security Academy: Authentication](https://portswigger.net/web-security/authentication)
* [Web Security Academy: JWT Attacks](https://portswigger.net/web-security/jwt)
