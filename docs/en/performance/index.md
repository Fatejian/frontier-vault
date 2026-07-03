# Performance Engineering

> Subtitle: Around the critical path and rendering pipeline, locate performance problems to specific stages.

## Module Positioning

Performance optimization is not a single-point trick like "add will-change" or "use transform for animations." It is a complete engineering method from problem localization to optimization verification. This module centers on the modern browser's critical path and rendering pipeline, decomposing performance issues into three models — waiting, blocking, and redundant work — so that every optimization is evidence-based.

Each optimization recommendation is accompanied by a DevTools verification path and an actionable practice checklist, avoiding pseudo-optimizations that "look improved" but actually change nothing.

## Core Topics

- **Critical path**: TTFB / resource discovery / HTML-CSS-JS parsing / module dependency graph / LCP breakdown.
- **Rendering pipeline**: Cost and triggering conditions of each stage — Style / Layout / Paint / Raster / Composite.
- **Runtime performance**: JIT deoptimization, GC pauses, long-task splitting, and INP optimization.
- **Core metrics**: Breakdown and optimization directions for LCP / INP / CLS / TTFB.
- **Engineering practice**: DevTools performance analysis, compositing-layer management, virtual lists, and scroll optimization.

## Article Guide

- [Rendering Performance Pitfalls](/en/performance/rendering-pitfalls) — Common traps and solutions at Layout / Paint / Composite stages.
- [The Critical Path of Modern Frontend Performance](/en/performance/critical-path) — A complete performance model from TTFB to Hydration.

## Intended Readers

- Performance owners who need to build a team-level performance diagnosis and optimization framework.
- Intermediate and senior frontend engineers who want to move beyond single-point optimizations like "add will-change."
- Frontend architects who need to evaluate how technical choices affect the critical path.
