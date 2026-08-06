# frontier-vault

> 面向中高级前端工程师的系统化深度知识库 —— 从浏览器底层原理到职业成长路径，覆盖 AI 工程实践，构建可落地的工程认知体系

**🌐 在线访问**：<https://www.fatejian.icu/> · Built with [VitePress](https://vitepress.dev/) · Bilingual 中文 / English · GitHub Actions 双路部署（GitHub Pages + Baidu Cloud）

---

## 模块总览

知识库按七大模块组织，每个模块围绕一个核心主题建立完整心智模型，共 17 篇 20+ 分钟深度长文：

| 模块 | 路径 | 核心主题 |
| --- | --- | --- |
| 浏览器原理 | `docs/browser/` | Chromium 多进程架构、渲染流水线（Style / Layout / Paint / Raster / Composite）、GPU 合成、资源加载 |
| JavaScript 深度 | `docs/javascript/` | 执行上下文、作用域链、闭包本质、V8 JIT 编译、GC 回收、异步演进 |
| 框架生态 | `docs/frameworks/` | React Fiber 链式可中断渲染、Vue 3 Proxy 响应式、状态管理从 Flux 到 Zustand 的设计演进 |
| 性能优化 | `docs/performance/` | Core Web Vitals（LCP / INP / CLS）、关键路径、渲染管线、运行时性能 |
| 测试工程 | `docs/testing/` | 负载测试全流程方法论、TPS / P95 指标体系、瓶颈分层诊断、降级与熔断验证 |
| AI 工程 | `docs/ai/` | 上下文工程、上下文窗口、短期 / 长期 / 检索 / 工具上下文、AI 编程转型、角色能力迁移 |
| 职业体系 | `docs/career/` | T 型到 π 型能力模型、初级到架构师成长路径、技术影响力构建、Vibe Coder vs Software Engineer |

> English 版本位于 `docs/en/`，与中文一一对应，文件名（slug）完全一致。

## 项目特色

- **深度优先**：每篇文章 20+ 分钟长文，覆盖原理、机制、工程实践与可执行清单，而非碎片化技巧罗列
- **统一风格**：所有文章遵循 [`frontier-vault-article-style`](skills/project/frontier-vault-article-style/SKILL.md) 规范——开篇三件套、章节四件套、Mermaid 五色主题、反例/正例对照、统一模型图、分组实践清单
- **核心论点贯穿**：每篇文章有明确核心论点，在开篇 `::: info`、每章 `::: tip`、结语 `blockquote` 中三次呼应
- **可执行结论**：以分组实践清单（task list）收尾，检查项具体可验证，避免"看起来优化了"的伪结论
- **数据驱动 i18n**：所有语言元数据集中管理在单一数据源，通过代码生成 `config.js`，新增语言无需修改任何硬编码

## 快速开始

**环境要求**：Node.js >= 18、npm

```bash
npm install           # 安装依赖
npm run docs:dev      # 启动本地开发服务器（http://localhost:5173）
npm run docs:build    # 构建生产版本
npm run docs:preview  # 本地预览构建产物
```

## 架构概览

项目采用「**单一数据源 + 代码生成**」模式，避免 VitePress 配置与多语言内容之间的硬编码耦合：

```
i18n 数据源 (docs/.vitepress/i18n/)
   │  languages.js / modules.js / ui.js / home.js
   ▼
目录扫描 (docs/<module>/)  ──►  generate-sidebar.js  ──►  config.js
   │  以 modules.js 的 order 数组定义遍历顺序                    │
   └── H1 标题作为 sidebar 文本                                   ▼
                                                          VitePress 启动加载
```

**关键约束**：

- **i18n 单一真相来源**：所有语言元数据集中在 `i18n/` 四个文件，`config.js` 不含任何硬编码语言字符串
- **slug 作为 canonical ID**：同一篇文章在所有语言下使用相同的英文 slug 文件名，`config.js` 无需 `rewrites`
- **`config.js` 勿手改**：修改 i18n 数据源或新增/删除 Markdown 文件后，重新生成配置：

```bash
npm run sidebar:gen    # 重新生成 config.js（数据驱动）
npm run i18n:check     # 检查翻译完整性（对比 slug 与模块目录集合）
npm run i18n:home      # 校验各语言 index.md 首页 frontmatter 与 home.js 一致
```

> 译者协作规范（翻译规则、Mermaid 标签转义、`:::` 指令、内链/外链更新、缺翻译策略、新增语言完整步骤等）详见 [`CONTRIBUTING-i18n.md`](CONTRIBUTING-i18n.md)。

## 技术栈

| 能力 | 选型 |
| --- | --- |
| 站点框架 | VitePress 1.6 |
| 图表渲染 | Mermaid 11（自定义集成于 `theme/index.js`，非 `vitepress-plugin-mermaid`） |
| Markdown 扩展 | markdown-it-task-lists（任务清单）、markdown-it-footnote（脚注）、markdown-it-anchor（锚点） |
| URL 策略 | `cleanUrls: true`，中文源文件统一使用英文 slug 命名（无需 rewrites） |
| i18n 架构 | 数据驱动单一数据源（`i18n/`）+ 代码生成（`generate-sidebar.js`） |
| CI/CD | GitHub Actions：push 到 master 自动构建并双路部署 |
| 自定义组件 | Vue 3 单文件组件（`HomePage.vue`），支持图标、链接、hover 动画 |
| AI 技能资产 | `skills/` 目录自包含版本化（15 个 Skill），`.agents/skills/` 为 IDE 运行时副本 |

## 项目结构

```
frontier-vault/
├── docs/
│   ├── .vitepress/
│   │   ├── config.js          # VitePress 配置（脚本生成，勿手改）
│   │   ├── i18n/              # i18n 单一数据源（languages / modules / ui / home）
│   │   └── theme/            # 自定义主题（Mermaid 集成、HomePage 组件、样式）
│   ├── browser/ javascript/ frameworks/ performance/ testing/ ai/ career/
│   ├── en/                    # English 版本（与中文一一对应，slug 完全一致）
│   ├── public/                # 静态资源（favicon 等）
│   └── index.md               # 中文站点首页
├── assets/readme/             # README 视觉资产（hero.svg）
├── scripts/                   # generate-sidebar.js 等工具脚本
├── skills/                    # AI 技能资产（自包含、Git 跟踪，克隆即得）
├── .github/workflows/deploy.yml
├── CONTRIBUTING-i18n.md       # 译者协作规范
├── LICENSE-CODE / LICENSE-CONTENT
└── package.json
```

## 自定义 Mermaid 主题

Mermaid v11 集成在 `docs/.vitepress/theme/index.js`（未使用 `vitepress-plugin-mermaid`），核心能力：

- **五色主题**：`wait`（蓝）/ `block`（橙）/ `work`（绿）/ `metric`（紫）/ `core`（深色）
- **点击放大**：点击图表在 90vw × 85vh 全屏 overlay 中渲染，带关闭按钮
- **明暗切换**：每图表右上角独立切换主题，并通过 `MutationObserver` 自动跟随 VitePress 页面主题
- **autoTextColor**：形状无关的背景检测自动调整文字对比度；`foreignObject` 动态扩展宽度防溢出
- **去重与防闪烁**：基于 FNV-1a 哈希跟踪已渲染代码块；代码块 `visibility:hidden + height:0` 预隐藏避免渲染闪烁

## AI 技能资产

所有 AI 技能集中管理在 [`skills/`](skills/) 目录，与 `docs/`（内容）、`scripts/`（工具）平级，作为独立的工程资产层随仓库版本化，克隆即得：

- **项目自研**（`skills/project/`，2 个）：`frontier-vault-article-style`（写作规范，8 子 Skill）、`svg-color-contrast-debug`（SVG 对比度调试方法论）
- **第三方技能**（`skills/third-party/`，13 个）：源自 [`Leonxlnx/taste-skill`](https://github.com/Leonxlnx/taste-skill) 与 [`oil-oil/beautify-github-readme`](https://github.com/oil-oil/beautify-github-readme)，涵盖图像生成、UI 设计、README 美化、工作流四类
- **运行时副本**：`.agents/skills/` 由 `skills-lock.json` 管理安装/更新，与 `skills/` 权威副本职责分离

> 完整技能总览、使用指南与同步维护流程详见 [`skills/README.md`](skills/README.md)。

## 部署

通过 GitHub Actions 自动部署（见 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)）：push 到 `master` 分支后，`npm ci` + `npm run docs:build` 构建静态站点到 `docs/.vitepress/dist`，双路部署到 GitHub Pages 与百度云服务器（`/var/www/frontier-vault/`）。

## 许可协议

- **代码**：[MIT License](LICENSE-CODE)
- **内容**：[CC BY 4.0](LICENSE-CONTENT)

## 相关链接

- GitHub 仓库：[Fatejian/frontier-vault](https://github.com/Fatejian/frontier-vault)
