# Skills · 技能包

> Frontier Vault 项目拥有的全部 AI 技能（Skill）集合 —— 自包含、随仓库版本化、可被 AI 助手加载执行的领域知识包。

本文件夹是项目技能资产的**权威来源（canonical source）**，与 `docs/`（内容）、`scripts/`（工具）平级，作为独立的工程资产层。任何人克隆仓库即可获得全部技能定义，无需依赖外部安装机制。

---

## 设计理念

| 原则 | 说明 |
| --- | --- |
| **自包含** | 所有技能的 `SKILL.md` 完整内容均在本文件夹内，不依赖外部路径即可阅读与加载 |
| **随仓库版本化** | 本文件夹纳入 Git 跟踪（区别于被 `.gitignore` 忽略的 `.agents/`），技能演进有历史可溯 |
| **所有权分层** | `project/` 存放项目自研技能（权威源），`third-party/` 存放第三方技能的自包含副本（来源见 `skills-lock.json`） |
| **适配项目架构** | 与项目「单一数据源 + 代码生成」哲学一致：技能定义集中管理，运行时副本由 IDE 机制同步 |

---

## 目录结构

```
skills/
├── README.md                          # 本文件：技能总览 + 使用指南
├── project/                           # 项目自研技能（权威源，随项目演进）
│   ├── frontier-vault-article-style/  # 高级技术长文写作风格规范
│   │   └── SKILL.md
│   └── svg-color-contrast-debug/      # SVG 颜色对比度调试与修复方法论
│       └── SKILL.md
└── third-party/                       # 第三方技能自包含副本（来源：Leonxlnx/taste-skill）
    ├── brandkit/SKILL.md
    ├── design-taste-frontend/SKILL.md
    ├── design-taste-frontend-v1/SKILL.md
    ├── full-output-enforcement/SKILL.md
    ├── gpt-taste/SKILL.md
    ├── high-end-visual-design/SKILL.md
    ├── image-to-code/SKILL.md
    ├── imagegen-frontend-mobile/SKILL.md
    ├── imagegen-frontend-web/SKILL.md
    ├── industrial-brutalist-ui/SKILL.md
    ├── minimalist-ui/SKILL.md
    ├── redesign-existing-projects/SKILL.md
    └── stitch-design-taste/{SKILL.md, DESIGN.md}
```

---

## 与其他技能位置的关系

项目中存在三处技能相关位置，职责互斥、互不重复：

| 位置 | 职责 | Git 跟踪 | 说明 |
| --- | --- | --- | --- |
| `skills/`（本文件夹） | **权威副本**：自包含、可读、随仓库 | ✅ 跟踪 | 克隆即得，版本可溯 |
| `.agents/skills/` | **运行时副本**：Trae IDE agent 实际加载位置 | ❌ 忽略 | 由 `skills-lock.json` 管理安装/更新 |
| `backup/archive/` | **历史归档**：项目自研技能的原始产出位置 | ❌ 忽略 | 保留创作过程，不再作为引用源 |

> **注意**：当 `.agents/skills/` 通过 `skills-lock` 机制更新第三方技能后，需手动同步至 `skills/third-party/` 以保持权威副本最新（见下文「维护指南」）。

---

## 技能总览

### 一、项目自研技能（`project/`）

由本项目从真实工程实践中提炼，是项目核心方法论沉淀。

| 技能 | 用途 | 优先级 | 触发场景 |
| --- | --- | --- | --- |
| [frontier-vault-article-style](project/frontier-vault-article-style/SKILL.md) | 高级技术长文写作风格规范 | P0 | 撰写/校验知识库文章时 |
| [svg-color-contrast-debug](project/svg-color-contrast-debug/SKILL.md) | SVG/Canvas 文字对比度调试与修复 | P1 | Mermaid/图表文字不可见时 |

#### 1. frontier-vault-article-style

从《现代前端性能的底层链路》一文提炼的可复用写作规范，覆盖完整长文结构。内含 **8 个子 Skill**，按 workflow 顺序执行：

1. `FrontmatterSpecSkill`（P0）— 规范 frontmatter 字段
2. `OpeningStructureSkill`（P0）— 构建开篇三件套（H1 + blockquote 副标题 + `::: info` 核心论点 + TOC）
3. `ChapterPatternSkill`（P0）— 套用章节四件套（问题框架 → 解释+示例 → `::: tip` 结论 → 可选 warning/info）
4. `MermaidThemeSkill`（P1）— 应用五色主题（wait 蓝 / block 橙 / work 绿 / metric 紫 / core 深色）
5. `CodeExamplePairSkill`（P1）— 反例/正例成对展示
6. `UnifiedModelDiagramSkill`（P1）— 生成统一模型汇总图
7. `PracticeChecklistSkill`（P1）— 输出分组实践清单（task list）
8. `ClosingStructureSkill`（P0）— 收尾五件套（统一模型 + 实践清单 + 结语 + FAQ + 来源）

**核心论点三次呼应**：开篇 `::: info` → 每章 `::: tip` → 结语 `blockquote`。

#### 2. svg-color-contrast-debug

从一次完整的 Mermaid 图表文字对比度调试会话中提炼的通用方法论，适用于任何 SVG/Canvas 可视化场景。涵盖问题识别、根因分类（5 类）、科学调试工作流、通用修复模式。

---

### 二、第三方技能（`third-party/`）

来源：[`Leonxlnx/taste-skill`](https://github.com/Leonxlnx/taste-skill)，经 `skills-lock.json` 锁定版本。按用途分三类：

#### 🎨 图像生成类

| 技能 | 用途 |
| --- | --- |
| [brandkit](third-party/brandkit/SKILL.md) | 高端品牌识别系统图像生成（logo、品牌指南板、视觉世界展示） |
| [imagegen-frontend-web](third-party/imagegen-frontend-web/SKILL.md) | 高端网站设计参考图生成，每个 section 生成一张独立横向图 |
| [imagegen-frontend-mobile](third-party/imagegen-frontend-mobile/SKILL.md) | 高端移动端 App 屏幕概念图与流程图生成（iOS/Android/跨平台） |
| [image-to-code](third-party/image-to-code/SKILL.md) | 将设计图实现为代码，先生成设计图再深度分析后还原 |

#### 🖌 UI 设计风格类

| 技能 | 用途 |
| --- | --- |
| [design-taste-frontend](third-party/design-taste-frontend/SKILL.md) | 反模板化前端技能，用于落地页/作品集/重设计（v2，当前默认） |
| [design-taste-frontend-v1](third-party/design-taste-frontend-v1/SKILL.md) | v1 原版，仅供需要精确向后兼容的项目使用 |
| [gpt-taste](third-party/gpt-taste/SKILL.md) | UX/UI + GSAP 动效工程，Python 驱动随机化布局、AIDA 结构、bento 网格 |
| [high-end-visual-design](third-party/high-end-visual-design/SKILL.md) | 高端代理商风格设计教学，定义字体/间距/阴影/卡片/动画的精确规范 |
| [minimalist-ui](third-party/minimalist-ui/SKILL.md) | 干净编辑风格界面，暖色单色调、排版对比、扁平 bento、柔和粉彩 |
| [industrial-brutalist-ui](third-party/industrial-brutalist-ui/SKILL.md) | 工业粗野主义界面，瑞士排版 + 军事终端美学、刚性网格、极端字号对比 |
| [stitch-design-taste](third-party/stitch-design-taste/SKILL.md) | 为 Google Stitch 生成 agent 友好的 `DESIGN.md` 设计系统文件（含 `DESIGN.md`） |

#### ⚙️ 工作流类

| 技能 | 用途 |
| --- | --- |
| [full-output-enforcement](third-party/full-output-enforcement/SKILL.md) | 覆盖 LLM 默认截断行为，强制完整代码生成、禁用占位符、处理 token 分割 |
| [redesign-existing-projects](third-party/redesign-existing-projects/SKILL.md) | 升级现有网站/App 至高端品质，审计设计并应用高端标准而不破坏功能 |

---

## 使用方式

### 1. 通过 AI 助手调用（推荐）

在 Trae IDE 中，AI 助手会根据任务自动匹配并调用技能。也可显式触发：

```
/<skill-name>
```

可用的显式调用包括项目自研与第三方全部技能。常用调用示例：

```
/frontier-vault-article-style     # 撰写新文章时套用写作规范
/svg-color-contrast-debug         # 调试 Mermaid 文字对比度问题
/design-taste-frontend            # 重设计首页/落地页
/redesign-existing-projects       # 升级现有页面视觉品质
/full-output-enforcement          # 需要完整无截断代码输出时
```

### 2. 项目典型场景 → 技能映射

| 项目场景 | 推荐技能 | 说明 |
| --- | --- | --- |
| 撰写知识库新文章 | `frontier-vault-article-style` | 按 8 步 workflow 生成同结构同质感长文 |
| 校验现有文章风格 | `frontier-vault-article-style` | 逐子 Skill 的 `quality_checks` 输出问题清单 |
| Mermaid 图表文字不可见 | `svg-color-contrast-debug` | 套用科学调试工作流定位根因 |
| 重设计首页 `HomePage.vue` | `design-taste-frontend` + `redesign-existing-projects` | 先审计再升级，遵守项目「禁用 SaaS 蓝紫渐变」约束 |
| 为新页面生成设计参考图 | `imagegen-frontend-web` | 每个 section 一张图，再据此实现 |
| 长代码生成被截断 | `full-output-enforcement` | 强制完整输出，禁用占位符 |

> ⚠️ **项目硬约束**：使用设计类技能时，必须遵守项目记忆中的视觉约束 —— **禁用普通 SaaS 蓝紫渐变、过度卡片化、营销网站风格**；保持专业、克制、高级、工程师友好、阅读优先的风格。

### 3. 直接阅读 SKILL.md

每个技能目录下的 `SKILL.md` 即完整技能定义，可直接阅读理解其规范与 prompt 模板，无需 AI 介入。项目自研技能尤其适合作为人工写作/调试 checklist 使用。

---

## 维护指南

### 同步第三方技能（`.agents/skills/` → `skills/third-party/`）

当通过 `skills-lock` 机制更新了 `.agents/skills/` 后，同步权威副本：

```powershell
# Windows PowerShell
Copy-Item -Path .agents\skills\* -Destination skills\third-party -Recurse -Force
```

```bash
# macOS / Linux
cp -R .agents/skills/* skills/third-party/
```

### 新增项目自研技能

1. 在 `skills/project/<skill-name>/` 下创建 `SKILL.md`
2. 采用 YAML frontmatter（`name` / `description` 必填）+ Markdown 正文结构
3. 更新本 README 的「项目自研技能」表格

### 技能文件格式约定

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `name` | ✅ | 技能唯一标识（小写连字符） |
| `description` | ✅ | 一句话用途说明，AI 助手据此匹配触发 |
| `display_name` | 可选 | 展示名（项目自研技能常用） |
| `version` | 可选 | 语义化版本 |
| 正文 | ✅ | 触发条件、规范、prompt 模板、质检清单等 |

---

## 许可说明

- **项目自研技能**（`project/`）：遵循项目内容协议 [CC BY 4.0](../LICENSE-CONTENT)
- **第三方技能**（`third-party/`）：源自 [`Leonxlnx/taste-skill`](https://github.com/Leonxlnx/taste-skill)，遵循其原始许可，版本由 [`skills-lock.json`](../skills-lock.json) 锁定
