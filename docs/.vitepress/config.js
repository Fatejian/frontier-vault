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