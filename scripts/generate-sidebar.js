/**
 * generate-sidebar.js — 从 i18n 数据源生成 VitePress config.js
 *
 * 用途：以 docs/.vitepress/i18n/ 下的数据源为单一真相来源，
 *      数据驱动地生成 VitePress 的 config.js（locales / nav / sidebar / footer / search）。
 *
 * 依赖（单一数据源）：
 *   - docs/.vitepress/i18n/languages.js  语言元数据（code/label/dir/isDefault/...）
 *   - docs/.vitepress/i18n/modules.js    每语言每模块的本地化显示名 + 模块规范顺序 order
 *   - docs/.vitepress/i18n/ui.js          每语言的导航/搜索/页脚/概述等界面文案
 *   - docs/.vitepress/i18n/home.js        每语言首页 hero/features 配置（用于 --sync-home 校验）
 *
 * 用法：
 *   node scripts/generate-sidebar.js             生成 docs/.vitepress/config.js
 *   node scripts/generate-sidebar.js --check     检查翻译完整性（不写入 config.js）
 *   node scripts/generate-sidebar.js --sync-home 校验首页 frontmatter 一致性
 *
 * 新增语言步骤：
 *   1. 在 docs/.vitepress/i18n/languages.js 增加语言条目（isDefault: false, dir: '<code>'）
 *   2. 在 modules.js 与 ui.js 中补齐该语言的文案
 *   3. 在 home.js 中补齐该语言的 hero/features 配置
 *   4. 创建 docs/<code>/ 目录并放入对应 Markdown 文件（含 index.md 首页 frontmatter）
 *   5. 重新运行 node scripts/generate-sidebar.js
 */

import fs from 'fs'
import path from 'path'

import languages from '../docs/.vitepress/i18n/languages.js'
import moduleNames, { order } from '../docs/.vitepress/i18n/modules.js'
import uiStrings from '../docs/.vitepress/i18n/ui.js'
import homeData from '../docs/.vitepress/i18n/home.js'

// 脚本约定从项目根目录运行（npm scripts 即如此）
const projectRoot = process.cwd()
const docsDir = path.join(projectRoot, 'docs')
const configPath = path.join(docsDir, '.vitepress', 'config.js')

// 基础排除目录（任何语言扫描都排除）
const baseExcludedDirs = ['.vitepress', 'public']

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
  // 统一用 lang.dir 推导：空字符串时等价于 docsDir，默认/非默认语言走同一代码路径
  const prefix = lang.dir ? `/${lang.dir}` : ''
  const langDir = path.join(docsDir, lang.dir)

  if (!fs.existsSync(langDir)) return sidebar

  // 按 order 规范顺序遍历模块；order 中存在但文件系统不存在的模块优雅跳过
  for (const moduleName of order) {
    const modulePath = path.join(langDir, moduleName)
    if (!fs.existsSync(modulePath) || !fs.statSync(modulePath).isDirectory()) continue

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
  }

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
 * 对每个非默认语言，先检查模块目录是否缺失（MISSING MODULE），再检查文章 slug 是否缺失（MISSING）。
 * 模块缺失时跳过该模块的 slug 检测以避免双重报告。有缺失退出码 1，无缺失退出码 0。
 */
function checkTranslations() {
  const defaultLang = languages.find(l => l.isDefault)
  if (!defaultLang) {
    console.error('No default language defined in languages.js')
    process.exit(2)
  }

  // 收集默认语言所有 module/slug 集合（按 order 遍历模块目录，以 `module/slug` 形式存储）
  const sourceSlugs = new Set()
  const defaultLangDir = path.join(docsDir, defaultLang.dir)
  for (const moduleName of order) {
    const modulePath = path.join(defaultLangDir, moduleName)
    if (!fs.existsSync(modulePath) || !fs.statSync(modulePath).isDirectory()) continue
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

    // 先检测模块目录缺失（遍历 order）；缺失模块的 slug 检测跳过以避免双重报告
    const missingModules = new Set()
    for (const moduleName of order) {
      const moduleDir = path.join(langDir, moduleName)
      if (!fs.existsSync(moduleDir) || !fs.statSync(moduleDir).isDirectory()) {
        missingModules.add(moduleName)
        console.log(`MISSING MODULE  ${lang.code}  ${moduleName}`)
      }
    }
    if (missingModules.size > 0) {
      hasMissing = true
    }

    // 再检测文章 slug 缺失（跳过已缺失模块）
    const missing = []
    for (const slugPath of sourceSlugs) {
      const [moduleName, slug] = slugPath.split('/')
      if (missingModules.has(moduleName)) continue
      const expected = path.join(langDir, moduleName, `${slug}.md`)
      if (!fs.existsSync(expected)) missing.push(slugPath)
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

/**
 * 截断长字符串用于错误信息展示
 */
function truncate(s, max = 60) {
  const str = String(s)
  return str.length > max ? str.slice(0, max) + '...' : str
}

/**
 * 检查 frontmatter 中是否包含指定字段的期望值
 * 兼容无引号、双引号、单引号三种写法；含特殊字符的值降级为子串包含检测
 */
function frontmatterHasField(frontmatter, fieldName, expectedValue) {
  const escaped = String(expectedValue).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`^[ \\t]*${fieldName}:[ \\t]*${escaped}[ \\t]*$`, 'm'),
    new RegExp(`^[ \\t]*${fieldName}:[ \\t]*"${escaped}"[ \\t]*$`, 'm'),
    new RegExp(`^[ \\t]*${fieldName}:[ \\t]*'${escaped}'[ \\t]*$`, 'm')
  ]
  for (const p of patterns) {
    if (p.test(frontmatter)) return true
  }
  return frontmatter.includes(String(expectedValue))
}

/**
 * 首页 frontmatter 一致性校验：
 * 对每个语言，读取 docs/<dir>/index.md 的 frontmatter，
 * 校验 home.js 中 hero/features 配置是否出现在 frontmatter 中。
 * 不一致时输出差异并退出码 1；一致时输出 OK 并退出码 0。
 * 注：此为校验工具，不自动修改 index.md（保留译者手写正文的灵活性）。
 */
function syncHome() {
  let hasMismatch = false

  for (const lang of languages) {
    const indexPath = path.join(docsDir, lang.dir, 'index.md')
    if (!fs.existsSync(indexPath)) {
      console.log(`HOME MISSING  ${lang.code}  ${path.relative(projectRoot, indexPath)}`)
      hasMismatch = true
      continue
    }

    const content = fs.readFileSync(indexPath, 'utf-8')
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (!fmMatch) {
      console.log(`HOME MISMATCH  ${lang.code}  no frontmatter found in ${path.relative(projectRoot, indexPath)}`)
      hasMismatch = true
      continue
    }
    const frontmatter = fmMatch[1]

    const data = homeData[lang.code]
    if (!data) {
      console.log(`HOME MISMATCH  ${lang.code}  no home data in home.js for this language`)
      hasMismatch = true
      continue
    }

    const mismatches = []

    // 校验 hero 标量字段
    for (const field of ['name', 'text', 'tagline']) {
      const expected = data.hero[field]
      if (!frontmatterHasField(frontmatter, field, expected)) {
        mismatches.push(`hero.${field}: expected "${truncate(expected)}" not found in frontmatter`)
      }
    }

    // 校验 hero.actions（theme/text/link）
    data.hero.actions.forEach((action, i) => {
      for (const field of ['theme', 'text', 'link']) {
        if (!frontmatterHasField(frontmatter, field, action[field])) {
          mismatches.push(`hero.actions[${i}].${field}: expected "${truncate(action[field])}" not found in frontmatter`)
        }
      }
    })

    // 校验 features（title/details）
    data.features.forEach((feature, i) => {
      for (const field of ['title', 'details']) {
        if (!frontmatterHasField(frontmatter, field, feature[field])) {
          mismatches.push(`features[${i}].${field}: expected "${truncate(feature[field])}" not found in frontmatter`)
        }
      }
    })

    if (mismatches.length > 0) {
      for (const m of mismatches) {
        console.log(`HOME MISMATCH  ${lang.code}  ${m}`)
      }
      hasMismatch = true
    } else {
      console.log(`home frontmatter OK for ${lang.code}`)
    }
  }

  if (hasMismatch) {
    process.exit(1)
  } else {
    process.exit(0)
  }
}

// 主入口：--check 走翻译检查；--sync-home 走首页校验；否则生成 config.js
if (process.argv.includes('--check')) {
  checkTranslations()
} else if (process.argv.includes('--sync-home')) {
  syncHome()
} else {
  const content = generateConfigContent()
  fs.writeFileSync(configPath, content, 'utf-8')
  console.log(`已生成 ${path.relative(projectRoot, configPath)}`)
}
