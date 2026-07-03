# 国际化协作指南

本指南面向译者与开发者，定义 frontier-vault 知识库多语言协作的统一规范，涵盖新增语言、翻译规则、检查命令、缺译策略、资源约定与模块顺序。

> 项目基于 VitePress，i18n 架构是数据驱动的：所有语言元数据、模块显示名、UI 文案、首页配置均集中在 `docs/.vitepress/i18n/` 下，文章以文件名（英文 slug）作为跨语言的 canonical article ID。

---

## 1. 新增一种语言（完整步骤）

以新增语言代码 `<code>`（如 `ja`、`ko`）为例，按下列顺序执行：

1. **在 `docs/.vitepress/i18n/languages.js` 增加语言条目**

   包含字段：`code` / `label` / `lang` / `isDefault: false` / `dir` / `description` / `title`。

2. **在 `docs/.vitepress/i18n/modules.js` 补该语言的 6 个模块显示名**

   按模块顺序填写：browser / javascript / frameworks / performance / testing / career。

3. **在 `docs/.vitepress/i18n/ui.js` 补该语言的 nav / search / footer / 概述文案**

4. **在 `docs/.vitepress/i18n/home.js` 补该语言的 hero / features**

5. **创建 `docs/<code>/` 目录**，按模块顺序建立 6 个子目录，并创建 `index.md`（站点首页）。

6. **复制默认语言的文章结构**，逐篇翻译。

   文件名必须与默认语言 slug **完全一致**（如 `rendering-pipeline.md`）。

7. **运行生成命令**

   ```bash
   npm run sidebar:gen
   ```

   重新生成 `config.js`。

8. **运行翻译完整性检查**

   ```bash
   npm run i18n:check
   ```

   确认无缺失。

9. **运行首页 frontmatter 校验**

   ```bash
   npm run i18n:home
   ```

   确认首页 hero/features 与 `home.js` 一致。

10. **运行构建确认**

    ```bash
    npm run docs:build
    ```

    确认构建成功。

---

## 2. 翻译规则清单

| 内容类型 | 规则 |
| --- | --- |
| 文件命名 | 必须与默认语言 slug 完全一致（如 `rendering-pipeline.md`） |
| Frontmatter | 保留所有 key 不变，翻译 value（`title` / `description` / `tags` 等） |
| Markdown H1 | 翻译为对应语言 |
| 正文 | 翻译，保留 Markdown 结构（标题层级、列表、表格、代码块） |
| 代码块 | 保留代码不变，仅翻译注释（`//` 后内容） |
| Mermaid 图表 | 翻译节点标签；标签含特殊字符（`{}` / `()` / `:` / `=` / `<br/>` / `/` 等）必须用双引号包裹 |
| `:::` 指令 | 保留指令名（`tip` / `info` / `warning` / `caution`），翻译内容 |
| 内部链接 | 更新为对应语言路径（中文 `/browser/...` → 英文 `/en/browser/...`） |
| 外部链接 | MDN 等链接的 `zh-CN` 改为对应语言（如 `en-US`） |
| 脚注 | 翻译脚注内容，保留 `[^id]` 标识 |

---

## 3. 检查命令说明

| 命令 | 用途 |
| --- | --- |
| `npm run sidebar:gen` | 生成 `config.js`（修改 i18n 数据源或增删文章后必须运行） |
| `npm run i18n:check` | 翻译完整性检查，对比默认语言与其他语言的 slug 集合；输出 `MISSING <lang> <module>/<slug>` 或 `MISSING MODULE <lang> <module>`；有缺失时退出码 1 |
| `npm run i18n:home` | 校验各语言 `index.md` 的 hero / features frontmatter 与 `home.js` 一致 |

---

## 4. 缺翻译策略

- **缺失翻译文件 = 404 页面**，**不做静默回退**到默认语言。
- 部署前必须 `npm run i18n:check` 通过。
- 部分翻译可以接受（先部署已翻译的），但必须满足以下任一条件：
  - 已部署的文章 slug 在所有配置的语言中都存在；或
  - 暂时从该语言的 sidebar 中移除未翻译的文章。

---

## 5. 资源约定

- **共享资源**（所有语言通用，如 favicon、logo）

  放 `docs/public/`，URL 为 `/xxx.png`。

- **语言特定资源**（如中文 UI 截图）

  放 `docs/public/<lang>/`（如 `docs/public/zh/`），URL 为 `/<lang>/xxx.png`。
  若 VitePress 不支持子目录 public，则放 `docs/<lang>/images/`，用相对路径引用。

- **推荐**：优先使用共享资源；仅在必须区分语言时才使用语言特定资源。

---

## 6. 模块顺序

下列 6 个模块及其规范顺序与 `docs/.vitepress/i18n/modules.js` 的 `order` 数组一致。sidebar 排列与翻译检查均以此顺序为准。

| 顺序 | 模块 | slug |
| --- | --- | --- |
| 1 | 浏览器（browser） | `browser` |
| 2 | JavaScript | `javascript` |
| 3 | 框架（frameworks） | `frameworks` |
| 4 | 性能（performance） | `performance` |
| 5 | 测试（testing） | `testing` |
| 6 | 职业（career） | `career` |
