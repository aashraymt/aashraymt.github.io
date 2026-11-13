---
title: "API9:2023 Improper Inventory Management"
description: "This category covers exposing non-production and unsupported API versions."
kind: note
category: "API Security"
tags: [api-security, owasp-api, notes]
order: 80
status: published
source: repo
---

This category covers exposing non-production and unsupported API versions. Those versions rarely get the same security attention as production, which makes them a way into other vulnerabilities.

Attackers typically get in through old API versions or endpoints that were left running unpatched with weaker requirements, or through a third party that has no reason to hold the data. Outdated documentation makes problems harder to find and fix, and a missing asset inventory and retirement plan leaves unpatched systems running. Microservices and cloud deployment make it easy to expose API hosts by accident. Google dorking, DNS enumeration, and internet-wide search engines are often enough to find targets.

Different versions or deployments are sometimes connected to the same database with real data, so an old version can give access to administrative functions or known vulnerabilities, and from there to sensitive data or the server.

## How it shows up

Old versions are more likely to hold vulnerabilities because nobody patches them. APIs still in development are usually less secure than production. Finding such an API is only the first step, and it can lead to excessive data exposure, information disclosure, mass assignment, missing rate limits, and injection.

Testing can start from outdated documentation, changelogs, and version history in repositories. If the docs mention `apiv1.org/admin` while the API now uses `apiv3.org/admin`, it is worth checking whether v1 and v2 still respond. A changelog may even say why v1 was retired, which points at weaknesses to test for. Versions often appear in paths (`/v1/`, `/v2/`, `/v3/`), and APIs still in development often use `/alpha/`, `/beta/`, `/test/`, `/uat/`, and `/demo/`.

Without documentation, guessing, fuzzing, and brute force can also reveal older and non-production versions. Newer versions usually appear on a new path:

* `api.target.com/v3`
* `/api/v2/accounts`
* `/api/v3/accounts`
* `/v2/accounts`

Versions can also be set in a header:

* `Accept: version=2.0`
* `Accept: api-version=3`

Or in a query parameter or the request body:

* `/api/accounts?ver=2`

```
POST /api/accounts

{
  "ver": 1.0,
  "user": "hapihacker"
}
```

Non-production versions are anything not meant for end users, for example:

* `api.test.target.com`
* `api.uat.target.com`
* `beta.api.com`
* `/api/private`
* `/api/partner`
* `/api/test`

## Mitigation

* Inventory all API hosts, with environment (production, staging, test, development), who should have network access (public, internal, partners), and API version.
* Inventory integrated services, including their role, the data exchanged, and its sensitivity.
* Document authentication, errors, redirects, rate limiting, CORS policy, and every endpoint with its parameters, requests, and responses.
* Generate documentation automatically from open standards and build it in the CI/CD pipeline. Make it available only to those authorized to use the API.
* Protect every exposed version with external controls such as an API security firewall, not only the current production one.
* Keep production data out of non-production deployments. If that is unavoidable, give those endpoints the same protection as production.
* When a newer version fixes security problems, do a risk analysis for the old one: backport the fixes if compatibility allows, or retire it quickly and move all clients over.

## References

* [CWE-1059: Incomplete Documentation](https://cwe.mitre.org/data/definitions/1059.html)
* [OpenAPI Initiative](https://www.openapis.org/)
