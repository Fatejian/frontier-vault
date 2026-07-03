# Browser Internals and Rendering

> Subtitle: From multi-process architecture to the rendering pipeline, build a complete mental model from request to pixel.

## Module Positioning

When many frontend engineers approach performance optimization, their first reaction is to blame "framework re-renders" or "bundle size," while ignoring the fact that the real bottleneck often lies inside the browser's own pipeline. This module does not treat the browser as a black box. Instead, it disassembles the network stack, HTML/CSS parsers, V8 engine, rendering pipeline, and GPU compositing so that you understand how every line of code finally becomes a pixel on the screen.

Only by building a complete mental model from request to pixel can you locate performance problems to a specific stage and choose the right optimization strategy.

## Core Topics

- **Multi-process architecture**: Responsibilities of the browser process, renderer process, GPU process, and network process, plus IPC collaboration.
- **Rendering pipeline**: Cost and triggering conditions of the five stages — Style / Layout / Paint / Raster / Composite.
- **Resource loading**: Preload scanner, Fetch Priority, and how HTTP/2 / HTTP/3 change resource organization.
- **GPU compositing**: Layers, tile rasterization, compositing-layer promotion conditions, and compositing-layer explosion.
- **Performance metrics**: Breakdown and optimization directions for TTFB / LCP / INP / CLS.

## Article Guide

- [Rendering Pipeline: From HTML to Pixels](/en/browser/rendering-pipeline) — A complete end-to-end overview; understand the input and output of each stage.
- [The Truth About Layout Thrashing](/en/browser/layout-thrashing) — Causes of forced synchronous layout and the FastDOM solution.
- [Painting and Rasterization](/en/browser/painting-rasterization) — Paint records, tile rasterization, and compositing-layer mechanisms.

## Intended Readers

- Intermediate and senior frontend engineers who want to break free from the limited perspective of "framework-level optimization."
- Performance owners who need to build a team-level framework for diagnosing performance issues.
- Frontend architects who need to evaluate browser capability boundaries during technical decision-making.
