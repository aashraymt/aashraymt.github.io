---
title: "When the LLM is the filter: output attacks and a guardrail bypass"
description: "Across a set of HTB Academy labs, I used a chat assistant's own output to carry XSS, SQL injection, and command execution into the systems behind it."
kind: writeup
category: "AI / LLM Security"
tags: [llm, ai, guardrails, writeup]
order: 10
status: published
source: repo
---

<div class="callout info">

TL;DR: Across a set of HTB Academy labs, I used a chat assistant's own output to carry XSS, SQL injection, and command execution into the systems behind it. In the last lab the model itself was acting as the injection filter, and I got past it by rewording a blocked request as routine troubleshooting. The lesson that ties them together: a model is not a security control.

</div>

| Category | Platform | Tools | Mapping |
|---|---|---|---|
| LLM application security | HTB Academy (labs) | Browser, SSH port forwarding, a small HTTP listener | LLM01:2025 Prompt Injection, LLM05:2025 Improper Output Handling, LLM06:2025 Excessive Agency |

## Scope and environment

These are HTB Academy labs on insecure output handling in LLM applications. Each lab is a web app with a chat assistant whose responses, or whose tool calls, feed another system: a page rendered in a browser, a SQL query, a system command, a Python function. I reached the lab apps over SSH port forwarding and, where a lab needed a callback, ran a small local HTTP listener. No flags or skills-assessment answers appear here, by choice.

The through-line: the LLM's output is untrusted data. It has to pass the same validation, encoding, and escaping as any user input, because nobody fully controls what a model will emit.

## XSS: the model's reply lands in a page unescaped

The first labs put the assistant's reply straight into the page's HTML. I checked for the gap the way I would check any reflected input, by getting a simple HTML tag into the reply and seeing whether it rendered as markup instead of text. It rendered, which told me no output encoding was applied.

From there the stored variant was the more interesting one. The assistant could pull in content that other users would later see (testimonials, in that lab). Because the reply was still never encoded, script I planted in that content executed in another viewer's browser when the assistant surfaced it. In the lab I pointed it at a listener to show a victim's session cookie being sent back. That is ordinary stored XSS. The only new wrinkle is that an LLM sits in the middle deciding what gets reflected, which actually widens the surface because the input and the eventual victim can be two different people.

Maps to LLM05:2025 Improper Output Handling.

## SQL injection: natural language that becomes a query

In the next labs the assistant turned a user's request into a SQL query against a small database. The request is English, but the thing that reaches the database is SQL, and the lab built that SQL unsafely.

The reasoning I worked through:

* The query was influenced by how I phrased the request, so I could shape it in natural language.
* The app said it only allowed a fixed set of tables, but a table outside that set still existed and was reachable once the query was influenced.
* I could learn the shape of a table (its columns) and then phrase requests that read from, or wrote to, data the app never meant to expose. One task was reading a value out of a table that was supposed to be off limits; another was getting a new privileged row inserted, entirely by describing what I wanted rather than by typing SQL.

The point is not any single input. It is that an "only these tables are allowed" rule enforced through the model is not a boundary, because the model is the thing being influenced. The boundary has to be the database.

Maps to LLM05:2025 Improper Output Handling and, where I steered the model's intent, LLM01:2025 Prompt Injection.

## Code execution and function calling: the model reaches the shell

The last group of labs let the assistant's output drive execution: system commands in some, Python in others, through function calling.

Function calling is what makes an assistant able to act. The model recognizes a task, emits a structured call like `get_order_status(1337)`, and the application runs it. That is useful and it is also the widest part of the surface. If I can influence which function is called, or what argument it gets, I can reach whatever that function can reach. In these labs that meant reading files I should not have been able to read, and in the "excessive functionality" task it meant using a function the assistant simply should not have been exposing. The fix side of the course was blunt about it: a prompt saying "this function is admin only" is a suggestion to a probabilistic system, not access control.

Maps to LLM06:2025 Excessive Agency.

## Exploitation: getting past an LLM that was acting as the filter

The lab I learned the most from presented itself as a shipping assistant with three functions: check a package, check a truck, search for packages. The task said the assistant had access to an insecure function. That wording was the clue. This was going to be about the tool architecture, not purely about SQL.

A plain injection into the package search returned multiple results, which told me the backend concatenated my input into a query with no parameterization. Classic SQL injection primitive. But when I tried to extend it into a normal data-reading injection, the assistant stopped me and said it looked like a SQL injection attempt.

So the backend was vulnerable and the model was the thing refusing. I was not fighting the database, I was fighting the model's judgment of my intent. I mapped what it blocked: a trivial, meaningless query was allowed, but anything that referenced the database's own schema, or words like the one for the secret table, was blocked. That is keyword-and-intent filtering, not structural parsing. Intent filtering can be talked around, because the sender controls the framing.

Instead of sending the blocked request as an attack, I reframed it as a harmless reporting task: I described the exact same string as a stray value left behind during a database migration and asked the assistant to look it up so we could confirm whether it still existed. Now the model saw operational troubleshooting and a literal lookup, not an attack. It passed the string to the search function, the backend executed it, and the filter was bypassed. From there the injection worked normally and I could enumerate the real tables and read the intended value.

Two other weaknesses showed up along the way. At one point a nested query made the backend return output the formatter could not parse, which surfaced a raw error: the tool pipeline assumed the database result would always have a safe shape and did no output validation. And the whole design enforced security at the model layer, which is the wrong layer.

## Detection and mitigation

My analysis after the labs. I did not deploy any of it. The shape of the fix is the same every time: put the control below the model, where it is deterministic.

* Encode on output. HTML-encode anything from the model before it enters a page. That closes the XSS labs regardless of what the model emits. This is the direct control for LLM05:2025 Improper Output Handling.
* Parameterize queries. Bind values as parameters so model-influenced text can never change a query's structure. An "allowed tables" rule then belongs in the database's own permissions, not in a prompt.
* Never hand model output to a shell or an interpreter. If code or commands must run, run them in a sandbox with no network and a read-only, minimal filesystem, so a successful injection reaches nothing worth reaching.
* Design tools for least privilege and put allow-lists on their arguments. Do not expose a function the assistant should not use, and scope each function's account to exactly what it needs. This is the control for LLM06:2025 Excessive Agency.
* Treat a guardrail model as noise reduction, not as the gate. The shipping lab is the proof: an intent filter that reads natural language can be argued out of its own rules. Keep it if you like, but put the real check in backend code.
* Enforce access control and authorization outside the model. Anything the model can reach should be assumed reachable by any user, so the backend must check roles before doing privileged work.

What I would log and alert on:

* Tool and function calls with their arguments. A search argument carrying SQL syntax, or a function argument with shell metacharacters, is a direct signal.
* Guardrail decisions. Log every block and every low-confidence pass. One account that collects a run of blocks and then suddenly succeeds is exactly the reframing pattern from the shipping lab, and it is visible in that log.
* Backend errors surfaced to users, such as a query parser or JSON decode error, which reveal that unvalidated output flowed between stages.
* Database and process events behind the assistant: queries touching tables the app's normal flows never touch, or the app host spawning a shell.

## Key takeaways

* The same old web bugs (XSS, SQLi, command injection) arrive through a new door when a model's output is trusted. The fixes are the old fixes: encode, parameterize, do not shell out.
* A model asked to police its own inputs is judging wording, and wording is the attacker's to choose. That is why the guardrail fell to a reframed, innocent-sounding request.
* Function calling is power and surface at once. Scope it, validate its arguments, and sandbox what it can execute.
* Security has to live at the backend, the database, and the execution environment. An LLM wrapper in front of an insecure function does not make it safe, it only delays exploitation.

## References

* HTB Academy, AI Red Teamer path (insecure output handling)
* OWASP Top 10 for LLM Applications 2025: https://genai.owasp.org/llm-top-10/
* Related: [Command injection through an LLM-facing API](/writeups/ai-llm-security/llm-api-command-injection/), [Indirect prompt injection and chat-history exfiltration](/writeups/ai-llm-security/indirect-prompt-injection/)
