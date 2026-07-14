import DefaultTheme from 'vitepress/theme'
import mermaid from 'mermaid'
import HomePage from './components/HomePage.vue'
import './style.css'

const MERMAID_CONFIG = {
  startOnLoad: false,
  renderDelay: 50,
  observer: {
    rootMargin: '150px',
    threshold: 0.05
  },
  keywords: [
    'flowchart',
    'graph',
    'mindmap',
    'sequenceDiagram',
    'classDiagram',
    'stateDiagram',
    'erDiagram',
    'gantt',
    'pie',
    '%%{init:'
  ]
}

const MERMAID_THEME_VARS = {
  dark: {
    primaryColor: '#3b82f6',
    primaryTextColor: '#ffffff',
    primaryBorderColor: '#3b82f6',
    lineColor: '#6b7280',
    secondaryColor: '#6366f1',
    tertiaryColor: '#8b5cf6',
    background: '#1a2332',
    mainBkg: '#1a2332',
    nodeBorder: '#3b82f6',
    clusterBkg: '#0f172a',
    titleColor: '#ffffff',
    edgeLabelBackground: '#1a2332',
    textColor: '#e2e8f0',
    fontFamily: 'inherit'
  },
  default: {
    primaryColor: '#3b82f6',
    primaryTextColor: '#1e293b',
    primaryBorderColor: '#3b82f6',
    lineColor: '#64748b',
    secondaryColor: '#6366f1',
    tertiaryColor: '#8b5cf6',
    background: '#ffffff',
    mainBkg: '#ffffff',
    nodeBorder: '#3b82f6',
    clusterBkg: '#f8fafc',
    titleColor: '#1e293b',
    edgeLabelBackground: '#ffffff',
    textColor: '#1e293b',
    fontFamily: 'inherit'
  }
}

function getPageTheme() {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'default'
}

function getMermaidThemeConfig(theme) {
  return {
    startOnLoad: MERMAID_CONFIG.startOnLoad,
    theme: theme === 'dark' ? 'dark' : 'default',
    themeVariables: MERMAID_THEME_VARS[theme] || MERMAID_THEME_VARS.default
  }
}

let currentMermaidTheme = getPageTheme()
mermaid.initialize(getMermaidThemeConfig(currentMermaidTheme))

function isMermaidCode(code) {
  return MERMAID_CONFIG.keywords.some(keyword => code.includes(keyword))
}

let renderedMermaidHashes = new Set()

function hashStr(str) {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    hash = (hash ^ str.charCodeAt(i)) * 0x01000193
  }
  return hash.toString(36)
}

let zoomSetupDone = false
let mermaidObserver = null
let mermaidRenderCounter = 0

function createMermaidContainer() {
  const container = document.createElement('div')
  container.className = 'mermaid-container'
  return container
}

function renderSingleMermaid(codeBlock, options = {}) {
  const { onComplete, onError } = options
  const preBlock = codeBlock?.parentElement
  if (!preBlock) {
    onError?.()
    return
  }

  const code = codeBlock.textContent.trim()
  if (!isMermaidCode(code)) {
    onComplete?.()
    return
  }

  const hash = hashStr(code)
  if (renderedMermaidHashes.has(hash)) {
    onComplete?.()
    return
  }
  renderedMermaidHashes.add(hash)

  const pageTheme = getPageTheme()
  const languageContainer = preBlock.closest('.language-mermaid')
  if (!languageContainer) {
    console.warn('Mermaid: .language-mermaid container not found')
    onComplete?.()
    return
  }

  const container = createMermaidContainer()
  languageContainer.parentNode.insertBefore(container, languageContainer.nextSibling)

  mermaid.render('mermaid-' + Date.now() + '-' + (mermaidRenderCounter++), code).then(({ svg }) => {
    container.innerHTML = svg
    container.dataset.theme = pageTheme
    container.title = '点击放大查看'

    requestAnimationFrame(() => {
      container.classList.add('is-visible')

      const svgEl = container.querySelector('svg')
      if (svgEl) {
        autoTextColor(svgEl)
        expandForeignObjects(svgEl)
      }
    })

    if (!zoomSetupDone) {
      zoomSetupDone = true
      setupMermaidZoom()
    }

    onComplete?.()
  }).catch((err) => {
    container.remove()
    languageContainer.style.display = 'block'
    console.error('Mermaid render error:', err)
    onError?.(err)
  })
}

function finalizeRender() {
  addThemeSwitcher()
}

function renderMermaid() {
  const codeBlocks = document.querySelectorAll('pre code')
  const mermaidCodeBlocks = Array.from(codeBlocks).filter(cb => {
    const code = cb.textContent.trim()
    return isMermaidCode(code)
  })

  if (mermaidCodeBlocks.length === 0) return

  document.querySelectorAll('.mermaid-container').forEach(el => el.remove())
  renderedMermaidHashes.clear()

  const pageTheme = getPageTheme()
  currentMermaidTheme = pageTheme
  mermaid.initialize(getMermaidThemeConfig(pageTheme))

  if ('IntersectionObserver' in window) {
    if (mermaidObserver) {
      mermaidObserver.disconnect()
    }

    let pendingRenders = mermaidCodeBlocks.length
    const checkCompletion = () => {
      pendingRenders--
      if (pendingRenders === 0) {
        finalizeRender()
      }
    }

    mermaidObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const codeBlock = entry.target.querySelector('code')
          if (codeBlock) {
            renderSingleMermaid(codeBlock, {
              onComplete: checkCompletion,
              onError: checkCompletion
            })
          }
          mermaidObserver.unobserve(entry.target)
        }
      })
    }, MERMAID_CONFIG.observer)

    mermaidCodeBlocks.forEach(codeBlock => {
      const preBlock = codeBlock?.parentElement
      if (!preBlock) return
      const languageContainer = preBlock.closest('.language-mermaid') || preBlock
      mermaidObserver.observe(languageContainer)
    })
  } else {
    let pendingRenders = 0
    const checkCompletion = () => {
      pendingRenders--
      if (pendingRenders === 0) {
        finalizeRender()
      }
    }

    mermaidCodeBlocks.forEach(codeBlock => {
      pendingRenders++
      renderSingleMermaid(codeBlock, {
        onComplete: checkCompletion,
        onError: checkCompletion
      })
    })
  }
}

function cleanupMermaidObserver() {
  if (mermaidObserver) {
    mermaidObserver.disconnect()
    mermaidObserver = null
  }
}

// 放大查看功能
let isOverlayOpen = false

function setupMermaidZoom() {
  if (document.querySelector('.mermaid-overlay')) return

  document.addEventListener('click', (e) => {
    // 如果遮罩已打开，不处理（防止关闭时穿透到下方图表重新打开）
    if (isOverlayOpen) return

    const rendered = e.target.closest('.mermaid-container')
    if (!rendered) return

    const svg = rendered.querySelector('svg')
    if (!svg) return

    const overlay = document.createElement('div')
    overlay.className = 'mermaid-overlay'
    // 跟随当前图表主题设置遮罩背景色
    const isDark = rendered.dataset.theme !== 'default'
    overlay.style.background = isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.92)'
    isOverlayOpen = true

    const content = document.createElement('div')
    content.className = 'mermaid-overlay-content'
    // 跟随当前图表主题设置内容区背景色
    content.style.background = isDark ? '#1e293b' : '#ffffff'
    content.style.boxShadow = isDark
      ? '0 8px 32px rgba(0, 0, 0, 0.5)'
      : '0 8px 32px rgba(0, 0, 0, 0.15)'

    const closeBtn = document.createElement('button')
    closeBtn.className = 'mermaid-overlay-close'
    closeBtn.setAttribute('aria-label', '关闭')
    closeBtn.textContent = '✕'
    closeBtn.style.color = isDark ? '#ffffff' : '#1e293b'
    closeBtn.addEventListener('click', () => {
      overlay.remove()
      isOverlayOpen = false
    })

    // Clone SVG and fix size for overlay display
    const svgClone = svg.cloneNode(true)
    const viewBox = svgClone.getAttribute('viewBox')
    if (viewBox) {
      const parts = viewBox.split(' ').map(Number)
      if (parts.length === 4) {
        svgClone.setAttribute('width', parts[2])
        svgClone.setAttribute('height', parts[3])
      }
    }
    svgClone.style.maxWidth = '90vw'
    svgClone.style.maxHeight = '85vh'
    svgClone.style.width = 'auto'
    svgClone.style.height = 'auto'

    // overlay 中需要重新应用主题颜色（字符串替换，无需挂载 DOM）
    applyThemeToSvg(svgClone, rendered.dataset.theme || getPageTheme())

    content.appendChild(closeBtn)
    content.appendChild(svgClone)
    overlay.appendChild(content)

    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) {
        overlay.remove()
        // 延迟重置状态，确保当前 click 事件冒泡完成后再允许打开新遮罩
        setTimeout(() => { isOverlayOpen = false }, 50)
      }
    })

    document.body.appendChild(overlay)
    // autoTextColor 必须在挂载到 DOM 后调用：getComputedStyle 仅对已挂载元素有效
    autoTextColor(svgClone)
  })
}

// 主题切换按钮功能
function addThemeSwitcher() {
  const pageTheme = getPageTheme()

  document.querySelectorAll('.mermaid-container').forEach(container => {
    // 如果已有按钮，不重复添加
    if (container.querySelector('.mermaid-theme-toggle')) return

    // 记录当前图表主题状态（默认跟随页面主题）
    container.dataset.theme = pageTheme

    // 创建切换按钮
    const toggleBtn = document.createElement('button')
    toggleBtn.className = 'mermaid-theme-toggle'
    toggleBtn.setAttribute('aria-label', '切换主题')
    // sun = light theme, moon = dark theme
    toggleBtn.innerHTML = pageTheme === 'dark' ? '\u{1F319}' : '\u2600\uFE0F'

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      toggleMermaidTheme(container)
    })

    container.style.position = 'relative'
    container.appendChild(toggleBtn)
  })
}

// 主题颜色映射
const themeColors = {
  dark: {
    text: '#ffffff',
    line: '#6b7280',
    containerBg: '#1e293b'
  },
  default: {
    text: '#1e293b',
    line: '#475569',
    containerBg: '#ffffff'
  }
}

// Mermaid 节点背景形状选择器（覆盖所有 SVG 可填充图形元素）
// rect=矩形, polygon=菱形/六边形, path=stadium/自定义, circle=圆形, ellipse=椭圆, use=引用形状
const BG_SHAPE_SELECTORS = 'rect, polygon, path, circle, ellipse, use'
const BG_SHAPE_SCOPE_SELECTORS = ':scope > rect, :scope > polygon, :scope > path, :scope > circle, :scope > ellipse, :scope > use'
const BG_SHAPE_TAGS = new Set(['rect', 'polygon', 'path', 'circle', 'ellipse', 'use'])

// 判断颜色是否为深色（亮度 < 128）
function isDarkColor(hex) {
  if (!hex || hex === 'none' || hex === 'transparent') return false
  const clean = hex.replace('#', '')
  if (clean.length < 6) return false
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  // 感知亮度公式
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b)
  return luminance < 128
}

// 获取元素实际渲染的背景色
// Mermaid SVG 中，foreignObject / text 的背景 rect 通常在其所属容器内
function getEffectiveBgColor(el) {
  // 1. 尝试找到元素最近的相关容器（优先 node/edgeLabel，再 note/label，避免误取外层 cluster 深色背景）
  const selectors = [
    '.node',      // flowchart / stateDiagram 节点
    '.edgeLabel', // 边标签
    '.edgeLabels',// 边标签容器
    '.note',      // note 节点
    '.noteLabel', // note 标签
    '.cluster',   // 子图（最后兜底）
    '.label'      // 通用标签容器
  ]

  let container = null
  let matchedSelector = null
  if (el.closest) {
    for (const selector of selectors) {
      container = el.closest(selector)
      if (container) { matchedSelector = selector; break }
    }
  }

  // 2. 在容器内查找背景形状（覆盖所有 SVG 可填充图形元素，优先直接子元素）
  //    Mermaid v11: rect=矩形, polygon=菱形, path=stadium, circle=圆形, ellipse=椭圆, use=引用
  if (container) {
    let shapes = container.querySelectorAll(BG_SHAPE_SCOPE_SELECTORS)
    let rectSource = shapes.length ? 'scope' : null
    if (!shapes.length) {
      shapes = container.querySelectorAll(BG_SHAPE_SELECTORS)
      rectSource = shapes.length ? 'recursive' : null
    }
    // 遍历所有形状，返回第一个有有效 fill 的（避免无 fill 的 rect 遮挡后续有 fill 的 path/circle）
    for (const shape of shapes) {
      const fill = getRectFill(shape)
      if (fill) return fill
    }
    // 2b. shape-agnostic 兜底：扫描 g.basic.label-container 直接子元素
    //     防御未来 Mermaid 引入新形状类型时遗漏（不依赖元素类型，仅看是否有有效 fill）
    const labelContainer = container.querySelector('.basic.label-container, .label-container')
    if (labelContainer) {
      for (const child of labelContainer.children) {
        const fill = getRectFill(child)
        if (fill) return fill
      }
    }
  }

  // 3. fallback：向上逐级查找最近的背景形状（覆盖所有 SVG 可填充图形元素）
  let current = el
  let fallbackSteps = 0
  while (current && current !== document.body) {
    if (BG_SHAPE_TAGS.has(current.tagName.toLowerCase())) {
      const fill = getRectFill(current)
      if (fill) {
        return fill
      }
    }
    if (current.querySelector) {
      const directRect = current.querySelector(BG_SHAPE_SCOPE_SELECTORS)
      if (directRect) {
        const fill = getRectFill(directRect)
        if (fill) {
          return fill
        }
      }
    }
    current = current.parentElement || current.parentNode
    fallbackSteps++
  }

  // 4. CSS 背景兜底：foreignObject 内的 div 可能有 CSS background-color（Mermaid v11 edge label）
  if (el.tagName === 'foreignObject' || el.closest('foreignObject')) {
    const fo = el.tagName === 'foreignObject' ? el : el.closest('foreignObject')
    const probeDiv = fo && fo.querySelector('div')
    if (probeDiv) {
      try {
        const cssBg = window.getComputedStyle(probeDiv).backgroundColor
        if (cssBg && cssBg !== 'rgba(0, 0, 0, 0)' && cssBg !== 'transparent') {
          const hex = rgbToHex(cssBg)
          if (hex) {
            return hex
          }
        }
      } catch (e) {}
    }
  }

  // 5. 主题兜底：无 rect 且无 CSS 背景时，按页面主题推断默认背景色
  //    深色主题 → #1a2332（深色）→ 白色文字；浅色主题 → #ffffff（浅色）→ 深色文字
  const pageTheme = getPageTheme()
  const themedDefault = pageTheme === 'dark' ? '#1a2332' : '#ffffff'
  return themedDefault
}

// 获取形状的 fill（优先 computedStyle 反映 CSS 覆盖，再 inline style，最后 fallback 属性）
function getRectFill(rect) {
  const attrFill = rect.getAttribute('fill')
  // inline style.fill：读取内联 style 中的 fill 值（在元素未挂载 DOM 时仍可读取，如放大遮罩的 clone）
  const inlineFill = rect.style && rect.style.fill ? rect.style.fill : null
  let computedFill = null
  try {
    computedFill = window.getComputedStyle(rect).fill
  } catch (e) {}
  // 优先使用 computedStyle：CSS class 可覆盖属性（暗色主题 .actor {fill:dark} 覆盖 fill="#eaeaea"）
  if (computedFill && computedFill !== 'none' && computedFill !== 'transparent' && computedFill !== 'rgb(0, 0, 0)') {
    return rgbToHex(computedFill)
  }
  // inline style 回退：元素未挂载 DOM 时 computedStyle 返回空，但 inline style 仍可读取
  // Mermaid v11 彩色节点用 style="fill:#FEE2E2 !important" 而非 fill 属性
  if (inlineFill && inlineFill !== 'none' && inlineFill !== 'transparent') {
    const hex = rgbToHex(inlineFill) || inlineFill
    return hex
  }
  if (attrFill && attrFill !== 'none' && attrFill !== 'transparent') {
    return attrFill
  }
  return null
}

// rgb/rgba 转 hex
function rgbToHex(color) {
  if (!color) return null
  if (color.startsWith('#')) return color
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (match) {
    const r = parseInt(match[1]).toString(16).padStart(2, '0')
    const g = parseInt(match[2]).toString(16).padStart(2, '0')
    const b = parseInt(match[3]).toString(16).padStart(2, '0')
    return '#' + r + g + b
  }
  return null
}

// 根据背景色自动调整文字颜色：深色背景用白色文字，浅色背景用深色文字
function autoTextColor(svg) {
  // 处理 foreignObject 内嵌的 HTML 元素（优先处理，因为需要同时设 padding）
  svg.querySelectorAll('foreignObject').forEach(fo => {
    const bgColor = getEffectiveBgColor(fo)
    const isDark = isDarkColor(bgColor)
    const textColor = isDark ? '#ffffff' : '#1e293b'

    // 给 foreignObject 直接子 div 动态添加 padding 并强制水平居中
    // 只处理 :scope > div 避免嵌套结构下 padding 累加压缩内容区
    // 同步设置 text-align:center 与 box-sizing:border-box：
    //   - text-align:center：内层 span/p 默认 left 对齐，加 padding 后文字会偏左
    //   - box-sizing:border-box：padding 不增加 div 总宽度，避免溢出 foreignObject
    // 动态阈值：foreignObject 宽度 < 80px 时（短标签、序号、状态码节点），
    //   padding 占比过高会显著挤压文字空间，直接取消 padding 让文字充分利用宽度
    const foWidth = parseFloat(fo.getAttribute('width')) || fo.clientWidth || 0
    fo.querySelectorAll(':scope > div').forEach(div => {
      if (!div.style.padding || div.style.padding === '0px') {
        div.style.padding = foWidth >= 80 ? '2px 6px' : '0'
      }
      div.style.setProperty('text-align', 'center', 'important')
      div.style.setProperty('box-sizing', 'border-box', 'important')
    })

    // 设置文字颜色（important 确保覆盖 Mermaid 内联样式）
    fo.querySelectorAll('div, span, p, *').forEach(child => {
      child.style.setProperty('color', textColor, 'important')
    })
  })

  // 处理 SVG 原生 text/tspan 元素
  const textEls = svg.querySelectorAll('text, tspan')
  textEls.forEach(el => {
    const bgColor = getEffectiveBgColor(el)
    const isDark = isDarkColor(bgColor)
    const textColor = isDark ? '#ffffff' : '#1e293b'

    el.style.setProperty('fill', textColor, 'important')
  })
}

// 扩展 foreignObject 宽度，防止文字溢出（覆盖 edge label 和 stateDiagram 节点等）
function expandForeignObjects(svg) {
  svg.querySelectorAll('foreignObject').forEach(fo => {
    const div = fo.querySelector('div')
    if (!div) return

    // 测量文字实际宽度
    const textWidth = div.scrollWidth || div.offsetWidth
    const currentWidth = parseFloat(fo.getAttribute('width')) || fo.clientWidth || 0
    if (textWidth <= currentWidth - 4) return

    const newWidth = Math.max(textWidth + 12, currentWidth)
    fo.setAttribute('width', newWidth)

    // 同步调整同级或父级 rect 的宽度，使背景框跟随文字扩展
    const g = fo.parentElement
    if (g) {
      const rect = g.querySelector(':scope > rect') || g.querySelector('rect')
      if (rect) {
        const oldRectWidth = parseFloat(rect.getAttribute('width')) || currentWidth
        if (newWidth > oldRectWidth) {
          rect.setAttribute('width', newWidth)
          const currentX = parseFloat(rect.getAttribute('x')) || 0
          rect.setAttribute('x', currentX - (newWidth - oldRectWidth) / 2)
        }
      }
    }
  })
}

function applyThemeToSvg(svg, theme) {
  const colors = themeColors[theme]
  const styleEl = svg.querySelector('style')

  if (styleEl) {
    let css = styleEl.textContent
    if (theme === 'default') {
      // dark → light
      css = css.replace(/fill:#ffffff/g, 'fill:' + colors.text)
      css = css.replace(/fill:#fff\b/g, 'fill:' + colors.text)
      css = css.replace(/fill:#000819/g, 'fill:' + colors.text)
      css = css.replace(/fill:#172033/g, 'fill:' + colors.text)
      css = css.replace(/fill:#0f172a/g, 'fill:' + colors.containerBg)
      css = css.replace(/fill:#1e293b/g, 'fill:' + colors.containerBg)
      css = css.replace(/fill:#000000/g, 'fill:' + colors.text)
      css = css.replace(/fill:#000\b/g, 'fill:' + colors.text)
      css = css.replace(/stroke:#6b7280/g, 'stroke:' + colors.line)
    } else {
      // light → dark
      // 将暗色文字替换为亮色，确保暗色方框上文字可读
      css = css.replace(/fill:#000000/g, 'fill:' + colors.text)
      css = css.replace(/fill:#000\b/g, 'fill:' + colors.text)
      css = css.replace(/fill:#172033/g, 'fill:' + colors.text)
      css = css.replace(/fill:#000819/g, 'fill:' + colors.text)
      css = css.replace(/fill:#475569/g, 'fill:' + colors.text)
      // 将白色背景替换为容器背景色
      css = css.replace(/fill:#ffffff/g, 'fill:' + colors.containerBg)
      css = css.replace(/fill:#fff\b/g, 'fill:' + colors.containerBg)
      css = css.replace(/fill:#f8fafc/g, 'fill:' + colors.containerBg)
      css = css.replace(/stroke:#475569/g, 'stroke:' + colors.line)
      css = css.replace(/stroke:#64748b/g, 'stroke:' + colors.line)
    }
    styleEl.textContent = css
  }

  // 替换 SVG 元素的直接 fill/stroke 属性
  svg.querySelectorAll('[fill]').forEach(el => {
    const fill = el.getAttribute('fill')
    if (theme === 'default') {
      if (fill === '#ffffff' || fill === '#fff') el.setAttribute('fill', colors.text)
      if (fill === '#000819' || fill === '#172033' || fill === '#000000' || fill === '#000') el.setAttribute('fill', colors.text)
      if (fill === '#0f172a' || fill === '#1e293b' || fill === '#1a2332') el.setAttribute('fill', colors.containerBg)
    } else {
      // 暗色模式：不替换 #1e293b / #1a2332，保留 Mermaid 原生暗色方框背景
      if (fill === '#ffffff' || fill === '#fff' || fill === '#f8fafc') el.setAttribute('fill', colors.containerBg)
      if (fill === '#475569') el.setAttribute('fill', colors.line)
    }
  })

  svg.querySelectorAll('[stroke]').forEach(el => {
    const stroke = el.getAttribute('stroke')
    if (theme === 'default') {
      if (stroke === '#6b7280') el.setAttribute('stroke', colors.line)
    } else {
      if (stroke === '#475569' || stroke === '#64748b') el.setAttribute('stroke', colors.line)
    }
  })
}

function toggleMermaidTheme(container) {
  const currentTheme = container.dataset.theme
  const newTheme = currentTheme === 'dark' ? 'default' : 'dark'

  // 找到隐藏的原始源码块（在容器的前一个兄弟节点）
  const sourceBlock = container.previousElementSibling
  if (!sourceBlock) return

  const code = sourceBlock.querySelector('code')
  if (!code) return

  const mermaidCode = code.textContent.trim()

  // 临时切换全局 mermaid 主题为目标主题，渲染后恢复为页面主题
  mermaid.initialize(getMermaidThemeConfig(newTheme))

  const id = 'mermaid-' + Date.now()
  mermaid.render(id, mermaidCode).then(({ svg: newSvgStr }) => {
    // mermaid.render 返回的是 SVG 字符串，需要解析为 DOM 元素才能应用主题颜色
    const parser = new DOMParser()
    const doc = parser.parseFromString(newSvgStr, 'image/svg+xml')
    const svgEl = doc.querySelector('svg')
    if (svgEl) {
      applyThemeToSvg(svgEl, newTheme)
    }

    // 替换容器内的 SVG
    const oldSvg = container.querySelector('svg')
    if (oldSvg) {
      oldSvg.outerHTML = svgEl ? svgEl.outerHTML : newSvgStr
    }

    // 更新容器主题状态
    container.dataset.theme = newTheme

    // SVG 替换后，动态调整文字颜色和扩展 foreignObject
      requestAnimationFrame(() => {
        const newSvgEl = container.querySelector('svg')
        if (newSvgEl) {
          autoTextColor(newSvgEl)
          expandForeignObjects(newSvgEl)
        }
      })

    // Update button icon: sun = light, moon = dark
    const toggleBtn = container.querySelector('.mermaid-theme-toggle')
    if (toggleBtn) {
      toggleBtn.innerHTML = newTheme === 'dark' ? '\u{1F319}' : '\u2600\uFE0F'
    }

    // 渲染完成后，将全局 mermaid 主题恢复为页面主题
    mermaid.initialize(getMermaidThemeConfig(getPageTheme()))
  })
}

// 监听 VitePress 页面主题切换，同步更新所有 mermaid 图表
function setupPageThemeSync() {
  const observer = new MutationObserver(() => {
    const pageTheme = getPageTheme()

    // 重新初始化 mermaid 使用页面主题
    mermaid.initialize(getMermaidThemeConfig(pageTheme))

    // 更新所有 mermaid 图表
    document.querySelectorAll('.mermaid-container').forEach(container => {
      const sourceBlock = container.previousElementSibling
      if (!sourceBlock) return

      const code = sourceBlock.querySelector('code')
      if (!code) return

      const mermaidCode = code.textContent.trim()
      const id = 'mermaid-' + Date.now() + '-' + Math.random().toString(36).slice(2)

      mermaid.render(id, mermaidCode).then(({ svg: newSvg }) => {
        const oldSvg = container.querySelector('svg')
        if (oldSvg) {
          oldSvg.outerHTML = newSvg
        }

        // 更新容器主题状态为页面主题
        container.dataset.theme = pageTheme

        // SVG 替换后，动态调整文字颜色和扩展 foreignObject
        requestAnimationFrame(() => {
          const newSvgEl = container.querySelector('svg')
          if (newSvgEl) {
            autoTextColor(newSvgEl)
            expandForeignObjects(newSvgEl)
          }
        })

        // 更新按钮图标
        const toggleBtn = container.querySelector('.mermaid-theme-toggle')
        if (toggleBtn) {
          toggleBtn.innerHTML = pageTheme === 'dark' ? '🌙' : '☀️'
        }
      })
    })
  })

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })
}

// 创建回到顶部按钮
function createBackToTop() {
  if (document.querySelector('.back-to-top')) return

  const btn = document.createElement('button')
  btn.className = 'back-to-top'
  btn.innerHTML = '↑'
  btn.setAttribute('aria-label', '回到顶部')
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })
  document.body.appendChild(btn)

  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
      btn.classList.add('visible')
    } else {
      btn.classList.remove('visible')
    }
  })
}

let renderTimer = null

function doRender() {
  renderMermaid()
  createBackToTop()
}

function scheduleRender() {
  if (renderTimer) clearTimeout(renderTimer)
  renderTimer = setTimeout(doRender, MERMAID_CONFIG.renderDelay)
}

// 立即执行一次
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      scheduleRender()
      setupPageThemeSync()
    })
  } else {
    scheduleRender()
    setupPageThemeSync()
  }

  window.addEventListener('beforeunload', cleanupMermaidObserver)
}

export default {
  ...DefaultTheme,
  layouts: {
    ...DefaultTheme.layouts,
    home: HomePage
  },
  enhanceApp({ app, router }) {
    if (typeof window !== 'undefined') {
      router.onAfterRouteChanged = scheduleRender
    }
  }
}
