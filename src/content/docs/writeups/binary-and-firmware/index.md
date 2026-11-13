---
title: "Binary and Firmware"
description: "Notes on fuzzing and memory-safety bugs in C and C++ targets. This is the level below my web and API work, and the section is small because I am early in it."
kind: index
category: "Binary & Firmware"
tags: [fuzzing, binary, firmware, writeup]
order: 50
status: in-progress
source: repo
---

<div class="callout info">

In progress. One project of my own and one guided course exercise so far.

</div>

Notes on fuzzing and memory-safety bugs in C and C++ targets. This is the level below my web and API work, and the section is small because I am early in it.

| Page | What it is | Source |
|---|---|---|
| [libFuzzer vs AFL++ on the same parser](/writeups/binary-and-firmware/fuzzing-uart-parser/) | Two fuzzers, one entry point, and why only one of them found the stack overflow | My own project, [Vuln-Firmware Lab](/projects/vuln-firmware-lab/) |
| [AFL++ first steps](/writeups/binary-and-firmware/afl-first-steps/) | Building, fuzzing, and debugging a small target with AFL++ in Podman | Guided exercise from the OST2 "Fuzzing 1001" course |

Related: [Evo-Fuzz](/projects/evo-fuzz/), my earlier Python fuzzer for a web API target.
