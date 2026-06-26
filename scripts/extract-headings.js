import { createMarkdownRenderer } from 'vitepress'
import fs from 'fs'
import path from 'path'

async function extractHeadings() {
  const markdownPath = path.join(process.cwd(), 'docs', 'performance', '现代前端性能的底层链路：如何减少关键路径上的等待、阻塞与重复工作.md')
  const content = fs.readFileSync(markdownPath, 'utf-8')
  
  const md = await createMarkdownRenderer({}, {})
  const html = md.render(content)
  
  const headingRegex = /<h[1-6]\s+id="([^"]+)"[^>]*>([^<]+)<\/h[1-6]>/g
  let match
  const headings = []
  
  while ((match = headingRegex.exec(html)) !== null) {
    headings.push({
      id: match[1],
      text: match[2].replace(/<[^>]+>/g, '').trim()
    })
  }
  
  console.log('VitePress 生成的实际 heading IDs:')
  console.log('================================')
  headings.forEach(h => {
    console.log(`ID: "${h.id}"`)
    console.log(`标题: ${h.text}`)
    console.log('---')
  })
  
  return headings
}

extractHeadings()
