# JavaScript 深度

> 副标题：从执行上下文到 V8 引擎，理解代码在运行时真实发生的每一件事

## 模块定位

JavaScript 是前端工程师每天使用的语言，但"会用"和"理解"之间隔着一条巨大的鸿沟。本模块不停留在语法层面，而是深入 V8 引擎的执行机制：执行上下文如何创建、作用域链如何形成、闭包在内存中如何存续、异步任务如何在事件循环中调度、JIT 如何优化热点代码、GC 如何回收内存。

理解这些底层机制，才能写出可预测性能的代码，才能在排查闭包泄漏、内存暴涨、长任务卡顿等问题时知道从哪里下手。

## 核心主题

- **执行机制**：执行上下文、作用域链、变量环境、词法环境与闭包本质
- **异步编程**：事件循环、宏任务与微任务、Promise 链、async/await 的演进与陷阱
- **V8 引擎**：Ignition 字节码、Sparkplug / Maglev / TurboFan JIT 层级、对象 shape 与隐藏类
- **内存管理**：新生代 / 老生代 GC、Scavenge 与 Mark-Sweep-Compact、短命对象与内存泄漏
- **性能边界**：JIT 去优化、GC 暂停、长任务拆分与主线程调度

## 文章导览

- [执行上下文与作用域链：从 V8 视角理解闭包本质](/javascript/execution-context-closure) — 闭包不是语法糖，而是词法环境的引用持有
- [异步编程的演进：从回调地狱到 async/await](/javascript/async-evolution) — Promise / Generator / async/await 的设计脉络与陷阱
- [V8 引擎揭秘：JIT 编译与垃圾回收机制](/javascript/v8-jit-gc) — 从字节码到 TurboFan，从 Scavenge 到 Mark-Compact

## 适用读者

- 中高级前端工程师，希望理解 JavaScript 运行时行为而非仅停留在语法层
- 性能优化工程师，需要排查内存泄漏、长任务、JIT 去优化等问题
- 框架开发者，需要评估不同 API 的运行时成本与 GC 压力
