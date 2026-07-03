// 语言元数据单一数据源：定义所有支持的语言及其基础属性。
// code: 语言代码；label: 显示名；lang: HTML lang 属性值；
// isDefault: 是否为默认语言（映射到 VitePress root locale，无 URL 前缀）；
// dir: docs 下的内容目录。默认语言用空字符串 ''（表示 docs 根目录本身，非子目录）；
//      非默认语言用子目录名（如 'en'），对应 docs/en/。
// 统一约定：dir 为空字符串即代表 docs 根，path.join(docsDir, '') === docsDir。
// description: 站点描述；title: 站点标题。
export default [
  {
    code: 'zh',
    label: '中文',
    lang: 'zh-CN',
    isDefault: true,
    dir: '',
    description: '面向中高级前端工程师的系统化知识库',
    title: 'Frontier Vault'
  },
  {
    code: 'en',
    label: 'English',
    lang: 'en-US',
    isDefault: false,
    dir: 'en',
    description: 'A systematic knowledge base for advanced frontend engineers',
    title: 'Frontier Vault'
  }
]
