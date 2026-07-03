# Testing Engineering

> Subtitle: From load testing, end-to-end testing to unit testing, build a verifiable quality-assurance system.

## Module Positioning

Testing is not a "final step" after development is done. It is an engineering method that runs through the full lifecycle of requirements, design, and delivery. This module decomposes testing into three goals: verification, isolation, and regression. Verify system boundaries under real pressure, isolate defects to specific layers, and ensure every change does not introduce new problems.

Each test category is accompanied by toolchain selection, scenario design, and result-analysis methods, avoiding pseudo-coverage where "tests were run but no conclusion could be drawn."

## Core Topics

- **Load & performance testing**: Test plans, load models, JMeter script parameterization, TPS / response time / error-rate metrics, and bottleneck localization.
- **End-to-end testing**: Playwright / Cypress scenario design, assertion strategy, parallel execution, and stability governance.
- **Unit & integration testing**: Jest / Vitest test pyramid, mock strategy, coverage boundaries, and contract testing.
- **Monitoring & observability**: Grafana, APM, OCP metric collection, and 95th-percentile response-time analysis.
- **Stability assurance**: Degradation and circuit-breaker validation, capacity planning, and third-party dependency stress testing.

## Article Guide

- [Load Testing Engineering Practice](/en/testing/load-testing-practice) — Full-process methodology for load testing and bottleneck diagnosis.

## Intended Readers

- Testing engineers and quality owners who need to build a team-level load-testing and bottleneck-localization framework.
- Intermediate and senior frontend engineers who want to understand system behavior under real pressure.
- Frontend architects who need to evaluate scalability and fault tolerance during technical decision-making.
