import mermaid from 'mermaid'

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

export default ({ app, router }) => {
  router.afterEach(() => {
    setTimeout(() => {
      renderMermaid()
    }, 100)
  })
  
  if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
      setTimeout(() => {
        renderMermaid()
      }, 500)
    })
  }
}

function renderMermaid() {
  const codeBlocks = document.querySelectorAll('pre code')
  codeBlocks.forEach((codeBlock, index) => {
    const preBlock = codeBlock.parentElement
    if (preBlock.nextElementSibling?.classList.contains('mermaid-rendered')) {
      return
    }
    
    const code = codeBlock.textContent.trim()
    
    if (isMermaidCode(code)) {
      const svgContainer = document.createElement('div')
      svgContainer.className = 'mermaid-rendered'
      
      try {
        mermaid.render('mermaid-' + Date.now() + '-' + index, code).then(({ svg }) => {
          svgContainer.innerHTML = svg
          preBlock.parentNode.insertBefore(svgContainer, preBlock.nextSibling)
          preBlock.style.display = 'none'
        })
      } catch (err) {
        console.error('Mermaid render error:', err)
        svgContainer.textContent = 'Mermaid 渲染错误: ' + err.message
        preBlock.parentNode.insertBefore(svgContainer, preBlock.nextSibling)
      }
    }
  })
}

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
