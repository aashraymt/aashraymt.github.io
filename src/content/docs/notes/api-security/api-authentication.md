---
title: "API Authentication"
description: "Notes on the places where API authentication and the code around it leak information: error messages, response headers, cookies, file paths, and missing rate limits."
kind: note
category: "API Security"
tags: [api-security, notes]
order: 10
status: published
source: repo
---

## Error disclosure

Error disclosure means exposing too much information in error messages, especially through APIs. Even if an error never shows up in the UI, it is still returned in the response (in Postman, the console, or a script), and an attacker reads it there.

### Why it is dangerous

* Errors can expose internal details: frameworks (Spring means Java), database technologies, stack traces, and library versions that may have known CVEs.
* Attackers use that to learn the tech stack, find known vulnerabilities, and craft better attacks.

### Bad and good error handling

**Bad:** a detailed message such as `"SQL syntax error at line 4 in com.spring..."`. It tells the attacker the app uses the Spring Framework and probably Java, which is a starting point.

**Good:** a generic message such as `"An error occurred. Please try again."`. It does not confirm whether an email exists or whether an injection worked.

### Security-aware error handling

Do:

* Fail early, so malicious attempts stop quickly.
* Use generic error messages for users.
* Send detailed error information only to developers and support, for example through internal logs.
* Use error IDs to trace errors without revealing details to users.
* Use `try`/`catch` blocks to stop execution on unexpected errors and to control what gets logged and what gets returned.

Do not:

* Return raw stack traces or system errors to users.
* Let unhandled exceptions reach the frontend or the client.
* Leak details about the backend technology or logic.
* Return different error responses that allow user enumeration.

### Code patterns to watch

* `try`/`except` in Python or `try`/`catch` in Node.js: do not just `print(error)` or `return error`. Log the error securely on the backend instead.
* Some frameworks (Express and Django, for example) can return uncaught errors automatically.

### Think like an attacker

Ask how an error could help someone attack you. Attackers do not only use the UI, they hit the API directly, so protect the frontend and the backend the same way.

GitHub returns a 404 for a private page you are not authorized to see, even though the page exists. That prevents enumeration of private resources.

| Do | Do not |
| --- | --- |
| Fail early | Return detailed technical information |
| Use generic public errors | Let stack traces reach the client |
| Log details privately | Help attackers learn the system |
| Use error IDs to link logs | Show differences between existing and missing users or emails |
| Stop on unknown exceptions | Assume everyone uses the UI |

## Server information leaks

A server can reveal its type, version, and tech stack in HTTP response headers. Attackers use that to understand the stack, find CVEs, and exploit them. Even logged-in APIs can leak this, because attackers skip the UI and call the API directly.

### Where the leak happens

Response headers, visible in Chrome DevTools, Postman, Node.js scripts, and `curl -I`. Common examples:

* `Server: Uvicorn` or `Server: nginx`
* `X-Powered-By: Express`
* `Version: 1.2.3` or similar

Uvicorn tells an attacker the server is Python-based, and its source code and CVEs are public. nginx is very common and is also used as a cache or reverse proxy. The less common the server, the more it stands out.

### Attack process

1. Open Chrome DevTools, go to the Network tab, and look at the headers.
2. Find the server header (for example `Server: Uvicorn`).
3. Look the server up online to understand its ecosystem.
4. Search for known vulnerabilities (for example "Uvicorn CVEs").
5. Use that to craft attacks or find misconfigurations.

### Headers to look for

| Header | Why it is risky |
| --- | --- |
| `Server` | Reveals the server software (for example Apache) |
| `X-Powered-By` | Exposes the framework (for example Express) |
| `Version` | Gives the exact version |

### Removing server information

| Server | Method |
| --- | --- |
| Uvicorn | Start it with `--no-server-header` |
| nginx | `server_tokens off;` in `nginx.conf` |
| Express/Node.js | Use the `helmet` package or `app.disable('x-powered-by')` |
| IIS | Remove the header through configuration settings |
| Others | Search for "[server] remove server header" |

Most modern servers have a built-in option to hide identifying headers.

## Cookies

Cookies store key-value data on the user's device. They persist across sessions and are used for authentication, session tracking, and personalization. If they are not protected, the data in them can be stolen, modified, or abused.

### Common cookie risks

1. **Cookie forging:** a malicious user alters cookie data to impersonate someone or escalate privileges.
2. **Harvesting through JavaScript:** if cookies are readable by JavaScript and the site has a cross-site scripting (XSS) flaw, the cookies can be stolen.
3. **Harvesting in transit:** cookies sent over plain HTTP can be intercepted, for example in a man-in-the-middle attack.

### Cookie attributes

| Attribute | Purpose |
| --- | --- |
| `Secure` | Sends the cookie only over HTTPS |
| `HttpOnly` | Stops JavaScript from reading the cookie |
| `Path` | Restricts the cookie to specific URLs or subdirectories |
| `SameSite` | Limits cross-site sending, which helps against CSRF |
| `Expires` / `Max-Age` | Sets the lifespan of the cookie |

### How attackers look at cookies

* Inspect them in browser dev tools (Network tab, headers).
* Split the cookie string on its delimiters: `;` between pairs and `=` between key and value.
* Look for session IDs, user roles, booleans or numbers that are easy to guess or change, and Base64 or URL-encoded values.

Base64 data can be decoded, modified, re-encoded, and sent back.

Example workflow:

1. Extract the cookie.
2. Decode or inspect the data.
3. Modify values (a session ID or a role, for example).
4. Re-encode if needed (Base64, for example).
5. Send the cookie back in the request.
6. Watch whether access changes or behavior shifts.

### Best practices

Treat cookies as untrusted input: validate and sanitize them like any other user input. Set these flags:

| Flag | Why it matters |
| --- | --- |
| `HttpOnly` | Blocks access from JavaScript, which reduces the impact of XSS |
| `Secure` | Prevents theft over unsecured HTTP |
| `Expires` | Makes the cookie delete itself after a defined period |

Store only what is necessary in a cookie (a session ID, for example), never business logic, table names, roles, or sensitive IDs.

### Check your own cookies

Open your own site and inspect its cookies. Can you decode or understand anything easily? Is sensitive logic stored in plain or encoded form? Are the values guessable or modifiable?

| Do | Do not |
| --- | --- |
| Set `HttpOnly`, `Secure`, and `Expires` | Let JavaScript read cookies unless necessary |
| Treat cookies as untrusted input | Store sensitive data or business logic in them |
| Decode and test cookie values the way an attacker would | Assume cookies cannot be modified or stolen |
| Review all cookies through the response headers | Forget that cookies are visible and modifiable |

## Path traversal

A path traversal vulnerability lets an attacker reach files or directories outside the intended web root. It can come from:

* Dynamic file includes that use user input directly in file paths.
* Misconfigured servers.
* Loose API specs, such as parameters typed as plain strings with no constraints.

### Why it is dangerous

It can expose sensitive files such as `/etc/passwd` on Linux, environment configs, log files, and source code, and with them secrets, credentials, and internal logic.

### Common causes

| Category | Example |
| --- | --- |
| Insecure coding | Using user input directly in file paths |
| Loose input validation | Accepting raw strings with no constraints |
| Server misconfiguration | Directory listings enabled, includes outside the web root allowed |
| Poor API specs | Parameters defined too loosely (a string with no restrictions) |

### Exploitation

```
GET /view?file=../../../../etc/passwd
```

Techniques:

* `../` or `..\` to move up directories.
* Encoding tricks: URL encoding (`%2e%2e%2f`), Unicode and ASCII variants, and double encoding to bypass filters.

Attackers use fuzzing tools to generate thousands of these variations.

### Developer mistake example

```php
// Vulnerable code
include($_COOKIE['template']);
```

If the cookie holds `template=../../etc/passwd`, this can be exploited. The code treats the input as safe because it comes from a cookie, which is a mistake.

### Defense

1. **Sanitize input.** Define the exact values that are allowed (whitelist IDs, paths, formats) and avoid accepting raw file paths from users.
2. **Fix API specs.** Avoid `"type": "string"` for critical parameters. Add maximum lengths, patterns or enums, and strict schemas.
3. **Harden the server.** Disable directory listings, disallow includes above the web root, and move sensitive files outside the web root or onto separate drives.
4. **Improve file access logic.** Never use a file path straight from user input. Map the input to a validated ID and look the path up on the server.
5. **Fail safely.** If file access fails or the request looks suspicious, do not proceed. Log the error securely and stop.

### Testing

* Run automated path traversal fuzzing.
* Use static code analysis to find `file_get_contents()`, `include()`, `fs.readFile()`, and similar calls that take a variable.

| Do | Do not |
| --- | --- |
| Validate and sanitize all user input | Use raw strings for file paths |
| Harden server configs (disable listings, and so on) | Leave the web root unrestricted |
| Reference files by ID | Include user-controlled paths |
| Add strict API specs (for example `maxLength`) | Use loose `"string"` types everywhere |
| Log and stop on unexpected input | Proceed with unknown file access |
| Keep sensitive files off the web root | Assume cookies or headers are safe by default |

Path traversal is easy to introduce by accident and easy to exploit if nothing checks it. The fix is a combination of secure coding, strong input validation, tight specs, server-side controls, and safe failure, starting from the habit of treating every input as hostile, including paths, cookies, and headers.

## Rate limiting

Rate limiting controls how many requests a client can make to a server within a time frame. It protects against abuse, DDoS attacks, brute-force login attempts, and resource exhaustion.

### Why it matters

* **Security:** prevents brute-force attacks on login endpoints, API keys, and tokens, and helps identify abusive clients.
* **Stability:** keeps usage fair across users and prevents downtime from overuse.
* **Cost control:** protects against usage spikes that drive up cloud and server costs.

### Common methods

| Method | Description |
| --- | --- |
| Fixed window | Limits requests per fixed time block (for example 100 per minute) |
| Sliding log | Records a timestamp for each request and counts recent ones |
| Token bucket | Tokens are added at a set rate and each request removes one |
| Leaky bucket | Requests are processed at a fixed rate and the queue overflows if there are too many |

Many APIs use token bucket or leaky bucket algorithms for flexibility and accuracy.

### When a limit is hit

The server returns HTTP 429 (`Too Many Requests`). The response may include a `Retry-After` header and rate limit headers such as `X-RateLimit-Limit` and `X-RateLimit-Remaining`.

### Where to apply limits

| Layer | Why |
| --- | --- |
| API gateway | One central point for limiting all requests |
| Endpoint | Tighter limits on sensitive endpoints |
| User or IP | Stops one user or IP from exhausting resources |
| Per token or API key | Limits by credential type or tier |

### Pitfalls

* Over-restricting hurts legitimate users.
* Ignoring distributed abuse (an attacker using many IPs).
* Not providing clear rate limit headers for developers.
* Not resetting limits consistently, especially with fixed windows.
* No fallback or error handling when limits are triggered.

### Best practices

| Practice | Benefit |
| --- | --- |
| Use `429 Too Many Requests` consistently | Standard HTTP response for rate limits |
| Provide a `Retry-After` header | Helps clients back off and retry properly |
| Different limits for different users | Premium and free, anonymous and authenticated |
| Monitor and log rate limit hits | Detects abuse and misconfiguration |
| Use gateway tools or middleware | Standardizes enforcement |

### Rate limits for security use cases

| Use case | What to limit |
| --- | --- |
| Login attempts | Per username and IP, to prevent brute force |
| Token generation | Prevents API key abuse and token spamming |
| Sensitive endpoints | Access to data or admin operations |
| Search endpoints | Scraping and enumeration |

## Mitigation

* Return generic errors to clients, log details privately, and tie them together with error IDs.
* Remove `Server`, `X-Powered-By`, and version headers.
* Set `HttpOnly`, `Secure`, `SameSite`, and an expiry on cookies, and treat cookie values as untrusted input.
* Map user input to validated IDs instead of building file paths from it, and keep sensitive files outside the web root.
* Rate limit login, token, and sensitive endpoints, and return 429 with `Retry-After`.
