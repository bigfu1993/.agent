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
- 项目用 `unplugin-auto-import` 等工具生成的类型声明文件（如 `auto-imports.d.ts`）通常带 `@ts-nocheck`，`tsc`/lint 不会检查它内部的导入路径是否还存在；重命名、移动、删除一个被自动导入覆盖的组件/函数后，dev server 往往只增量追加新条目，不会清理指向旧路径的失效条目，必须手动 grep 该文件确认旧名字/旧路径条目已清掉、新名字条目已存在，不能假设它会自愈。
- 页面改动至少确认页面可访问、非空白、无框架错误覆盖、console 无相关 error/warn，核心交互有真实状态变化。
- 视觉或布局改动至少检查桌面和一个移动视口；重点看溢出、遮挡、竖排、错位、滚动陷阱、不可读文本、z-index 和动态内容导致的跳动。
- Tailwind 工具类（尤其是颜色类）看起来没生效时，先查是否有更高选择器优先级的全局/嵌套 Less 规则（如 `.card-title svg { color: ... }`）覆盖了它；确认存在冲突时用内联 `style` 而不是继续加 Tailwind 类，内联样式优先级高于任何 class 选择器。
- 参考驱动实现要对照布局比例、文案、颜色、密度、组件层级、交互状态和响应式表现；偏差先修再交付。
- 导出、保存、提交、删除、复核、支付、发布等高风险动作要验证确认态、成功态、失败/校验态和数据结果。
- Browser 插件可用时优先做浏览器运行态验证；不可用或连接失败时降级到 Playwright；Playwright 也不可用、但目标 dev server 确认正在运行且已加载最新代码（对比进程启动时间和源文件 mtime）时，可降级为直接调用真实接口（如 curl 命中本地后端）验证返回数据和状态流转，仍需在最终说明里点明是接口级验证、未覆盖 UI 渲染。

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

## 全局浮层迁移验证

- 先验证 Provider 覆盖范围：所有触发入口与全局 Host 都必须位于对应 Provider 内；Context hook 在 Provider 外调用应有明确错误，不能静默返回空实现。
- 检查订阅边界：触发入口只消费稳定 Actions Context，不订阅草稿、查询结果或提交状态；Host 数据 Context 的变化不应导致底部导航、快捷按钮或列表卡片无意义重渲染。
- 检查最小契约：用 `rg` 搜打开/关闭回调、setter 和 Props，确认调用方只传 ID 或必要命令；删除根组件和中间组件中的一跳 handler、完整业务对象传递及庞大聚合 props。
- 检查单一状态源：迁移后搜索旧布尔开关、旧 controller/hook/组合组件、本地补丁列表和重复 mutation；服务端数据必须由查询缓存、失效或可回滚的乐观更新闭环。
- 为 lane 替换、按类型关闭、批量关闭、草稿确认到表单等关键转换补 reducer/state-machine 测试；至少覆盖同 lane 互斥、跨 lane 不误关和关闭后无残留状态。
- 删除或移动旧模块后，检查显式 import、JSX、类型文件和 auto-import 生成声明；带 `@ts-nocheck` 的声明文件必须单独搜索旧路径，不能用 `tsc` 通过替代。
- 运行态重复请求根组件、Provider、Host 和触发入口的完整导入链；浏览器可用时真实验证打开、关闭、切换、成功、失败和路由/会话清理，浏览器不可用时说明降级验证没有覆盖 UI 交互。

## 共享组件插槽化与批量迁移

给共享组件新增能力（插槽、可选 prop）并把散落在多个调用方的重复手写结构收敛进去时：

1. 新增能力做成可选、向后兼容：不传新 prop 时行为和渲染结果与改动前完全一致，未迁移的旧调用方不受影响，允许分批迁移而不是一次性全改。
2. 批量迁移前先逐个调用方读取真实用法，不能只看第一两个就套用统一模板；不同调用方常有细微差异（额外定位样式、多一行说明、嵌在别的插槽里等），要素齐了再定最终的共享组件 API 形状。
3. 删除某个调用方的专属类名前，先 `rg` 一下这个类名有没有自己的 Less/CSS 规则；很多"看起来专属"的类名其实只复用外层通用类、自身没有样式，可以安全删，但要逐个验证，不能凭经验批量假设。
4. 若某个调用方的专属样式（如表单滚动区域的 sticky 头需要 `position/z-index`）没法被新的通用结构覆盖，给共享组件加一个可选的 className 透传点承接差异，不要为了插槽化牺牲这类既有效果。
5. 大批量迁移收尾时，除了对改动文件跑 eslint，必须再跑一次整项目级别的 lint/typecheck；部分文件是显式 `import` 依赖而非走项目 auto-import，只有全量 lint 才能抓出这类文件里迁移后残留的未使用 import。
6. 全部迁移完成后做一次全仓库回归搜索：确认旧模式没有遗漏，同时人工甄别命中结果里是不是同名但语义不同的误报（比如同一个类名在别处是完全无关的用途），不能看到匹配就当成漏改。

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
