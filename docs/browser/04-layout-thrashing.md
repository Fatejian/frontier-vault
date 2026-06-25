# 布局抖动的真相：Layout Thrashing 如何搞垮你的动画

## 一句话总结
在循环中交替读写布局信息，会迫使浏览器反复执行强制同步布局，造成严重的性能卡顿。

## 坏例子与好例子
*(粘贴我们最早讨论的那段代码，并解释区别)*

## 什么是强制同步布局（Forced Synchronous Layout）
- 正常流程：JS → Style → Layout → Paint → Composite
- 读属性（如 offsetWidth）时，如果前面有样式修改，浏览器会强制提前计算布局
- 用 Chrome DevTools Performance 面板演示

## 如何识别与诊断
- Performance 面板中的 Layout 事件（紫色块）
- Rendering 选项卡中的 Layout Shift Regions
- 关键指标：FPS 下降、INP 变差

## 常见触发场景
- 循环里调整元素尺寸 + 读取父容器
- 响应式组件中频繁 getBoundingClientRect
- 第三方库的 DOM 操作

## 解决方案与最佳实践
- 读-记-写模式（先批量读，再批量写）
- 使用 requestAnimationFrame 编排
- CSS 动画代替 JS 动画
- 现代框架的批量更新机制（React 的 Fiber）

## 关联阅读
- [[03-渲染流水线：从HTML到像素]]
- [[05-绘制与光栅化]]
- [[03-渲染性能避坑指南]]