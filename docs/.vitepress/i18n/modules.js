// 模块显示名单一数据源：每语言每模块的本地化显示名。
// 键为模块标识（与 docs 目录名一致），值为对应语言的模块名称。

// 模块的规范顺序（sidebar 遍历与翻译检查均以此为准，不依赖文件系统 sort）
export const order = ['browser', 'javascript', 'frameworks', 'performance', 'testing', 'ai', 'career']

export default {
  zh: {
    browser: '浏览器原理',
    javascript: 'JavaScript 深度',
    frameworks: '框架与生态',
    performance: '性能优化工程',
    testing: '测试工程',
    ai: 'AI 工程',
    career: '职业体系'
  },
  en: {
    browser: 'Browser Internals',
    javascript: 'JavaScript Deep Dive',
    frameworks: 'Frameworks & Ecosystem',
    performance: 'Performance Engineering',
    testing: 'Testing Engineering',
    ai: 'AI Engineering',
    career: 'Career System'
  }
}
