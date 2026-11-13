---
title: "API Security"
description: "Notes on how APIs authenticate callers, how tokens work, and where the common mistakes are."
kind: index
category: "API Security"
tags: [api-security, notes]
order: 10
status: published
source: repo
---

Notes on how APIs authenticate callers, how tokens work, and where the common mistakes are. The deeper material on error handling, headers, cookies, path traversal, and rate limiting is on the [API Authentication](/notes/api-security/api-authentication/) page, and the vulnerability categories are in the [OWASP API Security Top 10](/notes/api-security/owasp-api-top-10/).

## Authentication vs authorization

| Concept | Meaning |
| --- | --- |
| Authentication | Identifies who is making the request (user or machine) |
| Authorization | Determines what that entity is allowed to do |

Authorization is impossible without authenticating the entity first.

## API authentication methods

### 1. Basic authentication

* Uses the `Authorization` HTTP header with the `Basic` scheme.
* Sends `username:password` as Base64, which is an encoding, not encryption.
* Often used for quick machine or user identity checks.
* Risk: the credentials go out with every request and are trivially decoded by anyone who sees them, so TLS is mandatory.

### 2. API keys

* A single static token that identifies the calling app.
* Used for rate limiting, throttling, monetization, and analytics.
* Simple to implement, but limited: it identifies the app, not the user.
* Keys often end up hardcoded in source or leaked through logs.

### 3. mTLS (mutual TLS)

* Both client and server present certificates.
* Strong, encrypted machine authentication.
* Certificate management is complex, and it is not suited to end-user authentication.

### 4. Token-based authentication

* Tokens are issued by an identity provider (IdP) and verified by the API.
* Supports expiration, refresh, audiences, scopes, and embedded claims such as roles.
* Makes stateless, scalable API authentication possible.

## OAuth 2.0 and OpenID Connect (OIDC)

### OAuth 2.0

* A delegation protocol for controlled access to APIs.
* Apps no longer have to handle user credentials: access without password sharing.
* OAuth 2.0 dates from 2012. OAuth 2.1 is the upcoming cleanup and stays backward compatible with the current flows.

### OpenID Connect

* An identity layer built on top of OAuth 2.0.
* Adds user identity information such as email and profile.
* Enables federated login (for example "Sign in with Google") and SSO. It is not typically used for machine-only APIs.

### OAuth architecture

| Actor | Description |
| --- | --- |
| Resource Owner (RO) | The user who owns the data |
| Client | The application requesting access |
| Authorization Server (AS) | Authenticates the user and issues tokens |
| Resource Server (RS) | The API hosting the protected resources |

Flow summary: the user authorizes, the client receives a token, and the client calls the API with that token.

### OAuth is delegation, not authorization

The user delegates limited access to an app. The actual authorization decisions still happen at the API (the resource server).

An analogy: your boss (resource owner) gives you (client) a signed note (token) to take to the bank (API). The bank may still refuse certain actions. Delegation does not mean full access.

### Common OAuth flows

| Flow | Use case | Involves user | Refresh token |
| --- | --- | --- | --- |
| Authorization Code (with PKCE) | Web and mobile apps | Yes | Yes |
| Refresh Token | Session renewal | Needs a valid refresh token | Yes |
| Client Credentials | Machine to machine | No | No |

#### Authorization Code flow (with PKCE)

Best for user-facing web and mobile apps.

1. The client redirects the user to `/authorize` with a `code_challenge`.
2. The user authenticates and the authorization server returns a one-time code.
3. The client sends a `/token` request with the `code_verifier`.
4. The server issues an access token and a refresh token.

PKCE stops a stolen authorization code from being redeemed by someone else.

#### Refresh Token flow

* Used to get new access tokens without a new login.
* Refresh tokens are long-lived (hours to months).
* Rotate refresh tokens where possible.

#### Client Credentials flow

* For backend jobs, cron tasks, and microservices.
* No user interaction.
* The client sends its own credentials to get an access token.
* Access tokens are short-lived and there is no refresh token.

## Tokens

### Token formats

| Type | Description | Pros | Cons |
| --- | --- | --- | --- |
| By reference (opaque) | Random string validated through introspection | Privacy | Needs an extra call |
| By value (JWT) | Self-contained and signed | Fast, no lookup | Sensitive data is exposed if it leaks |

### Token purposes

| Token | Used by | Purpose |
| --- | --- | --- |
| Access token | Client to API | Grants API access |
| Refresh token | Client to authorization server | Gets new access tokens |
| ID token | Client only | Provides identity (OIDC) |

### Token types

| Type | Analogy | Description |
| --- | --- | --- |
| Bearer | Cash | Whoever holds it can use it |
| Proof of Possession (PoP) | Credit card plus PIN | The holder must prove ownership of the token (DPoP or mTLS) |

## JSON Web Tokens (JWT)

Structure: `<Header>.<Payload>.<Signature>`

* Header: algorithm (`alg`) and key ID (`kid`).
* Payload: `sub`, `iss`, `aud`, `exp`, `iat`, `scope`, and custom claims.
* Signature: protects integrity.

A JWS is a signed JWT (the common case). A JWE is an encrypted JWT, used when the contents must be confidential.

Security tips:

* Reject `alg: none`.
* Validate the signature, `exp`, `aud`, and `iss`.
* Do not trust token contents without verifying the signature.
* Do not rely on a client decoding a JWT to make security decisions.

## Scopes and claims

| Concept | Description | Example |
| --- | --- | --- |
| Scope | What an app can do | `invoice_read` |
| Claim | Who the user is, or attributes of the user | `"email": "jacob@example.com"` |

* Scopes are coarse-grained, app-level permissions.
* Claims are fine-grained, user-level data.

```json
{
  "scope": "invoice_read",
  "claims": {
    "sub": "jacob123",
    "department": "Finance"
  }
}
```

Best practices:

* Keep scopes broad and few (`invoice_read`, not `invoice_read_1`).
* Use claims for fine-grained resource checks.
* Include only trusted attributes.
* Never put sensitive data in claims.
* Combine both for layered authorization.

## API gateway and token validation

| Component | Role |
| --- | --- |
| Gateway | Validates tokens and checks scopes |
| API | Evaluates claims for fine-grained access |

1. The gateway receives the token and validates it through `/introspect` or `/token_exchange`.
2. The gateway passes the JWT downstream.
3. The API verifies the claims and applies access rules.

Every layer validates identity and intent, which fits a Zero Trust design.

## API-to-API token strategies

| Method | Description | Use case |
| --- | --- | --- |
| Exchange | Request a new token with reduced scopes | Scoped delegation |
| Embed | Pass downstream tokens inside the main token | Controlled service chaining |
| Share | Reuse the token (same trust zone only) | Internal APIs |

## Mitigation

* Send credentials only over TLS, and prefer tokens over Basic authentication.
* Use Authorization Code with PKCE for user-facing apps and Client Credentials for machine-to-machine calls.
* Validate the signature, `exp`, `aud`, and `iss` on every JWT, and reject `alg: none`.
* Keep access tokens short-lived and rotate refresh tokens.
* Keep scopes coarse and enforce fine-grained authorization inside the API using claims.
