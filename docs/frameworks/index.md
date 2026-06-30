# 框架与生态

> 副标题：看透 React Fiber、Vue 3 响应式与状态管理抽象背后的工程取舍

## 模块定位

现代前端框架把"如何更新 DOM"这件事抽象得越来越彻底，但抽象不是免费的。React Fiber 的链式可中断渲染、Vue 3 的 Proxy 响应式、Zustand 的原子化状态，每一种方案背后都是对"调度、依赖追踪、性能与开发体验"的不同取舍。

本模块不只讲"怎么用框架"，而是拆开框架的内部机制，让你理解它为什么这样设计、在什么场景下会有性能瓶颈、什么情况下应该绕过抽象直接操作底层。

## 核心主题

- **调度机制**：React Fiber 链表结构、时间切片、可中断渲染与并发模式
- **响应式系统**：Vue 3 Proxy 依赖收集、Effect 调度、ref / reactive / computed 的实现差异
- **状态管理**：Flux 单向流、Redux 中间件、Zustand 原子化、Recoil 派生状态的设计演进
- **工程取舍**：运行时 vs 编译时、细粒度更新 vs 虚拟 DOM diff、单 store vs 原子的权衡

## 文章导览

- [React Fiber 架构：从栈调度到链式可中断渲染](/frameworks/react-fiber) — Fiber 节点结构、Scheduler、Lane 优先级模型
- [Vue 3 响应式系统：Proxy 与依赖收集的完整实现](/frameworks/vue3-reactivity) — 从 Proxy trap 到 Effect 调度的完整链路
- [现代状态管理演进：从 Flux 到 Zustand 的设计哲学](/frameworks/state-management) — 单向流、不可变性、原子化的取舍脉络

## 适用读者

- 中高级前端工程师，希望理解框架内部机制而非只会用 API
- 前端架构师，需要在技术选型时评估不同框架的性能边界
- 框架源码贡献者，需要建立调度、响应式、状态管理的统一视角
