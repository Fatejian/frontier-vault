// UI 字符串单一数据源：每语言的导航文案、搜索框翻译、页脚、概述标签等界面文本。
// 默认语言（zh）的 nav link 不带前缀；非默认语言（en）的 nav link 带 /<code>/ 前缀。
//
// ⚠️ activeMatch 为必填项，不可省略：VitePress 的 isActive 默认是**精确匹配**
// （normalize 后不等即判否），模块内任意文章页都会匹配不上 `/javascript/` 而让顶部
// 失去高亮。改为正则前缀匹配后，模块内所有页面都会保持对应模块高亮。
// 已用 VitePress 自身的 isActive 验证：文章页与模块首页均为 true，其它模块为 false。
// 「首页」无需 activeMatch——`/` 与 `index.md` 归一化后本就相等。
export default {
  zh: {
    nav: [
      { text: '首页', link: '/' },
      { text: '浏览器', link: '/browser/', activeMatch: '^/browser/' },
      { text: 'JavaScript', link: '/javascript/', activeMatch: '^/javascript/' },
      { text: '框架生态', link: '/frameworks/', activeMatch: '^/frameworks/' },
      { text: '性能优化', link: '/performance/', activeMatch: '^/performance/' },
      { text: '测试工程', link: '/testing/', activeMatch: '^/testing/' },
      { text: 'AI 工程', link: '/ai/', activeMatch: '^/ai/' },
      { text: '职业体系', link: '/career/', activeMatch: '^/career/' }
    ],
    overview: '概述',
    search: {
      button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
      modal: {
        noResultsText: '无法找到相关结果',
        resetButtonTitle: '清除查询条件',
        footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' }
      }
    },
    footer: { message: 'Code: MIT | Content: CC BY 4.0', copyright: 'Copyright © 2026-present', icp: '粤ICP备2026097578号-1', icpLink: 'https://beian.miit.gov.cn/' }
  },
  en: {
    nav: [
      { text: 'Home', link: '/en/' },
      { text: 'Browser', link: '/en/browser/', activeMatch: '^/en/browser/' },
      { text: 'JavaScript', link: '/en/javascript/', activeMatch: '^/en/javascript/' },
      { text: 'Frameworks', link: '/en/frameworks/', activeMatch: '^/en/frameworks/' },
      { text: 'Performance', link: '/en/performance/', activeMatch: '^/en/performance/' },
      { text: 'Testing', link: '/en/testing/', activeMatch: '^/en/testing/' },
      { text: 'AI Engineering', link: '/en/ai/', activeMatch: '^/en/ai/' },
      { text: 'Career', link: '/en/career/', activeMatch: '^/en/career/' }
    ],
    overview: 'Overview',
    search: {
      button: { buttonText: 'Search documentation', buttonAriaLabel: 'Search documentation' },
      modal: {
        noResultsText: 'No results found',
        resetButtonTitle: 'Reset search',
        footer: { selectText: 'Select', navigateText: 'Navigate', closeText: 'Close' }
      }
    },
    footer: { message: 'Code: MIT | Content: CC BY 4.0', copyright: 'Copyright © 2026-present', icp: '粤ICP备2026097578号-1', icpLink: 'https://beian.miit.gov.cn/' }
  }
}
