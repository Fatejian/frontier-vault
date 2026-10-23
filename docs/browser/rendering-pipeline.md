---
title: "渲染流水线：从 HTML 到像素"
description: 从 HTML 流式解析、CSSOM 构建、渲染树合成、布局计算、绘制分层到 GPU 合成的完整链路深度解析
category: Browser
tags:
  - Browser Internals
  - Rendering Pipeline
  - Performance
readingTime: 28 min
outline: deep
---

# 渲染流水线：从 HTML 到像素

很多工程师能背出 Layout、Paint、Composite 的顺序，却说不清一次具体的 DOM 修改会走到哪一步。问题不在于阶段名称，而在于每个阶段的触发条件和线程归属。本文把这些阶段还原成一条有输入、输出和跳过条件的链路，并用同一套判断解释 CSS 阻塞、渲染树差异与合成动画的代价。

::: info 一句话
渲染流水线的关键不是阶段数量，而是依赖关系：前一阶段的输出决定后一阶段能否开始，某些修改则可以跳过中间阶段。性能问题通常来自"本可跳过却被触发"或"触发范围被放大"。
:::

## 目录

- [先看六个问题](#先看六个问题)
- [一、渲染流水线全景图](#一、渲染流水线全景图)
- [二、HTML 流式解析与 DOM 构建](#二、html-流式解析与-dom-构建)
- [三、CSSOM 构建与 CSS 阻塞机制](#三、cssom-构建与-css-阻塞机制)
- [四、渲染树（Render Tree）合成](#四、渲染树-render-tree-合成)
- [五、布局（Layout / Reflow）计算](#五、布局-layout-reflow-计算)
- [六、绘制（Paint）与图层分层](#六、绘制-paint-与图层分层)
- [七、合成（Composite）与 GPU 加速](#七、合成-composite-与-gpu-加速)
- [八、每个阶段的性能瓶颈](#八、每个阶段的性能瓶颈)
- [九、不同 CSS 属性触发不同路径](#九、不同-css-属性触发不同路径)
- [十、实战：用 Performance 面板定位瓶颈](#十、实战-用-performance-面板定位瓶颈)
- [结语](#结语)
- [FAQ](#faq)
- [来源](#来源)

## 先看六个问题

同一段 DOM 或 CSS 修改，在不同属性上会走不同长度的链路。下面几个问题常被当作零散知识点记住：

- HTML 解析是流式还是一次性？预加载扫描器到底干了什么？
- CSSOM 是一棵树还是一张表？为什么 CSS 会阻塞首次渲染却不阻塞 HTML 解析？
- `display:none` 和 `visibility:hidden` 在渲染树里有什么区别？
- Layout 真的那么贵吗？为什么改一个 width 会让整页 reflow？
- Paint 和 Composite 之间到底隔了什么？为什么 `transform` 不触发 Layout？
- GPU 合成到底是怎么把多个图层拼到屏幕上的？

这些问题都可以从同一张依赖图推出来。

---

## 一、渲染流水线全景图

现代浏览器的渲染流水线（以 Chromium 为参考）可以简化为以下六个阶段：

```mermaid
flowchart LR
    subgraph Parse["① 解析阶段"]
        direction TB
        A1[HTML 解析器]
        A2[DOM 树]
        A3[CSS 解析器]
        A4[CSSOM]
        A1 --> A2
        A3 --> A4
    end

    subgraph Render["② 渲染树合成"]
        direction TB
        B1[Style 计算]
        B2[Render Tree]
        B1 --> B2
    end

    subgraph Layout["③ 布局"]
        direction TB
        C1[Layout Tree]
        C2[布局计算]
        C3[几何信息]
        C1 --> C2 --> C3
    end

    subgraph Paint["④ 绘制"]
        direction TB
        D1[Paint Record]
        D2[Layer 分层]
        D1 --> D2
    end

    subgraph Raster["⑤ 光栅化"]
        direction TB
        E1[Tile 切分]
        E2[光栅化线程]
        E3[GPU 纹理]
        E1 --> E2 --> E3
    end

    subgraph Composite["⑥ 合成"]
        direction TB
        F1[合成器帧]
        F2[GPU 合成]
        F3((屏幕像素))
        F1 --> F2 --> F3
    end

    Parse --> Render --> Layout --> Paint --> Raster --> Composite

    classDef wait fill:#EEF6FF,stroke:#3B82F6,color:#172033,stroke-width:1.5px;
    classDef work fill:#ECFDF3,stroke:#22C55E,color:#172033,stroke-width:1.5px;
    classDef block fill:#FFF7E6,stroke:#F59E0B,color:#172033,stroke-width:1.5px;
    classDef metric fill:#F5E8FF,stroke:#A855F7,color:#172033,stroke-width:1.5px;
    classDef core fill:#172033,color:#fff,stroke:#172033,stroke-width:2px;

    class A1,A2,A3,A4 wait;
    class B1,B2 work;
    class C1,C2,C3 block;
    class D1,D2 work;
    class E1,E2,E3 metric;
    class F1,F2,F3 core;
```

图中从左到右依次是解析、渲染树、布局、绘制、光栅化和合成。阅读时先看每个方框的输入输出，再注意跨阶段的箭头：解析产物决定渲染树，布局结果决定绘制内容，而光栅化和合成已经可以离开主线程。

每个阶段的输入和输出大致如下：

| 阶段 | 主要输入 | 主要输出 | 运行线程 |
| --- | --- | --- | --- |
| HTML 解析 | HTML 字节流 | DOM 树 | 主线程 |
| CSS 解析 | CSS 字节流 | CSSOM | 主线程 |
| Style 计算 | DOM + CSSOM | 每个 DOM 节点的最终样式 | 主线程 |
| Layout | Render/Style 树 + 几何约束 | 每个节点的位置和大小 | 主线程 |
| Paint | Layout 树 + 样式 | Paint Record（绘制指令列表）+ Layer 列表 | 主线程 |
| Raster | Layer + Tile | 像素位图（GPU 纹理） | 合成线程 + 光栅化工作线程 |
| Composite | 多个 Layer 的纹理 | 合成帧 | GPU 进程 |

::: info 关键认知

注意"主线程 / 合成线程 / 光栅化工作线程 / GPU 进程"的分工。**Layout 和 Paint 占用主线程**，因此会推迟 JS 和交互；**Raster 和 Composite 可以在主线程之外完成**，所以 `transform/opacity` 动画即使主线程被 JS 占满也能流畅。这是后续优化策略的共同依据。
:::

---

## 二、HTML 流式解析与 DOM 构建

### 1. 增量式解析

HTML 解析器不是等 HTML 全部下载完才开始工作的，而是**字节流到达即解析**。Chromium 把网络层收到的字节流交给 HTML 解析器，解析器一边消费字节、一边构建 DOM 节点。

这意味着：

- HTML 越早开始流式返回，DOM 越早开始构建
- 服务端可以分段返回 HTML（流式 SSR），让浏览器提前开始解析和发现子资源
- 大块 HTML 仍然会形成"Parse HTML"长任务

### 2. 预加载扫描器（Preload Scanner）

主解析器遇到 `<script src="...">`（无 defer/async）会被阻塞，但解析不会完全停住。**预加载扫描器**会在主解析器阻塞期间，继续向前扫描原始 HTML 标记，提前发现图片、CSS、JS 等资源并并行下载。

```html
<!-- 预加载扫描器能发现 -->
<link rel="stylesheet" href="/a.css">
<script src="/b.js"></script>
<img src="/hero.webp">

<!-- 预加载扫描器发现不了：要等 JS 执行后才知道 -->
<div id="root"></div>
<script>
  // 这里的图片必须等 JS 执行后才会被发现
  document.getElementById('root').innerHTML = '<img src="/late.webp">'
</script>
```

### 3. 阻塞点

HTML 解析阶段的主要阻塞点有两个：

- **同步 script**：阻塞 HTML 解析，等脚本下载并执行完成
- **CSS 阻塞 JS 执行**：如果脚本要操作 DOM 的样式，CSS 必须先加载完成。所以 CSS 不阻塞 HTML 解析，但可能阻塞 JS 执行

```mermaid
flowchart TB
    Start([HTML 到达]) --> Parse[主解析器流式构建 DOM]
    Parse --> MeetCSS{遇到 CSS 链接}
    MeetCSS -->|是| LoadCSS[并行下载 CSS]
    LoadCSS --> Continue1[继续解析 HTML]
    Continue1 --> MeetScript{遇到 script}
    MeetScript -->|无 defer/async| WaitCSS{CSS 是否就绪}
    WaitCSS -->|否| Wait[等待 CSS]
    Wait --> WaitJS[下载并执行 JS]
    WaitCSS -->|是| WaitJS
    WaitJS --> Continue2[继续解析 HTML]
    MeetScript -->|defer/async| Parallel[并行下载]
    Parallel --> Continue2

    classDef core fill:#172033,color:#fff,stroke:#172033,stroke-width:2px;
    classDef wait fill:#EEF6FF,stroke:#3B82F6,color:#172033,stroke-width:1.5px;
    classDef block fill:#FFF7E6,stroke:#F59E0B,color:#172033,stroke-width:1.5px;

    class Start core;
    class Parse,LoadCSS,Continue1,Parallel,Continue2,MeetCSS,MeetScript,WaitCSS wait;
    class Wait,WaitJS block;
```

图中从上到下是一条解析主线，右侧分支是遇到 CSS 或 script 后的等待路径。关键转折在 `WaitCSS`：CSS 不就绪时，同步脚本无法执行，HTML 解析也会停在这一步。

因此，首屏关键资源要尽早出现在 HTML 中，非关键 JS 则用 `defer` 或 `async` 移出解析主路径。

::: warning 常见误区

把 SSR 当成性能万能解。SSR 让 HTML 更早返回，但如果输出体积过大，或者把全部数据都塞进 HTML，Parse HTML 阶段反而会变长。流式 SSR 与关键内容前置通常更稳妥。
:::

---

## 三、CSSOM 构建与 CSS 阻塞机制

### 1. CSSOM 是什么

CSS 解析器把 CSS 文本解析成 **CSSOM（CSS Object Model）**。CSSOM 的结构与 DOM 类似，也是树形：选择器按嵌套关系组织，最终每个规则带一组样式声明。

CSSOM 之所以是树形，是因为 CSS 有继承和层叠：

- **继承**：`font-size`、`color` 等属性会从父节点继承
- **层叠**：多个规则作用于同一节点时，需要按优先级、特殊性、来源决定最终值

### 2. CSS 阻塞首次渲染

CSS 不阻塞 HTML 解析（解析器可以继续构建 DOM），但**阻塞首次渲染**。原因是浏览器要避免"先渲染无样式版本，再重绘成有样式版本"的闪烁（FOUC，Flash of Unstyled Content）。

### 3. CSS 阻塞 JS 执行

如果脚本要查询元素样式（如 `getComputedStyle`），CSS 必须先加载完成。所以 CSS 也会间接阻塞后续 JS 执行。

### 4. 媒体查询与不阻塞

`<link rel="stylesheet" media="print">` 不会阻塞首次渲染，因为浏览器知道它不适用于当前媒体。可以利用这个机制把非首屏 CSS 标记为不同 media，再在加载后切换：

```html
<!-- 非首屏 CSS：不阻塞首次渲染 -->
<link rel="stylesheet" href="/non-critical.css"
      media="print" onload="this.media='all'">
```

### 5. Style 计算阶段

DOM 和 CSSOM 都准备好后，浏览器进入 **Style 计算**阶段：

1. 对每个 DOM 节点，从 CSSOM 中找出所有匹配的规则
2. 按优先级、特殊性、来源排序
3. 计算最终样式（Computed Style）

Style 计算的成本取决于：

- DOM 节点数量
- CSS 规则数量
- 选择器复杂度（后代选择器、通配符选择器更贵）

这三项中，选择器复杂度最容易被忽视，因为它通常不会在单个组件里暴露，却会在节点规模变大后放大 Style 计算成本。

---

## 四、渲染树（Render Tree）合成

### 1. 渲染树 ≠ DOM 树

**渲染树（Render Tree）** 是 DOM 和样式信息的合并产物，但**只包含需要绘制的节点**：

- `display: none` 的元素**不在渲染树**里（不参与布局、不参与绘制）
- `visibility: hidden` 的元素**仍在渲染树**里（占位但不显示）
- `<head>`、`<script>` 等不可见元素不在渲染树里
- `::before`、`::after` 等伪元素会在渲染树里生成对应节点

### 2. Layout Tree 与 Render Tree

在 Chromium 的现代架构里，"渲染树"的概念被进一步细分为：

- **Layout Tree**：参与布局的节点，每个节点对应一个 LayoutObject
- **Paint Layer**：参与绘制的图层单元
- **Graphics Layer**：合成器能独立处理的合成层

Layout Tree 的构建规则大致是：

```text
对 DOM 树中每个节点：
  如果它生成盒子（有 box，比如 display 不是 none）
    则为它创建 LayoutObject
  否则跳过
```

### 3. 关键启示

理解了渲染树与 DOM 的区别，就能解释很多现象：

- 为什么 `display: none` 切换比 `visibility: hidden` 切换更贵：前者要重新构建渲染树并触发完整 Layout，后者只触发 Paint
- 为什么大量 `display: none` 节点会拖慢初始渲染：它们虽然不绘制，但 DOM 解析、Style 计算阶段仍要处理
- 为什么虚拟列表能优化长列表：从源头减少 Layout Tree 的节点数

因此，控制 DOM 规模和减少不必要的渲染树节点，比事后优化 Layout 更根本。

---

## 五、布局（Layout / Reflow）计算

### 1. Layout 做什么

Layout 阶段根据渲染树和视口约束，计算每个节点的**几何信息**：位置（x, y）、尺寸（width, height）、z-order、相对父节点的关系等。

Layout 是一个递归过程：从根节点开始，根据盒模型约束逐层向下计算。父节点的尺寸可能依赖子节点（如 `height: auto`），子节点的尺寸也可能依赖父节点（如 `width: 50%`），所以 Layout 经常需要多轮迭代。

### 2. Layout 的代价

Layout 是渲染流水线里最贵的阶段之一，原因：

- 全局性：一个节点的尺寸变化可能影响整页布局
- 多轮迭代：弹性布局、自适应布局可能需要多次计算才能收敛
- 同步执行：在主线程上同步完成，无法被 Worker 加速

### 3. 增量 Layout

浏览器不会因为一个节点变化就重排整页。Chromium 会做**增量 Layout**：标记脏节点（dirty mark），只重新计算受影响的部分。

但增量 Layout 的边界并不总是和开发者直觉一致：

- 改一个 `width` 可能影响兄弟节点和父节点
- 改 `font-size` 可能影响整页文本回流
- 改一个浮动元素的位置可能影响后续所有内容

### 4. 强制同步布局（Forced Synchronous Layout）

JS 读取布局属性时，如果之前有未消化的样式修改，浏览器会被迫**立即执行 Layout**才能返回正确值。这也是[布局抖动](/browser/layout-thrashing)的根源。

常见的"会触发 Layout 的读取"包括：

```javascript
element.offsetWidth / offsetHeight / offsetTop / offsetLeft
element.clientWidth / clientHeight / clientTop / clientLeft
element.scrollHeight / scrollWidth / scrollLeft / scrollTop
window.getComputedStyle(element)
element.getBoundingClientRect()
window.scrollX / scrollY / innerWidth / innerHeight
```

因此，优化 Layout 的方向始终是减少触发次数和缩小影响范围，而不是记住一份"昂贵属性清单"。

::: warning 常见误区

"我把动画做成 transform 就不会触发 Layout 了，所以可以随便用。" —— `transform` 不触发 Layout 没错，但 `will-change: transform` 滥用会创建大量合成层，反而增加内存和合成成本。
:::

---

## 六、绘制（Paint）与图层分层

### 1. Paint 做什么

Paint 阶段不直接产生像素，而是产生**绘制指令列表（Paint Record / Display List）**：在哪个坐标画什么颜色、什么矩形、什么文字、什么图片，按什么顺序。

Paint Record 是一系列绘制指令，类似：

```text
drawRect(0, 0, 100, 100, #ff0000)
drawText("hello", 10, 50, font=...)
drawImage(hero.webp, 0, 200, 800, 600)
```

这些指令的顺序很重要，因为后画的会覆盖先画的（painter's algorithm）。

### 2. 图层（Layer）分层

Paint 阶段不只是把整页画成一张大图，而是会**根据层叠上下文切成多个图层**，每个图层独立产生 Paint Record。

会触发新图层的常见原因：

- 有 3D 变换：`transform: translateZ(0)`、`translate3d`
- `position: fixed`、`sticky`（在某些浏览器里）
- `opacity < 1`
- `will-change: transform / opacity`
- `<video>`、`<canvas>`、WebGL 元素
- 有 `z-index` 且不是 auto 的定位元素

每个图层会进一步被切成小的 **Tile**（瓦片），交给光栅化线程并发处理。

### 3. Paint 的代价

Paint 的成本主要来自：

- 绘制区域大小（重绘面积）
- 绘制复杂度（阴影、模糊、渐变、滤镜）
- 图层数量（每个图层都要单独生成 Paint Record）

`box-shadow: 0 0 50px rgba(0,0,0,0.5)` 这种大面积模糊阴影非常贵，因为浏览器要么用 CPU 软件模糊，要么用 GPU 多次采样。

控制重绘面积和绘制复杂度，通常比单纯增加图层更直接。

---

## 七、合成（Composite）与 GPU 加速

### 1. 合成做什么

合成阶段把多个已经光栅化的图层按正确顺序、正确变换拼到一起，最终输出到屏幕。

关键点：合成主要由**合成线程与 GPU 进程**完成，主线程不参与。所以只要动画只改 `transform` 和 `opacity`，即使主线程被 JS 占满，合成线程和 GPU 仍然能继续推进动画。

### 2. 合成层（Compositing Layer）

如果一个图层被提升为**合成层**，它会有自己独立的 GPU 纹理，可以被 GPU 直接变换和合成，不需要主线程参与。

提升为合成层的常见触发条件：

- 3D 变换
- `<video>`、`<canvas>`、WebGL
- `will-change: transform / opacity`（前提是真有动画）
- `position: fixed` + 软件合成
- 被动画的 `transform / opacity`

### 3. GPU 加速的正确理解

"GPU 加速"常被当成一个统一开关，实际它指不同的优化方式。最常见的含义是：**某个图层被提升为合成层，它的变换和透明度变化由 GPU 直接处理，不触发 Layout 和 Paint**。

不是所有"GPU 加速"都好：

- 每个合成层都要占用 GPU 内存
- 大量合成层会让合成阶段本身变慢
- `will-change` 滥用会导致内存爆炸

合成与光栅化都可以离开主线程，但新图层、新动画的启动仍要主线程参与；这决定了优化能走多远。

::: warning 常见误区

给所有元素加 `will-change: transform` 或 `transform: translateZ(0)` 来"开启 GPU 加速"。这会导致大量合成层被创建，反而拖慢合成阶段并消耗内存。`will-change` 应该在有动画即将开始时加上、动画结束后移除。
:::

---

## 八、每个阶段的性能瓶颈

各阶段的常见瓶颈与可观察信号如下：

| 阶段 | 常见瓶颈 | 优化方向 | 性能面板标记 |
| --- | --- | --- | --- |
| HTML 解析 | 同步 script 阻塞、HTML 体积过大 | 用 defer/async、流式 SSR | 蓝色 Parse HTML |
| CSS 解析 | CSS 文件大、规则多 | 关键 CSS 内联、非关键 CSS 异步 | 蓝色 Parse Stylesheet |
| Style 计算 | DOM 节点多、选择器复杂 | 减少 DOM、简化选择器 | 紫色 Recalculate Style |
| Layout | 频繁触发、强制同步布局 | 避免 R/W 交错、动画用 transform | 紫色 Layout |
| Paint | 大面积重绘、复杂效果 | 控制重绘范围、避免大阴影模糊 | 绿色 Paint |
| Raster | 图层大、Tile 多 | 控制图层尺寸、避免长列表整层光栅化 | 绿色 Rasterize |
| Composite | 合成层过多 | 谨慎使用 will-change | 绿色 Composite Layers |

### 一个典型的"全线重做"反例

```javascript
// 反例：一次操作触发完整流水线
function updateList(items) {
  const list = document.querySelector('.list')
  list.innerHTML = ''  // 触发 DOM 重建
  items.forEach(item => {
    const li = document.createElement('li')
    li.style.width = list.clientWidth + 'px'  // 触发强制同步布局
    li.style.boxShadow = '0 0 30px rgba(0,0,0,0.3)'  // 复杂绘制
    li.textContent = item.name
    list.appendChild(li)
  })
}
```

这段代码每次调用都会触发：DOM 重建 → Style 重算 → 强制 Layout → Paint → Raster → Composite，且在循环中重复触发。优化思路：

1. 用 DocumentFragment 批量构建 DOM
2. 先读 `clientWidth`，再批量写
3. 把阴影做成静态背景或用 filter（合成层）

先回答问题，再选优化手段；颜色块只是线索，不是结论。

---

## 九、不同 CSS 属性触发不同路径

这是渲染流水线最实用的知识：**修改不同 CSS 属性会触发不同长度的流水线**。

```mermaid
flowchart TB
    Start([修改 CSS 属性]) --> Class{属性类别}

    Class -->|width/height/top/left<br/>margin/padding| Layout
    Class -->|color/background<br/>box-shadow/border| Paint
    Class -->|transform/opacity<br/>filter| Composite

    Layout[触发 Layout] --> Paint2[Paint]
    Paint2 --> Raster2[Raster]
    Raster2 --> Composite2[Composite]

    Paint[触发 Paint] --> Raster3[Raster]
    Raster3 --> Composite3[Composite]

    Composite[只触发 Composite]

    classDef core fill:#172033,color:#fff,stroke:#172033,stroke-width:2px;
    classDef wait fill:#EEF6FF,stroke:#3B82F6,color:#172033,stroke-width:1.5px;
    classDef block fill:#FFF7E6,stroke:#F59E0B,color:#172033,stroke-width:1.5px;
    classDef work fill:#ECFDF3,stroke:#22C55E,color:#172033,stroke-width:1.5px;
    classDef metric fill:#F5E8FF,stroke:#A855F7,color:#172033,stroke-width:1.5px;

    class Start core;
    class Class wait;
    class Layout block;
    class Paint,Paint2,Raster2,Raster3,Raster work;
    class Composite,Composite2,Composite3 metric;
```

图中从属性类别分出三条路径，越往下游走链路越短。阅读时注意：`transform/opacity/filter` 不是"不触发任何阶段"，而是通常只落在 Composite；具体仍取决于元素是否已是合成层。

### 1. 触发 Layout 的属性

凡是会改变元素几何信息的属性，都会触发 Layout：

- `width`、`height`
- `margin`、`padding`
- `top`、`left`、`right`、`bottom`
- `font-size`、`font-family`、`line-height`
- `float`、`clear`
- `text-align`（影响文本流）
- `display`

### 2. 只触发 Paint 的属性

不改变几何信息，但改变视觉表现的属性：

- `color`、`background-color`
- `border-color`
- `box-shadow`、`text-shadow`
- `background-image`
- `border-radius`

### 3. 只触发 Composite 的属性

- `transform`
- `opacity`
- `filter`（部分情况下）

这类属性作用在合成层：浏览器不需要重新计算布局，也不需要重新生成绘制指令，只需要在合成时改变变换矩阵或透明度。

因此，动画优先用 `transform` 和 `opacity`；但前提是元素处于合成层，且没有同时修改其他会触发 Paint 的属性。

csstriggers.com 列出了每个 CSS 属性在主流浏览器中触发的渲染阶段，可作快速参考；实际行为还会受合成层提升与增量 Layout 影响。

---

## 十、实战：用 Performance 面板定位瓶颈

### 1. 录制步骤

1. 打开 DevTools → Performance 面板
2. 启用 CPU 4× slowdown（模拟低端设备）
3. 启用网络节流（可选）
4. 点击录制 → 操作页面 → 停止

### 2. 颜色对应关系

| 颜色 | 阶段 | 含义 |
| --- | --- | --- |
| 蓝色 | Parse HTML / Parse Stylesheet | 解析阶段 |
| 紫色 | Recalculate Style / Layout | 样式和布局 |
| 绿色 | Paint / Raster / Composite | 绘制和合成 |
| 黄色 | Evaluate Script / Function Call | JS 执行 |
| 红色 | 长任务 | 主线程被占用 >50ms |

### 3. 典型问题模式

- **Parse HTML 后接长 Evaluate Script**：同步 script 阻塞解析
- **连续紫色 Layout 块**：布局抖动，可能强制同步布局
- **大量绿色 Paint 块**：重绘面积过大或效果太复杂
- **黄色长任务 + 红色三角**：JS 占用主线程，影响交互（INP）
- **Composite Layers 很贵**：合成层过多

### 4. Rendering 标签页

DevTools → More tools → Rendering 提供：

- **Paint flashing**：高亮重绘区域
- **Layout Shift Regions**：高亮布局抖动区域
- **Layer borders**：显示合成层边界
- **FPS meter**：实时帧率

定位时先看最长的那段事件，再确认它是主动触发还是被资源阻塞间接触发；Rendering 标签页用于验证，而不是替代判断。

---

## 结语

把渲染流水线重新理解为一张依赖图，而不是六道依次执行的工序：解析决定输入何时可用，Style 决定每个节点匹配什么规则，Layout 把树变成几何，Paint 与 Raster 把几何变成像素，Composite 把像素送到屏幕。每类修改只是在这张图上点亮不同的节点。

下一步，拿一次真实的交互录制 Performance：先看最长的事件属于哪一段，再确认它是被业务代码主动触发，还是被资源阻塞间接触发。把优化动作对应到具体节点，比记住"少用这个属性"更可复用。

---

## FAQ

### 1. `defer` 和 `async` 为什么仍可能拖慢首屏？

两者都避免脚本阻塞 HTML 解析，但脚本下载完成后仍要在主线程执行。`defer` 按顺序在解析结束后执行，`async` 则可能在任意时刻执行并打断其他任务；如果脚本本身很重，仍会占用主线程，推迟首次渲染或后续交互。它们改变的是调度时机，不是执行成本。

### 2. Style 计算和 Layout 有什么区别？

Style 计算回答"每个节点最终应用哪些 CSS 值"，输出是计算样式；Layout 回答"这些值对应什么几何位置和尺寸"，输出是盒子在页面上的位置。修改颜色通常只需要重新计算 Style 和 Paint，不需要 Layout；修改宽度则可能同时影响两者。

### 3. 修改 `transform` 为什么有时仍触发 Paint 或 Layout？

`transform` 本身通常只影响合成阶段的变换矩阵，但如果元素不在合成层、同时修改了其他几何属性，或者变换导致内容需要重新绘制（例如改变 3D 变换后的可见面），仍可能触发 Paint 甚至 Layout。看到"用了 transform"不能直接推断"只走 Composite"。

### 4. 增量 Layout 能保证只重排局部吗？

不能保证。增量 Layout 会尽量缩小范围，但一个节点的变化可能影响父节点、兄弟节点或后续文本流，具体取决于盒模型、浮动、字体和依赖关系。它能减少成本，但不是"改一个节点就只重算一个节点"的承诺。

### 5. CSS 选择器复杂度对性能影响大吗？

多数场景下影响有限，因为现代浏览器的样式匹配已经很快。但当 DOM 节点上万、CSS 规则很多时，复杂选择器（尤其是长链后代选择器和通配符）会让 Recalculate Style 明显变慢。优先用类名，避免 `div ul li a` 这类依赖深层结构的写法。

---

## 来源

以下资料可直接支撑文中的机制与工具说明：

1. Chromium Graphics 架构文档：[https://source.chromium.org/chromium/chromium/src/+/main:docs/graphics/](https://source.chromium.org/chromium/chromium/src/+/main:docs/graphics/)
2. web.dev 渲染性能系列：[https://web.dev/articles/rendering-performance](https://web.dev/articles/rendering-performance)
3. CSS Triggers：[https://csstriggers.com/](https://csstriggers.com/)
4. Chrome DevTools Performance 面板文档：[https://developer.chrome.com/docs/devtools/performance/](https://developer.chrome.com/docs/devtools/performance/)
