---
title: "Model extraction basics: cloning a toy classifier through its API"
description: "Concept note from the HTB Academy AI Red Teamer path (attacking the application layer of an AI deployment). The target was a small teaching classifier in a lab."
kind: note
category: "AI / LLM Security"
tags: [model-extraction, notes]
order: 30
status: published
source: repo
---

Concept note from the HTB Academy AI Red Teamer path (attacking the application layer of an AI deployment). The target was a small teaching classifier in a lab. Nothing here was run against a real service.

## The idea

Model extraction, also called model reverse engineering, is a black-box technique. You never see the model's architecture or its training data. You send inputs to its public interface, record what comes back, and train your own model on those pairs. If the copy agrees with the original often enough, you have a surrogate.

Three reasons this matters to a defender:

* The model itself can be the product. A copy is stolen work.
* A local copy lets someone search for inputs that a spam, fraud, or abuse classifier gets wrong without sending those test inputs to the real system, where they might be noticed.
* A close copy is a starting point for attacks that try to recover information about the training data.

## The worked example

The lab exposed a web API that labeled a penguin as one of two species from two numbers: flipper length in millimeters and body mass in grams. The request carried the two values as parameters and the response was a one-field JSON object with the predicted label.

```text
request:  flipper_length=<mm>, body_mass=<g>
response: {"result": "<species>"}
```

The method has three steps.

1. Generate input pairs.
2. Send each pair to the API and store the label that comes back.
3. Train a separate classifier on the stored pairs and labels.

## What I took from it: sampling is the whole cost

The number of queries is what the attacker pays, and it is also what the defender can see. So the interesting part is how the inputs are chosen.

With domain knowledge, the input space shrinks. Real penguins have flipper lengths and body masses inside a known range, so sampling only inside that range puts every query where the model's decision boundary is likely to be. Fewer queries, better copy.

Without domain knowledge, the attacker samples blind over a much wider range. Most of those points land far from the boundary and teach the surrogate nothing, so far more queries are needed for the same accuracy.

## What a defender can do with this

This is my reasoning from the lab, not something I deployed.

* Rate limit per client and per key. Extraction needs volume, and the course notes call out a missing rate limit as the enabling condition.
* Return the minimum. A bare label leaks less per query than a label with a confidence score.
* Log queries with enough detail to look at their distribution later. Real users cluster around realistic values. An extraction run tends to look like an even sweep across the input space, or a dense band along the boundary between classes.
* Alert on query volume per client that is far above the baseline, and on clients whose inputs cover the space more uniformly than normal traffic does.
* Require authentication so that volume can be tied to an identity and cut off.

In the OWASP Top 10 for LLM Applications 2025 this falls under LLM10:2025 Unbounded Consumption, which lists model extraction among its risks.

## References

* OWASP Top 10 for LLM Applications 2025: https://genai.owasp.org/llm-top-10/
* HTB Academy, AI Red Teamer path
