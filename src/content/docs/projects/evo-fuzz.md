---
title: "Evo-Fuzz"
description: "An evolutionary fuzzer I wrote in Python (Feb 2026) to learn how fuzzers work on the inside. It found a crash that I planted myself in my own .NET 8 web API."
kind: project
tags: [fuzzing, python, project]
order: 20
status: published
source: repo
---

An evolutionary fuzzer I wrote in Python (Feb 2026) to learn how fuzzers work on the inside. It found a crash that I planted myself in my own .NET 8 web API. This is v1 of my fuzzing work. The [Vuln-Firmware Lab](/projects/vuln-firmware-lab/) is v2.

## Why I built it

I had run fuzzers before, but I could not have explained what a mutation strategy or a feedback loop was doing. So I built one from scratch, with a target small enough that I knew exactly what the right answer was. The goal was understanding, not finding real bugs.

## What I built

Two pieces, both running on localhost:

* **The target.** A minimal C# web API on .NET 8. I added one deliberate bug: if the payload is exactly 42 characters long, the handler throws an unhandled exception.
* **The fuzzer.** A Python script that keeps a pool of inputs, breeds new ones from them, sends each one to the API, and watches how the server answers.

```
            +--------------------+
            |     gene pool      |<-----------------------+
            +---------+----------+                        |
                      | select two parents                |
                      v                                   |
        crossover, mutation, dictionary mutation          |
                      |                                   |
                      v                                   |
              HTTP request to the API                     |
                      |                                   |
                      v                                   |
        response looks different from before? ---- yes ---+
                      |
                      v
        server error? hash the stack trace,
        keep it only if the hash is new
```

```csharp title="Program.cs (the planted bug)"
if (data.Payload.Length == 42)
{
    throw new InvalidOperationException("CRITICAL MEMORY FAILURE: Buffer Edge Case Hit!");
}
```

The exception message is theatrical. The bug is not memory corruption. It is a managed exception that nothing catches.

## Technical highlights

**Genetic loop.** Each round the fuzzer selects two inputs that did well, combines them (crossover), mutates the child, and fires it at the API. Inputs that produce something new go back into the pool.

**Feedback is response behavior, not coverage.** This is the main limit of v1. The fuzzer has no instrumentation inside the target. Its only signal is the HTTP response: if the response length changes, it treats that as a hint that the input reached different code. That is a heuristic. Two different code paths can return the same length, and the same path can return different lengths. A real coverage-guided fuzzer knows which branches ran. Mine guesses.

**Dictionary mutation.** Pure evolution was slow, so I let the fuzzer sometimes swap in a known-bad string from a dictionary (null bytes, very long strings) instead of mutating randomly.

**Crash deduplication.** When the server returns an error, the fuzzer hashes the stack trace and reports the crash only if the hash is new. Without this, one bug produced a wall of identical log lines.

## Results and evidence

The fuzzer triggered the planted exception in generation 0, through a dictionary replacement, and wrote out the input that caused it.

<p><a href="https://github.com/user-attachments/assets/40da68ba-ed99-4edf-a6f0-0fce4d16a8d6" rel="noreferrer">Left: the fuzzer reporting the crash. Right: the API throwing the exception.</a></p>

<p><a href="https://github.com/user-attachments/assets/dc1cefd5-e95b-4815-9290-f6103ab8a955" rel="noreferrer">The input the fuzzer saved for the crash.</a></p>

What this shows, and what it does not:

* The loop, the dictionary, and the dedup all work end to end.
* The crash was one I planted, in my own code, on my own machine. It is not a discovered vulnerability.
* The dictionary found it in the first generation, so this target never really tested the evolutionary part. A length check is exactly the kind of bug a list of long strings will hit by luck.

Repo: [github.com/aashraymt/Evo-Fuzz](https://github.com/aashraymt/Evo-Fuzz)

## What I'd do next

The honest lesson from v1 was that response length is a weak signal, and that I wanted to fuzz something lower level with real coverage feedback. That is what the [Vuln-Firmware Lab](/projects/vuln-firmware-lab/) is. I am also working through the OST2 "Fuzzing 1001" course, which uses AFL++.
