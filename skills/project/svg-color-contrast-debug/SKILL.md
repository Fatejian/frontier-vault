---
name: "svg-color-contrast-debug"
description: "Debugs and fixes SVG/Canvas text-color contrast issues (light-bg white-text or dark-bg dark-text). Invoke when text is unreadable on SVG diagram backgrounds, especially in Mermaid/D3/SVG-based charts with theme toggling or zoom/overlay features."
---

# SVG 颜色对比度调试与修复指南

> 从一次完整的 Mermaid 图表文字对比度调试会话中提炼的通用方法论，适用于任何基于 SVG 的图表/可视化场景（Mermaid、D3、SVG 图标等）。

---

## 一、问题识别

### 典型症状

| 症状 | 表现 | 常见场景 |
|------|------|---------|
| 浅色背景 + 白色文字 | 文字几乎不可见 | 深色主题下彩色节点 |
| 深色背景 + 深色文字 | 文字几乎不可见 | 浅色主题下默认节点 |
| 原页面正常，放大/弹窗后异常 | 遮罩/overlay 中文字颜色错误 | 点击放大、模态框展示 |

### 根因分类（按出现频率排序）

1. **背景形状类型未覆盖** — 检测逻辑只搜索部分 SVG 元素类型（如只查 `rect`，遗漏 `path`/`circle`/`ellipse`）
2. **DOM 未挂载时调用 getComputedStyle** — clone 的 SVG 在 `appendChild` 前调用颜色检测，`getComputedStyle` 返回空
3. **fill 来源多样未全覆盖** — SVG 的 fill 可来自 CSS 规则、inline style、presentation attribute，检测逻辑遗漏某种来源
4. **querySelector 只取第一个** — 容器内多个形状，第一个无 fill 但遮挡了后续有 fill 的形状
5. **透明度丢失** — `rgba(r,g,b,a)` 转 hex 时丢失 alpha 通道，导致半透明深色被当作全不透明深色

---

## 二、调试工作流（科学方法）

> 遵循「假设 → 插桩 → 证据 → 最小修复 → 验证 → 通用性增强 → 清理」的闭环。

### Step 1: 复现并备份 DOM

让用户在浏览器 DevTools 中，右键问题节点 → Copy → Copy outerHTML，保存到文件。

```
# 用户操作示例
DevTools → Elements → 选中问题节点 → 右键 → Copy → Copy outerHTML
# 粘贴到 backup/dom-snapshot.txt
```

### Step 2: 提出 3-5 个可证伪假设

基于 DOM 快照分析，列出假设：

```
假设 A: getEffectiveBgColor 未找到背景形状 → 回退到主题默认色
假设 B: 形状搜索选择器遗漏了 <path>/<circle> 等元素类型
假设 C: getComputedStyle 在未挂载 DOM 时返回空（放大遮罩场景）
假设 D: fill 仅存在于 inline style，无 fill 属性，检测逻辑遗漏
假设 E: rgba alpha 通道在转 hex 时丢失
```

### Step 3: 插桩收集运行时证据

在关键函数中注入日志（通过 Debug Server 或 console），记录：
- 搜索到的形状列表（tag、fill 属性、computedStyle）
- 每个形状的 fill 检测结果
- 最终返回的背景色和判断的 isDark 值

### Step 4: 确认根因

基于证据确认哪个假设成立，**不要凭猜测修复**。

### Step 5: 最小修复

仅针对确认的根因实施最小范围修改。

### Step 6: 多场景验证

**必须覆盖以下 4 个场景**（矩阵验证）：

| | 深色背景节点 | 浅色背景节点 |
|---|---|---|
| **原页面** | 应显示白色文字 | 应显示深色文字 |
| **放大/遮罩** | 应显示白色文字 | 应显示深色文字 |

### Step 7: 通用性增强

修复确认后，分析是否存在同类未覆盖的类型，一次性补全而非逐个修复。

### Step 8: 清理

移除所有插桩代码、停止 Debug Server、删除调试文件。

---

## 三、核心技术方案

### 3.1 SVG 形状背景检测——完整覆盖方案

#### SVG 规范中所有可填充图形元素

| 元素 | 用途 | 有 fill 区域 | 需检测 |
|------|------|-------------|--------|
| `<rect>` | 矩形 | ✓ | ✓ |
| `<circle>` | 圆形 | ✓ | ✓ |
| `<ellipse>` | 椭圆 | ✓ | ✓ |
| `<polygon>` | 多边形（菱形/六边形等） | ✓ | ✓ |
| `<path>` | 自定义路径（stadium 等） | ✓ | ✓ |
| `<use>` | 引用形状 | ✓（解析后） | ✓（防御性） |
| `<line>` | 直线 | ✗ | ✗ |
| `<polyline>` | 折线 | ✗ | ✗ |
| `<image>` | 图片 | ✗（用 href） | ✗ |

#### 推荐实现：命名常量 + 遍历 + shape-agnostic 兜底

```javascript
// ========== 形状选择器常量（统一管理，便于扩展） ==========
const BG_SHAPE_SELECTORS = 'rect, polygon, path, circle, ellipse, use'
const BG_SHAPE_SCOPE_SELECTORS =
  ':scope > rect, :scope > polygon, :scope > path, :scope > circle, :scope > ellipse, :scope > use'
const BG_SHAPE_TAGS = new Set(['rect', 'polygon', 'path', 'circle', 'ellipse', 'use'])

// ========== 获取形状的 fill（三级回退） ==========
function getShapeFill(shape) {
  // 1. getComputedStyle：反映 CSS class 覆盖（元素须已挂载 DOM）
  let computedFill = null
  try {
    computedFill = window.getComputedStyle(shape).fill
  } catch (e) {}

  if (computedFill && computedFill !== 'none'
      && computedFill !== 'transparent'
      && computedFill !== 'rgb(0, 0, 0)') {
    return rgbToHex(computedFill)
  }

  // 2. inline style.fill：未挂载 DOM 时 computedStyle 为空，inline style 仍可读取
  //    适用于 clone/overlay 场景（SVG 未 appendChild 前调用颜色检测）
  const inlineFill = shape.style && shape.style.fill
  if (inlineFill && inlineFill !== 'none' && inlineFill !== 'transparent') {
    return rgbToHex(inlineFill) || inlineFill
  }

  // 3. fill 属性：SVG presentation attribute
  const attrFill = shape.getAttribute('fill')
  if (attrFill && attrFill !== 'none' && attrFill !== 'transparent') {
    return attrFill
  }

  return null
}

// ========== 获取元素的有效背景色 ==========
function getEffectiveBgColor(el) {
  // 1. 定位最近容器（.node / .edgeLabel / .label 等）
  const container = el.closest('.node, .edgeLabel, .label, .cluster')

  if (container) {
    // 2. 搜索容器内所有背景形状（优先直接子元素）
    let shapes = container.querySelectorAll(BG_SHAPE_SCOPE_SELECTORS)
    if (!shapes.length) {
      shapes = container.querySelectorAll(BG_SHAPE_SELECTORS)
    }
    // 遍历所有形状，返回第一个有有效 fill 的
    // （避免无 fill 的 <rect> 遮挡后续有 fill 的 <path>/<circle>）
    for (const shape of shapes) {
      const fill = getShapeFill(shape)
      if (fill) return fill
    }

    // 2b. shape-agnostic 兜底：扫描 label-container 直接子元素
    //     防御未来引入新形状类型（不依赖元素类型，仅看是否有有效 fill）
    const labelContainer = container.querySelector('.basic.label-container, .label-container')
    if (labelContainer) {
      for (const child of labelContainer.children) {
        const fill = getShapeFill(child)
        if (fill) return fill
      }
    }
  }

  // 3. 向上逐级查找最近的背景形状
  let current = el
  while (current && current !== document.body) {
    if (BG_SHAPE_TAGS.has(current.tagName.toLowerCase())) {
      const fill = getShapeFill(current)
      if (fill) return fill
    }
    if (current.querySelector) {
      const direct = current.querySelector(BG_SHAPE_SCOPE_SELECTORS)
      if (direct) {
        const fill = getShapeFill(direct)
        if (fill) return fill
      }
    }
    current = current.parentElement
  }

  // 4. CSS background-color 回退（foreignObject 内的 div）
  // 5. 主题默认色回退
  // ... 根据项目需求实现
}
```

### 3.2 getComputedStyle 时机陷阱

#### 问题

```javascript
// ❌ 错误：clone 的 SVG 未挂载 DOM，getComputedStyle 返回空
const svgClone = svg.cloneNode(true)
autoTextColor(svgClone)  // getComputedStyle 在此失效！
document.body.appendChild(overlay)  // 挂载发生在之后
```

#### 解决方案

```javascript
// ✅ 正确：先挂载到 DOM，再调用颜色检测
const svgClone = svg.cloneNode(true)
document.body.appendChild(overlay)  // 先挂载
autoTextColor(svgClone)             // getComputedStyle 现在有效
```

#### 双保险

同时使用 `getShapeFill` 的三级回退（computedStyle → inline style → attr），即使元素未挂载 DOM 也能从 inline style 读取 fill 值。

### 3.3 遍历 vs querySelector

#### 问题

```javascript
// ❌ querySelector 只返回第一个匹配元素
// 如果第一个形状无 fill，会遗漏后续有 fill 的形状
const rect = container.querySelector('rect, polygon, path')
const fill = getShapeFill(rect)  // rect 可能是无 fill 的 <rect>，返回 null
// → 直接跳过，不再检查后续的 <path>/<circle>
```

#### 解决方案

```javascript
// ✅ querySelectorAll 遍历所有形状，返回第一个有有效 fill 的
const shapes = container.querySelectorAll('rect, polygon, path, circle, ellipse, use')
for (const shape of shapes) {
  const fill = getShapeFill(shape)
  if (fill) return fill  // 找到有效 fill 立即返回
}
```

### 3.4 rgba alpha 通道处理

```javascript
// ⚠️ 问题：正则只捕获 RGB，丢失 alpha
function rgbToHex(color) {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  // rgba(26,35,50,0.5) → #1a2332（丢失 0.5 透明度，变为全不透明）
}

// ✅ 修复：将 rgba 在页面背景上合成后再转 hex
function rgbToHex(color, pageBgColor = '#1a2332') {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (!match) return color
  let [, r, g, b, a] = match
  r = +r; g = +g; b = +b
  if (a !== undefined) {
    // alpha 合成：result = src * alpha + dst * (1 - alpha)
    const [bgR, bgG, bgB] = hexToRgb(pageBgColor)
    const alpha = +a
    r = Math.round(r * alpha + bgR * (1 - alpha))
    g = Math.round(g * alpha + bgG * (1 - alpha))
    b = Math.round(b * alpha + bgB * (1 - alpha))
  }
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}
```

---

## 四、验证清单模板

修复后必须逐项验证：

```markdown
## 对比度验证清单

### 原页面
- [ ] 深色背景节点 → 白色文字（可读）
- [ ] 浅色背景节点 → 深色文字（可读）
- [ ] edge label 文字 → 与标签背景对比度足够

### 放大/遮罩/弹窗
- [ ] 深色背景节点 → 白色文字（可读）
- [ ] 浅色背景节点 → 深色文字（可读）
- [ ] 放大后文字颜色与原页面一致

### 主题切换
- [ ] 切换主题后，所有节点文字颜色正确更新
- [ ] 多次切换主题无残留错误

### 不同图表类型
- [ ] flowchart（矩形/菱形/stadium/圆形/椭圆节点）
- [ ] sequenceDiagram（actor box）
- [ ] stateDiagram（起止圆形）
- [ ] classDiagram / erDiagram（矩形）
```

---

## 五、调试检查项

当遇到 SVG 文字对比度问题时，按以下顺序排查：

- [ ] **DOM 快照分析**：备份问题节点 outerHTML，确认背景元素类型（rect/polygon/path/circle/ellipse）
- [ ] **fill 来源确认**：fill 来自 CSS class、inline style、还是 attribute？
- [ ] **挂载时机检查**：颜色检测是否在元素挂载到 DOM 后调用？
- [ ] **选择器完整性**：形状搜索是否覆盖所有可能的 SVG 元素类型？
- [ ] **遍历 vs 取第一个**：是否遍历所有形状返回第一个有效 fill？
- [ ] **透明度检查**：rgba 值的 alpha 通道是否正确处理？
- [ ] **遮罩/clone 场景**：放大或弹窗中的 SVG clone 是否正确检测颜色？

---

## 六、适用场景

| 场景 | 典型库 | 常见问题 |
|------|-------|---------|
| 流程图/架构图 | Mermaid, flowchart.js | stadium/circle 节点背景遗漏 |
| 数据可视化 | D3.js, ECharts | 动态生成 SVG path/circle 未检测 |
| SVG 图标 | 自定义 SVG | 主题切换后文字颜色未更新 |
| 交互式图表 | Cytoscape, vis.js | clone/导出时颜色丢失 |
| 白板工具 | Excalidraw, draw.io | 形状类型多样，fill 来源复杂 |

---

## 七、经验总结

1. **不要逐个类型修复** — 发现 `path` 遗漏后，立即检查 SVG 规范中所有可填充元素，一次性覆盖
2. **用命名常量统一管理选择器** — `BG_SHAPE_SELECTORS` 等常量便于维护和扩展
3. **shape-agnostic 兜底是最后防线** — 不依赖元素类型，扫描 label-container 子元素
4. **getComputedStyle 必须在 DOM 挂载后调用** — 这是前端最隐蔽的 bug 之一
5. **inline style.fill 是未挂载元素的救星** — 作为 computedStyle 和 attribute 之间的回退层
6. **验证必须覆盖 4 个场景矩阵** — 原页面/遮罩 × 深色背景/浅色背景
7. **DOM 快照是最佳证据** — 让用户提供问题节点的 outerHTML 比口头描述精确 100 倍
