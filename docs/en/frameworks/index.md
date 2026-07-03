# Frameworks & Ecosystem

> Subtitle: See the engineering trade-offs behind React Fiber, Vue 3 reactivity, and state-management abstractions.

## Module Positioning

Modern frontend frameworks abstract "how to update the DOM" more and more thoroughly, but abstraction is not free. React Fiber's interruptible chain rendering, Vue 3's Proxy reactivity, and Zustand's atomic state — each solution represents a different trade-off among scheduling, dependency tracking, performance, and developer experience.

This module does not just teach "how to use frameworks." It disassembles their internal mechanisms so that you understand why they are designed this way, where their performance bottlenecks lie, and when you should bypass the abstraction and operate at a lower level.

## Core Topics

- **Scheduling mechanisms**: React Fiber linked-list structure, time slicing, interruptible rendering, and concurrent mode.
- **Reactivity systems**: Vue 3 Proxy dependency collection, Effect scheduling, and implementation differences among ref / reactive / computed.
- **State management**: Design evolution of Flux unidirectional flow, Redux middleware, Zustand atomicity, and Recoil derived state.
- **Engineering trade-offs**: Runtime vs compile time, fine-grained updates vs virtual DOM diff, single store vs atomic state.

## Article Guide

- [React Fiber Architecture](/en/frameworks/react-fiber) — Fiber node structure, Scheduler, and the Lane priority model.
- [Vue 3 Reactivity System](/en/frameworks/vue3-reactivity) — The complete chain from Proxy traps to Effect scheduling.
- [Modern State Management Evolution](/en/frameworks/state-management) — The thread of trade-offs among unidirectional flow, immutability, and atomicity.

## Intended Readers

- Intermediate and senior frontend engineers who want to understand framework internals rather than only APIs.
- Frontend architects who need to evaluate the performance boundaries of different frameworks during technical decision-making.
- Framework source-code contributors who need a unified perspective on scheduling, reactivity, and state management.
