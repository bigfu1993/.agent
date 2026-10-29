# 将已有 Vue 项目迁移为插件

目标是保留可复用 UI 和业务规则，把独立网页/Electron 的接入方式改成宿主授权接口。先盘点、后分阶段改造，不整仓复制一个旧型号来替换现有页面。

## 盘点与替换表

可先搜索 `axios|fetch\(|WebSocket|EventSource|electronAPI|ipcRenderer|node:|localStorage|createWebHistory|import.meta.env|new Worker|setInterval`，再按调用语义判断；静态模型 fetch 不属于后端直连。

| 旧能力 | 插件内替换方式 | 验收点 |
| --- | --- | --- |
| HTTP 轮询设备状态 | `client.state.subscribe` + 字段校验 | 状态资源、实例、缺失语义一致 |
| 直接 WebSocket / socket.io | `client.stream.open` + Worker，或低频状态资源 | kind/subkind、ACK、流释放与重连 |
| Electron / preload / IPC | SDK 已公开方法 | 找不到等价能力时记录 Provider 缺口，不加入 Node polyfill 绕过 |
| 页面持有 token / 登录 | 宿主认证与可信上下文 | 移除插件内后端凭据读取、刷新与存储 |
| axios 控制按钮 | `command.call` / 已发布 SDK 控制辅助 | 权限、参数、业务终态、超时不盲目重发 |
| 本地文件 API | `file.saveText` / chooseDirectory / revealPath 等实际能力 | 权限、取消语义、路径归属；没有任意文件读写 |
| localStorage 设置 | UI 临时状态可保留；宿主持久配置用 `config.*` | 配置 scope/兼容迁移，默认值不自动下发硬件 |
| history 路由 | hash/内存路由 | iframe 内导航、刷新、懒加载不产生 404 |
| `/assets`、`/api`、CDN | 相对打包资源 / SDK / geometry 清单 URL | `dxp-plugin://` 下全部依赖可加载 |
| 自建公共图标/图表/滚动容器 | visualization 对应已发布入口 | 替换时保留业务语义与交互，不强制重画全部 UI |
| 高频数组 Pinia/ref/reactive | Worker + 普通缓冲 + 低频指标状态 | 低内存增长、背压、丢帧可控 |
| 全局单例、window 事件 | session 内所有权与注销 | 多页面/多设备/反复挂载互不串数据 |

## 迁移阶段

1. **基线**：记录现有启动/构建命令、页面截图与关键交互；检查 dirty 状态。保留当前功能入口和数据样例的来源。
2. **建立接入缝隙**：把直接网络与 Electron 调用集中到插件内的 session/service 接口，保持页面 props/events 与领域函数；只对必要部分重构。
3. **静态宿主页面**：引入精确依赖、Manifest、相对路径与路由，先在 Desktop 显示原页面的空态。提前暴露 CSS、懒加载、CSP、字体/Worker 路径问题。
4. **真实状态**：改为 SDK ready/context/state，绑定实例并防止迟到事件污染新设备；移除自动 mock 回退、旧状态轮询和重复认证流程。
5. **写操作与流**：逐个迁移命令、文件和高频数据。每完成一种能力，核对 Manifest 权限与业务终态；不一次开放全部权限。
6. **生命周期与公共显示**：接入 suspend/resume、beforeLeave、释放与 WebGL 恢复；接入 visualization，保持型号算法在本地模块。
7. **独立交付**：生产构建与测试只使用 registry 依赖；验证包内资源、CI dry-run、隔离安装与 Electron 行为。成功迁移的旧接入代码再删除，避免双路控制。

## 是否保留独立网页

用户需要双端时，共享页面/domain，按入口注入 `DesktopSession` 与已有 `WebSession`；两者在当前工程内实现。生产插件入口只包含 DesktopSession，测试 mock 只进入显式预览入口。用 bundle/网络检查证明旧 HTTP/WS/Electron 路径未进入插件运行链路，不仅用运行时 if 隐藏。

用户只需要插件时，完成等价迁移后移除旧宿主依赖。Vue 2、Nuxt SSR 或深度依赖 Electron 的项目需单列兼容工作：当前 visualization 是 Vue 3.5 peer，不能直接挂入 Vue 2，也不能把服务器路由当作插件页面。先说明范围并利用现有授权推进可独立的改造。

## 回归重点

- 首次打开、未绑定、离线、状态异常、设备 A→B→A、快速关闭、订阅迟到。
- 原有按钮/设置/图表的业务结果与单位；校准和录制的离开保护。
- 懒加载页、字体、模型、Worker、WASM 在 `dxp-plugin://` 内加载。
- 旧页面不会同时维持原 WebSocket 和新 stream；卸载后所有订阅/端口/计时器释放。
- mock 与生产数据来源清晰；缺失字段显示「—」或异常，不能补 0 冒充采集值。

完成时给出迁移映射表：原能力 → 新 SDK 方法/模块 → 权限 → 验证结果 → 尚缺宿主能力。不要只报告「页面可以打开」。
