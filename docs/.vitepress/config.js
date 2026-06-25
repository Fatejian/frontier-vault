import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Frontier Vault',
  description: 'Advanced frontend knowledge base & career system',
  base: '/frontier-vault/',
  markdown: {
    theme: 'github-dark',
    lineNumbers: true
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
    sidebar: {
      '/browser/': [
        {
          text: '浏览器原理',
          items: [
            { text: '概述', link: '/browser/' },
            // 后面文章逐渐补充，例如：
            // { text: '架构与进程模型', link: '/browser/architecture' }
          ]
        }
      ],
      '/javascript/': [
        {
          text: 'JavaScript 深度',
          items: [
            { text: '概述', link: '/javascript/' }
          ]
        }
      ],
      '/frameworks/': [
        {
          text: '框架与生态',
          items: [
            { text: '概述', link: '/frameworks/' }
          ]
        }
      ],
      '/performance/': [
        {
          text: '性能优化工程',
          items: [
            { text: '概述', link: '/performance/' }
          ]
        }
      ],
      '/career/': [
        {
          text: '职业体系',
          items: [
            { text: '概述', link: '/career/' }
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
