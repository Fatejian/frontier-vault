/**
 * generate-sidebar.js — 从 i18n 数据源生成 VitePress config.js
 *
 * 用途：以 docs/.vitepress/i18n/ 下的三个数据源为单一真相来源，
 *      数据驱动地生成 VitePress 的 config.js（locales / nav / sidebar / footer / search）。
 *
 * 依赖（单一数据源）：
 *   - docs/.vitepress/i18n/languages.js  语言元数据（code/label/dir/isDefault/...）
 *   - docs/.vitepress/i18n/modules.js    每语言每模块的本地化显示名
 *   - docs/.vitepress/i18n/ui.js          每语言的导航/搜索/页脚/概述等界面文案
 *
 * 用法：
 *   node scripts/generate-sidebar.js          生成 docs/.vitepress/config.js
 *   node scripts/generate-sidebar.js --check  检查翻译完整性（不写入 config.js）
 *
 * 新增语言步骤：
 *   1. 在 docs/.vitepress/i18n/languages.js 增加语言条目（isDefault: false, dir: '<code>'）
 *   2. 在 modules.js 与 ui.js 中补齐该语言的文案
 *   3. 创建 docs/<code>/ 目录并放入对应 Markdown 文件
 *   4. 重新运行 node scripts/generate-sidebar.js
 */

import fs from 'fs'
import path from 'path'

import languages from '../docs/.vitepress/i18n/languages.js'
import moduleNames from '../docs/.vitepress/i18n/modules.js'
import uiStrings from '../docs/.vitepress/i18n/ui.js'

// 脚本约定从项目根目录运行（npm scripts 即如此）
const projectRoot = process.cwd()
const docsDir = path.join(projectRoot, 'docs')
const configPath = path.join(docsDir, '.vitepress', 'config.js')

// 基础排除目录（任何语言扫描都排除）
const baseExcludedDirs = ['.vitepress', 'public']
// 非默认语言目录列表（默认语言扫描 docs/ 根时需排除这些语言目录）
const nonDefaultLangDirs = languages.filter(l => !l.isDefault).map(l => l.dir)
// 默认语言扫描 docs/ 根时的排除集合：基础项 + 所有非默认语言目录
const defaultLangExcludedDirs = [...baseExcludedDirs, ...nonDefaultLangDirs]

/**
 * 从 Markdown 文件读取首个 H1 标题；读不到返回 null
 */
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

/**
 * 为指定语言生成 sidebar 配置对象
 * @param {object} lang  来自 languages.js 的语言配置对象
 * @returns {object} sidebar 配置对象（key: 模块路径前缀，value: 条目数组）
 */
function generateSidebarForLang(lang) {
  const sidebar = {}
  const prefix = lang.isDefault ? '' : `/${lang.dir}`
  // 默认语言扫描 docs/ 根；非默认语言扫描 docs/<dir>/
  const langDir = lang.isDefault ? docsDir : path.join(docsDir, lang.dir)
  const excluded = lang.isDefault ? defaultLangExcludedDirs : baseExcludedDirs

  if (!fs.existsSync(langDir)) return sidebar

  const modules = fs.readdirSync(langDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !excluded.includes(d.name))
    .map(d => d.name)
    .sort()

  modules.forEach(moduleName => {
    const modulePath = path.join(langDir, moduleName)
    const files = fs.readdirSync(modulePath, { withFileTypes: true })
      .filter(f => f.isFile() && f.name.endsWith('.md') && f.name !== 'index.md')
      .map(f => f.name)
      .sort()

    const items = []

    // index.md → 概述条目
    if (fs.existsSync(path.join(modulePath, 'index.md'))) {
      items.push({
        text: uiStrings[lang.code].overview,
        link: `${prefix}/${moduleName}/`
      })
    }

    // 其余 .md 文件 → slug 直接拼 link，标题取自 H1
    files.forEach(file => {
      const slug = file.replace(/\.md$/, '')
      const link = `${prefix}/${moduleName}/${slug}`
      const title = getTitleFromMarkdown(path.join(modulePath, file)) || slug
      items.push({ text: title, link })
    })

    const sidebarKey = `${prefix}/${moduleName}/`
    sidebar[sidebarKey] = [{
      text: moduleNames[lang.code][moduleName] || moduleName,
      items
    }]
  })

  return sidebar
}

/**
 * 把字符串序列化为 JS 单引号字面量（转义反斜杠与单引号）
 */
function jsString(s) {
  return `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

/**
 * 把 JS 值序列化为 JS 字面量风格字符串（单引号、无引号 key），
 * 用于嵌入 search.translations 等结构化对象
 * @param {*} value    待序列化的值
 * @param {number} indent  当前层级闭合括号的缩进空格数
 */
function formatJs(value, indent = 0) {
  const pad = ' '.repeat(indent)
  const padInner = ' '.repeat(indent + 2)
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const items = value.map(v => `${padInner}${formatJs(v, indent + 2)}`).join(',\n')
    return `[\n${items}\n${pad}]`
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
    if (entries.length === 0) return '{}'
    const items = entries
      .map(([k, v]) => `${padInner}${k}: ${formatJs(v, indent + 2)}`)
      .join(',\n')
    return `{\n${items}\n${pad}}`
  }
  if (typeof value === 'string') return jsString(value)
  return String(value)
}

/**
 * 把 sidebar 对象格式化为带 8 空格前缀的字符串
 * 保持与历史输出一致：sidebar: 与首行 { 同行，后续每行加 8 空格缩进
 */
function formatSidebar(sidebar) {
  return JSON.stringify(sidebar, null, 2)
    .split('\n')
    .map(line => '        ' + line)
    .join('\n')
}

/**
 * 生成单个语言的 locale 块字符串
 */
function generateLocaleBlock(lang) {
  const navLines = uiStrings[lang.code].nav
    .map(item => `          { text: ${jsString(item.text)}, link: ${jsString(item.link)} }`)
    .join(',\n')

  const sidebar = generateSidebarForLang(lang)
  const sidebarStr = formatSidebar(sidebar)

  const footer = uiStrings[lang.code].footer
  // search.translations 块缩进对齐到 12 空格（与现有 config.js 一致）
  const searchTranslations = formatJs(uiStrings[lang.code].search, 12)

  const linkLine = lang.isDefault ? '' : `      link: '/${lang.dir}/',\n`
  const localeKey = lang.isDefault ? 'root' : lang.code

  return `    ${localeKey}: {
      label: ${jsString(lang.label)},
      lang: ${jsString(lang.lang)},
${linkLine}      title: ${jsString(lang.title)},
      description: ${jsString(lang.description)},
      themeConfig: {
        nav: [
${navLines}
        ],
        sidebar: ${sidebarStr},
        footer: {
          message: ${jsString(footer.message)},
          copyright: ${jsString(footer.copyright)}
        },
        search: {
          provider: 'local',
          options: {
            translations: ${searchTranslations}
          }
        }
      }
    }`
}

/**
 * 生成完整 config.js 文件内容
 */
function generateConfigContent() {
  const localeBlocks = languages.map(generateLocaleBlock).join(',\n')

  return `import { defineConfig } from 'vitepress'
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
${localeBlocks}
  },
  socialLinks: [
    { icon: 'github', link: 'https://github.com/Fatejian/frontier-vault' }
  ]
})
`
}

/**
 * 翻译完整性检查：
 * 扫描默认语言的所有 <module>/<slug>.md（排除 index.md），收集 slug 集合；
 * 对每个非默认语言目录，检查同 <module>/<slug>.md 是否存在。
 * 有缺失退出码 1，无缺失退出码 0。
 */
function checkTranslations() {
  const defaultLang = languages.find(l => l.isDefault)
  if (!defaultLang) {
    console.error('No default language defined in languages.js')
    process.exit(2)
  }

  // 收集默认语言所有 module/slug 集合（以 `module/slug` 形式存储）
  const sourceSlugs = new Set()
  const moduleDirs = fs.readdirSync(docsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !defaultLangExcludedDirs.includes(d.name))
    .map(d => d.name)

  for (const moduleName of moduleDirs) {
    const modulePath = path.join(docsDir, moduleName)
    const files = fs.readdirSync(modulePath, { withFileTypes: true })
      .filter(f => f.isFile() && f.name.endsWith('.md') && f.name !== 'index.md')
      .map(f => f.name)
    for (const file of files) {
      const slug = file.replace(/\.md$/, '')
      sourceSlugs.add(`${moduleName}/${slug}`)
    }
  }

  let hasMissing = false
  for (const lang of languages.filter(l => !l.isDefault)) {
    const langDir = path.join(docsDir, lang.dir)
    const missing = []
    if (!fs.existsSync(langDir)) {
      // 整个语言目录不存在：所有源 slug 均视为缺失
      for (const slug of sourceSlugs) missing.push(slug)
    } else {
      for (const slugPath of sourceSlugs) {
        const [moduleName, slug] = slugPath.split('/')
        const expected = path.join(langDir, moduleName, `${slug}.md`)
        if (!fs.existsSync(expected)) missing.push(slugPath)
      }
    }
    for (const slug of missing) {
      console.log(`MISSING  ${lang.code}  ${slug}`)
    }
    if (missing.length > 0) {
      console.log(`Total: ${missing.length} missing translations in ${lang.code}`)
      hasMissing = true
    }
  }

  if (!hasMissing) {
    console.log('All translations complete.')
    process.exit(0)
  } else {
    process.exit(1)
  }
}

// 主入口：--check 走翻译检查；否则生成 config.js
if (process.argv.includes('--check')) {
  checkTranslations()
} else {
  const content = generateConfigContent()
  fs.writeFileSync(configPath, content, 'utf-8')
  console.log(`已生成 ${path.relative(projectRoot, configPath)}`)
}
