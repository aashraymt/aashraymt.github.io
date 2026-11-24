---
title: "Fuzzing and Exploiting a UART Command Parser"
description: "Four bugs planted in a small C firmware parser, fuzzed blind with libFuzzer and AFL++, one turned into a shell, then fixed and proven fixed with a fresh 60-second campaign."
kind: project
category: "Binary & Firmware"
tags: [fuzzing, binary, exploitation, firmware, project]
date: 2026-11-24
order: 10
status: published
source: repo
---

<div class="callout info">

This is a deliberately vulnerable training target I built and only run on my own machine. Every bug in it is intentional and documented.

</div>

Coverage guidance is great at finding bugs hidden behind branches and surprisingly bad at finding bugs hidden behind length. I found that out by planting four bugs in a small C firmware parser and watching two fuzzers disagree about them.

Repo: [github.com/aashraymt/vuln-firmware-lab](https://github.com/aashraymt/vuln-firmware-lab)

I wanted to run the whole loop once, end to end, on code I owned: plant bugs, fuzz them out blind, triage the crashes, turn one into a shell, fix everything, and prove the fix. Not a challenge someone else wrote, not a CVE I read about. My own target, where I know the ground truth and can check my tooling against it.

This is the C sequel to [Evo-Fuzz](/projects/evo-fuzz/), a Python evolutionary fuzzer I pointed at a web API. Same instinct (generate inputs, find the crash, understand why), one abstraction layer down. The proof that it all holds together is one command:

<figure><img src="/images/projects/uart-command-parser/proof-make-verify.png" alt="Terminal output of make verify passing 13 of 13 checks and make verify-fixed passing 11 of 11"><figcaption>My machine, clean build: <code>make verify</code> 13/13 (all four bugs plus the exploit) and <code>make verify-fixed</code> 11/11.</figcaption></figure>

## What I built

A small C "device" that speaks a line-oriented ASCII protocol over what would be a UART. I read bytes from stdin instead of a real serial ring. The same parse and dispatch path is driven three ways: an interactive front end, a libFuzzer harness, and an AFL++ persistent-mode harness. They all enter through one function, `fw_feed()`, so the fuzzers reach exactly the code a serial client would.

## How it is laid out

The one design decision that makes the lab work: the parser and dispatch are memory safe on purpose, and every bug lives in a command handler, one bug per handler. When a crash lands, it points at one root cause instead of smearing across the parser.

The protocol is one command per newline-terminated line:

```text title="protocol"
PING                       -> PONG
VERSION                    -> banner
HELP                       -> command list
AUTH  <token>              -> BUG 1 stack buffer overflow
WRITE <count> <hexbytes>   -> BUG 2 integer overflow into heap overflow
CFG   <key>                -> BUG 3 off by one NUL write
LOG   <message>            -> BUG 4 format string
RESET                      -> clear session
```

And the four bugs:

| # | Handler | What is wrong | CWE |
| --- | --- | --- | --- |
| 1 | `cmd_auth` | `strcpy` into a 64-byte stack buffer, exploited to a shell | CWE-121 |
| 2 | `cmd_write` | allocation size `count*8` wraps in 32-bit math (`0x20000001*8` becomes 8), copy length comes from the payload | CWE-190 into CWE-787 |
| 3 | `cmd_cfg` | guard uses `>` not `>=`, so a 32-byte key writes the NUL one past the end | CWE-193 |
| 4 | `cmd_log` | `printf(msg)` | CWE-134 |

Two details I liked. For bug 2 the fuzzer found a cheaper sibling than the one I designed: `WRITE c 4142`, where the count parses to 0, so a tiny allocation gets a 2-byte payload. Same mismatch, much simpler input. Fuzzers find the cheapest crashing path, not the one you had in mind. For bug 3, UBSan catches it crisply:

```text
index 32 out of bounds for type 'char[32]'
```

One codebase compiles into six variants: libFuzzer, AFL++, an ASan reproducer, an exploit build, an NX build, and a fixed build. I developed it on Kali Linux under WSL 2, with GitHub Actions running the gating checks on every push.

## The result worth remembering

Same `fw_feed()` entry point, same seeds, same dictionary. The only variable is the search strategy.

| Bug | libFuzzer | AFL++ |
| --- | --- | --- |
| 1, stack overflow | stalled | found |
| 2, integer into heap overflow | found | found |
| 3, off by one | found | found |
| 4, format string | found | found |
| bonus, UBSan "left shift of negative value" in the hex decoder | not seen | found |

The bonus row is a bug I did not plant. AFL++ fed non-hex input to my hex decoder and tripped undefined behavior I had never noticed.

<div class="callout info">

Why did libFuzzer stall on bug 1? Reaching `cmd_auth` only needs `AUTH x`. Growing the argument from 6 bytes toward 64 adds no new coverage until it actually overflows, so coverage guidance has no gradient to climb. AFL++ havoc and splice stages grow length regardless of coverage.

</div>

On the vulnerable build AFL++ saved 24 unique crashes in 60 seconds. One saved crash file is literally `AUTH AAAA...`, the fuzzer rediscovering bug 1 on its own. My takeaway: coverage guidance is strong for branch-structured logic and weak for size-structured bugs. Running both over one harness is not redundancy; they cover each other's blind spots. The longer version of this comparison is in [libFuzzer vs AFL++ on the same parser](/writeups/binary-and-firmware/fuzzing-uart-parser/).

## Turning one bug into a shell

This part uses a build with no PIE, no stack canary, and an executable stack. The teaching configuration, with every mitigation off.

1. **Offset.** A De Bruijn pattern as the `AUTH` argument gives 72 bytes to the saved return address (0x40 buffer plus 8 saved RBP).
2. **Shellcode.** A 27-byte `execve("/bin/sh")` with no NUL bytes (`strcpy` would stop there) and no newline (the device frames on newline).
3. **Payload.** A 45-byte NOP sled plus the shellcode fill the 72 bytes, then the return address.
4. **Return address.** Only the low 6 bytes are written. `strcpy`'s own terminator supplies byte 7, and byte 8 is already 0x00 on the stack.
5. **Finding the buffer.** ASLR is disabled for the child only, with `setarch -R`. The exploit reads the target's own stack top from `/proc/<pid>/maps` and scans down. Each candidate is a fast exit-code check: a wrong address dies by signal, a correct one execs a shell that exits 0. A run of `id` behind a nonce confirms it.

```text title="payload layout"
AUTH [ 45x 0x90 NOP sled ][ 27-byte shellcode ][ ret addr, low 6 bytes ] \n
```

And the real output from my machine:

```text title="exploit output"
[*] stack top: 0x7ffffffff000 (from /proc/<pid>/maps)
[+] SHELL via buffer @ 0x7fffffffcc60 (top-0x23a0, after 315 tries)
uid=1000(stratcat_08) gid=1000(stratcat_08) ...
```

Worth being plain about: the shell runs as whoever launches the target. This is code execution, not privilege escalation.

## What NX changes

Same code, built with a non-executable stack. The shellcode payload now fails:

```text
tried 256 return addresses, no shell
```

But RIP control is untouched. Under gdb the faulting RIP is exactly the `0x424242424242` I chose. NX stops the shellcode, not the hijack.

<figure><img src="/images/projects/uart-command-parser/proof-nx-demo.png" alt="Terminal output of make nx-demo showing the shellcode blocked and RIP set to 0x424242424242"><figcaption><code>make nx-demo</code> on my machine: shellcode blocked by NX, RIP still lands on 0x424242424242.</figcaption></figure>

The obvious next move is a ROP chain, and that did not work here. A single-line chain needs several 8-byte addresses on consecutive stack slots. Because `strcpy` runs over a newline-terminated line, the payload cannot contain 0x00 or 0x0a. One return address survives (I write six bytes and let the stack supply the zeros). A chain does not, because the high bytes of each gadget address are 0x00 and the copy stops before the next slot.

The path I think would work: stage the chain on the heap through `WRITE` (hex decoding can place 0x00), leak an address with the format string bug, and use the single stack overwrite as a pivot. I have not landed that. It is specified, not implemented.

## Fixing it, and proving the fix

`commands_fixed.c` has the same handlers with minimal fixes: bound and reject in `cmd_auth`; 64-bit size math, a cap, and a copy clamped to the allocation in `cmd_write`; a `>=` guard in `cmd_cfg`; `printf("LOG: %s\n", msg)` in `cmd_log`; and a validating hex decoder.

First proof: `make verify-fixed` runs every curated reproducer against the hardened build. All handled, 11/11 checks, "HARDENED BUILD VERIFIED".

Second proof, the stronger one: a fresh fuzzing campaign. Same AFL++ setup, same seeds, same dictionary, same 60 seconds.

```text
vulnerable handlers   60s  ->  24 unique crashes
hardened   handlers   60s  ->   0 crashes
```

<figure><img src="/images/projects/uart-command-parser/proof-afl-vulnerable-24-crashes.png" alt="AFL++ status lines during a 60 second run ending with 24 unique crashes"><figcaption>AFL++ for 60 seconds on the vulnerable handlers: 24 unique crashes.</figcaption></figure>

<figure><img src="/images/projects/uart-command-parser/proof-verify-fixed-0-crashes.png" alt="make verify-fixed with a 60 second AFL++ run reporting 0 crashes and 12 of 12 checks passed"><figcaption>The same 60-second AFL++ campaign on the hardened handlers: 0 crashes, 12/12 checks.</figcaption></figure>

Every result here reproduces from a clean checkout. The commands are in the repo README.

## Limitations and open questions

- It is x86 Linux, not a real microcontroller. The memory corruption is real; the hardware is not.
- ASLR is disabled per process for the exploit. I did not defeat it; I switched it off for one child.
- The heap-staged NX bypass is a plan, not a result.
- Crash counts vary from run to run. "24" is what I saw, not a constant.
- Zero crashes in 60 seconds is evidence, not proof. A longer campaign might find something I missed.

And the honest one about the fuzzing result: you could say "run both fuzzers" is the least surprising lesson possible, and you would not be entirely wrong. What I find more interesting is why libFuzzer stalled, because it points at the fitness signal and not at the tool.

I am not sure how general the libFuzzer result is. It is one bug, one harness, and one short comparison. Maybe a length-aware fitness function closes the gap; maybe it just moves it somewhere else. This lab is now the benchmark I will test that on.

## What I would do next

- Port the target to an ARM Cortex-M build under QEMU.
- Add a signed firmware update command (secure boot style), attack it, then fix it.
- Land the heap-staged ROP pivot that gets code execution under NX.
- Benchmark Evo-Fuzz with a length-aware fitness function against bug 1.

Code: [github.com/aashraymt/vuln-firmware-lab](https://github.com/aashraymt/vuln-firmware-lab)
