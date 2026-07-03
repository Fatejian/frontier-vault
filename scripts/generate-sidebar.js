import fs from 'fs'
import path from 'path'

const docsDir = path.join(process.cwd(), 'docs')
const configPath = path.join(docsDir, '.vitepress', 'config.js')

const excludedDirs = ['.vitepress', 'public', 'en']
const excludedFiles = []

// 中文源文件名 → 英文 slug 的映射（与 .vitepress/config.js 中的 rewrites 保持一致）
const rewriteMap = {
  'browser/01-渲染流水线：从HTML到像素.md': 'browser/rendering-pipeline',
  'browser/02-布局抖动的真相：Layout-Thrashing如何搞垮动画.md': 'browser/layout-thrashing',
  'browser/03-绘制与光栅化.md': 'browser/painting-rasterization',
  'performance/01-现代前端性能的底层链路：如何减少关键路径上的等待、阻塞与重复工作.md': 'performance/critical-path',
  'performance/02-渲染性能避坑指南.md': 'performance/rendering-pitfalls',
  'career/01-前端工程师能力模型：从T型到π型人才的进阶框架.md': 'career/capability-model',
  'career/02-技术成长路径：从初级到架构师的能力跃迁.md': 'career/growth-path',
  'career/03-技术影响力构建：从代码贡献到技术领导力.md': 'career/technical-influence',
  'javascript/01-执行上下文与作用域链：从V8视角理解闭包本质.md': 'javascript/execution-context-closure',
  'javascript/02-异步编程的演进：从回调地狱到async-await.md': 'javascript/async-evolution',
  'javascript/03-V8引擎揭秘：JIT编译与垃圾回收机制.md': 'javascript/v8-jit-gc',
  'frameworks/01-React-Fiber架构：从栈调度到链式可中断渲染.md': 'frameworks/react-fiber',
  'frameworks/02-Vue3响应式系统：Proxy与依赖收集的完整实现.md': 'frameworks/vue3-reactivity',
  'frameworks/03-现代状态管理演进：从Flux到Zustand的设计哲学.md': 'frameworks/state-management',
  'testing/01-负载测试工程实践：从测试计划到瓶颈定位的全流程方法论.md': 'testing/load-testing-practice',
}

const moduleNames = {
  zh: {
    browser: '浏览器原理',
    javascript: 'JavaScript 深度',
    frameworks: '框架与生态',
    performance: '性能优化工程',
    career: '职业体系',
    testing: '测试工程'
  },
  en: {
    browser: 'Browser Internals',
    javascript: 'JavaScript Deep Dive',
    frameworks: 'Frameworks & Ecosystem',
    performance: 'Performance Engineering',
    career: 'Career System',
    testing: 'Testing Engineering'
  }
}

function getTitleFromMarkdown(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  for (const line of lines) {
    if (line.startsWith('# ')) {
      return line.slice(2).trim()
    }
  }
  return null
}

function parseFileName(fileName) {
  const match = fileName.match(/^(\d+-)?(.+)\.md$/)
  if (match) {
    return match[2]
  }
  return fileName.replace('.md', '')
}

const langNames = {
  zh: { overview: '概述' },
  en: { overview: 'Overview' }
}

function generateSidebarForLang(langDir, prefix = '') {
  const sidebar = {}
  const modules = fs.readdirSync(langDir, { withFileTypes: true })
    .filter(dir => dir.isDirectory() && !excludedDirs.includes(dir.name))

  modules.forEach(module => {
    const modulePath = path.join(langDir, module.name)
    const files = fs.readdirSync(modulePath, { withFileTypes: true })
      .filter(f => f.isFile() && f.name.endsWith('.md'))
      .map(f => f.name)
      .filter(f => f !== 'index.md')
      .sort()

    const items = []

    const langKey = prefix ? 'en' : 'zh'

    if (fs.existsSync(path.join(modulePath, 'index.md'))) {
      items.push({ text: langNames[langKey].overview, link: `${prefix}/${module.name}/` })
    }

    files.forEach(file => {
      if (excludedFiles.includes(file)) return

      const relativePath = path.join(path.relative(docsDir, modulePath), file).replace(/\\/g, '/')
      const rewriteKey = relativePath
      const link = rewriteMap[rewriteKey]
        ? `/${rewriteMap[rewriteKey]}`
        : `${prefix}/${module.name}/${file.replace('.md', '')}`

      const filePath = path.join(modulePath, file)
      const title = getTitleFromMarkdown(filePath) || parseFileName(file)
      items.push({ text: title, link })
    })

    sidebar[`${prefix}/${module.name}/`] = [{
      text: moduleNames[langKey][module.name] || module.name,
      items
    }]
  })

  return sidebar
}

function updateConfig() {
  const zhSidebar = generateSidebarForLang(docsDir)
  const enSidebar = generateSidebarForLang(path.join(docsDir, 'en'), '/en')

  const sidebarStr = (sidebar) => JSON.stringify(sidebar, null, 2)
    .split('\n')
    .map(line => '        ' + line)
    .join('\n')

  const configContent = `import { defineConfig } from 'vitepress'
import taskLists from 'markdown-it-task-lists'
import footnote from 'markdown-it-footnote'

export default defineConfig({
  base: '/',
  cleanUrls: true,
  rewrites: {
${Object.entries(rewriteMap).map(([k, v]) => `    '${k}': '${v}.md'`).join(',\n')}
  },
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
        sidebar: ${sidebarStr(zhSidebar)},
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
        sidebar: ${sidebarStr(enSidebar)},
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
})`

  fs.writeFileSync(configPath, configContent, 'utf-8')
  console.log('侧边栏配置已更新：')
  console.log(JSON.stringify({ ...zhSidebar, ...enSidebar }, null, 2))
}

updateConfig()
