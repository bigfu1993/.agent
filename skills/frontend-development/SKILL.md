---
name: frontend-development
description: Use when designing or implementing frontend applications, React/Vue/Next/Vite pages, components, routing, state ownership, UI structure, styling, forms, interactions, responsive behavior, or prototype-to-code work.
---

# Frontend Development

## 核心原则

- 先读现状再改：读取项目 `AGENTS.md`、`package.json`、路由、入口组件、设计系统、样式方案、数据层、现有页面/组件/hooks/types/utils 和验证脚本。
- 先定位 owner：明确页面 owner、状态 owner、数据源、接口契约、复用组件、布局 owner、运行态验证方式，再开始改代码。
- 优先复用项目模式：沿用既有框架、目录、组件库、请求层、状态层、消息层、样式 tokens 和测试命令。
- 保持真实闭环：状态、权限、流程、归属、结果由后端契约、数据库、前端消费链路或可解释的本地 demo 状态闭环；不要用 toast、假按钮、缓存或 mock 代替真实结果。
- 最小完整单元交付：按可验证的功能切片完成，不扩大无关重构；删除/拆分前用 `rg` 查 imports、JSX、生成声明和 auto-import 暴露项。

## 工程结构

- 新建复杂前端应用时默认使用 React + Vite + TypeScript，除非项目已有框架或用户指定其他方案。
- 默认安装并配置 Tailwind CSS 与 Less；若项目已有样式系统，先沿用现有系统，再判断是否需要补齐 Tailwind/Less。
- Tailwind CSS 仅用于宽度、高度、margin、padding、文字大小 utility，例如 `w-*`、`h-*`、`min-h-*`、`max-w-*`、`m-*`、`mx-*`、`p-*`、`px-*`、`text-sm`、`text-[13px]`；能直接绑定 DOM 的新增或重构代码必须优先写到组件 `className`。
- 颜色、背景、布局关系、定位、display/flex/grid/gap、边框、圆角、阴影、字重、行高、状态样式、动画、伪元素、复杂选择器、第三方覆盖和业务语义样式统一使用 Less 文件维护，不写 Tailwind utility。
- Less 中不要把既有 `width`、`height`、`min/max-width`、`min/max-height`、`margin`、`padding`、`font-size` 机械批量替换为 Tailwind `@apply`；`@apply` 在 Less 预处理链路中必须先经构建产物和运行态截图确认不会残留到 CSS。
- 既有项目迁移尺寸/间距/字号时按组件 owner 逐步推进：先把可直接绑定 DOM 的属性迁到 JSX/TSX `className`，再删除对应 Less 声明；伪元素、复杂选择器、第三方覆盖和暂时没有 DOM 挂点的旧语义类可继续用原生 Less 声明，直到该组件被完整迁移。
- 新代码不要用 `@apply` 承接 Tailwind utility；若历史代码残留 `@apply`，必须检查 `dist` 或 dev CSS 中无 `@apply` 字面量后再交付。
- 默认配置全局 alias，至少将 `@` 指向 `src`；全局模块、全局组件和跨模块工具使用 alias 引用，避免深层相对路径。
- 默认使用路由切换页面；页面入口收敛到 `src/pages`，路由记录、layout 和页面组件保持清晰映射。
- 默认新增 `src/layouts` 维护页面布局、壳层和公共模块；layout 由 router/route config 选择和套用，思想参考 Vue 嵌套路由的父级 layout + 子页面 outlet。
- `src/pages` 只负责核心页面内容、业务状态编排和页面级数据消费；pages 禁止直接 import 并包裹 layout 组件，不维护全局导航、页头、侧栏、固定底部等公共布局。
- Layout 组件只负责区域关系、固定头/侧栏/滚动主体/底部操作区等布局职责，并通过 `children`、命名插槽、route meta 或显式 slot props 承载页面内容；不要把页面业务状态、领域判断或数据变更逻辑下沉到 layout。
- Layout 根组件只负责固定区域关系和插槽；与某个 layout 强绑定的业务壳层（topbar、sidebar、导航、操作栏、项目切换器等）作为该 layout 模块的业务子组件维护，例如 `src/layouts/<LayoutName>/components/`。
- 固定 layout 的壳层组件在 `src/layouts/<LayoutName>/index.tsx` 内部直接组合；router/route wrapper 只选择 layout、传页面 children/outlet、页面动作契约和确实可变的插槽，不 import 或传入固定 topbar/sidebar/header slot。若某 layout 的 topbar/sidebar 固定，对外只暴露真正可变的命名插槽，例如 `overlays`。
- 页面若需要为 layout 提供页面级操作区、浮层或辅助模块，优先暴露稳定数据/动作契约给 router，由 router/route wrapper 传给 layout；pages 不直接 import layout、layout slot、全局导航、页头或侧栏组件。
- 默认使用 auto-import 插件；Vite 项目优先选用 `unplugin-auto-import` 等生态成熟方案，并把生成的 TypeScript 声明写入 `types/`。
- TypeScript 为默认语言；手写 `.d.ts`、auto-import 声明、全局类型扩展和环境声明统一放入 `types/`。
- 所有 TS 类型声明统一迁移到根 `types/`：type/interface、Props、API 契约、domain 类型、布局/路由契约和全局扩展都不放在 `src` 页面、组件、api、layout 或 utils 内；业务代码只消费类型名。
- 使用 auto-import 接管所有 type 类型的显式引入：Vite 项目用 `unplugin-auto-import` 扫描 `types/*.ts` 并启用 `dirsScanOptions.types`，生成声明写入 `types/auto-imports.d.ts`；React 类型如 `ReactNode`、`RefObject`、`SVGProps`、`FormEvent` 也通过 auto-import 类型声明接管。业务源码中不要写 `import type ...`。
- 保持根组件克制：根组件只做 Provider、路由、登录态、全局请求/消息和跨模块组合；业务页面不要塞成单个巨型组件。
- 按业务模块组织页面；同域页面、局部组件、hooks、model、mock/demo 数据收敛到同一边界。
- 主页面文件使用小写命名，例如 `src/pages/dashboard.tsx`；组件文件使用大驼峰命名，例如 `UserTable.tsx`。
- 目录型模块主入口文件统一命名为 `index.ts`/`index.tsx`，不要使用与文件夹同名的主入口文件；目录内具体组件实现仍使用大驼峰命名，目录本身表达模块名。
- 文件名不要重复携带所在模块、父级目录或业务边界名；目录已经表达上下文，子文件只命名职责和角色，例如 `src/layouts/WorkbenchLayout/components/Sidebar.tsx`，避免 `WorkbenchSidebar.tsx`。
- 组件分为业务组件和全局组件：业务组件放在引用文件同级 `components/` 下，并使用 `./components/Xxx` 引用；全局组件放在 `src/components/` 下，并使用 `@/components/Xxx` 引用。
- 抽取组件前先判定长期 owner：页面私有组件归对应 page 的 `components/`，layout 强绑定壳层归对应 layout 的 `components/`，跨业务复用组件归 `src/components/`；router 只放路由、权限、重定向和 route wrapper 装配，不作为视觉业务组件 owner。
- 判定 owner 不能只看组件当前物理位置：用 `rg`/`Grep` 搜实际 import 方，若全部调用方都落在某个页面/layout 子树内，即使文件当前放在 `src/components/`，也要按真实调用范围收回该页面/layout；反之若要把组件移进某页面私有目录，先确认它现有的调用方是否都在该页面子树内，会不会形成"全局组件反向依赖某页面私有路径"，会的话先跟用户确认处理方案，不擅自移动。
- 一个模块内部随内容增多需要拆成多文件时，只有真正渲染 UI 的组件文件才进该模块的 `components/` 子目录；`model.ts`、类型、常量等纯逻辑支撑文件放模块根目录，不因为"也是被组件消费"就混进 `components/`。
- 页面私有组件/hook 放模块内；全局 hook、类型、纯工具放项目约定目录或共享包。
- HTTP 请求模块统一维护在 `src/api/`：Axios/request 实例、拦截器、错误解析、API domain 方法和后端接口适配放在 `src/api`，业务页面通过 `@/api/...` 调用；`src/utils` 不承载请求实例或接口调用封装。
- Vite 本地代理服务默认将 `server.host` 配置为 `0.0.0.0`，保证 `127.0.0.1`、`localhost` 和本机局域网地址都能访问同一 dev server；新增或调整 `server.proxy` 时必须在 `configure` 中记录代理请求、响应状态和错误日志，便于确认接口是否真实转发到目标服务。
- 结构化拆分：根 `types/` 放声明与稳定契约，`data/model` 放种子数据、domain 构造和业务归一化，`src/utils/tools` 放不包含业务语义的纯处理函数（如字符串/数值/日期/容量/CSV/深拷贝/clamp 等），组件只承接视图和局部交互。
- 局部组件、props/interface、内部工具函数也优先避免重复模块前缀；在模块边界内使用 `Sidebar`、`Topbar`、`WorkspacePane` 等职责名，在跨模块导出或全局组件确需消歧时再保留更完整命名。除非生成产物、发布约束或既有约定要求固定前缀。
- 依赖分组要干净：运行依赖放 `dependencies`，构建/类型/测试工具放 `devDependencies`；提交 `.gitignore` 覆盖 `node_modules/`、`dist/`、`*.tsbuildinfo` 等产物。

## React 与状态

- 状态靠近真实消费方；跨页面或跨模块状态用 Provider/Context/store，不要页面层重复透传。
- 业务数据查询默认按需懒加载：`enabled`/触发时机绑定真正消费该数据的路由匹配、tab 激活或组件挂载，不默认在根组件只用登录态一个开关把所有业务模块的查询一次性并发发起。除非用户明确要求"全局预加载"（说明预加载范围和收益，例如为减少切 tab 加载感、预热跨模块共享的高频数据），否则新增查询一律先问"当前路由/tab 是否真的需要这份数据"，不因为"根组件请求层已经在那儿了"就顺手把新查询也挂上去。
- 列表卡片/行的弹窗、开关态是否要提升到列表层，用"是否需要跨兄弟实例只保留一份"判断，不是"看起来像列表级功能"就默认提升：单实例、无需跨行协调的弹窗和 mutation 下沉到卡片自己内部；只有真正需要全列表共享唯一一份的（如同一个确认弹窗被任意一行触发）才留在列表层。
- 页面管业务编排，组件管展示与自身交互；无语义、无复用、无独立状态的外壳及时合并或抽成通用容器。
- 组件 props 以 owner 契约为准：父级传真实源值、稳定 domain 对象/集合、必要状态和动作回调；不要为了展示方便在入口文件维护 `xxxCount`、格式化文案、布尔中间态等无语义中间变量再逐层传递。
- 列表、筛选和排序组件优先接收源集合与必要外部选中态/回调；能由源集合稳定派生的选项、摘要、数量、标签和禁用态收敛在组件内部。若选中态会影响父级过滤结果、路由、请求参数或跨组件协作，则状态与变更回调仍由父级持有。
- 组件内部可以维护服务自身展示和交互的方法、变量、派生值和中间处理环节；对外只抛出稳定结果、事件或调用外部传入的必要 prop，不把组件内部处理链路拆成多层 props 让父级托管。
- 若某个派生值能由组件已拥有的源值稳定计算，且只服务该组件展示、禁用态或局部交互，则在组件内部计算；只有跨组件复用、影响业务流程或后端契约的派生结果才提升到页面、hook、model 或 shared util。
- 展示型组件优先接收可计算口径的源数据，例如 `rows`、`visibleRows`、`selected`、`statsSource`，由组件内部生成摘要、计数、空态、按钮 disabled 和文案；父级只负责提供数据来源和操作回调。
- 多处使用的统计、筛选、格式化和归一化口径必须抽到模块内 `data/model`、`utils` 或 hook 中复用，避免父子组件各自复制计算逻辑。
- 不把组件自有文案和布局顺序作为父级 props 传入；只有用户配置、业务差异、路由/权限/layout 契约或跨场景复用需要变化时，才将文案、slot 或 render 函数暴露为 props。
- 用 domain 类型约束事件、状态、枚举和接口结果；稳定状态值集中维护。
- 派生状态优先 render 期间计算；避免用 effect 同步可以直接推导的值。
- 事件修改状态时优先使用函数式 setState 或明确 snapshot，保证撤销/重做、异步计时器、拖拽等不会读旧闭包。
- 定时器、监听器、浏览器对象和临时 URL 必须清理；涉及 `localStorage` 时加稳定 key 和容错解析。
- 大型交互要有可检查状态：选中态、禁用态、草稿态、保存态、校验态、空态、错误态和成功反馈都要真实响应。

### Provider 文件边界

- Provider、其私有 Context 与对应消费 hook 默认属于同一项完整能力，应收敛在所属领域的单个 `provider.tsx` 中；不得只为形式分类新增 `provider/` 目录，或把 Context/hook 拆成与 Provider 并列的 `context.ts`。
- Context 实例保持文件私有，`provider.tsx` 对外只导出 Provider 组件和完成消费所需的 hook；业务调用方统一从该 Provider 文件导入，不得直接获得 Context、内部 state/setter、查询对象或装配细节。
- reducer、state machine、model 或查询编排只有在具备独立职责、可单独测试或被多处复用时才拆文件；Provider 真正演变为包含多个独立功能的子模块后才建立目录，不能把“每个标识符一个文件”当作拆分理由。
- Provider 只接收应用边界无法自行获得的最小依赖，领域查询、mutation、流程状态和派生动作收敛在文件内部；不得把 Provider 包装成庞大 props 转发层，也不得与页面、本地 hook 或其他 Context 并行维护同一份状态。
- Context 按订阅边界拆分，而不是按文件数量拆分；只有更新频率、消费方或权限边界明显不同的数据/命令才使用独立 Context。公开命令保持稳定引用，value 在能减少无关消费者更新时保持稳定身份。
- Provider 文件同时导出 Provider 与对应消费 hook 是单文件内聚的明确例外；不得仅为消除 Fast Refresh 边界提示拆文件。项目若启用 `react-refresh/only-export-components`，豁免必须精确限定到 Provider 文件，禁止全局关闭规则。

### 全局浮层与跨组件命令

- 先按作用域判断所有权：只服务单个卡片/页面且无需跨兄弟协调的弹窗保留在局部；需要跨页面触发、跨层关闭、同类互斥或全局唯一实例的弹窗/抽屉才进入全局 Overlay 架构。
- 全局 Overlay 默认分为四层职责：基础调度器只保存 `lane/type/targetId` 等最小可序列化状态；领域 Provider 拥有草稿、查询、mutation、反馈和流程编排；领域 Host 负责按状态组合真实组件；触发组件直接消费领域命令，不经根组件或中间组件逐层转发。
- 触发命令 Context 与 Host 数据 Context 默认拆分：触发入口只订阅稳定命令，Host 才订阅草稿、列表、提交状态和业务动作；公开命令用 `useCallback`、Context value 用 `useMemo` 保持身份稳定，避免编辑表单或查询刷新带动无关入口重渲染。
- Context 对外只接收完成动作所需的最小契约；只需要实体 ID 时不得传完整业务对象，只需要打开/关闭命令时不得暴露内部 setter、查询对象、mutation 实例或中间状态。
- 根组件只装配 Provider、Host 和确实跨应用边界的回调（例如导航、会话清理）；页面、卡片、底部导航和快捷入口在 Provider 范围内直接调用领域 hook，不在根组件创建一跳 handler 或聚合庞大 props 对象。
- 路由切换、角色切换和会话结束统一调用调度器的 `closeAll` 或按领域批量关闭命令；不得在多个调用方散落若干 `setIsXOpen(false)`，也不得让已迁移领域继续保留独立布尔开关作为第二状态源。
- 服务端业务数据以查询缓存为唯一来源：发布/提交成功后优先依赖 mutation 失效、精确刷新或明确的乐观更新；不得再维护一份仅为“立即展示”而存在的本地业务列表。确需乐观更新时必须定义回滚和与服务端结果对账策略。
- Provider 必须覆盖全部触发入口和对应 Host；全局 Host 只组合各领域 Host，不接收领域业务 props。涉及多个 lane 的流程用 reducer/state machine 表达互斥和转换，避免多个布尔值形成非法组合。

## UI 与交互标准

- 延续现有样式语言，保持紧凑、清晰、可扫描；业务应用第一屏必须可用，不做营销型落地页，除非用户明确要求。
- UI 文案聚焦当前操作，不堆功能说明；按钮、标签、提示语要服务当前工作流。
- 页面布局先定 owner：固定头、滚动主体、固定底部必须归属 `src/layouts` 中同一个 layout owner，并作为同级区域维护；外部按钮用稳定 `form` id 关联表单。
- 表单排序按风险和频率：必填、高频、高风险字段靠前；选填补充信息按含义聚合；同组字段高度稳定。
- 弹窗、侧拉和抽屉内的表单模块默认使用 small size 控件渲染：输入框、选择器、文本域、按钮、标签保持紧凑高度和小字号；需要大尺寸时必须有清晰业务理由，并同步检查桌面/移动视口不被撑开或截断。
- 弹窗类组件的文件和文件夹命名优先使用业务对象、`Modal`、`Overlay`、`Sheet` 等稳定 owner 名称，不把 `Dialog` 作为长期文件/文件夹后缀；标准可访问性属性值如 `aria-haspopup="dialog"` 保持语义正确。
- TSX/JSX 中每个 `div` 必须显式提供语义化 `className`；类名体现当前 owner 和元素角色，避免匿名 `div` 依赖父级或标签选择器，临时布局容器也要保留可检索类名。
- 输入内辅助动作优先轻量文字/图标；全局消息由根注册单例，业务代码直接调消息工具。
- 避免卡片套卡片；只在重复项、弹窗、明确工具面板中使用卡片。页面大区块优先用 full-width band、开放布局、列表、表格、轨道或画布。
- 使用稳定尺寸约束：固定格式控件、工具栏、时间轴、棋盘/网格、按钮、指标块、媒体 frame 要有明确宽高、aspect-ratio、grid tracks 或 min/max，避免 hover/文本/动态内容导致跳动。
- 文本必须适配移动和桌面：按钮、输入框、卡片、导航和表格文本不遮挡、不撑乱、不竖排；必要时使用 `white-space: nowrap`、换行策略或动态尺寸。
- 响应式不是事后补丁：至少考虑桌面、窄桌面和移动；移动端允许堆叠，但主流程仍应能访问和操作。

## 原型到代码

- 用户给出 prototype、截图、Figma 或既有页面时，将其视作已接受的设计规格；不要重新发明视觉方向。
- 先盘点原型结构、tokens、布局比例、交互脚本、数据模型、弹窗、快捷键、持久化和边界状态。
- 迁移时保留工作流而不是复制 DOM 脚本：把数据、类型、工具函数、组件和状态机拆开，让 React/Vue 接管状态驱动。
- 对模拟媒体、图表、时间轴、热力图等可视模块，使用代码原生结构实现；交互控件、表单、表格、导航和状态反馈必须是可操作 UI，不要交付静态截图。
- 原型若包含本地草稿、导出、撤销重做、筛选搜索、播放、拖拽、校验、复核等流程，应在实现中保留等价可验证行为，除非用户明确裁剪范围。

## 开发收口

- 开发实现完成后，使用 `frontend-validation-optimization` 做静态检查、运行态检查、视觉/交互验证、代码质量复盘和优化治理。
- 若任务本身是验证、排错、重构优化、props 收敛、冗余代码治理或性能/质量检查，直接使用 `frontend-validation-optimization`。
