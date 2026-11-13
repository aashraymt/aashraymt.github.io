---
title: "AI security notes"
description: "Study notes I keep while working through LLM attack labs on HTB Academy and PortSwigger Web Security Academy."
kind: note
category: "AI / LLM Security"
tags: [notes, security]
order: 40
status: published
source: repo
---

Study notes I keep while working through LLM attack labs on HTB Academy and PortSwigger Web Security Academy. They are a map of where LLM applications tend to break and what I would check first. The lab writeups that back these notes are in [AI and LLM security](/writeups/ai-llm-security/).

## The core problem: excessive agency

An LLM application becomes dangerous when the model can reach APIs, data, or tools, and the application lets the model decide when to use them. Anyone who can influence the model's input can then try to steer those tools. OWASP calls this LLM06:2025 Excessive Agency.

Three things an attacker can aim for:

* Reading what the model can read: its system prompt, connected data, internal APIs.
* Triggering what the model can trigger, including classic web bugs in the APIs behind it.
* Reaching other people, by planting content that the model will later read while serving a different user.

## How function calling works

Knowing the sequence tells you where to put controls.

1. The client sends the user's prompt to the model.
2. The model decides a function is needed and returns a structured object with arguments that match that function's schema.
3. The application calls the function with those arguments.
4. The application appends the function's result to the conversation, and the model writes the final answer.

The gap is between steps 2 and 3. In many applications there is no confirmation and no validation there, so the user never sees which call was made or with what arguments.

## Prompt injection, by where the text comes from

| Type | How it gets in | What it looks like |
|---|---|---|
| Direct | The person chatting types it | A request to disregard the system instructions |
| Indirect | The model reads it in outside content: a web page, a file, a review, an email | Instructions hidden in content the victim asked the model to summarize |
| Through generated code | The model is persuaded to write code or commands that the application then runs | A coding assistant producing a destructive command |
| Chained | One model's output carries an injection that a second model reads | Multi-agent pipelines |

All four fall under LLM01:2025 Prompt Injection.

## Other weaknesses I keep on the list

* LLM05:2025 Improper Output Handling. If model output is placed into a page, a query, or a command without encoding or validation, it carries XSS, SQL injection, or command injection with it.
* Chaining through a harmless-looking tool. A function that takes a filename can still be a path traversal bug.
* LLM02:2025 Sensitive Information Disclosure. Completion-style prompts can pull back text the model saw in training or earlier in the context.
* LLM04:2025 Data and Model Poisoning. Bad training or fine-tuning data changes later behavior, sometimes on purpose as a backdoor.

## Where input enters an LLM system

| Entry point | Examples | What I would test |
|---|---|---|
| Prompt interface | Web chat, chatbots, command-line agents | Direct injection, jailbreak wording, very long input |
| Tools and plugins | Browsing, code execution, file access | Whether arguments are validated, what the tool's account can reach |
| Memory and session state | Conversation history, stored embeddings | Whether planted content comes back in a later session |
| Retrieval (RAG) | Search, internal knowledge bases | Whether a document I control can be indexed and then retrieved for another user |
| Model API | Hosted or self-hosted inference endpoints | Rate limits, authentication, extraction by volume |
| Training and fine-tuning pipeline | Datasets, labeling, preprocessing | Who can add or change training examples |

## Defenses I would start with

* Treat every API the model can call as if it were public. Authenticate and authorize in the API. The model does not get to decide who is allowed.
* Least privilege for tools and agents, with allow-lists on which tools exist and on what their arguments may contain. This is what prevents a confused-deputy outcome.
* Keep instructions and data apart. Content the model retrieves should be marked as data and should never be able to trigger a privileged tool call on its own.
* Treat model output as untrusted input to whatever consumes it: HTML-encode it for pages, bind it as a parameter for queries, never pass it to a shell.
* Only give the model data that the lowest-privileged user of the application is allowed to see.
* Require a person to confirm actions that change or delete something.
* Log prompts, tool calls with their arguments, and guardrail verdicts. Alert on unusual tool-call patterns and on spikes in refused or blocked requests.
* Rate limit model endpoints and watch per-client volume.

## References

* OWASP Top 10 for LLM Applications 2025: https://genai.owasp.org/llm-top-10/
* PortSwigger Web Security Academy, Web LLM attacks: https://portswigger.net/web-security/llm-attacks
* MITRE ATLAS: https://atlas.mitre.org/
