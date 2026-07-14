# frontier-vault

> A curated knowledge vault for advanced frontend engineering — browser internals, JavaScript deep dives, framework mechanics, performance optimization, testing engineering, AI engineering practice, and career frameworks.
>
> 面向中高级前端工程师的系统化知识库，从浏览器底层原理到职业成长路径，覆盖 AI 工程实践，构建可落地的工程认知体系。

Built with [VitePress](https://vitepress.dev/) · Bilingual: 中文 / English · Deployed via GitHub Actions to GitHub Pages + Baidu Cloud

## 项目特色

- **深度优先**：每篇文章都是 20+ 分钟的长文，覆盖原理、机制、工程实践与可执行清单，而非碎片化的技巧罗列
- **统一风格**：所有文章遵循 `frontier-vault-article-style` 写作规范 —— 开篇三件套、章节四件套、Mermaid 五色主题、反例/正例对照、统一模型图、分组实践清单
- **核心论点贯穿**：每篇文章有明确的核心论点，在开篇 `::: info`、每章 `::: tip`、结语 `blockquote` 中三次呼应
- **可执行结论**：每篇文章以分组实践清单（task list）收尾，检查项具体可验证，避免"看起来优化了"的伪结论
- **数据驱动 i18n**：所有语言元数据、模块名、UI 文案集中管理在单一数据源，通过代码生成 `config.js`，新增语言无需修改任何硬编码
- **自定义首页组件**：`HomePage.vue` 支持模块卡片图标、可点击链接跳转、hover 缩放动画效果
- **Mermaid 渲染优化**：代码块预隐藏（`visibility:hidden + height:0`）避免渲染闪烁，点击放大 + 明暗切换 + autoTextColor 自动对比度

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

## 架构设计

项目采用「**单一数据源 + 代码生成**」模式，避免 VitePress 配置与多语言内容之间的硬编码耦合。

**数据流**：

1. **i18n 数据源**（`docs/.vitepress/i18n/`）—— 4 个文件定义所有语言元数据、模块名、UI 文案、首页配置
2. **目录扫描**（`docs/<module>/` 与 `docs/<dir>/<module>/`）—— 以 `modules.js` 的 `order` 数组为顺序遍历，H1 标题作为 sidebar 文本
3. **代码生成**（`scripts/generate-sidebar.js`）—— 读取上述两类输入，生成 `docs/.vitepress/config.js` 的 `locales / nav / sidebar / search / footer` 全部配置
4. **VitePress 加载** —— 启动时读取生成的 `config.js`，无需手动维护 locale 配置

**关键约束**：

- **i18n 单一真相来源**：所有语言元数据集中在 `i18n/` 四个文件，`config.js` 不含任何硬编码语言字符串
- **模块顺序显式控制**：`modules.js` 的 `order` 数组定义模块遍历顺序，不依赖文件系统 `sort()`
- **slug 作为 canonical ID**：同一篇文章在所有语言下使用相同的英文 slug 文件名，因此 `config.js` 无需 `rewrites`
- **`config.js` 勿手改**：由脚本生成，修改 i18n 数据源或新增/删除 Markdown 文件后需重新运行 `npm run sidebar:gen`

## 模块总览

知识库按七大模块组织，每个模块围绕一个核心主题建立完整心智模型：

| 模块 | 中文路径 | 英文路径 | 核心主题 |
| --- | --- | --- | --- |
| 浏览器原理 | `docs/browser/` | `docs/en/browser/` | Chromium 多进程架构、渲染流水线（Style / Layout / Paint / Raster / Composite）、GPU 合成、资源加载 |
| JavaScript 深度 | `docs/javascript/` | `docs/en/javascript/` | 执行上下文、作用域链、闭包本质、V8 JIT 编译、GC 回收、异步演进 |
| 框架生态 | `docs/frameworks/` | `docs/en/frameworks/` | React Fiber 链式可中断渲染、Vue 3 Proxy 响应式、状态管理从 Flux 到 Zustand 的设计演进 |
| 性能优化 | `docs/performance/` | `docs/en/performance/` | Core Web Vitals（LCP / INP / CLS）、关键路径、渲染管线、运行时性能 |
| 测试工程 | `docs/testing/` | `docs/en/testing/` | 负载测试全流程方法论、TPS / P95 指标体系、瓶颈分层诊断、降级与熔断验证 |
| AI 工程 | `docs/ai/` | `docs/en/ai/` | 上下文工程、上下文窗口、短期 / 长期 / 检索 / 工具上下文、AI 编程转型、角色能力迁移 |
| 职业体系 | `docs/career/` | `docs/en/career/` | T 型到 π 型能力模型、初级到架构师成长路径、技术影响力构建、Vibe Coder vs Software Engineer |

## 项目结构

```
frontier-vault/
├── docs/
│   ├── .vitepress/
│   │   ├── config.js              # VitePress 配置（由 generate-sidebar.js 自动生成，勿手改）
│   │   ├── i18n/                  # i18n 单一数据源
│   │   │   ├── languages.js       # 语言元数据（code / label / lang / isDefault / dir）
│   │   │   ├── modules.js         # 每语言每模块的本地化显示名 + 模块规范顺序 order
│   │   │   ├── ui.js              # 每语言的 nav / search / footer / 概述文案
│   │   │   └── home.js            # 每语言首页 hero / features 配置（用于 --sync-home 校验）
│   │   └── theme/                 # 自定义主题
│   │       ├── components/        # 自定义组件
│   │       │   └── HomePage.vue   # 自定义首页组件（支持 icon、link、hover 动画）
│   │       ├── index.js           # 主题入口（Mermaid 集成、点击放大、明暗切换、autoTextColor）
│   │       ├── enhanceApp.js      # 应用增强钩子
│   │       └── style.css          # 自定义样式（全局主题变量、卡片效果、Mermaid 隐藏）
│   ├── browser/                   # 浏览器原理模块（中文，文件名用英文 slug）
│   │   ├── index.md               # 模块概述页（知识地图 + 核心主题 + 内容规划）
│   │   ├── rendering-pipeline.md  # 渲染流水线：Style / Layout / Paint / Raster / Composite
│   │   ├── layout-thrashing.md    # Layout Thrashing 与性能优化策略
│   │   └── painting-rasterization.md  # 绘制与栅格化原理
│   ├── javascript/                # JavaScript 深度模块（中文）
│   │   ├── index.md
│   │   ├── execution-context-closure.md  # 执行上下文与闭包本质
│   │   ├── v8-jit-gc.md           # V8 JIT 编译与 GC 回收机制
│   │   └── async-evolution.md     # 异步演进：从 callback 到 Promise 到 async/await
│   ├── frameworks/                # 框架生态模块（中文）
│   │   ├── index.md
│   │   ├── react-fiber.md         # React Fiber 链式可中断渲染
│   │   ├── vue3-reactivity.md     # Vue 3 Proxy 响应式系统
│   │   └── state-management.md    # 状态管理从 Flux 到 Zustand 的设计演进
│   ├── performance/               # 性能优化模块（中文）
│   │   ├── index.md
│   │   ├── critical-path.md       # 关键路径优化与资源加载策略
│   │   └── rendering-pitfalls.md  # 渲染陷阱与 Core Web Vitals 优化
│   ├── testing/                   # 测试工程模块（中文）
│   │   ├── index.md
│   │   └── load-testing-practice.md  # 负载测试全流程方法论
│   ├── ai/                        # AI 工程模块（中文）
│   │   ├── index.md
│   │   └── understanding-context-in-ai-era.md  # 上下文工程：短期/长期/检索/工具上下文
│   ├── career/                    # 职业体系模块（中文）
│   │   ├── index.md
│   │   ├── capability-model.md    # T 型到 π 型能力模型
│   │   ├── growth-path.md         # 初级到架构师成长路径
│   │   ├── technical-influence.md # 技术影响力构建
│   │   └── vibe-coder-vs-software-engineer.md  # Vibe Coder vs Software Engineer
│   ├── en/                        # English 版本（与中文一一对应，slug 完全一致）
│   │   ├── browser/
│   │   ├── javascript/
│   │   ├── frameworks/
│   │   ├── performance/
│   │   ├── testing/
│   │   ├── ai/
│   │   ├── career/
│   │   └── index.md               # English 站点首页
│   ├── public/                    # 静态资源（favicon 等）
│   │   └── favicon.png
│   └── index.md                   # 中文站点首页（frontmatter 与 home.js 同步校验）
├── scripts/
│   ├── generate-sidebar.js        # 数据驱动生成 config.js + 翻译检查 + 首页校验
│   ├── extract-headings.js        # 标题提取工具
│   └── vite-plugin-auto-sidebar.js  # Vite 插件（开发期辅助）
├── .github/workflows/deploy.yml   # GitHub Actions 部署工作流
├── CONTRIBUTING-i18n.md           # 译者协作规范
├── LICENSE-CODE                   # MIT（代码）
├── LICENSE-CONTENT                # CC BY 4.0（内容）
├── package.json
├── package-lock.json
└── vite.config.js
```

## 多语言支持

站点采用数据驱动的 i18n 架构，所有语言元数据集中管理在 `docs/.vitepress/i18n/` 单一数据源：

- **中文（默认）**：内容位于 `docs/` 根目录，访问路径为 `/`
- **English**：内容位于 `docs/en/` 目录，访问路径为 `/en/`

### 数据源结构

| 文件 | 作用 |
| --- | --- |
| `i18n/languages.js` | 语言列表与元数据（code / label / lang / isDefault / dir） |
| `i18n/modules.js` | 每语言每模块的本地化显示名 + 模块规范顺序 `order` |
| `i18n/ui.js` | 每语言的 nav 文案、search 翻译、footer、概述标签 |
| `i18n/home.js` | 每语言首页 hero / features 配置（用于 `i18n:home` 校验） |

### 文件命名约定

同一篇文章在所有语言下使用**相同的英文 slug 文件名**（如 `rendering-pipeline.md`），文件名即为跨语言的 canonical article ID。中文标题保留在 Markdown H1 与 frontmatter 中，不进入文件名。因此 `config.js` 无需 `rewrites` 规则。

### 资源约定

- **共享资源**（所有语言通用，如 favicon、logo）放 `docs/public/`，URL 为 `/xxx.png`
- **语言特定资源**（如中文 UI 截图）放 `docs/public/<lang>/`（如 `docs/public/zh/`），URL 为 `/<lang>/xxx.png`；若 VitePress 不支持子目录 public，则放 `docs/<lang>/images/` 用相对路径引用
- **推荐**：优先使用共享资源，仅在必须区分语言时才使用语言特定资源

> 完整的译者协作规范（翻译规则、Mermaid 标签转义、`:::` 指令、内链/外链更新、缺翻译策略等）参见 [`CONTRIBUTING-i18n.md`](CONTRIBUTING-i18n.md)。

## 自定义 Mermaid 主题

Mermaid v11 集成在 `docs/.vitepress/theme/index.js`，未使用 `vitepress-plugin-mermaid`。核心能力：

- **五色主题**：`wait`（蓝）/ `block`（橙）/ `work`（绿）/ `metric`（紫）/ `core`（深色）
- **点击放大**：点击图表在 90vw × 85vh 全屏 overlay 中渲染，带关闭按钮
- **明暗切换**：每个图表右上角 ☀️ / 🌙 按钮独立切换主题
- **页面主题同步**：通过 `MutationObserver` 监听 `<html>` class，自动跟随 VitePress 页面明暗切换
- **去重渲染**：基于 FNV-1a 哈希算法跟踪已渲染代码块，防止重复处理
- **autoTextColor**：形状无关的背景检测（rect / polygon / path / circle / ellipse / use + shape-agnostic fallback），自动调整文字颜色对比度
- **foreignObject 自适应**：动态扩展宽度防止文字溢出；短标签（宽度 < 80px）自动取消 padding 保证居中
- **渲染闪烁优化**：代码块使用 `visibility:hidden + height:0` 预隐藏，而非 `display:none`，确保 IntersectionObserver 正常检测
- **集中配置**：`MERMAID_CONFIG` 与 `MERMAID_THEME_VARS` 常量集中管理渲染延迟、观察器参数、主题颜色等配置

## 快速开始

### 环境要求

- Node.js >= 18
- npm

### 本地开发

```bash
# 安装依赖
npm install

# 启动本地开发服务器
npm run docs:dev

# 构建生产版本
npm run docs:build

# 本地预览构建产物
npm run docs:preview
```

开发服务器默认启动在 `http://localhost:5173`。

### i18n 与侧边栏维护

修改 i18n 数据源或新增/删除 Markdown 文件后，需要执行以下命令：

```bash
# 重新生成 config.js（数据驱动，从 i18n 数据源与目录结构生成）
npm run sidebar:gen

# 检查翻译完整性（对比默认语言与其他语言的文章 slug 与模块目录集合）
npm run i18n:check

# 校验各语言 index.md 首页 frontmatter 与 home.js 一致
npm run i18n:home
```

### 新增一种语言

1. 在 `i18n/languages.js` 增加语言条目（`isDefault: false`, `dir: '<code>'`）
2. 在 `modules.js` 与 `ui.js` 中补齐该语言的文案
3. 在 `home.js` 中补齐该语言的 hero / features 配置
4. 创建 `docs/<code>/` 目录，按模块顺序建立 7 个子目录，放入对应语言的 Markdown 文件（文件名须与默认语言的 slug 一致）+ `index.md` 站点首页
5. 运行 `npm run sidebar:gen` 重新生成 config.js
6. 运行 `npm run i18n:check` 与 `npm run i18n:home` 确认无缺失

无需修改 `generate-sidebar.js` 或 `config.js` 任何硬编码——脚本会自动从 `languages.js` 读取语言列表并生成对应的 locale 配置。详见 [`CONTRIBUTING-i18n.md`](CONTRIBUTING-i18n.md)。

## 写作规范

所有知识库文章遵循 `frontier-vault-article-style` 写作规范（详见 `backup/frontier-vault-article-style.skill`），核心要素：

- **Frontmatter**：`title` / `description` / `category` / `tags` / `readingTime` / `outline`
- **开篇三件套**：H1 标题 + blockquote 副标题块 + `::: info 一句话` 核心论点 + 目录
- **章节四件套**：问题框架引入 → 解释+示例 → `::: tip 本节核心结论` → 可选 `::: warning` / `::: info`
- **Mermaid 五色主题**：`wait`（蓝）/ `block`（橙）/ `work`（绿）/ `metric`（紫）/ `core`（深色）
- **反例/正例对照**：`// 反例：xxx` 与 `// 正例：xxx` 成对呈现
- **收尾五件套**：统一模型图 → 分组实践清单 → 结语（blockquote 第三次呼应核心论点）→ FAQ → 来源

## 部署

项目通过 GitHub Actions 自动部署（见 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)）：

1. **触发条件**：push 到 `master` 分支
2. **构建**：`npm ci` + `npm run docs:build` 生成静态站点到 `docs/.vitepress/dist`
3. **双路部署**：
   - GitHub Pages（通过 `peaceiris/actions-gh-pages`）
   - 百度云服务器（通过 `burnett01/rsync-deployments` 同步到 `/var/www/frontier-vault/`）

## 许可协议

- **代码**：[MIT License](LICENSE-CODE)
- **内容**：[CC BY 4.0](LICENSE-CONTENT)

## 相关链接

- GitHub 仓库：[Fatejian/frontier-vault](https://github.com/Fatejian/frontier-vault)
