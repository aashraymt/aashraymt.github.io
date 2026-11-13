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

Then I cloned AFL++ and the exercise repository.

```bash title="clone.sh"
git clone https://github.com/AFLplusplus/AFLplusplus

mkdir -p ~/Documents/ost2/
cd ~/Documents/ost2/
git clone https://github.com/alex-maleno/Fuzzing-Module.git
```

### The container

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

## Building the target with AFL++ instrumentation

AFL++ needs to see which paths each input takes, so the target has to be compiled with AFL++'s own compiler wrappers. They insert the instrumentation into the binary. Inside the container, I pointed CMake at `afl-clang-fast` and `afl-clang-fast++` in place of the default compilers.

```bash title="build.sh"
cd /target/
mkdir build
cd build
CC=/AFLplusplus/afl-clang-fast CXX=/AFLplusplus/afl-clang-fast++ cmake ..
make
```

`make` produces an instrumented executable named `simple_crash`, the name set in the exercise's `CMakeLists.txt`.

## Fuzzing

### Seeds

The fuzzer needs starting inputs to mutate. For this exercise the seed corpus is five files of random bytes.

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

## Reading the output

Everything AFL++ found is under `/target/out`.

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

## Key takeaways

- A fuzzing target needs two builds: an instrumented one for the fuzzer and a plain debug one for triage.
- AFL++ sorts its output into crashes, hangs, and the queue. The crash file names record how each input was produced.
- Random seeds were enough for a toy target. I used the same workflow, with real seeds and a dictionary, on my own C target in [libFuzzer vs AFL++ on the same parser](/writeups/binary-and-firmware/fuzzing-uart-parser/).

## References

- OST2, "Fuzzing 1001" (course)
- Exercise repository: [github.com/alex-maleno/Fuzzing-Module](https://github.com/alex-maleno/Fuzzing-Module)
- AFL++: [github.com/AFLplusplus/AFLplusplus](https://github.com/AFLplusplus/AFLplusplus)
