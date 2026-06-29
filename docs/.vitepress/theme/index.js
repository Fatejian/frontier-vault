import DefaultTheme from 'vitepress/theme'
import mermaid from 'mermaid'
import './style.css'

// mermaid 主题默认跟随 VitePress 页面主题
function getPageTheme() {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'default'
}

function getMermaidThemeConfig(theme) {
  return {
    startOnLoad: false,
    theme: theme === 'dark' ? 'dark' : 'default',
    themeVariables: theme === 'dark' ? {
      primaryColor: '#3b82f6',
      primaryTextColor: '#ffffff',
      primaryBorderColor: '#3b82f6',
      lineColor: '#6b7280',
      secondaryColor: '#6366f1',
      tertiaryColor: '#8b5cf6',
      background: '#1e293b',
      mainBkg: '#1e293b',
      nodeBorder: '#3b82f6',
      clusterBkg: '#0f172a',
      titleColor: '#ffffff',
      edgeLabelBackground: '#1e293b',
      textColor: '#ffffff',
      fontFamily: 'inherit'
    } : {
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
}

// 使用页面主题初始化 mermaid
let currentMermaidTheme = getPageTheme()
mermaid.initialize(getMermaidThemeConfig(currentMermaidTheme))

function isMermaidCode(code) {
  const mermaidKeywords = [
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
  return mermaidKeywords.some(keyword => code.includes(keyword))
}

let renderedMermaidHashes = new Set()

function hashStr(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return hash
}

let zoomSetupDone = false

function renderMermaid() {
  const codeBlocks = document.querySelectorAll('pre code')
  const mermaidCodeBlocks = Array.from(codeBlocks).filter(cb => {
    const code = cb.textContent.trim()
    return isMermaidCode(code)
  })

  if (mermaidCodeBlocks.length === 0) return

  // 检查是否有可见的 mermaid 源码块（说明需要重新渲染）
  const hasVisibleSource = mermaidCodeBlocks.some(cb => {
    const pre = cb.parentElement
    const wrapper = pre?.closest('.line-numbers-mode') || pre
    return wrapper && !wrapper.classList.contains('mermaid-source-hidden')
  })

  if (!hasVisibleSource) return

  // 恢复隐藏的源码块
  document.querySelectorAll('.mermaid-source-hidden').forEach(el => {
    el.classList.remove('mermaid-source-hidden')
  })

  // 移除旧的渲染结果
  document.querySelectorAll('.mermaid-rendered').forEach(el => el.remove())

  // 清空哈希，重新渲染
  renderedMermaidHashes.clear()

  // 确保使用当前页面主题初始化 mermaid
  const pageTheme = getPageTheme()
  currentMermaidTheme = pageTheme
  mermaid.initialize(getMermaidThemeConfig(pageTheme))

  let counter = 0
  let pendingRenders = 0

  codeBlocks.forEach((codeBlock) => {
    const preBlock = codeBlock.parentElement
    if (!preBlock) return

    const code = codeBlock.textContent.trim()
    if (!isMermaidCode(code)) return

    const hash = hashStr(code)
    if (renderedMermaidHashes.has(hash)) return
    renderedMermaidHashes.add(hash)

    const svgContainer = document.createElement('div')
    svgContainer.className = 'mermaid-rendered'
    svgContainer.title = '点击放大查看'

    pendingRenders++
    mermaid.render('mermaid-' + Date.now() + '-' + (counter++), code).then(({ svg }) => {
      svgContainer.innerHTML = svg
      const lineNumbersMode = preBlock.closest('.line-numbers-mode')
      if (lineNumbersMode) {
        lineNumbersMode.parentNode.insertBefore(svgContainer, lineNumbersMode.nextSibling)
        lineNumbersMode.classList.add('mermaid-source-hidden')
      } else {
        preBlock.parentNode.insertBefore(svgContainer, preBlock.nextSibling)
        preBlock.classList.add('mermaid-source-hidden')
      }

      pendingRenders--
      // 所有渲染完成后，设置事件监听和主题切换按钮
      if (pendingRenders === 0) {
        if (!zoomSetupDone) {
          zoomSetupDone = true
          setupMermaidZoom()
        }
        addThemeSwitcher()
      }
    }).catch((err) => {
      console.error('Mermaid render error:', err)
      pendingRenders--
    })
  })
}

// 放大查看功能
let isOverlayOpen = false

function setupMermaidZoom() {
  if (document.querySelector('.mermaid-overlay')) return

  document.addEventListener('click', (e) => {
    // 如果遮罩已打开，不处理（防止关闭时穿透到下方图表重新打开）
    if (isOverlayOpen) return

    const rendered = e.target.closest('.mermaid-rendered')
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
  })
}

// 主题切换按钮功能
function addThemeSwitcher() {
  const pageTheme = getPageTheme()

  document.querySelectorAll('.mermaid-rendered').forEach(container => {
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
      css = css.replace(/fill:#1e293b/g, 'fill:' + colors.text)
      css = css.replace(/fill:#ffffff/g, 'fill:' + colors.containerBg)
      css = css.replace(/fill:#fff\b/g, 'fill:' + colors.containerBg)
      css = css.replace(/fill:#f8fafc/g, 'fill:' + colors.containerBg)
      css = css.replace(/fill:#475569/g, 'fill:' + colors.line)
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
      if (fill === '#0f172a' || fill === '#1e293b') el.setAttribute('fill', colors.containerBg)
    } else {
      if (fill === '#1e293b') el.setAttribute('fill', colors.text)
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
    document.querySelectorAll('.mermaid-rendered').forEach(container => {
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
  renderTimer = setTimeout(doRender, 300)
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
}

export default {
  ...DefaultTheme,
  enhanceApp({ app, router }) {
    if (typeof window !== 'undefined') {
      router.onAfterRouteChanged = scheduleRender
    }
  }
}
