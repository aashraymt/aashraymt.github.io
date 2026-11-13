---
title: "Indirect prompt injection and chat-history exfiltration"
description: "Lab exercises where instructions hidden in outside content (a comment, a web page, a review) steer a model acting for someone else."
kind: writeup
category: "AI / LLM Security"
tags: [llm, ai, prompt-injection, writeup]
order: 20
status: published
source: repo
---

<!-- keep slug or redirect: /writeups/hackthebox-ai-walkthrough -->

<div class="callout info">

TL;DR: When a model reads outside content (a comment, a web page, an email, a product review) on someone else's behalf, instructions hidden in that content can steer the model as if the victim had typed them. Across HTB Academy and PortSwigger labs I used this to frame an innocent user, to force an action on a victim's account, and to leak a prior conversation out through a rendered Markdown image. The fix is to keep retrieved content as data and to control what the model's output can reach.

</div>

| Category | Platform | Tools | Mapping |
|---|---|---|---|
| LLM application security | HTB Academy and PortSwigger (labs) | Browser, SSH port forwarding, swaks (SMTP), a small HTTP listener | LLM01:2025 Prompt Injection, LLM02:2025 Sensitive Information Disclosure, LLM06:2025 Excessive Agency |

## Scope and environment

These are HTB Academy and PortSwigger Web Security Academy labs on indirect prompt injection. In a direct injection the attacker and the person chatting are the same. Indirect injection is the more realistic case: I never talk to the model directly. I leave text somewhere the model will later read while it serves another user, and my text carries the instructions. I reached the HTB labs over SSH port forwarding, sent lab email with swaks to a local SMTP server, and ran a small HTTP listener for the exfiltration callback. No flags are reproduced here.

## Recon and approach

The pattern is always: find content the model ingests that I can write to, and understand what the model is allowed to do with what it reads. A comment field, a product review, a page the model is asked to summarize, an email the model screens. Each is an unvalidated data source feeding a system that treats what it reads as if it were trusted instruction.

## Exploitation

### Framing another user through a comment

The first HTB lab had an assistant that moderated a comment section and could decide who had broken the rules. The comments are the data source, and I could post one. I wrote a comment that, underneath looking like a normal comment, told the model to conclude that a specific other user had broken the rules and should be banned. When the model read the comment thread, it acted on my planted instruction and accused a user who had done nothing. Nobody typed that instruction into the chat. It arrived through content the model trusted.

### Getting an action taken on a victim's account (PortSwigger)

The PortSwigger labs made the stakes concrete: the assistant could delete an account, and it retrieved product reviews to answer questions. A victim routinely asked the assistant about one product. So the review for that product was my channel to the victim's session.

A raw code payload in the review got flagged by the model as code and ignored. The move that worked was to stop making it look like code. In one version I wrote the review as natural language that included a short block framed to look like the conversation had ended and the user was now speaking, asking for the account action. In the XSS variant I wrapped the markup inside a plausible sentence (describing it as text printed on a free T-shirt that came with the product) so the model treated it as description rather than as code to refuse. When the victim later asked about that product, the model retrieved the review and carried out the embedded instruction against the victim's own session.

This is the heart of indirect injection: the model cannot tell the difference between content it was asked to read and instructions it was given, because both arrive as text in the same context. It maps to LLM01:2025 Prompt Injection, and the account-deletion capability makes it LLM06:2025 Excessive Agency.

### Summaries and screening: web pages and email

Two smaller labs showed the same idea in other channels. One assistant summarized a web page I controlled, so instructions placed on that page steered the summary. Another screened job-application emails and decided whether to advance them; I placed the injection in a quoted, signature-like block of the email, where it reads as metadata rather than as a request, and the screening decision flipped. The lesson is that any ingested channel (page, document, email) is an injection surface, not just the chat box.

### Exfiltrating the chat history through a rendered image

The exfiltration lab was the one that connected injection to data theft. The assistant rendered Markdown in its replies, which means it renders Markdown image syntax, which means when it emits an image the victim's browser fetches that image's URL. If I can make the model build an image URL that includes something sensitive from the conversation, the fetch sends that data to wherever the URL points.

The injected instruction told the model to output an image whose URL pointed at my listener and whose query string carried a piece of the earlier conversation, with spaces escaped so it survived as a single URL. When the model followed it, the victim's browser rendered the "image", which was really a request to my server, and the conversation detail arrived in my logs as a query parameter. The image itself fails to load, which the victim barely notices, while the data has already left.

That chains two weaknesses: LLM01:2025 Prompt Injection to plant the instruction, and LLM02:2025 Sensitive Information Disclosure as the payoff. The enabling design flaw is that the model was allowed to emit Markdown that triggers an outbound request to an arbitrary host.

## Detection and mitigation

My analysis after the labs, not controls I deployed.

Separate content from instructions:

* Mark retrieved content (reviews, pages, emails, documents) as data and keep it out of the instruction channel. The model should treat it as quoted material it may summarize, never as commands it may follow. This is the core defense for LLM01:2025 Prompt Injection.
* Do not let retrieved content, on its own, trigger a privileged tool call. Actions like account deletion should require the actual account holder's authenticated, in-session confirmation, not an instruction that surfaced from a review. That is the control for LLM06:2025 Excessive Agency.
* Keep the model to least privilege. If the assistant does not need the ability to delete accounts to answer product questions, it should not have it.

Control egress and image rendering (the exfiltration channel):

* Do not render model-produced image or link URLs to arbitrary hosts. Allow-list the domains the UI may fetch, or strip remote image rendering from assistant output. This closes the Markdown-image exfiltration directly.
* Apply a content security policy that restricts where the chat UI may load images and make outbound requests, so a planted URL has nowhere to send to.
* Restrict outbound network egress from the rendering context to known destinations.

Treat output as untrusted (so injected content cannot also be XSS):

* Encode model output before placing it in a page, which is where the review-embedded iframe variant would otherwise fire. This is LLM05:2025 Improper Output Handling.

What I would log and alert on:

* Outbound requests from the chat UI or its backend to hosts that are not on the allow-list, especially image fetches whose URL query strings carry long or conversation-shaped values. That is the exfiltration signature.
* Tool calls, with arguments, that are triggered during a turn where the model had just ingested third-party content. A `delete_account` call that follows a product-review retrieval is the pattern to flag.
* Retrieved content that contains instruction-like phrasing or fake conversation delimiters, scored and logged for review.
* A single author whose comments or reviews are disproportionately followed by moderation actions or account actions.

## Key takeaways

* Indirect injection removes the need to talk to the model at all. The attacker writes to a data source; the victim's own session carries out the instruction.
* Models cannot reliably separate "content to read" from "instructions to obey" when both are text in one context. The separation has to be built around the model.
* Refusing raw code is not a defense. Rephrasing the same payload as natural language walked past the filter in every lab where I tried it.
* Rendering model output that can trigger outbound requests (a Markdown image) turns any injection into an exfiltration channel. Lock down egress and what the UI will render.

## References

* HTB Academy, AI Red Teamer path (exfiltration and indirect prompt injection)
* PortSwigger Web Security Academy, Indirect prompt injection: https://portswigger.net/web-security/llm-attacks
* OWASP Top 10 for LLM Applications 2025: https://genai.owasp.org/llm-top-10/
* Related: [When the LLM is the filter: output attacks and a guardrail bypass](/writeups/ai-llm-security/llm-output-attacks/), [Command injection through an LLM-facing API](/writeups/ai-llm-security/llm-api-command-injection/)
