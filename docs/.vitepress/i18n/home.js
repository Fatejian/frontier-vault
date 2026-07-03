// 首页 i18n 数据源：每语言的 hero 与 features 配置。
// 与 VitePress home layout frontmatter 字段一一对应。
// 用法：node scripts/generate-sidebar.js --sync-home 校验各语言 index.md frontmatter 一致性。
export default {
  zh: {
    hero: {
      name: 'Frontier Vault',
      text: 'Advanced frontend knowledge base & career system',
      tagline: '面向中高级前端工程师的系统化知识库 — 从浏览器底层原理、JavaScript 运行时、框架生态到性能优化与职业成长，构建可落地的工程认知体系',
      actions: [
        { theme: 'brand', text: '开始阅读', link: '/browser/' },
        { theme: 'alt', text: 'GitHub', link: 'https://github.com/Fatejian/frontier-vault' }
      ]
    },
    features: [
      {
        title: '浏览器原理',
        details: '深入 Chromium 多进程架构、渲染流水线（Style / Layout / Paint / Raster / Composite）、GPU 合成与 V8 引擎机制，建立从请求到像素的完整心智模型'
      },
      {
        title: 'JavaScript 深度',
        details: '从执行上下文、作用域链、闭包本质到 V8 JIT 编译与 GC 回收，理解异步演进与内存模型，写出可预测性能的代码'
      },
      {
        title: '框架生态',
        details: '剖析 React Fiber 链式可中断渲染、Vue 3 Proxy 响应式、状态管理从 Flux 到 Zustand 的设计演进，看透框架抽象背后的工程取舍'
      },
      {
        title: '性能优化',
        details: '围绕 Core Web Vitals（LCP / INP / CLS）与渲染管线，拆解关键路径上的等待、阻塞与重复工作，输出可执行的优化清单'
      },
      {
        title: '测试工程',
        details: '覆盖负载测试全流程方法论、TPS / P95 指标体系、瓶颈分层诊断、降级与熔断验证，构建可验证的质量保障体系'
      },
      {
        title: '职业体系',
        details: '从 T 型到 π 型能力模型、初级到架构师的成长路径、技术影响力构建方法，提供可量化的进阶框架而非空泛建议'
      }
    ]
  },
  en: {
    hero: {
      name: 'Frontier Vault',
      text: 'Advanced frontend knowledge base & career system',
      tagline: 'A systematic knowledge base for advanced frontend engineers — from browser internals and JavaScript runtimes to framework ecosystems, performance optimization, and career growth. Build a practical engineering mental model.',
      actions: [
        { theme: 'brand', text: 'Start Reading', link: '/en/browser/' },
        { theme: 'alt', text: 'GitHub', link: 'https://github.com/Fatejian/frontier-vault' }
      ]
    },
    features: [
      {
        title: 'Browser Internals',
        details: "Deep dive into Chromium's multi-process architecture, the rendering pipeline (Style / Layout / Paint / Raster / Composite), GPU compositing, and V8 engine mechanics. Build a complete mental model from request to pixel."
      },
      {
        title: 'JavaScript Deep Dive',
        details: 'From execution context, scope chain, and closure nature to V8 JIT compilation and GC. Understand the evolution of async programming and memory models to write predictable, high-performance code.'
      },
      {
        title: 'Frameworks & Ecosystem',
        details: "Analyze React Fiber's interruptible chain rendering, Vue 3's Proxy reactivity, and the design evolution of state management from Flux to Zustand. See the engineering trade-offs behind framework abstractions."
      },
      {
        title: 'Performance Engineering',
        details: 'Centered on Core Web Vitals (LCP / INP / CLS) and the rendering pipeline, decompose waiting, blocking, and redundant work on the critical path. Produce actionable optimization checklists.'
      },
      {
        title: 'Testing Engineering',
        details: 'Cover the full load-testing methodology, TPS / P95 metrics, layered bottleneck diagnosis, and degradation / circuit-breaker validation. Build a verifiable quality-assurance system.'
      },
      {
        title: 'Career System',
        details: 'From T-shaped to π-shaped capability models, growth paths from junior to architect, and methods for building technical influence. Provide quantifiable advancement frameworks, not vague advice.'
      }
    ]
  }
}
