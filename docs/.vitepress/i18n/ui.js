// UI 字符串单一数据源：每语言的导航文案、搜索框翻译、页脚、概述标签等界面文本。
// 默认语言（zh）的 nav link 不带前缀；非默认语言（en）的 nav link 带 /<code>/ 前缀。
export default {
  zh: {
    nav: [
      { text: '首页', link: '/' },
      { text: '浏览器', link: '/browser/' },
      { text: 'JavaScript', link: '/javascript/' },
      { text: '框架生态', link: '/frameworks/' },
      { text: '性能优化', link: '/performance/' },
      { text: '测试工程', link: '/testing/' },
      { text: 'AI 工程', link: '/ai/' },
      { text: '职业体系', link: '/career/' }
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
      { text: 'Browser', link: '/en/browser/' },
      { text: 'JavaScript', link: '/en/javascript/' },
      { text: 'Frameworks', link: '/en/frameworks/' },
      { text: 'Performance', link: '/en/performance/' },
      { text: 'Testing', link: '/en/testing/' },
      { text: 'AI Engineering', link: '/en/ai/' },
      { text: 'Career', link: '/en/career/' }
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
