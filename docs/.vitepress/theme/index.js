import DefaultTheme from 'vitepress/theme'
import mermaid from 'mermaid'
import './style.css'

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#3b82f6',
    primaryTextColor: '#ffffff',
    primaryBorderColor: '#3b82f6',
    lineColor: '#6b7280',
    secondaryColor: '#6366f1',
    tertiaryColor: '#8b5cf6'
  }
})

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
      // 所有渲染完成后，设置事件监听
      if (pendingRenders === 0 && !zoomSetupDone) {
        zoomSetupDone = true
        setupMermaidZoom()
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
    isOverlayOpen = true

    const content = document.createElement('div')
    content.className = 'mermaid-overlay-content'

    const closeBtn = document.createElement('button')
    closeBtn.className = 'mermaid-overlay-close'
    closeBtn.setAttribute('aria-label', '关闭')
    closeBtn.textContent = '✕'
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
    document.addEventListener('DOMContentLoaded', scheduleRender)
  } else {
    scheduleRender()
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
