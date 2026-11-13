---
title: "Vuln-Firmware Lab"
description: "A deliberately vulnerable UART-style command parser I wrote in C, with four planted memory-corruption bugs, fuzzed with libFuzzer and AFL++."
kind: project
tags: [firmware, project]
order: 10
status: published
source: repo
---

A deliberately vulnerable firmware-style target I wrote in C: a UART command parser with four planted memory-corruption bugs, fuzzed with both libFuzzer and AFL++, triaged back to root cause, with a fix written up for each. This is the C sequel to [Evo-Fuzz](/projects/evo-fuzz/), my Python fuzzer from v1.

## Why I built it

Most of my recent work sits at the web and API layer. I wanted reps one level down, on the memory-corruption bugs that live in embedded C: saved return addresses, heap layout, the places a `strcpy` or a 32-bit multiply quietly goes wrong. The target is shaped like the small command-driven C devices used in the MITRE eCTF competition, so the practice maps onto that style of embedded target.

The idea was to own the target completely. I planted known bugs, then tried to forget I planted them: fuzz the thing blind, see what the tooling actually surfaces, and measure my own triage pipeline against ground truth I wrote myself. Evo-Fuzz did the same thing one abstraction layer up (Python, a web API, evolutionary input generation). Same instinct here, lower level: generate inputs, find the crash, understand why it crashes.

## What I built

The target is a small C "device" that speaks a line-oriented ASCII command protocol over what would be a UART. In the lab it reads bytes from stdin instead of a real serial RX line, but the parse-and-dispatch path is exactly the one a serial client would drive. One command per newline-terminated line:

```
PING                       -> PONG
VERSION                    -> banner
HELP                       -> command list
AUTH  <token>              -> stack buffer overflow
WRITE <count> <hexbytes>   -> integer overflow into heap overflow
CFG   <key>                -> off-by-one NUL write
LOG   <message>            -> format string
RESET                      -> clear session state
```

The design choice that makes the lab useful: I kept the parser and the dispatch logic clean and pushed every bug into a command handler, one bug per handler. That isolation is what lets each crash point at a single root cause instead of smearing across the parser. I checked the parser for memory safety separately, so the only bugs in play are the ones I meant to put there.

### Two harnesses, one parser

The same `fw_feed()` entry point is driven three ways: an interactive front-end, a libFuzzer harness (fork mode), and an AFL++ persistent-mode harness. Same code under test in every case. Because the two fuzzer harnesses hit the identical parse path with the same seeds and dictionary, any difference in what they find comes from search strategy, not from the target.

I compile one codebase four ways. The separation between the detection builds and the one exploitation build is the core of the setup:

| Binary | Build | Purpose |
|---|---|---|
| `fuzz_libfuzzer` | clang with fuzzer, ASan, UBSan | libFuzzer campaign |
| `fuzz_afl` | afl-clang-fast, ASan, persistent mode | AFL++ campaign |
| `target_asan` | clang with ASan and UBSan, no optimization | deterministic crash reproduction and triage |
| `target_exploit` | gcc, no PIE, no stack protector, executable stack | the all-mitigations-off teaching build |

The sanitizer builds detect. Only `target_exploit` has the protections turned off, and it exists only to demonstrate impact. I say more about that under Limitations.

## The four bugs

Each handler holds one bug. These are the classes and root causes; the fixes are the point of the exercise.

**Bug 1, stack buffer overflow in `cmd_auth` (CWE-121).** A fixed 64-byte stack buffer copied into with `strcpy` and no length check, so a long `AUTH` argument runs past the buffer over the saved frame pointer and return address. Fix: reject an oversized token and bound the copy (`strlen` check plus `memcpy`, or `snprintf` / `strlcpy`). Stack canary, non-executable stack, PIE with ASLR, and `_FORTIFY_SOURCE` would each have blunted it independently.

**Bug 2, integer overflow into heap overflow in `cmd_write` (CWE-190 into CWE-787).** Two defects compound: the allocation size is computed in 32-bit arithmetic and wraps, while the copy length is driven by the payload rather than the allocation. A large count multiplies to a tiny value, `malloc` returns a small chunk, and the full decoded payload copies in anyway. Fix: do the size math in a width that cannot wrap, bound the count, and clamp the copy to the real allocation capacity.

**Bug 3, off-by-one NUL write in `cmd_cfg` (CWE-193).** The length guard uses `>` where it needs `>=`, so a key exactly the size of the buffer passes the check, fills the buffer, and writes its terminator one byte past the end. A single stray `\0`, which usually looks fine until the stack layout shifts and it clips an adjacent value. Fix: `>=` in the guard, or `snprintf`. This is the one I point to for why sanitizer-driven testing matters: UBSan caught it crisply where a plain run would not.

**Bug 4, uncontrolled format string in `cmd_log` (CWE-134).** User data passed straight to `printf` as the format argument, so format specifiers in the message read and leak stack memory or crash on a bad dereference. Fix: `printf("LOG: %s\n", msg)` and compile with `-Werror=format-security` to turn the whole class into a build failure.

## Fuzzing: the result I care about

Both fuzzers ran against the same harness.

| Bug | libFuzzer (about 2 min, fork mode) | AFL++ (about 90 s, persistent) |
|---|---|---|
| 1, stack overflow | stalled | found, 55-byte reproducer |
| 2, integer into heap overflow | found | found |
| 3, off-by-one | found | found |
| 4, format string | found | found |
| unplanted UBSan finding in the hex decoder | not reported | found |

libFuzzer stalled on the stack overflow and AFL++ caught it. My explanation: reaching `cmd_auth` only needs a short `AUTH` line, and growing that argument from 6 bytes toward 64 produces no new code coverage until it actually overflows. libFuzzer's coverage feedback had no gradient to climb, so it explored elsewhere. AFL++'s havoc and splice stages mutate input length aggressively regardless of coverage. It grew `AUTH` lines to 147 bytes in its queue and tripped the overflow in about a minute and a half. Length-triggered overflows with no intermediate coverage signal are a known libFuzzer blind spot, and this reproduced it cleanly on a bug I controlled.

AFL++ also surfaced a bug I did not plant: a UBSan negative-left-shift in my hex decoder when it is fed non-hex characters. That is the part that sells real fuzzing. It finds the bugs you never wrote down.

The takeaway: no single fuzzer is complete. Coverage guidance is strong for branch-structured logic and weak for size-structured bugs; blind length mutation is the opposite. Running both over one harness is not redundancy, it is covering each other's blind spots.

## Results and evidence

`make verify` runs the whole chain from a clean build. It asserts that benign commands behave, that each curated reproducer triggers the exact expected sanitizer finding, and that the proof of concept below works. It ends on `ALL CHECKS PASSED` (13/13).

One of the four bugs, the stack overflow, I also carried through to a working proof of concept. Against the separate `target_exploit` build, which has the stack canary, PIE/ASLR, and non-executable stack all turned off, the overflow redirects execution into attacker-supplied code and spawns a shell. I am deliberately not publishing the exploitation steps here; the point for this page is that the planted bug is exploitable, not how.

## Limitations

The proof of concept works only because the mitigations are off on that one build. `target_exploit` is a teaching binary with no stack canary, no PIE/ASLR, and an executable stack; the sanitizer and fuzzing builds keep normal protections. With real defenses on, the same overflow would force a leak-and-ROP approach instead, which is future work, not something this lab demonstrates today. Everything here is a self-contained training target meant to be fuzzed and debugged on my own machine. Every bug is intentional and documented, and none of it is meant to run anywhere real.

## What I'd do next

- Rebuild the exploit with the non-executable stack re-enabled and write the ret2libc or ROP version, a more realistic technique.
- Wire this target up as a benchmark for Evo-Fuzz v2 and test whether a genetic fitness function that rewards input length and buffer pressure, not just coverage, closes the gap that stalled libFuzzer on Bug 1.
- Add CI that runs `make verify` on every push so the whole chain stays provably green.
- Apply the fixes, re-run both fuzzers, and confirm zero crashes, closing the loop the way a real remediation review would.
