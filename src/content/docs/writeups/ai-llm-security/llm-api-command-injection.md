---
title: "Command injection through an LLM-facing API"
description: "A PortSwigger Web Security Academy lab with a support chat assistant that could call backend APIs."
kind: writeup
category: "AI / LLM Security"
tags: [llm, ai, writeup]
order: 30
status: published
source: repo
---

<div class="callout info">

TL;DR: A PortSwigger Web Security Academy lab with a support chat assistant that could call backend APIs. One of those APIs passed its argument into a shell, so asking the assistant to use that API with a crafted value ran a command on the server. The model was only the delivery route. The real bug, and the fix, live in the API.

</div>

| Category | Platform | Tools | Mapping |
|---|---|---|---|
| LLM application security | PortSwigger Web Security Academy (lab) | Browser, the lab's exploit-server mail client | LLM06:2025 Excessive Agency, OS command injection |

## Scope and environment

This is the PortSwigger lab on exploiting vulnerabilities in LLM APIs. It is a deliberately vulnerable training shop with a live chat assistant whose job is to answer customer questions. Everything below happened inside the lab instance and its bundled exploit server.

## Recon and approach

I opened by asking the assistant, in plain language, what it was able to do. It listed its functions without any resistance: password reset, product information, editing an email address, and newsletter subscription.

That list is the attack surface. The reasoning that matters is not about the model at all, it is about what sits behind each function. Features that send email are often implemented by shelling out to a mail program on the server. If the address a user supplies is concatenated into that shell command instead of being passed safely, then whatever I can get into the address field, I can get into the command. The newsletter subscription function takes an email address, so that was the one to probe.

## Exploitation

The approach has three steps, and I kept the actual inputs minimal because the point is the mechanism, not a payload.

1. Prove the address is not sanitized. I asked the assistant to subscribe an address whose local part was a shell command substitution wrapping a harmless identity command, pointed at an address on my exploit server. When the mail arrived, the recipient it was addressed to was not the text I typed. It was the output of the command. That confirmed the server was evaluating the contents of the address as a shell command before sending.

2. Confirm server-side execution. Reading that email on the exploit server's mail client was the confirmation. A command had run on the backend and its result had come back to me by email, which is a clean out-of-band signal that this is real command execution and not just reflected text.

3. Complete the objective. The lab's goal was to delete one specific file in a lab user's home directory. I asked the assistant to subscribe one more crafted address, this time with the file-removal command in the same command-substitution position. The server executed it and the file was gone, which the lab checks for.

The chat assistant did none of this knowingly. Each time, I made an ordinary-sounding request ("subscribe this address to the newsletter"), the model called the newsletter API with the address I gave, and the vulnerable API did the rest. The model is a confused deputy here: it has the agency to call the API, and I supplied the argument.

## Detection and mitigation

This is my after-the-fact analysis. I did not deploy any of it.

What actually broke was the API, so that is where the fixes belong.

* Do not build shell commands by string concatenation. Call the mail transfer agent through a library that takes the address as a separate argument, or hand arguments to the program as a list so the shell never parses them. This removes command injection regardless of what the model passes.
* Validate the email address against a strict format before it reaches any backend function. A shell metacharacter in a local part is not a valid address and should be rejected at the edge.
* Treat the model's tool call as untrusted input to the API. The arguments the model produces are shaped by whatever the user typed, so the API must validate them exactly as it would validate a raw request from the internet. OWASP LLM05:2025 Improper Output Handling is the same point from the model's side: do not trust model output just because a model produced it.
* Scope the tool and its account to least privilege. The newsletter function needs to send mail. It does not need a shell that can delete files, so the process behind it should not have one. If the mail path must run external programs, run them in a sandbox with no write access outside what the feature needs. This is the control for LLM06:2025 Excessive Agency: narrow what the tool can do so a hijacked call cannot reach the filesystem.
* Put an allow-list on the argument where the data is structured enough to allow one.

What I would log and alert on:

* The arguments of every tool or function call the assistant makes, stored where a reviewer can read them. An address field that contains shell metacharacters, backticks, or `$(` is a direct signal.
* Process creation on the application host. A mail-sending feature spawning a shell, or spawning file-management commands, is the event that matters here, because normal newsletter traffic never does that.
* Outbound connections from the application host to addresses that came out of user-controlled input, which is how the out-of-band confirmation step would show up.

## Key takeaways

* Giving a model a tool extends the model's reach to everything that tool can do. The model's politeness filter is irrelevant if the tool behind it is unsafe.
* Command injection here is an old bug wearing a new interface. The fix is the same one it has always been: parameterize, do not concatenate.
* Out-of-band confirmation (make the server talk back to you by email) is a reliable way to prove execution without guessing.
* The model is a confused deputy. Harden the deputy's tools and its privileges, not the model's wording.

## References

* PortSwigger Web Security Academy, Exploiting vulnerabilities in LLM APIs: https://portswigger.net/web-security/llm-attacks
* OWASP Top 10 for LLM Applications 2025: https://genai.owasp.org/llm-top-10/
* OWASP, OS command injection: https://owasp.org/www-community/attacks/Command_Injection
