---
title: "libFuzzer vs AFL++ on the same parser"
description: "I ran libFuzzer and AFL++ against one UART-style C command parser through matched harnesses, same seeds and dictionary, so the only variable was search strategy."
kind: writeup
category: "Binary & Firmware"
tags: [fuzzing, binary, writeup]
order: 10
status: published
source: repo
---

<div class="callout info">

TL;DR: I ran libFuzzer and AFL++ against one UART-style C command parser through matched harnesses, same seeds and dictionary, so the only variable was search strategy. Both found three of four planted bugs fast; only AFL++ found the length-triggered stack overflow, and it also surfaced a bug I never planted. This page is about the harness design and why that split happened. The target itself is described in [Vuln-Firmware Lab](/projects/vuln-firmware-lab/).

</div>

| Category | Platform | Tools | Mapping |
|---|---|---|---|
| Fuzzing / secure coding | Personal lab | libFuzzer, AFL++, ASan, UBSan, clang, gcc | CWE-121, CWE-190, CWE-787, CWE-193, CWE-134 |

## Scope and environment

A deliberately buggy C command parser I wrote, running on my own machine and reading from stdin. The parser and dispatch are clean; four known memory bugs each live in their own command handler. I am not re-listing the bugs here. The project page covers them at the level of class, root cause, and fix. This page answers a narrower engineering question: given the same target and the same inputs, where do libFuzzer and AFL++ diverge, and why.

## Harness design

Both fuzzers drive one entry point, `fw_feed()`, through a thin harness. That is the whole trick for a fair comparison. If the two campaigns reached the parser by different paths, any difference in findings could be the plumbing rather than the fuzzer. One shared entry point removes that doubt.

**libFuzzer, fork mode.** The libFuzzer build is clang with the fuzzer, address, and undefined-behavior sanitizers in one binary. The harness hands the fuzzer's byte buffer to `fw_feed()` and returns. I ran the campaign in fork mode, where libFuzzer runs the target in child processes, so a crash is recorded and the campaign keeps going. That matters on a target with four separate bugs: without it the run ends at the first crash, and the first crash is always the easiest bug.

**AFL++, persistent mode.** The AFL++ build uses `afl-clang-fast` with ASan, and the harness runs in persistent mode: one instrumented process loops over many inputs instead of being started fresh for each one. On a small, fast target the per-process startup cost is most of the runtime, so persistent mode buys executions per second.

**Seeds and dictionary.** Both campaigns used the same seeds and the same dictionary. The dictionary includes format tokens such as `%s` and `%n`, and they helped: the format string bug was the first one both fuzzers found.

## Crash triage and dedup

A fuzzer hands back crashing inputs, not bugs. I replayed crashes against a separate deterministic build (`target_asan`: clang, ASan and UBSan, `-O0`) so each input produces the same sanitizer report every time. The report names the fault class and the source line. Because every planted bug sits in its own handler, the faulting handler plus the fault class is enough to tell which bug an input belongs to.

That grouping caught one case worth keeping. The integer overflow has a designed trigger: a count large enough to wrap the 32-bit size calculation. The fuzzer got to the same defect by a cheaper route first, a count that does not parse as a number, becomes zero, and produces a one-byte allocation that the payload overruns. Two very different inputs, one root cause (allocation size does not match copy length). Fuzzers find the cheapest crashing path, not the one you had in mind, so I group by root cause and not by input.

## Build: why coverage-guided fuzzers plateau on some checks

The finding I care about is that libFuzzer stalled on the stack overflow and AFL++ did not.

Reaching that handler needs only a short command line. Growing its argument from a few bytes toward the buffer size produces no new code coverage until the write actually runs off the end. libFuzzer is coverage-guided: it keeps inputs that light up new edges and lets the rest fade. With no new coverage anywhere along the path from "short argument" to "argument long enough to overflow," there was no gradient for it to climb, so it spent its budget elsewhere where the feedback signal was richer.

AFL++ found it because its havoc and splice stages mutate input length aggressively regardless of whether a longer input shows new coverage. It grew `AUTH` lines to 147 bytes in its queue and tripped the overflow in about a minute and a half, inside a run of about 90 seconds. libFuzzer had about 2 minutes and never got there. The general shape: coverage guidance is strong for branch-structured logic, where each new input reaches a visible new edge, and weak for size-structured bugs, where the dangerous change is quantity rather than control flow. Blind length mutation is the mirror image. Running both over one harness is not redundancy; each covers the other's blind spot.

## What the sanitizers added

The fuzzers decide which inputs to try. The sanitizers decide whether a bug is seen at all.

- **ASan** turned the heap and stack overflows into immediate, located aborts instead of "works until it corrupts something later." Without it, the off-by-one NUL write in particular would usually run clean and only misbehave once the stack layout shifted.
- **UBSan** caught two things a crash-only oracle would miss: the off-by-one out-of-bounds index, and the unplanted negative-left-shift in the hex decoder that AFL++ reached with non-hex input. Neither one necessarily crashes; both are real defects.

A fuzzer without a sanitizer only sees the bugs that happen to segfault. The sanitizer build is what makes the quiet ones count.

## Detection and mitigation

How to stop this class of bug before a fuzzer or an attacker reaches it:

- Compiler hardening on any build that ships. A stack canary, a non-executable stack, PIE with ASLR, and `_FORTIFY_SOURCE` each make a stack overflow harder to turn into control of the program, and `_FORTIFY_SOURCE` swaps `strcpy` for a checked version that aborts on overflow. `-Werror=format-security` turns the uncontrolled format string class into a build failure.
- Bounds checks in the handler. Reject oversized input instead of truncating it. Use `>=` in length guards so there is room for the terminator. Do allocation-size arithmetic in a width that cannot wrap, and clamp every copy to the capacity of the destination, not to the length of the incoming payload.
- Sanitizer builds in testing. An ASan and UBSan build is what makes single-byte and non-crashing defects visible. My `make verify` target replays a curated reproducer for each bug and asserts the exact sanitizer finding.
- Fuzzing in CI. This is planned, not done: the next step is running `make verify` on every push, then applying the fixes and re-running both fuzzers to confirm zero crashes.

## Key takeaways

- One shared entry point for every harness is what makes a fuzzer comparison fair. Match the seeds and the dictionary too, and strategy becomes the only variable.
- Coverage-guided fuzzing has a real blind spot for length-triggered bugs that show no intermediate coverage. Pair it with a length-mutating fuzzer rather than trusting one tool.
- Triage to root cause, not to input. Replaying under a deterministic sanitizer build is what collapses a crash pile into a short list of bugs.
- Sanitizers, not the fuzzer alone, are what surface the quiet non-crashing defects, including ones you never planted.

## References

- Project page: [Vuln-Firmware Lab](/projects/vuln-firmware-lab/)
- AFL++ project documentation (persistent mode, dictionaries)
- LLVM libFuzzer documentation (fork mode, coverage guidance)
- Clang AddressSanitizer and UndefinedBehaviorSanitizer documentation
