---
name: frontier-vault-article-style
display_name: Frontier Vault 高级技术长文写作风格 Skill
version: 1.0.0
language: zh-CN
description: >
  从《现代前端性能的底层链路：如何减少关键路径上的等待、阻塞与重复工作》一文提炼的可复用写作风格规范，
  用于指导生成同结构、同质感、同视觉体系的高级前端技术长文。
  覆盖 frontmatter、开篇三件套、章节四件套、Mermaid 五色配色体系、
  反例/正例对照、统一模型图、分组实践清单、FAQ、来源等完整规范。
  推荐用于 Frontier Vault 知识库内的浏览器原理、前端性能、框架机制、工程实践等深度长文。

applicability:
  article_types:
    - 高级前端技术长文
    - 浏览器原理 / 性能优化文章
    - 框架机制深度解析文章
    - 工程实践复盘文章
    - 知识库核心沉淀文章
  target_readers:
    - 中高级前端工程师
    - 前端架构师
    - 性能优化负责人
    - 技术负责人
  core_goals:
    - 统一文章结构与视觉体系
    - 强化核心论点贯穿全文
    - 保证技术严谨与可读性平衡
    - 形成可识别的 Frontier Vault 文章风格

workflow:
  - step: 1
    skill: FrontmatterSpecSkill
    purpose: 规范 frontmatter 字段
  - step: 2
    skill: OpeningStructureSkill
    purpose: 构建开篇三件套
  - step: 3
    skill: ChapterPatternSkill
    purpose: 套用章节四件套
  - step: 4
    skill: MermaidThemeSkill
    purpose: 应用统一 Mermaid 配色体系
  - step: 5
    skill: CodeExamplePairSkill
    purpose: 反例/正例成对展示
  - step: 6
    skill: UnifiedModelDiagramSkill
    purpose: 生成统一模型汇总图
  - step: 7
    skill: PracticeChecklistSkill
    purpose: 输出分组实践清单
  - step: 8
    skill: ClosingStructureSkill
    purpose: 完成结语 + FAQ + 来源

skills:
  - name: FrontmatterSpecSkill
    display_name: Frontmatter 规范 Skill
    priority: P0
    description: >
      规范 Markdown 文章顶部的 YAML frontmatter，确保字段齐全、值规范，
      保证 VitePress 能正确解析 title / description / category / tags / readingTime / outline。
    best_for:
      - 新建任何 Frontier Vault 知识库文章
      - 校验已有文章的 frontmatter 是否符合规范
    input_requirements:
      - 文章标题
      - 文章主题范围
      - 文章分类（Performance / Browser / JavaScript / Frameworks / Career）
    output_requirements:
      - 完整的 frontmatter YAML 块
      - 字段顺序与示例一致
    prompt_template: |
      请为以下文章生成符合 Frontier Vault 规范的 frontmatter。

      要求：
      1. 字段顺序固定：title / description / category / tags / readingTime / outline。
      2. title 使用中文完整标题，可带冒号副标题。
      3. description 用一句话概括技术范围，列出关键术语（如 TTFB、LCP、Hydration、JIT、GC 等）。
      4. category 取值：Performance / Browser / JavaScript / Frameworks / Career。
      5. tags 使用英文数组，3-6 个，覆盖主题域（如 Frontend Performance / Browser Internals / LCP）。
      6. readingTime 形如 "25 min"。
      7. outline 固定为 deep。

      文章主题：{{topic}}
      文章分类：{{category}}

      输出格式示例：
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
    quality_checks:
      - 字段顺序是否与示例一致
      - tags 是否全部使用英文
      - description 是否为一句话技术范围概括
      - outline 是否为 deep

  - name: OpeningStructureSkill
    display_name: 开篇三件套 Skill
    priority: P0
    description: >
      构建文章开篇的固定结构：H1 标题 + blockquote 副标题块 + ::: info 一句话 核心论点 + 详细目录。
      核心论点在开篇第一次出现，后续在每章 tip 和结语 blockquote 中反复呼应。
    best_for:
      - 文章开篇结构搭建
      - 确保核心论点在开篇明确写出
    input_requirements:
      - 文章标题
      - 副标题（技术范围）
      - 目标读者
      - 阅读时间
      - 核心论点（一句话）
      - 章节列表（用于生成 TOC）
    output_requirements:
      - H1 标题
      - blockquote 副标题块（含副标题、目标读者、阅读时间三行）
      - ::: info 一句话 容器（放核心论点）
      - 详细 TOC（每项带锚点，章节用中文序号"一、二、三"）
    prompt_template: |
      请为以下文章生成开篇三件套。

      要求：
      1. 第一行是 H1 标题（# {{title}}）。
      2. 紧接一个 blockquote 块，包含三行：
         > 副标题：{{subtitle}}
         >
         > 目标读者：{{target_readers}}
         >
         > 阅读时间：约 {{reading_time}}
      3. 然后是一个 ::: info 一句话 容器，放入核心论点：
         ::: info 一句话
         {{core_thesis}}
         :::
      4. 接着是 "## 目录" 标题，下面列出所有章节锚点：
         - 章节序号使用中文"一、二、三..."。
         - 每项格式：- [章节名](#锚点)
         - 锚点规则：中文保留、空格用连字符、标点去掉。

      核心论点：{{core_thesis}}
      章节列表：{{chapters}}

      输出完整的开篇 Markdown。
    quality_checks:
      - H1 是否唯一且在文档顶部
      - blockquote 是否包含副标题/目标读者/阅读时间三行
      - ::: info 一句话 容器是否在 blockquote 之后
      - TOC 锚点是否与章节标题对应
      - 章节序号是否使用中文一二三

  - name: ChapterPatternSkill
    display_name: 章节四件套 Skill
    priority: P0
    description: >
      规范每个正文章节的内部结构：问题框架引入 → 解释+示例（代码/Mermaid） →
      ::: tip 本节核心结论 → 可选 ::: warning 常见误区 / ::: info 工程启示。
      每章必有"本节核心结论"，warning 和 info 按需补充。
    best_for:
      - 正文章节内容组织
      - 保证每章都有明确结论与可选误区/启示
    input_requirements:
      - 章节主题
      - 章节核心结论
      - 是否需要反例/正例代码
      - 是否需要 Mermaid 图
      - 是否有常见误区
      - 是否有工程启示
    output_requirements:
      - 章节标题（## 一、xxx 或 ## 二、xxx）
      - 问题框架引入段（疑问句或对比）
      - 解释段落 + 代码块 + Mermaid 图（按需）
      - ::: tip 本节核心结论 容器（必有，1-2 句话）
      - ::: warning 常见误区 容器（可选）
      - ::: info 工程启示 容器（可选）
      - 章节之间用 --- 分隔
    prompt_template: |
      请按章节四件套规范编写以下章节。

      要求：
      1. 章节标题用 "## {{序号}}、{{章节名}}" 格式（如 "## 二、第一段等待：TTFB 之前，浏览器已经做了很多事"）。
      2. 开头用问题框架引入：以疑问句、对比或常见认知引入（如"很多人把 TTFB 简单理解为..."）。
      3. 中间是解释 + 示例：用段落、有序列表、代码块、Mermaid 图说明机制。
      4. 章节末尾必有 ::: tip 本节核心结论 容器，1-2 句话提炼核心观点。
      5. 按需追加 ::: warning 常见误区 或 ::: info 工程启示 容器。
      6. 章节之间用 --- 水平线分隔。

      章节主题：{{chapter_topic}}
      核心结论：{{core_conclusion}}
      常见误区：{{misconception}}
      工程启示：{{engineering_takeaway}}

      输出完整章节 Markdown。
    quality_checks:
      - 章节标题是否使用中文序号
      - 是否有问题框架引入段
      - ::: tip 本节核心结论 是否必有
      - 章节末尾是否用 --- 分隔
      - 是否避免无示例的纯文字章节

  - name: MermaidThemeSkill
    display_name: Mermaid 五色主题 Skill
    priority: P1
    description: >
      统一 Mermaid 图表的视觉体系：使用 %%{init}%% 自定义主题变量，
      五色分组（wait 蓝 / block 橙 / work 绿 / metric 紫 / core 深色），
      通过 classDef + class 给节点分组上色，字体使用 Inter, PingFang SC, Microsoft YaHei。
    best_for:
      - 任何需要 Mermaid 图的章节
      - 统一全文图表视觉风格
    input_requirements:
      - 图表类型（flowchart / mindmap / sequenceDiagram 等）
      - 节点分组（哪些属于 wait / block / work / metric / core）
      - 图表语义
    output_requirements:
      - 完整 Mermaid 代码块（带 ```mermaid 包裹）
      - %%{init}%% 主题变量声明
      - classDef 五色定义
      - class 节点分组
      - 节点文字使用中文
    prompt_template: |
      请按 Frontier Vault 五色主题规范生成 Mermaid 图。

      主题变量（固定）：
      %%{init: {'theme': 'base', 'themeVariables': { 'fontFamily': 'Inter, PingFang SC, Microsoft YaHei, sans-serif', 'primaryColor': '#F8FAFC', 'primaryTextColor': '#172033', 'primaryBorderColor': '#CBD5E1', 'lineColor': '#64748B'}}}%%

      五色分组（通过 classDef 定义）：
      - wait:   fill:#EEF6FF,stroke:#3B82F6,color:#172033,stroke-width:1.5px   （蓝，等待类）
      - block:  fill:#FFF7E6,stroke:#F59E0B,color:#172033,stroke-width:1.5px   （橙，阻塞类）
      - work:   fill:#ECFDF3,stroke:#22C55E,color:#172033,stroke-width:1.5px   （绿，工作类）
      - metric: fill:#F5E8FF,stroke:#A855F7,color:#172033,stroke-width:2px     （紫，指标类）
      - core:   fill:#172033,color:#fff,stroke:#172033,stroke-width:2px        （深色，核心节点）

      要求：
      1. 图表类型：{{diagram_type}}
      2. 节点分组：{{node_groups}}
      3. 节点文字使用中文。
      4. 用 subgraph 划分阶段时，subgraph 名使用中文。
      5. 至少区分 2 种颜色分组。

      输出完整 Mermaid 代码块。
    quality_checks:
      - 是否包含 %%{init}%% 主题变量
      - 是否定义了至少 2 种 classDef
      - 颜色值是否与五色规范完全一致
      - 节点文字是否为中文
      - 字体是否包含 PingFang SC 和 Microsoft YaHei

  - name: CodeExamplePairSkill
    display_name: 反例正例对照 Skill
    priority: P1
    description: >
      规范代码示例的呈现方式：反例与正例成对出现，反例用 "// 反例：xxx" 注释，
      正例用 "// 正例：xxx" 注释，代码块带语言标签，对照展示同一问题的错误写法和正确写法。
    best_for:
      - 涉及性能陷阱、写法对比的章节
      - Layout Thrashing / JIT 去优化 / GC 压力等场景
    input_requirements:
      - 反例代码
      - 正例代码
      - 反例说明（为什么错）
      - 正例说明（为什么对）
      - 语言标签（javascript / html / css / text）
    output_requirements:
      - 反例代码块（带 "// 反例：{{说明}}" 首行注释）
      - 正例代码块（带 "// 正例：{{说明}}" 首行注释）
      - 两块代码紧邻呈现，方便对照
    prompt_template: |
      请按反例/正例对照规范输出代码示例。

      要求：
      1. 反例代码块首行注释：// 反例：{{anti_pattern_description}}
      2. 正例代码块首行注释：// 正例：{{correct_pattern_description}}
      3. 反例在前，正例在后，紧邻呈现。
      4. 代码块带语言标签（```javascript / ```html / ```css / ```text）。
      5. 代码内容简短聚焦，只展示问题核心，不要冗长。

      反例代码：{{anti_code}}
      正例代码：{{correct_code}}
      语言：{{language}}

      输出对照代码块。
    quality_checks:
      - 反例与正例是否成对出现
      - 首行注释是否使用 "// 反例：" 和 "// 正例：" 格式
      - 代码块是否带语言标签
      - 代码是否简短聚焦

  - name: UnifiedModelDiagramSkill
    display_name: 统一模型汇总图 Skill
    priority: P1
    description: >
      在文章末尾生成统一模型章节，用 Mermaid flowchart 或 mindmap 汇总全文核心模型。
      图表应将全文散落的观点归并为统一框架，使用五色主题，体现核心论点与子模型的关系。
    best_for:
      - 长文收尾的模型汇总
      - 把多章节散点归并为统一思维框架
    input_requirements:
      - 全文核心论点
      - 子模型分组（如三组问题：等待/阻塞/重复工作）
      - 每组的子项
      - 每组对应的策略
    output_requirements:
      - 统一模型章节标题（如 "## 十七、统一模型：等待、阻塞、重复工作"）
      - Mermaid flowchart 或 mindmap，使用五色主题
      - 核心节点居中，子模型用 subgraph 分组
      - 每个子模型下连接策略节点
      - 文字说明三组问题的具体内容
      - ::: tip 本节核心结论 容器
    prompt_template: |
      请为以下文章生成统一模型汇总章节。

      要求：
      1. 章节标题：## {{序号}}、统一模型：{{model_name}}
      2. 开头一句话说明该图汇总全文核心模型。
      3. 使用 Mermaid flowchart TB 或 mindmap。
      4. 使用 Frontier Vault 五色主题（wait 蓝 / block 橙 / work 绿 / metric 紫 / core 深色）。
      5. 核心节点用 core 色（深色 #172033）。
      6. 子模型用 subgraph 分组，每组用对应颜色。
      7. 每个子模型下连接 1-2 个策略节点（用虚线 classDef）。
      8. 图后用 ### 子标题分别说明每组的具体内容。
      9. 章节末尾必有 ::: tip 本节核心结论 容器。

      核心论点：{{core_thesis}}
      子模型分组：{{sub_models}}

      输出完整章节 Markdown（含 Mermaid 代码块）。
    quality_checks:
      - 是否使用五色主题
      - 核心节点是否居中并用 core 色
      - 子模型是否用 subgraph 分组
      - 是否有策略节点
      - 是否有 ::: tip 本节核心结论
      - Mermaid 语法是否正确

  - name: PracticeChecklistSkill
    display_name: 分组实践清单 Skill
    priority: P1
    description: >
      在统一模型章节后生成分组实践清单章节，按主题分组（首屏资源设计 / JS 加载执行 /
      模块图治理 / 渲染管线 / Hydration / 运行时稳定性 / 多进程 IPC 等），
      每组用 ### 子标题，每项用 - [ ] task list 格式（依赖 markdown-it-task-lists 插件）。
    best_for:
      - 文章收尾的工程实践清单
      - 给读者可执行的检查项
    input_requirements:
      - 文章主题域
      - 实践分组（5-7 组）
      - 每组的检查项（3-6 项）
    output_requirements:
      - 章节标题（如 "## 十八、高级前端实践清单"）
      - 5-7 个 ### 子分组
      - 每项用 "- [ ] " 开头
      - 检查项措辞具体可执行（避免空泛）
    prompt_template: |
      请为以下文章生成分组实践清单。

      要求：
      1. 章节标题：## {{序号}}、{{section_title}}
      2. 分 5-7 个 ### 子分组，每组一个主题。
      3. 每项用 "- [ ] " 开头（task list 格式，不带 bullet point）。
      4. 检查项措辞具体、可执行、可验证（如"使用 fetchpriority='high'"而不是"优化图片"）。
      5. 每组 3-6 项。

      文章主题：{{topic}}
      分组建议：{{groups}}

      输出完整章节 Markdown。
    quality_checks:
      - 是否分 5-7 组
      - 每项是否以 "- [ ] " 开头
      - 检查项是否具体可执行
      - 是否避免空泛措辞

  - name: ClosingStructureSkill
    display_name: 收尾五件套 Skill
    priority: P0
    description: >
      规范文章收尾结构：统一模型章节 + 实践清单章节 + 结语（含 blockquote 强调核心论点） +
      FAQ（5 个左右真实问题）+ 来源（参考链接列表）。核心论点在结语 blockquote 中第三次出现。
    best_for:
      - 文章收尾结构搭建
      - 确保核心论点在结语中第三次呼应
    input_requirements:
      - 核心论点
      - 5 个左右 FAQ 问题及答案
      - 参考来源列表（标题 + URL）
    output_requirements:
      - 结语章节（## 结语：xxx）
      - 结语正文用哲学性总结，最后用 blockquote 强调核心论点
      - FAQ 章节（## FAQ），5 个 ### 问题，每题 2-4 句回答
      - 来源章节（## 来源），列出参考链接
    prompt_template: |
      请为以下文章生成收尾五件套中的结语、FAQ、来源三部分。

      要求：
      1. 结语章节：
         ## 结语：{{conclusion_title}}
         - 正文 2-3 段哲学性总结，呼应开篇核心论点。
         - 最后用 blockquote 强调核心论点（第三次出现）：
           > **{{core_thesis}}**
      2. FAQ 章节：
         ## FAQ
         - 5 个左右问题，每个用 ### 序号. 问题 格式。
         - 每题答案 2-4 句，覆盖真实搜索意图。
      3. 来源章节：
         ## 来源
         - 列出参考链接，格式：序号. 标题：[URL](URL)
         - 至少包含权威来源。

      核心论点：{{core_thesis}}
      FAQ 列表：{{faqs}}
      参考来源：{{sources}}

      输出完整收尾 Markdown。
    quality_checks:
      - 结语是否用 blockquote 第三次强调核心论点
      - FAQ 是否有 5 个左右问题
      - 每题答案是否 2-4 句
      - 来源是否包含可点击 URL
      - 三部分是否按结语 → FAQ → 来源顺序排列

usage_examples:
  - name: 生成一篇同风格的新性能文章
    input: |
      使用 workflow 全部 8 步，核心论点贯穿全文，
      三组问题模型组织章节，Mermaid 使用五色主题。
      适用场景：从零撰写一篇 Frontier Vault 性能模块长文。
  - name: 复用风格写一篇框架机制文章
    input: |
      使用 FrontmatterSpecSkill + OpeningStructureSkill + ChapterPatternSkill +
      MermaidThemeSkill + CodeExamplePairSkill + ClosingStructureSkill。
      跳过 UnifiedModelDiagramSkill 和 PracticeChecklistSkill（框架文章不一定需要统一模型）。
  - name: 只做风格校验
    input: |
      逐个 skill 的 quality_checks 检查现有文章是否符合 Frontier Vault 风格规范，
      输出问题清单与修改建议。

recommended_for_article:
  title: 现代前端性能的底层链路：如何减少关键路径上的等待、阻塞与重复工作
  core_thesis: 现代前端性能优化的本质，是管理关键路径上的等待、阻塞与重复工作。
  three_group_model:
    - 等待：TTFB / LCP / Hydration / 资源发现 / 数据请求
    - 阻塞：同步 Script / CSS 首次渲染 / JS 长任务 / GC 暂停 / 同步布局
    - 重复工作：重复布局 / 重复绘制 / 重复 Hydrate / 重复解析 / 重复请求
  mermaid_palette:
    wait: '#EEF6FF'      # 蓝
    block: '#FFF7E6'     # 橙
    work: '#ECFDF3'      # 绿
    metric: '#F5E8FF'    # 紫
    core: '#172033'      # 深色
  core_thesis_echo_points:
    - 开篇 ::: info 一句话 容器（第一次）
    - 每章 ::: tip 本节核心结论（贯穿呼应）
    - 结语 blockquote（第三次强化）
  chapter_numbering: 中文序号"一、二、三..."
  section_separators: 章节之间用 --- 水平线分隔
  code_pair_pattern: 反例在前（// 反例：xxx），正例在后（// 正例：xxx）
  containers_used:
    - '::: info 一句话（开篇核心论点）'
    - '::: tip 本节核心结论（每章必有）'
    - '::: warning 常见误区（按需）'
    - '::: info 工程启示（按需）'
  closing_sections_order:
    - 统一模型章节（Mermaid 汇总）
    - 实践清单章节（分组 task list）
    - 结语（blockquote 强调核心论点）
    - FAQ（5 个左右真实问题）
    - 来源（参考链接列表）
---
