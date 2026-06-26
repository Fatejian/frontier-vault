import { spawn } from 'child_process'
import path from 'path'

export default function autoSidebar() {
  return {
    name: 'auto-sidebar',
    configureServer(server) {
      server.watcher.add('docs/**/*.md')
      server.watcher.on('add', (file) => {
        if (file.endsWith('.md')) {
          console.log('\n[auto-sidebar] 检测到新增文件:', path.basename(file))
          runScript()
        }
      })
      server.watcher.on('unlink', (file) => {
        if (file.endsWith('.md')) {
          console.log('\n[auto-sidebar] 检测到删除文件:', path.basename(file))
          runScript()
        }
      })
      server.watcher.on('change', (file) => {
        if (file.endsWith('.md')) {
          console.log('\n[auto-sidebar] 检测到修改文件:', path.basename(file))
          runScript()
        }
      })
    }
  }
}

function runScript() {
  const scriptPath = path.join(process.cwd(), 'scripts', 'generate-sidebar.js')
  const child = spawn('node', [scriptPath])
  
  child.stdout.on('data', (data) => {
    console.log('[auto-sidebar]', data.toString().trim())
  })
  
  child.stderr.on('data', (data) => {
    console.error('[auto-sidebar] 错误:', data.toString().trim())
  })
  
  child.on('close', (code) => {
    if (code === 0) {
      console.log('[auto-sidebar] 侧边栏已自动更新')
    }
  })
}
