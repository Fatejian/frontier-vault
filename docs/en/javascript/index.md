# JavaScript Deep Dive

> Subtitle: From execution context to the V8 engine, understand everything that truly happens at runtime.

## Module Positioning

JavaScript is the language frontend engineers use every day, but there is a huge gap between "can use it" and "understand it." This module does not stop at the syntax level. Instead, it goes deep into V8's execution mechanics: how execution contexts are created, how scope chains are formed, how closures persist in memory, how async tasks are scheduled in the event loop, how JIT optimizes hot code, and how GC reclaims memory.

Understanding these underlying mechanisms allows you to write code with predictable performance and to know where to start when investigating closure leaks, memory spikes, or long-task jank.

## Core Topics

- **Execution mechanics**: Execution context, scope chain, variable environment, lexical environment, and the nature of closures.
- **Async programming**: Event loop, macro/micro tasks, Promise chains, and the evolution and pitfalls of async/await.
- **V8 engine**: Ignition bytecode, Sparkplug / Maglev / TurboFan tiers, object shapes, and hidden classes.
- **Memory management**: Young / old generation GC, Scavenge and Mark-Sweep-Compact, short-lived objects, and memory leaks.
- **Performance boundaries**: JIT deoptimization, GC pauses, long-task splitting, and main-thread scheduling.

## Article Guide

- [Execution Context & Scope Chain](/en/javascript/execution-context-closure) — Closures are not syntactic sugar; they are references held to lexical environments.
- [Async Programming Evolution](/en/javascript/async-evolution) — The design thread and pitfalls of Promise / Generator / async/await.
- [V8 Engine: JIT & Garbage Collection](/en/javascript/v8-jit-gc) — From bytecode to TurboFan, from Scavenge to Mark-Compact.

## Intended Readers

- Intermediate and senior frontend engineers who want to understand JavaScript runtime behavior rather than just syntax.
- Performance engineers who need to troubleshoot memory leaks, long tasks, and JIT deoptimization.
- Framework developers who need to evaluate the runtime cost and GC pressure of different APIs.
