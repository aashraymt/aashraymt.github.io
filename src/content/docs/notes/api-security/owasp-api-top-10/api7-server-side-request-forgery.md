---
title: "API7:2023 Server Side Request Forgery"
description: "Server Side Request Forgery (SSRF) happens when a user can control the remote resources an application retrieves."
kind: note
category: "API Security"
tags: [api-security, owasp-api, notes]
order: 60
status: published
source: repo
---

Server Side Request Forgery (SSRF) happens when a user can control the remote resources an application retrieves. The attacker supplies a URL through the API and the server fetches it. That can expose private data, scan the internal network, or lead to remote code execution. SSRF was also number 10 in the 2021 OWASP Top 10.

Exploitation needs an endpoint that accesses a client-supplied URI. Basic SSRF, where the response comes back to the attacker, is easier than blind SSRF, where there is no feedback. Modern development habits encourage fetching client-provided URIs, and missing or weak validation of them is common. Impact includes enumerating internal services (port scanning), information disclosure, bypassing firewalls and other controls, DoS, or using the server as a proxy to hide other activity.

## In-band SSRF

The server returns the content of the resource the user pointed it at. If the attacker supplies `http://example.com` to a vulnerable server, the server fetches it and sends the content back.

Intercepted request:

```
POST api/v1/store/products
headers...

{
  "inventory": "http://store.com/api/v3/inventory/item/12345"
}
```

Attack, with the URL replaced (the section signs mark the Burp Intruder payload position):

```
POST api/v1/store/products
headers...

{
  "inventory": "http://localhost/secrets"
}
```

Response:

```
HTTP/1.1 200 OK
headers...

{
  "secret_token": "<redacted>"
}
```

## Out-of-band (blind) SSRF

The server makes the request but does not send the fetched content back, so the attacker gets no direct sign that it worked. To know whether the request happened, the attacker needs to control the destination server.

The same attack against a blind-SSRF target returns an empty body:

```
HTTP/1.1 200 OK
headers...

{}
```

An empty response does not show whether the server is vulnerable. Instead of `http://localhost/secrets`, the attacker points the URL at a server they can watch. Burp Suite Collaborator (in Burp Suite Pro) provides one, and webhook.site is a free alternative that generates a random URL and logs any request made to it.

An out-of-band attack then looks like this:

```
POST api/v1/store/products
headers...

{
  "inventory": "https://webhook.site/<your-random-id>"
}
```

After sending the request, check the third-party site for new requests. If one arrived from the API's server, the API is vulnerable to out-of-band SSRF.

<figure><img src="https://3542531408-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FSyIJeOUWOBybHBLrjf9m%2Fuploads%2FDFAfUaSJBOW9jwTwLiPt%2Fimage.png?alt=media&amp;token=4db09aeb-6ba3-4b68-b2cc-28c6d6477d21" alt=""><figcaption></figcaption></figure>

## Mitigation

* Isolate the resource-fetching mechanism in your network, since these features are meant to retrieve remote resources, not internal ones.
* Use allow lists where possible: remote origins users may fetch from, URL schemes and ports, and accepted media types.
* Disable HTTP redirections.
* Use a well-tested URL parser to avoid parsing inconsistencies.
* Validate and sanitize all client-supplied input.
* Do not send raw responses back to clients.

## References

* [Server Side Request Forgery](https://owasp.org/www-community/attacks/Server_Side_Request_Forgery)
* [Server-Side Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
* [CWE-918: Server-Side Request Forgery (SSRF)](https://cwe.mitre.org/data/definitions/918.html)
* [Web Security Academy: SSRF](https://portswigger.net/web-security/ssrf)
