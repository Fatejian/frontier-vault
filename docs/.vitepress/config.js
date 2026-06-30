import { defineConfig } from 'vitepress'
import taskLists from 'markdown-it-task-lists'
import footnote from 'markdown-it-footnote'

export default defineConfig({
  title: 'Frontier Vault',
  description: 'Advanced frontend knowledge base & career system',
  base: '/',
  cleanUrls: true,
  rewrites: {
    'browser/03-渲染流水线：从HTML到像素.md': 'browser/rendering-pipeline.md',
    'browser/04-layout-thrashing.md': 'browser/layout-thrashing.md',
    'browser/05-绘制与光栅化.md': 'browser/painting-rasterization.md',
    'performance/03-渲染性能避坑指南.md': 'performance/rendering-pitfalls.md',
    'performance/现代前端性能的底层链路：如何减少关键路径上的等待、阻塞与重复工作.md': 'performance/critical-path.md',
    'career/01-前端工程师能力模型：从T型到π型人才的进阶框架.md': 'career/capability-model.md',
    'career/02-技术成长路径：从初级到架构师的能力跃迁.md': 'career/growth-path.md',
    'career/03-技术影响力构建：从代码贡献到技术领导力.md': 'career/technical-influence.md',
    'javascript/01-执行上下文与作用域链：从V8视角理解闭包本质.md': 'javascript/execution-context-closure.md',
    'javascript/02-异步编程的演进：从回调地狱到async-await.md': 'javascript/async-evolution.md',
    'javascript/03-V8引擎揭秘：JIT编译与垃圾回收机制.md': 'javascript/v8-jit-gc.md',
    'frameworks/01-React-Fiber架构：从栈调度到链式可中断渲染.md': 'frameworks/react-fiber.md',
    'frameworks/02-Vue3响应式系统：Proxy与依赖收集的完整实现.md': 'frameworks/vue3-reactivity.md',
    'frameworks/03-现代状态管理演进：从Flux到Zustand的设计哲学.md': 'frameworks/state-management.md',
  },
  head: [
    ['link', { rel: 'icon', href: '/favicon.png', type: 'image/png' }]
  ],
  markdown: {
    theme: 'github-dark',
    lineNumbers: true,
    config: (md) => {
      md.use(taskLists, { enabled: true, label: true })
      md.use(footnote)
    }
  },
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '浏览器', link: '/browser/' },
      { text: 'JavaScript', link: '/javascript/' },
      { text: '框架生态', link: '/frameworks/' },
      { text: '性能优化', link: '/performance/' },
      { text: '职业体系', link: '/career/' }
    ],
    sidebar:     {
      "/browser/": [
        {
          "text": "浏览器原理",
          "items": [
            {
              "text": "概述",
              "link": "/browser/"
            },
            {
              "text": "渲染流水线：从HTML到像素",
              "link": "/browser/rendering-pipeline"
            },
            {
              "text": "布局抖动的真相：Layout Thrashing 如何搞垮你的动画",
              "link": "/browser/layout-thrashing"
            },
            {
              "text": "绘制与光栅化",
              "link": "/browser/painting-rasterization"
            }
          ]
        }
      ],
      "/career/": [
        {
          "text": "职业体系",
          "items": [
            {
              "text": "概述",
              "link": "/career/"
            },
            {
              "text": "前端工程师能力模型：从 T 型到 π 型人才的进阶框架",
              "link": "/career/capability-model"
            },
            {
              "text": "技术成长路径：从初级到架构师的能力跃迁",
              "link": "/career/growth-path"
            },
            {
              "text": "技术影响力构建：从代码贡献到技术领导力",
              "link": "/career/technical-influence"
            }
          ]
        }
      ],
      "/frameworks/": [
        {
          "text": "框架与生态",
          "items": [
            {
              "text": "概述",
              "link": "/frameworks/"
            },
            {
              "text": "React Fiber 架构：从栈调度到链式可中断渲染",
              "link": "/frameworks/react-fiber"
            },
            {
              "text": "Vue 3 响应式系统：Proxy 与依赖收集的完整实现",
              "link": "/frameworks/vue3-reactivity"
            },
            {
              "text": "现代状态管理演进：从 Flux 到 Zustand 的设计哲学",
              "link": "/frameworks/state-management"
            }
          ]
        }
      ],
      "/javascript/": [
        {
          "text": "JavaScript 深度",
          "items": [
            {
              "text": "概述",
              "link": "/javascript/"
            },
            {
              "text": "执行上下文与作用域链：从 V8 视角理解闭包本质",
              "link": "/javascript/execution-context-closure"
            },
            {
              "text": "异步编程的演进：从回调地狱到 async/await",
              "link": "/javascript/async-evolution"
            },
            {
              "text": "V8 引擎揭秘：JIT 编译与垃圾回收机制",
              "link": "/javascript/v8-jit-gc"
            }
          ]
        }
      ],
      "/performance/": [
        {
          "text": "性能优化工程",
          "items": [
            {
              "text": "概述",
              "link": "/performance/"
            },
            {
              "text": "渲染性能避坑指南",
              "link": "/performance/rendering-pitfalls"
            },
            {
              "text": "现代前端性能的底层链路：如何减少关键路径上的等待、阻塞与重复工作",
              "link": "/performance/critical-path"
            }
          ]
        }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Fatejian/frontier-vault' }
    ],
    footer: {
      message: 'Code: MIT | Content: CC BY 4.0',
      copyright: 'Copyright © 2026-present'
    },
    search: {
      provider: 'local'
    }
  }
})