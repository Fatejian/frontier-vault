import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')
const css = read('docs/.vitepress/theme/style.css')
const js = read('docs/.vitepress/theme/index.js')
const svg = read('assets/readme/hero.svg')

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === '.vitepress' || ent.name === 'dist') continue
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, out)
    else if (ent.name.endsWith('.md')) out.push(p)
  }
  return out
}
const mdFiles = walk(path.join(ROOT, 'docs'))
const md = mdFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n')

const errors = []
const notes = []
const ok = (msg) => console.log('[PASS] ' + msg)
const fail = (msg) => { errors.push(msg); console.log('[FAIL] ' + msg) }

// ---------- 基础色计算 ----------
function rgbOf(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
}
function luminance(hex) {
  const [r, g, b] = rgbOf(hex).map((v) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a, b) {
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
function oklchToHex(value) {
  const m = value.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/)
  if (!m) return null
  const [, L, C, H] = m.map(Number)
  const a = C * Math.cos((H * Math.PI) / 180)
  const b = C * Math.sin((H * Math.PI) / 180)
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3)
  const mm = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3)
  const s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3)
  return '#' + [4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.7076147010 * s]
    .map((v) => {
      const t = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
      return Math.round(Math.min(1, Math.max(0, t)) * 255).toString(16).padStart(2, '0')
    }).join('').toUpperCase()
}

// ---------- 1. 解析双模式 token，校验 OKLCH 主值与 hex 回退等价 ----------
function parseBlock(re) {
  const block = css.match(re)?.[1]
  if (!block) return new Map()
  const vars = new Map()
  for (const d of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    const list = vars.get(d[1]) || []
    list.push(d[2].trim())
    vars.set(d[1], list)
  }
  return vars
}
const light = parseBlock(/:root\s*\{([\s\S]*?)\}/)
const dark = parseBlock(/\.dark\s*\{([\s\S]*?)\}/)
const firstHex = (list) => {
  for (const v of list || []) {
    const m = v.match(/^#([0-9a-fA-F]{6})$/)
    if (m) return '#' + m[1].toUpperCase()
  }
  return null
}
const token = (vars, name) => firstHex(vars.get(name))

if (light.size < 30 || dark.size < 30) fail('CSS token 块缺失或变量不足（light=' + light.size + ', dark=' + dark.size + '）')
else ok('CSS 双模式 token 解析成功（light ' + light.size + ' 项 / dark ' + dark.size + ' 项）')

let equivalence = 0
for (const [scope, vars] of [['light', light], ['dark', dark]]) {
  for (const [name, list] of vars) {
    const hex = firstHex(list)
    const oklch = list.find((v) => v.startsWith('oklch('))
    if (!hex || !oklch) continue
    const converted = oklchToHex(oklch)
    if (!converted) { fail(scope + ' ' + name + ' 的 OKLCH 无法解析'); continue }
    const d = Math.max(...[1, 3, 5].map((i, k) =>
      Math.abs(parseInt(hex.slice(i, i + 2), 16) - parseInt(converted.slice(i, i + 2), 16))))
    if (d > 3) fail(scope + ' ' + name + ' 的 hex 回退 ' + hex + ' 与 OKLCH 换算 ' + converted + ' 不一致')
    else equivalence++
  }
}
ok('OKLCH 主值与 hex 回退等价（校验 ' + equivalence + ' 组）')

// ---------- 2. WCAG 对比度矩阵 ----------
const chart = (vars, name) => token(vars, '--fv-chart-' + name)
const pairs = [
  ['亮 正文/底', token(light, '--fv-text'), token(light, '--fv-bg'), 4.5],
  ['亮 次要文字/底', token(light, '--fv-text-muted'), token(light, '--fv-bg'), 4.5],
  ['亮 辅助文字/底', token(light, '--fv-text-subtle'), token(light, '--fv-bg'), 4.5],
  ['亮 主色/底', token(light, '--fv-primary'), token(light, '--fv-bg'), 4.5],
  ['亮 主色/表面', token(light, '--fv-primary'), token(light, '--fv-surface'), 3],
  ['亮 品牌按钮/回到顶部 前景/底', token(light, '--fv-on-primary'), token(light, '--fv-primary'), 4.5],
  ['亮 品牌按钮/回到顶部 前景/hover 底', token(light, '--fv-on-primary'), token(light, '--fv-primary-hover'), 4.5],
  ['亮 alt 按钮 前景/底', token(light, '--fv-text'), token(light, '--fv-surface-elevated'), 4.5],
  ['亮 success/底', token(light, '--fv-success'), token(light, '--fv-bg'), 4.5],
  ['亮 warning/底', token(light, '--fv-warning'), token(light, '--fv-bg'), 4.5],
  ['亮 danger/底', token(light, '--fv-danger'), token(light, '--fv-bg'), 4.5],
  ['暗 正文/底', token(dark, '--fv-text'), token(dark, '--fv-bg'), 4.5],
  ['暗 次要文字/底', token(dark, '--fv-text-muted'), token(dark, '--fv-bg'), 4.5],
  ['暗 辅助文字/底', token(dark, '--fv-text-subtle'), token(dark, '--fv-bg'), 4.5],
  ['暗 主色/底', token(dark, '--fv-primary'), token(dark, '--fv-bg'), 4.5],
  ['暗 主色/表面', token(dark, '--fv-primary'), token(dark, '--fv-surface'), 3],
  ['暗 品牌按钮/回到顶部 前景/底', token(dark, '--fv-on-primary'), token(dark, '--fv-primary'), 4.5],
  ['暗 品牌按钮/回到顶部 前景/hover 底', token(dark, '--fv-on-primary'), token(dark, '--fv-primary-hover'), 4.5],
  ['暗 alt 按钮 前景/底', token(dark, '--fv-text'), token(dark, '--fv-surface-elevated'), 4.5],
  ['暗 success/底', token(dark, '--fv-success'), token(dark, '--fv-bg'), 4.5],
  ['暗 warning/底', token(dark, '--fv-warning'), token(dark, '--fv-bg'), 4.5],
  ['暗 danger/底', token(dark, '--fv-danger'), token(dark, '--fv-bg'), 4.5],
  ['亮 图表节点 文字/底', token(light, '--fv-text'), chart(light, 'node'), 4.5],
  ['亮 图表 core 描边/节点底', chart(light, 'core'), chart(light, 'node'), 3],
  ['亮 图表 wait 描边/节点底', chart(light, 'wait'), chart(light, 'node'), 3],
  ['亮 图表 block 描边/节点底', chart(light, 'block'), chart(light, 'node'), 3],
  ['亮 图表 work 描边/节点底', chart(light, 'work'), chart(light, 'node'), 3],
  ['亮 图表 metric 描边/节点底', chart(light, 'metric'), chart(light, 'node'), 3],
  ['暗 图表节点 文字/底', token(dark, '--fv-text'), chart(dark, 'node'), 4.5],
  ['暗 图表 core 描边/节点底', chart(dark, 'core'), chart(dark, 'node'), 3],
  ['暗 图表 wait 描边/节点底', chart(dark, 'wait'), chart(dark, 'node'), 3],
  ['暗 图表 block 描边/节点底', chart(dark, 'block'), chart(dark, 'node'), 3],
  ['暗 图表 work 描边/节点底', chart(dark, 'work'), chart(dark, 'node'), 3],
  ['暗 图表 metric 描边/节点底', chart(dark, 'metric'), chart(dark, 'node'), 3]
]
for (const [label, fg, bg, min] of pairs) {
  if (!fg || !bg) { fail(label + ' 缺少色值'); continue }
  const ratio = contrast(fg, bg)
  if (ratio < min) fail(label + ' 对比度 ' + ratio.toFixed(2) + ' < ' + min)
  else notes.push(label + ' ' + ratio.toFixed(2) + ':1')
}
ok('WCAG 对比度矩阵 ' + pairs.length + ' 项（最低 ' + Math.min(...pairs.filter((p) => p[1] && p[2]).map((p) => contrast(p[1], p[2]))).toFixed(2) + ':1）')

// ---------- 2b. 按钮前景接线（防止回退到写死白字 / 特异性失效） ----------
const buttonBindings = [
  ['--vp-button-brand-bg', 'var(--fv-primary)'],
  ['--vp-button-brand-hover-bg', 'var(--fv-primary-hover)'],
  ['--vp-button-brand-text', 'var(--fv-on-primary)'],
  ['--vp-button-brand-hover-text', 'var(--fv-on-primary)'],
  ['--vp-button-alt-bg', 'var(--fv-surface-elevated)'],
  ['--vp-button-alt-text', 'var(--fv-text)']
]
for (const [name, value] of buttonBindings) {
  if (!css.includes(name + ': ' + value + ';')) fail('VitePress 按钮变量未接线: ' + name + ' → ' + value)
}
if (/\.VPButton\.(brand|alt)\s*\{/.test(css)) fail('仍存在特异性不足的 .VPButton.* 覆盖规则')
if (/\.back-to-top\s*\{[^}]*color:\s*#FFFFFF/i.test(css)) fail('.back-to-top 仍写死白字')
if (/input\[type="checkbox"\]:checked::after\s*\{[^}]*color:\s*#FFFFFF/i.test(css)) fail('任务勾选态仍写死白字')
ok('按钮 / 回到顶部 / 勾选态前景色接线正确')

// ---------- 3. 图表色板与 CSS token 同源 ----------
const CHART_TOKEN = {
  node: '--fv-chart-node', core: '--fv-chart-core',
  wait: '--fv-chart-wait', block: '--fv-chart-block',
  work: '--fv-chart-work', metric: '--fv-chart-metric',
  line: '--fv-chart-line', border: '--fv-border', text: '--fv-text'
}
const baseSource = js.match(/const FV_CHART_BASE = \{[\s\S]*?\n\}/)?.[0] || ''
const darkSource = js.match(/const FV_CHART_DARK = \{[\s\S]*?\n\}/)?.[0] || ''
const parseChart = (src) => {
  const out = {}
  for (const m of src.matchAll(/(\w+):\s*'(#[0-9a-fA-F]{6})'/g)) out[m[1]] = m[2].toUpperCase()
  return out
}
const base = parseChart(baseSource)
const darkChart = parseChart(darkSource)
let chartSourceOk = true
for (const key of Object.keys(CHART_TOKEN)) {
  const l = token(light, CHART_TOKEN[key]), d = token(dark, CHART_TOKEN[key])
  if (!l || !d || base[key] !== l || darkChart[key] !== d) {
    fail('图表色板 ' + key + ' 与 CSS token 不同源')
    chartSourceOk = false
  }
}
if (chartSourceOk) ok('FV_CHART_BASE / FV_CHART_DARK 共 ' + Object.keys(CHART_TOKEN).length + ' 组与 CSS token 同源')
if (!js.includes('function applyChartThemeToCode')) fail('缺少源码级图表主题映射')
else ok('图表主题在渲染前由 applyChartThemeToCode 统一映射')
if (js.includes('applyThemeToSvg')) fail('仍存在旧的 SVG 字符串颜色替换（会覆盖新的主题映射）')

const cssHexes = new Set([...css.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toUpperCase()))
const paletteSource = js.match(/const FV_PALETTE = \{[\s\S]*?\n\}/)?.[0] || ''
const jsHexes = [...paletteSource.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toUpperCase())
if (!paletteSource || jsHexes.length < 12) fail('未找到 FV_PALETTE 或色值不足')
else {
  const unknown = [...new Set(jsHexes)].filter((h) => !cssHexes.has(h))
  if (unknown.length) fail('FV_PALETTE 中存在 CSS 无来源色值: ' + unknown.join(', '))
  else ok('FV_PALETTE 共 ' + new Set(jsHexes).size + ' 个色值，全部可追溯到 CSS token')
}
if (/fontFamily:\s*'Inter/.test(js)) fail('Mermaid 字体仍以 Inter 为首')
else ok('Mermaid 字体栈与页面 --fv-font-body 一致')

// ---------- 4. Markdown 图表配色合规 ----------
const fenceList = [...md.matchAll(/```mermaid[\s\S]*?```/g)].map((m) => m[0])
const fences = fenceList.join('\n')
// 渲染层已由 FV_CHART_BASE / FV_FONT_STACK 统一提供主题；围栏内的 %%{init}%% 会覆盖它。
const hardcodedInit = [...fences.matchAll(/%%\{init:[\s\S]*?\}%%/g)]
  .filter((m) => /fontFamily|primaryColor|themeVariables/.test(m[0]))
if (hardcodedInit.length) fail('Mermaid 围栏内仍有 ' + hardcodedInit.length + ' 处硬编码 %%{init} 主题配置')
else ok('Mermaid 围栏主题由渲染层 FV_CHART_BASE / FV_FONT_STACK 统一提供')

const allowedFills = new Set([base.node])
const allowedStrokes = new Set([base.wait, base.block, base.work, base.metric, base.core])
const badFills = new Set(), badStrokes = new Set()
let colorDecls = 0
for (const m of fences.matchAll(/(fill|stroke|color):(#[0-9a-fA-F]{3,6})/gi)) {
  const kind = m[1].toLowerCase(), hex = m[2].toUpperCase()
  if (kind === 'color') colorDecls++
  else if (kind === 'fill' && !allowedFills.has(hex)) badFills.add(hex)
  else if (kind === 'stroke' && !allowedStrokes.has(hex)) badStrokes.add(hex)
}
if (badFills.size) fail('图表节点底色未统一: ' + [...badFills].join(', '))
if (badStrokes.size) fail('图表出现非语义描边色: ' + [...badStrokes].join(', '))
if (colorDecls) fail('classDef 仍有 ' + colorDecls + ' 处写死文字色（应由 autoTextColor 按底色反转）')
if (!badFills.size && !badStrokes.size && !colorDecls) {
  ok('已扫描 ' + mdFiles.length + ' 篇 Markdown / ' + fenceList.length + ' 个图表围栏：统一中性底 + 语义描边 + 品牌绿核心')
}
if (svg.includes('#E0A458') || svg.includes('#0B0E14') || svg.includes('#0F1512')) fail('hero.svg 仍残留琥珀/旧底色或非色板底色')
else if (!svg.includes('#82E2AD')) fail('hero.svg 缺少新品牌绿')
else ok('hero.svg 品牌色已统一到绿色系')

// ---------- 5. 旧色残留扫描 ----------
const LEGACY = [
  '#2563eb', '#1d4ed8', '#7aa2f7', '#0c1424', '#162136', '#1e2d47', '#e6eaf0', '#8b97a8',
  '#16a34a', '#d97706', '#dc2626', '#e2e8f0', '#1e293b', '#334155', '#475569', '#f1f5f9',
  '#f6f8fa', '#16181d', '#b3231f', '#ff8a82', '#30363d', '#0550ae', '#0a3069', '#cf222e',
  '#8250df', '#79c0ff', '#a5d6ff', '#ff7b72', '#d2a8ff', '#e6edf3', '#484f58', '#8b949e',
  '#57606a', '#6e7781', '#24292f', '#64748b', '#e0a458', '#0b0e14', '#e6e8ec', '#8b919e',
  '#161b22', '#eef6ff', '#ecfdf3', '#f59e0b', '#fff7e6', '#a855f7', '#f5e8ff', '#cbd5e1',
  '#3b82f6', '#eff5f7', '#edf5ef', '#fbf5ea', '#f4eff8', '#22322b'
]
// 正文 drawRect 示例代码中的蓝色矩形属于内容语义，不属于主题配色
const ALLOWED = { '#3b82f6': 2 }
const corpus = (css + '\n' + js + '\n' + md + '\n' + svg).toLowerCase()
const leftovers = []
for (const hex of LEGACY) {
  const n = (corpus.match(new RegExp(hex, 'g')) || []).length
  if (n > (ALLOWED[hex] || 0)) leftovers.push(hex + ' × ' + n)
}
if (leftovers.length) fail('旧色残留: ' + leftovers.join(', '))
else ok('旧色残留扫描通过（白名单：正文 drawRect 示例 #3b82f6 × 2）')

// ---------- 汇总 ----------
console.log('\n对比度明细:')
for (const n of notes) console.log('  ' + n)
if (errors.length) {
  console.error('\n共 ' + errors.length + ' 项未通过')
  process.exit(1)
}
console.log('\n全部校验通过')
