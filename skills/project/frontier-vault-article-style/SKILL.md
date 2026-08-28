---
name: frontier-vault-article-style
display_name: Frontier Vault 文章风格
version: 2.0.0
language: zh-CN
description: >
  Frontier Vault 知识库深度长文的写作风格规范。定义一篇长文从 frontmatter 到
  结语的整体结构、章节写法、Mermaid 配色、代码对照与收尾约定，
  并附一份可直接使用的生成 prompt 和校验清单。用于撰写或校验浏览器原理、
  前端性能、框架机制、工程实践类文章。
---

# Frontier Vault 文章风格

这份规范从《现代前端性能的底层链路：如何减少关键路径上的等待、阻塞与重复工作》
一文提炼。目的只有一个：让知识库里每篇长文长成一个样，读者无论打开哪一篇，
都能快速找到结论、看清结构、看懂图。

它写给 AI 用，也写给想理解这套风格的人读。生成新文章时，把「生成 prompt」
一节原样丢给 AI；写完或审稿时，用「校验清单」过一遍。

## 适用场景

- 从零写一篇深度长文（浏览器原理、前端性能、框架机制、工程实践）
- 把一篇草稿补全成完整文章
- 检查已有文章是否贴合本站风格

## 一篇文章的整体形状

一篇文章按以下顺序组织：

1. **frontmatter**：字段固定的 YAML 头
2. **开篇**：H1 标题、引用块（副标题 / 目标读者 / 阅读时间）、`::: info 一句话` 核心论点、目录
3. **正文章节**：每章独立成节，章节之间用 `---` 分隔
4. **统一模型 / 实践清单**：见下方「按文章类型收尾」，不是每篇都要
5. **结语 + FAQ + 来源**：收尾三部分，所有文章都含

核心论点在全文中出现三次：开篇的 `::: info 一句话`、每章的 `::: tip 本节核心结论`、
结语的 blockquote。这不是凑字数，是让读者无论从哪一段读起都抓得住主线。

## frontmatter

字段顺序固定，不要增删、不要调换：

```yaml
---
title: 现代前端性能的底层链路：如何减少关键路径上的等待、阻塞与重复工作
description: 从 TTFB、LCP、Hydration 到 ESM、JIT、GC、光栅化、IPC 与资源调度
category: Performance
tags:
  - Frontend Performance
  - Browser Internals
  - LCP
  - Hydration
  - JavaScript Runtime
readingTime: 25 min
outline: deep
---
```

写的时候注意：

- `title`：中文完整标题，可以带冒号副标题
- `description`：一句话点出技术范围，关键术语都带出来
- `category`：Performance / Browser / JavaScript / Frameworks / Testing / AI / Career 中选一个
- `tags`：3-6 个英文标签，覆盖主题域
- `readingTime`：形如 `25 min`
- `outline`：固定 `deep`

## 开篇

开篇按顺序放四样东西：

1. `#` H1 标题，全文唯一
2. 引用块，恰好三行：副标题、目标读者、阅读时间
3. `::: info 一句话` 容器，放核心论点
4. `## 目录`，列出全部章节锚点

章节标题用中文序号（一、二、三…）。目录锚点的规则：中文保留、空格换成连字符、
引号等标点去掉。

```markdown
# 现代前端性能的底层链路：如何减少关键路径上的等待、阻塞与重复工作

> 副标题：从 TTFB、LCP、Hydration 到 ESM、JIT、GC、光栅化、IPC 与资源调度
>
> 目标读者：中高级前端工程师、前端架构师、性能优化负责人
>
> 阅读时间：约 25 分钟

::: info 一句话
现代前端性能优化的本质，是管理关键路径上的等待、阻塞与重复工作。
:::

## 目录

- [写在前面](#写在前面)
- [一、从“框架视角”升级到“浏览器链路视角”](#一、从-框架视角-升级到-浏览器链路视角)
```

## 正文章节

每章内部按「引入 → 展开 → 收束」走，但别把它当模板硬套，内容比形式重要：

- **引入**：从一个问题、一个常见认知、一次对比切入。比如"很多人以为…"、
  "很多页面 LCP 慢，其实不是…"
- **展开**：讲清楚机制，配代码、配图。这一部分是主体，篇幅占大头
- **收束**：`::: tip 本节核心结论`，一两句话把本章观点钉死

`::: warning 常见误区` 和 `::: info 工程启示` 按需加，不要每章都塞，
塞多了就不值钱。

```markdown
## 二、第一段等待：TTFB 之前，浏览器已经做了很多事

**TTFB（Time to First Byte，首字节时间）**表示浏览器从发起请求到收到服务器
第一个字节之间的时间。很多人把它简单理解成"后端响应时间"，其实在第一个字节
到达之前，浏览器已经经历了 URL 解析、DNS、TCP 连接、TLS 握手等一串步骤。

::: tip 本节核心结论
TTFB 不等于后端响应时间，它包含 DNS、TCP、TLS、服务端处理等多个阶段。
:::

::: warning 常见误区
把 TTFB 慢一律归因于后端接口慢，忽略了 DNS、TLS 握手、CDN 命中等网络阶段。
:::
```

## Mermaid 配色

所有 Mermaid 图统一走五色体系，别自己发明颜色。图头部用固定的 init 声明：

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'fontFamily': 'Inter, PingFang SC, Microsoft YaHei, sans-serif', 'primaryColor': '#F8FAFC', 'primaryTextColor': '#172033', 'primaryBorderColor': '#CBD5E1', 'lineColor': '#64748B'}}}%%
```

五种语义色通过 classDef 定义：

| 语义 | 底色 | 边框 | 用途 |
| --- | --- | --- | --- |
| wait | `#EEF6FF` | `#3B82F6` | 等待类：网络、发现、加载 |
| block | `#FFF7E6` | `#F59E0B` | 阻塞类：长任务、同步脚本 |
| work | `#ECFDF3` | `#22C55E` | 工作类：解析、布局、绘制 |
| metric | `#F5E8FF` | `#A855F7` | 指标类：LCP、INP 等结果 |
| core | `#172033`（白字） | `#172033` | 核心节点，居中 |

classDef 写法示例：

```text
classDef wait fill:#EEF6FF,stroke:#3B82F6,color:#172033,stroke-width:1.5px
classDef block fill:#FFF7E6,stroke:#F59E0B,color:#172033,stroke-width:1.5px
classDef work fill:#ECFDF3,stroke:#22C55E,color:#172033,stroke-width:1.5px
classDef metric fill:#F5E8FF,stroke:#A855F7,color:#172033,stroke-width:2px
classDef core fill:#172033,color:#fff,stroke:#172033,stroke-width:2px
```

节点文字用中文，同一张图至少区分两种颜色。用 subgraph 划分阶段时，
subgraph 名也用中文。

## 代码对照

涉及写法对错的章节，反例和正例成对出现，反例在前、正例在后，紧挨着放，
首行注释标清楚：

```javascript
// 反例：读写交错，强制同步布局
for (const item of list) {
  item.style.width = container.offsetWidth + 'px'
}
```

```javascript
// 正例：先批量读，再批量写
const width = container.offsetWidth
for (const item of list) {
  item.style.width = width + 'px'
}
```

代码块带语言标签，内容只保留问题核心，别贴一坨无关逻辑。

## 统一模型（实践型通常用，原理型按需）

实践型文章的正文最后放一张统一模型：用 Mermaid flowchart（或 mindmap）把全文
归拢成一个框架。要点：

- 核心节点用 core 色，居中
- 子模型用 subgraph 分组，每组一个语义色
- 每个子模型下接 1-2 个策略节点（虚线 classDef）
- 图后用文字分组说明每部分内容，章节末尾照例 `::: tip 本节核心结论`

## 按文章类型收尾

收尾结构跟文章类型走，别一刀切。先判断这篇属于哪类：

- **实践型**：性能优化、测试方案、工程流程、学习路径——结论能落到具体动作。
  这类必含统一模型 + 实践清单，收尾顺序：统一模型 → 实践清单 → 结语 → FAQ → 来源
- **原理型**：浏览器内部机制、框架源码机制、语言运行时原理——核心是讲清"怎么运作、为什么"。
  这类不强求统一模型和实践清单，收尾顺序：结语 → FAQ → 来源
  （如果全文确实能用一张图归拢，统一模型可以加；硬凑一张图反而干扰。）

判断不准时，问自己一句：读者合上这篇，是要"去做什么"，还是"理解了什么"。
前者给清单，后者别硬塞。

## 实践清单（实践型才用）

实践清单分 5-7 组，每组一个 `###` 子标题，每项 `- [ ] ` 开头（task list，
依赖 markdown-it-task-lists 插件）。检查项要具体到能验证——写
"给关键图片加 fetchpriority='high'"，别写"优化图片"。

## 结语、FAQ 与来源

所有文章都含这三部分，顺序在最后：

- **结语**：两三段总结，最后用 blockquote 第三次强调核心论点
- **FAQ**：5 个左右读者真正会搜的问题，每个 `### 序号. 问题`，回答 2-4 句，
  别复读术语
- **来源**：参考链接，格式 `序号. 标题：[URL](URL)`，优先权威来源

## 生成 prompt

写一篇「{{主题}}」的文章，主题域：{{主题域}}，目标读者：{{目标读者}}，
核心论点：{{核心论点}}。

按 Frontier Vault 文章风格组织：

1. **frontmatter**：字段顺序为 title / description / category / tags /
   readingTime / outline。description 一句话点出技术范围并带出关键术语；
   tags 用 3-6 个英文标签；readingTime 形如 "25 min"；outline 固定 deep。
2. **开篇**：H1 标题，引用块三行（副标题 / 目标读者 / 阅读时间），
   `::: info 一句话` 放核心论点，`## 目录` 列出全部章节锚点，章节用中文序号。
3. **正文**：每章从问题或常见认知引入，讲清机制并配代码或图，结尾用
   `::: tip 本节核心结论` 收束；`::: warning 常见误区` 和 `::: info 工程启示`
   按需使用；章节之间用 `---` 分隔。
4. **图表**：Mermaid 图统一五色体系（wait 蓝 / block 橙 / work 绿 /
   metric 紫 / core 深色），init 和 classDef 用规范里的固定写法，节点文字用中文。
5. **代码**：写法对比成对出现，反例在前正例在后，首行注释 `// 反例：` 和
   `// 正例：`，带语言标签，内容聚焦。
6. **收尾**：先判断文章类型。实践型（性能/测试/工程流程/学习路径）顺序为
   统一模型（Mermaid 汇总图 + 文字分组说明）→ 实践清单（5-7 组，`- [ ]` 检查项）
   → 结语 → FAQ → 来源；原理型（浏览器机制/框架源码/运行时原理）顺序为
   结语 → FAQ → 来源，统一模型和实践清单不强求，硬凑反而干扰。结语用
   blockquote 第三次强调核心论点；FAQ 5 个左右；来源用「标题 + URL」。

## 校验清单

写完或审稿时逐项过：

- [ ] frontmatter 字段齐全、顺序正确，tags 全英文，outline 为 deep
- [ ] 开篇四样齐全：H1 唯一、引用块三行、info 一句话、目录锚点有效
- [ ] 每章都有 `::: tip 本节核心结论`，章节间用 `---` 分隔
- [ ] Mermaid 图用五色体系，色值与规范一致，节点为中文
- [ ] 反例/正例成对，首行注释格式正确
- [ ] 核心论点在开篇、每章结论、结语至少出现三次
- [ ] 收尾结构与文章类型匹配：实践型含统一模型 + 实践清单（5-7 组、检查项
      具体可验证）；原理型可省，顺序为 结语 → FAQ → 来源
- [ ] 结语、FAQ（5 个左右）、来源三部分齐全且顺序在最后
