---
title: "AFL++ first steps: fuzzing a small C++ target in Podman"
description: "This is Exercise 1 of the OST2 \"Fuzzing 1001\" course, a guided exercise and not my own research."
kind: writeup
category: "Binary & Firmware"
tags: [fuzzing, binary, writeup]
order: 20
status: published
source: repo
---

<div class="callout info">

TL;DR: This is Exercise 1 of the OST2 "Fuzzing 1001" course, a guided exercise and not my own research. I built the course's `simple_crash` target with AFL++ instrumentation inside a Podman container, fuzzed it from random seeds until it saved 3 crashes, then rebuilt it with debug symbols and replayed a crash under GDB in VS Code.

</div>

| Category | Difficulty | Platform | Tools | Mapping |
|---|---|---|---|---|
| Fuzzing | Beginner (guided course exercise) | OST2 "Fuzzing 1001", local lab | AFL++, Podman, CMake, g++, GDB, VS Code | n/a |

## Scope and environment

The course is OST2 "Fuzzing 1001", which I am still working through. The target comes from the course's exercise repository, [alex-maleno/Fuzzing-Module](https://github.com/alex-maleno/Fuzzing-Module). The course chose the target, the tooling, and the steps. What I added is this record of what I ran and why each step is there.

Everything ran on my own Ubuntu machine. AFL++ ran inside a Podman container with the exercise folder mounted in. A container makes setup simple. For real fuzzing work, running on bare metal is the better choice for speed.

## Setup

### Podman and the repositories

I installed Podman and checked the version to confirm it worked.

```bash title="install-podman.sh"
sudo apt-get update
sudo apt-get -y install podman
podman --version
```

<figure><img src="https://3542531408-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FSyIJeOUWOBybHBLrjf9m%2Fuploads%2Ff5c7xs31fWH64GoAqIK0%2Fimage.png?alt=media&amp;token=a77a5e69-b119-4211-946a-bd7eb32dd18d" alt=""><figcaption></figcaption></figure>

Then I cloned AFL++ and the exercise repository.

```bash title="clone.sh"
git clone https://github.com/AFLplusplus/AFLplusplus

mkdir -p ~/Documents/ost2/
cd ~/Documents/ost2/
git clone https://github.com/alex-maleno/Fuzzing-Module.git
```

### The container

<figure><img src="https://3542531408-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FSyIJeOUWOBybHBLrjf9m%2Fuploads%2FqFpGepyXTbT68BLaT1bO%2Fimage.png?alt=media&amp;token=ecab1ee3-8213-45db-a192-6836fc174918" alt=""><figcaption></figcaption></figure>

I pulled the AFL++ image (`podman images` lists it afterwards, with the image ID the next command needs) and started a container with the exercise folder mounted at `/target`.

```bash title="container.sh"
podman pull docker.io/aflplusplus/aflplusplus
podman run --rm -it -v $(pwd)/Fuzzing-Module/exercise1:/target <IMAGE ID>
```

What the flags do:

* `--rm` removes the container when it exits.
* `-i` keeps stdin open.
* `-t` allocates a pseudo-terminal.
* `-v` mounts the exercise folder into the container, so the build output and the fuzzer findings land back on the host.

<figure><img src="https://3542531408-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FSyIJeOUWOBybHBLrjf9m%2Fuploads%2FJuKco7aS9b7oCPoIS9Jn%2Fimage.png?alt=media&amp;token=1a449009-6cfd-49be-ab3b-0a426e28bfac" alt=""><figcaption></figcaption></figure>

<figure><img src="https://3542531408-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FSyIJeOUWOBybHBLrjf9m%2Fuploads%2F8AspAMVL00RIARtLPpy5%2Fimage.png?alt=media&amp;token=1a789a85-b329-40c6-9a79-f06f1e0166e5" alt=""><figcaption></figcaption></figure>

## Building the target with AFL++ instrumentation

AFL++ needs to see which paths each input takes, so the target has to be compiled with AFL++'s own compiler wrappers. They insert the instrumentation into the binary. Inside the container, I pointed CMake at `afl-clang-fast` and `afl-clang-fast++` in place of the default compilers.

```bash title="build.sh"
cd /target/
mkdir build
cd build
CC=/AFLplusplus/afl-clang-fast CXX=/AFLplusplus/afl-clang-fast++ cmake ..
make
```

<figure><img src="https://3542531408-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FSyIJeOUWOBybHBLrjf9m%2Fuploads%2FIoqiVdrKtDojeVABcIqR%2Fimage.png?alt=media&amp;token=18f15766-c9b3-4b4e-963a-0e567e13eaf0" alt=""><figcaption></figcaption></figure>

`make` produces an instrumented executable named `simple_crash`, the name set in the exercise's `CMakeLists.txt`.

<figure><img src="https://3542531408-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FSyIJeOUWOBybHBLrjf9m%2Fuploads%2FKdhOed27VJnLxYCVSw3d%2Fimage.png?alt=media&amp;token=35aec8f7-8d19-4876-b9e0-7653fbeeb5f8" alt=""><figcaption></figcaption></figure>

## Fuzzing

### Seeds

The fuzzer needs starting inputs to mutate. For this exercise the seed corpus is five files of random bytes.

<figure><img src="https://3542531408-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FSyIJeOUWOBybHBLrjf9m%2Fuploads%2FansRkl3no7qAcrsojFVM%2Fimage.png?alt=media&amp;token=985fd99a-cba3-4ed6-8b0d-91db5f27c3f2" alt=""><figcaption></figcaption></figure>

```bash title="seeds.sh"
cd /target/build/
mkdir seeds
cd seeds
for i in {0..4}; do dd if=/dev/urandom of=seed_$i bs=64 count=10; done
```

### Running AFL++

```bash title="fuzz.sh"
/AFLplusplus/afl-fuzz -i /target/build/seeds/ -o /target/out -m none -- /target/build/simple_crash
```

* `-i` is the input directory with the seeds.
* `-o` is the output directory for findings.
* `-m none` turns off the memory limit for the child process.

I stopped the run with `Ctrl+C`. The signal for stopping is that no new crashes show up for a while. For this exercise that was once AFL++ had saved 3 crashes.

<figure><img src="https://3542531408-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FSyIJeOUWOBybHBLrjf9m%2Fuploads%2FjG8P1A15LYeQRPN4e9oK%2Fimage.png?alt=media&amp;token=b8405fc6-6863-4ee1-81b3-aba37f6ff203" alt=""><figcaption></figcaption></figure>

## Reading the output

Everything AFL++ found is under `/target/out`.

<figure><img src="https://3542531408-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FSyIJeOUWOBybHBLrjf9m%2Fuploads%2FwcOzshcAX66lLkw94hO8%2Fimage.png?alt=media&amp;token=ad11319c-b98b-4e8b-977c-bbca3a7b5c31" alt=""><figcaption></figcaption></figure>

* `out/default/crashes/` holds the inputs that crashed the target. The file names record how each one was made, for example `id:000000,src:000000,op:havoc,rep:4`.
* `out/default/hangs/` holds inputs that timed out, which is where infinite loops and slow paths show up.
* `out/default/queue/` is the corpus AFL++ built: every input that reached a new execution path.

`xxd <crash file>` prints a hex dump of a crash input, which is easier to read than the raw bytes.

## Triage in GDB

The instrumented binary is the wrong one to debug, because AFL++'s inserted code gets in the way. I left the container (`exit` or `Ctrl+D`) and rebuilt the target on the host with plain `g++` and debug symbols.

```bash title="debug-build.sh"
cd ~/Documents/ost2/Fuzzing-Module/exercise1
g++ -g simple_crash.cpp -o simple_crash_debug
```

Then I opened the folder in VS Code (`code ~/Documents/ost2/Fuzzing-Module/exercise1`) and added a debug configuration through Run, Add Configuration, "C/C++: (gdb) Launch". The part that matters is `args`: it redirects one crash file into the program's stdin. The crash file name is from my run and will differ on another machine.

<figure><img src="https://3542531408-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FSyIJeOUWOBybHBLrjf9m%2Fuploads%2Fwm7qreEXf5gwPnLqPBrd%2Fimage.png?alt=media&amp;token=86894b41-b127-4cd8-b1e6-84c008709a7f" alt=""><figcaption></figcaption></figure>

```json title=".vscode/launch.json"
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "(gdb) Launch",
      "type": "cppdbg",
      "request": "launch",
      "program": "${workspaceFolder}/simple_crash_debug",
      "args": [
        "<",
        "${workspaceFolder}/out/default/crashes/id:000000,sig:06,src:000016,time:203,execs:181,op:havoc,rep:3"
      ],
      "stopAtEntry": false,
      "cwd": "${fileDirname}",
      "environment": [],
      "externalConsole": false,
      "MIMode": "gdb",
      "setupCommands": [
        {
          "description": "Enable pretty-printing for gdb",
          "text": "-enable-pretty-printing",
          "ignoreFailures": true
        },
        {
          "description": "Set Disassembly Flavor to Intel",
          "text": "-gdb-set disassembly-flavor intel",
          "ignoreFailures": true
        }
      ]
    }
  ]
}
```

With `simple_crash.cpp` open, `F5` runs the debug build against the crash file. GDB stops where the program dies, with the crashing input visible in the debugger.

<figure><img src="https://3542531408-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FSyIJeOUWOBybHBLrjf9m%2Fuploads%2FOkFfinNcnP3YKG7umgn8%2Fimage.png?alt=media&amp;token=80d9b46f-a648-4324-9d28-f60806a7e1bd" alt=""><figcaption></figcaption></figure>

## Key takeaways

- A fuzzing target needs two builds: an instrumented one for the fuzzer and a plain debug one for triage.
- AFL++ sorts its output into crashes, hangs, and the queue. The crash file names record how each input was produced.
- Random seeds were enough for a toy target. I used the same workflow, with real seeds and a dictionary, on my own C target in [libFuzzer vs AFL++ on the same parser](/writeups/binary-and-firmware/fuzzing-uart-parser/).

## References

- OST2, "Fuzzing 1001" (course)
- Exercise repository: [github.com/alex-maleno/Fuzzing-Module](https://github.com/alex-maleno/Fuzzing-Module)
- AFL++: [github.com/AFLplusplus/AFLplusplus](https://github.com/AFLplusplus/AFLplusplus)
