import { defineConfig } from 'vitepress'
import taskLists from 'markdown-it-task-lists'
import footnote from 'markdown-it-footnote'

export default defineConfig({
  base: '/',
  cleanUrls: true,
  head: [
    ['link', { rel: 'icon', href: '/favicon.png', type: 'image/png' }]
  ],
  markdown: {
    theme: {
      light: 'vitesse-light',
      dark: 'github-dark'
    },
    lineNumbers: true,
    config: (md) => {
      md.use(taskLists, { enabled: true, label: true })
      md.use(footnote)
    }
  },
  locales: {
    root: {
      label: '中文',
      lang: 'zh-CN',
      title: 'Frontier Vault',
      description: '面向中高级前端工程师的系统化知识库',
      themeConfig: {
        nav: [
          { text: '首页', link: '/' },
          { text: '浏览器', link: '/browser/' },
          { text: 'JavaScript', link: '/javascript/' },
          { text: '框架生态', link: '/frameworks/' },
          { text: '性能优化', link: '/performance/' },
          { text: '测试工程', link: '/testing/' },
          { text: '职业体系', link: '/career/' }
        ],
        sidebar:         {
          "/browser/": [
            {
              "text": "浏览器原理",
              "items": [
                {
                  "text": "概述",
                  "link": "/browser/"
                },
                {
                  "text": "布局抖动的真相：Layout Thrashing 如何搞垮你的动画",
                  "link": "/browser/layout-thrashing"
                },
                {
                  "text": "绘制与光栅化：从图层合成到屏幕显示",
                  "link": "/browser/painting-rasterization"
                },
                {
                  "text": "渲染流水线：从 HTML 到像素",
                  "link": "/browser/rendering-pipeline"
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
                  "text": "现代状态管理演进：从 Flux 到 Zustand 的设计哲学",
                  "link": "/frameworks/state-management"
                },
                {
                  "text": "Vue 3 响应式系统：Proxy 与依赖收集的完整实现",
                  "link": "/frameworks/vue3-reactivity"
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
                  "text": "异步编程的演进：从回调地狱到 async/await",
                  "link": "/javascript/async-evolution"
                },
                {
                  "text": "执行上下文与作用域链：从 V8 视角理解闭包本质",
                  "link": "/javascript/execution-context-closure"
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
                  "text": "现代前端性能的底层链路：如何减少关键路径上的等待、阻塞与重复工作",
                  "link": "/performance/critical-path"
                },
                {
                  "text": "渲染性能避坑指南：从 Layout、Paint 到 Composite 的常见陷阱与解法",
                  "link": "/performance/rendering-pitfalls"
                }
              ]
            }
          ],
          "/testing/": [
            {
              "text": "测试工程",
              "items": [
                {
                  "text": "概述",
                  "link": "/testing/"
                },
                {
                  "text": "负载测试工程实践：从测试计划到瓶颈定位的全流程方法论",
                  "link": "/testing/load-testing-practice"
                }
              ]
            }
          ]
        },
        footer: {
          message: 'Code: MIT | Content: CC BY 4.0',
          copyright: 'Copyright © 2026-present'
        },
        search: {
          provider: 'local',
          options: {
            translations: {
              button: {
                buttonText: '搜索文档',
                buttonAriaLabel: '搜索文档'
              },
              modal: {
                noResultsText: '无法找到相关结果',
                resetButtonTitle: '清除查询条件',
                footer: {
                  selectText: '选择',
                  navigateText: '切换',
                  closeText: '关闭'
                }
              }
            }
          }
        }
      }
    },
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      title: 'Frontier Vault',
      description: 'A systematic knowledge base for advanced frontend engineers',
      themeConfig: {
        nav: [
          { text: 'Home', link: '/en/' },
          { text: 'Browser', link: '/en/browser/' },
          { text: 'JavaScript', link: '/en/javascript/' },
          { text: 'Frameworks', link: '/en/frameworks/' },
          { text: 'Performance', link: '/en/performance/' },
          { text: 'Testing', link: '/en/testing/' },
          { text: 'Career', link: '/en/career/' }
        ],
        sidebar:         {
          "/en/browser/": [
            {
              "text": "Browser Internals",
              "items": [
                {
                  "text": "Overview",
                  "link": "/en/browser/"
                },
                {
                  "text": "The Truth About Layout Thrashing: How It Wrecks Your Animations",
                  "link": "/en/browser/layout-thrashing"
                },
                {
                  "text": "Painting and Rasterization: From Layer Composition to Screen Display",
                  "link": "/en/browser/painting-rasterization"
                },
                {
                  "text": "Rendering Pipeline: From HTML to Pixels",
                  "link": "/en/browser/rendering-pipeline"
                }
              ]
            }
          ],
          "/en/career/": [
            {
              "text": "Career System",
              "items": [
                {
                  "text": "Overview",
                  "link": "/en/career/"
                },
                {
                  "text": "Frontend Engineer Capability Model: A Growth Framework from T-Shaped to π-Shaped Talent",
                  "link": "/en/career/capability-model"
                },
                {
                  "text": "Technical Growth Path: The Capability Leap from Junior to Architect",
                  "link": "/en/career/growth-path"
                },
                {
                  "text": "Building Technical Influence: From Code Contribution to Technical Leadership",
                  "link": "/en/career/technical-influence"
                }
              ]
            }
          ],
          "/en/frameworks/": [
            {
              "text": "Frameworks & Ecosystem",
              "items": [
                {
                  "text": "Overview",
                  "link": "/en/frameworks/"
                },
                {
                  "text": "React Fiber Architecture: From Stack Reconciliation to Interruptible Chain Rendering",
                  "link": "/en/frameworks/react-fiber"
                },
                {
                  "text": "Modern State Management Evolution: The Design Philosophy from Flux to Zustand",
                  "link": "/en/frameworks/state-management"
                },
                {
                  "text": "Vue 3 Reactivity System: The Complete Implementation of Proxy and Dependency Collection",
                  "link": "/en/frameworks/vue3-reactivity"
                }
              ]
            }
          ],
          "/en/javascript/": [
            {
              "text": "JavaScript Deep Dive",
              "items": [
                {
                  "text": "Overview",
                  "link": "/en/javascript/"
                },
                {
                  "text": "Async Programming Evolution: From Callback Hell to async/await",
                  "link": "/en/javascript/async-evolution"
                },
                {
                  "text": "Execution Context & Scope Chain: Understanding Closures from the V8 Perspective",
                  "link": "/en/javascript/execution-context-closure"
                },
                {
                  "text": "V8 Engine Deep Dive: JIT Compilation and Garbage Collection",
                  "link": "/en/javascript/v8-jit-gc"
                }
              ]
            }
          ],
          "/en/performance/": [
            {
              "text": "Performance Engineering",
              "items": [
                {
                  "text": "Overview",
                  "link": "/en/performance/"
                },
                {
                  "text": "The Critical Path of Modern Frontend Performance",
                  "link": "/en/performance/critical-path"
                },
                {
                  "text": "Rendering Performance Pitfalls: Common Traps and Solutions from Layout, Paint to Composite",
                  "link": "/en/performance/rendering-pitfalls"
                }
              ]
            }
          ],
          "/en/testing/": [
            {
              "text": "Testing Engineering",
              "items": [
                {
                  "text": "Overview",
                  "link": "/en/testing/"
                },
                {
                  "text": "Load Testing Engineering Practice: A Full-Stack Methodology from Test Plan to Bottleneck Localization",
                  "link": "/en/testing/load-testing-practice"
                }
              ]
            }
          ]
        },
        footer: {
          message: 'Code: MIT | Content: CC BY 4.0',
          copyright: 'Copyright © 2026-present'
        },
        search: {
          provider: 'local',
          options: {
            translations: {
              button: {
                buttonText: 'Search documentation',
                buttonAriaLabel: 'Search documentation'
              },
              modal: {
                noResultsText: 'No results found',
                resetButtonTitle: 'Reset search',
                footer: {
                  selectText: 'Select',
                  navigateText: 'Navigate',
                  closeText: 'Close'
                }
              }
            }
          }
        }
      }
    }
  },
  socialLinks: [
    { icon: 'github', link: 'https://github.com/Fatejian/frontier-vault' }
  ]
})
