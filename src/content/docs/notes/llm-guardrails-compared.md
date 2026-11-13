---
title: "LLM guardrails compared: a managed filter and a classifier model"
description: "Concept note from the HTB Academy AI Red Teamer path."
kind: note
category: "AI / LLM Security"
tags: [llm, guardrails, notes]
order: 20
status: published
source: repo
---

Concept note from the HTB Academy AI Red Teamer path. I read about two guardrail products from Google while working through the abuse-attacks material and wrote down how they differ. I have not deployed either one. This is a comparison from documentation and course reading, plus what my own labs taught me about filters that sit in front of a model.

## The two approaches

| | Model Armor | ShieldGemma |
|---|---|---|
| What it is | A managed service that screens text on its way into and out of a model | A Gemma-based model fine-tuned to classify content against a safety policy |
| Who runs it | The cloud provider. The application calls an API. | You do. You host the model and build the integration. |
| Where it sits | Twice in the request path: on the user prompt before the model sees it, and on the model's response before the user sees it | The same two positions, but you wire them up yourself |
| What comes back | A structured result (match state and a confidence level) that the application can act on | A yes or no style answer, usually with a short explanation |
| Coverage I noted | Hate speech, harassment, and patterns that look like prompt injection or jailbreaks | Hate speech and harassment classification |
| Main limit | It is a filter on text, so it only knows what the text looks like | It is itself an LLM, so its answer depends on how the policy-check prompt is written |

The request path is the same idea in both cases:

```text
user prompt -> application -> guardrail check -> model
model response -> application -> guardrail check -> user
```

Neither product is meant to catch misinformation. A false statement written politely passes a toxicity filter. That needs a separate process: fact checking, source verification, provenance.

## How I would choose between them

The structured result is the part of the managed service I find most useful. A confidence level lets the application do more than block or allow. It can log, warn, or send a borderline case to a person.

The self-hosted classifier makes sense when the text cannot leave your environment, or as a second opinion next to another filter. The cost is that the classifier needs a tightly constrained prompt (answer yes or no first, then explain) to give consistent answers.

## Why classifier-style guardrails can be evaded

A classifier scores what the text looks like. An attacker only has to change the look while keeping the meaning. The course material groups the changes by size:

* Character level: swapping, substituting, deleting, or inserting characters so a person can still read the word but the model scores it lower.
* Word level: replacing a flagged word with a synonym.
* Sentence level: paraphrasing the whole message. An LLM can do this automatically and at volume.

There is a second problem when the guardrail is a language model. It reads its input the way any LLM does, so the content it is judging can argue with it. I saw a version of this in an HTB Academy lab where the assistant refused a request that looked like an attack and then accepted the same request once it was framed as routine work. The filter was judging intent from wording, and wording is the one thing the sender fully controls.

## Where that leaves guardrails

I treat them as one layer that lowers noise and raises attacker effort, never as the control that makes a dangerous action safe. The controls that hold are the deterministic ones behind the model: output encoding, parameterized queries, authorization checks in backend code, and tools scoped to the least privilege that still does the job. A guardrail verdict is also good telemetry. Logging every block and every low-confidence pass gives a detection team something to alert on, such as one account collecting many blocks in a short window.

## References

* OWASP Top 10 for LLM Applications 2025: https://genai.owasp.org/llm-top-10/
* Google Cloud Model Armor documentation: https://cloud.google.com/security-command-center/docs/model-armor-overview
* ShieldGemma model card: https://ai.google.dev/gemma/docs/shieldgemma
* Benchmark of hate speech detectors on LLM-generated content: https://arxiv.org/pdf/2501.16750
