import fs from 'fs'
import path from 'path'

const docsDir = path.join(process.cwd(), 'docs')
const configPath = path.join(docsDir, '.vitepress', 'config.js')

const excludedDirs = ['.vitepress', 'public']
const excludedFiles = ['api-examples.md', 'markdown-examples.md']

function getModuleName(dirName) {
  const names = {
    browser: '浏览器原理',
    javascript: 'JavaScript 深度',
    frameworks: '框架与生态',
    performance: '性能优化工程',
    career: '职业体系'
  }
  return names[dirName] || dirName
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

function generateSidebar() {
  const sidebar = {}
  const modules = fs.readdirSync(docsDir, { withFileTypes: true })
    .filter(dir => dir.isDirectory() && !excludedDirs.includes(dir.name))

  modules.forEach(module => {
    const modulePath = path.join(docsDir, module.name)
    const files = fs.readdirSync(modulePath, { withFileTypes: true })
      .filter(f => f.isFile() && f.name.endsWith('.md'))
      .map(f => f.name)
      .filter(f => f !== 'index.md')
      .sort()

    const items = []

    if (fs.existsSync(path.join(modulePath, 'index.md'))) {
      items.push({ text: '概述', link: `/${module.name}/` })
    }

    files.forEach(file => {
      if (excludedFiles.includes(file)) return
      const link = `/${module.name}/${file.replace('.md', '')}`
      const filePath = path.join(modulePath, file)
      const title = getTitleFromMarkdown(filePath) || parseFileName(file)
      items.push({ text: title, link })
    })

    sidebar[`/${module.name}/`] = [{
      text: getModuleName(module.name),
      items
    }]
  })

  return sidebar
}

function updateConfig() {
  const sidebar = generateSidebar()
  const sidebarStr = JSON.stringify(sidebar, null, 2)
    .split('\n')
    .map(line => '    ' + line)
    .join('\n')

  const configContent = `import { defineConfig } from 'vitepress'

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
    sidebar: ${sidebarStr},
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
})`

  fs.writeFileSync(configPath, configContent, 'utf-8')
  console.log('侧边栏配置已更新：')
  console.log(JSON.stringify(sidebar, null, 2))
}

updateConfig()
