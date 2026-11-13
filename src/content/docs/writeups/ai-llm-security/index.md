---
title: "AI and LLM security"
description: "These pages are hands-on labs from HTB Academy and PortSwigger Web Security Academy, plus one retired Hack The Box machine. None of them is a real-world engagement."
kind: index
category: "AI / LLM Security"
tags: [llm, ai, writeup]
order: 30
status: published
source: repo
---

I wrote each one the same way: what the application trusted, how I got it to do something it should not, and then what I would put in place to detect and stop it. The detection sections are my own analysis after the lab, not controls I deployed anywhere.

| Page | What it covers |
|---|---|
| [When the LLM is the filter: output attacks and a guardrail bypass](/writeups/ai-llm-security/llm-output-attacks/) | XSS, SQL injection, and code execution through model output and function calling, and why a model that refuses "obvious" attacks is not a security control. HTB Academy. |
| [Indirect prompt injection and chat-history exfiltration](/writeups/ai-llm-security/indirect-prompt-injection/) | Instructions hidden in comments, web pages, and email that the model reads on someone else's behalf, and leaking a conversation through a rendered Markdown image. HTB Academy and PortSwigger. |
| [Command injection through an LLM-facing API](/writeups/ai-llm-security/llm-api-command-injection/) | A chat assistant with a newsletter tool that passes its argument to a shell. PortSwigger. |
| [HTB Artificial](/writeups/ai-llm-security/htb-artificial/) | Retired Hack The Box machine with an AI model-handling component. |

Shorter concept notes live under Research and notes:

* [LLM guardrails compared](/notes/llm-guardrails-compared/)
* [Model extraction basics](/notes/model-extraction-basics/)
* [AI security notes](/notes/ai-security-notes/)
