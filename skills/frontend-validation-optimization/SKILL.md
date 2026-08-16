---
name: frontend-validation-optimization
description: Use when validating frontend changes, testing rendered UI, debugging frontend runtime behavior, checking responsive layout/screenshots, reviewing code quality, or optimizing redundant React/TypeScript props, derived state, aliases, callbacks, and low-value wrappers.
---

# Frontend Validation Optimization

## 范围

- 用于前端改动后的验证、运行态排错、视觉/交互检查、console 日志检查、响应式检查和收尾复盘。
- 用于行为保持的小型优化：冗余 props、透传噪音、低价值派生状态、一跳别名、一跳 helper、Boolean 包装、callback wrapper 和 JSX 临时值。
- 若还没确定页面、组件、布局、状态 owner 或 UI 结构，先读 `frontend-development`；本 skill 只负责验证与优化治理。

## 验证闭环

- 先识别项目入口、脚本、路由、样式系统、测试命令和是否需要 dev server；不要套用其他项目命令。
- 先跑项目已有静态命令：类型检查、lint、单测；构建只在发布前、用户要求或排查构建问题时运行。没有脚本时说明缺口并选择最接近的替代检查。
- 需要 dev server 时，同一项目只保留一个前端服务进程；启动前查端口和进程归属，能复用就复用。临时启动的额外进程验证后停止。
- 批量重命名/搬迁文件（尤其是删除同名旧文件、创建同名新目录结构）后，dev server 的模块解析可能出现瞬时不一致；不能只用一次请求返回 200 就下结论，要对同一条导入链路重复请求几次，确认解析到的路径稳定一致再收尾；发现不一致时先 touch 相关文件触发重新 transform，再复查。
- 页面改动至少确认页面可访问、非空白、无框架错误覆盖、console 无相关 error/warn，核心交互有真实状态变化。
- 视觉或布局改动至少检查桌面和一个移动视口；重点看溢出、遮挡、竖排、错位、滚动陷阱、不可读文本、z-index 和动态内容导致的跳动。
- 参考驱动实现要对照布局比例、文案、颜色、密度、组件层级、交互状态和响应式表现；偏差先修再交付。
- 导出、保存、提交、删除、复核、支付、发布等高风险动作要验证确认态、成功态、失败/校验态和数据结果。
- Browser 插件可用时优先做浏览器运行态验证；不可用或连接失败时降级到 Playwright，并在最终说明降级原因。

## 优化方法

1. 先定位 owner：页面、组件、hook、model、共享类型或工具。
2. 用 `rg` 做定向候选搜索，再人工读上下文；不要只因为“只用一次”就删除。
3. 保持行为不变，除非用户明确要求功能变化；保留错误文案、异步顺序、hook 依赖、提交 payload 和状态时机。

优先移除：

- 只把值转交一跳的别名、无快照语义的 `const next = value`。
- 只调用另一个 parser/formatter、只读取单字段、只做空值兜底且没有独立业务语义的一跳 helper。
- 单次使用且直读同样清晰的 `Boolean(x)`、`!!x`。
- `rawX -> x.filter(...)` 这类无意义中间变量；需要类型收窄时用显式 type guard。
- 只为下一句 `if` 服务的临时 validation/result 变量，前提是内联后失败路径仍清晰。

必须保留：

- 命名业务规则、权限、流程状态、用户可见条件的变量。
- 多处用于 JSX、依赖数组、className、payload 构造或昂贵计算缓存的变量。
- 保留 mutation 前快照、避免旧闭包、缩窄 TypeScript 类型或稳定对象/函数身份的变量。

## Props 与回调

- 父级传真实源数据、稳定 domain 对象、必要外部选中态和必要业务动作；组件内部派生展示选项、摘要、数量、标签、禁用态和局部文案。
- 列表、筛选、排序组件优先接收源集合；能从源集合稳定计算的 `options` 不从父级传入。若选中态影响父级过滤结果、路由、请求参数或跨组件协作，则状态与变更回调仍由父级持有。
- 列表卡片优先接收 item，由卡片内部绑定 `onOpen(item)`、`onUse(item)`、`onDelete(item)` 等 item 级事件，减少 `.map` 中 callback wrapper。
- 字段组件可接收 `draft`、`field` 和通用 `onChange(field, value)`，由字段内部读值并绑定 DOM 事件。
- 不要把父级路由、条件渲染、React Query 失效、API payload 归属、业务流程编排移动进子组件。
- `className`、`variant`、`children`、slot 和 render props 是共享组件的合理扩展点；不要因为当前只有一个调用点就硬删。

## 常用扫描

```bash
rg -n "const (raw[A-Z]|has[A-Z]|is[A-Z]|can[A-Z]|show[A-Z]|should[A-Z]|current[A-Z]|selected[A-Z]|submitted[A-Z]|.+Summary|.+Config|.+Value)\s*=" src
rg -n "const .* = Boolean\(|const .* = !!|const .* = [A-Za-z0-9_?.]+;" src
rg -n "interface [A-Za-z0-9]+Props|type [A-Za-z0-9]+Props|function [A-Z][A-Za-z0-9]+\(" src
rg -n "on[A-Z][A-Za-z0-9]+=\{\(.*\) =>|[A-Za-z0-9]+=\"[^\"]+\"|[A-Za-z0-9]+=\{(true|false|0)\}" src
```

## 交付说明

- 最终说明改了什么、验证了什么、运行 URL 或关键路径、还剩什么风险；不要倾倒完整命令输出。
- 无法运行态验证时，明确未检验项、阻塞原因和替代检查。
