# 架构规划与职责

## 先形成可实施的设计

在实现前用一份简明设计记录以下结果；项目已有对应文档时更新原文，不再创建平行规范。

| 决策 | 应写明的结果 |
| --- | --- |
| 身份与兼容 | plugin/component/package/Adapter/model 各自的值、来源、已有升级关系、API 范围 |
| 页面与状态 | 展示页、控制面板、设置、等待、离线、权限不足、数据异常、恢复/退出 |
| 数据契约 | 每项数据来自哪个状态资源/流、目标实例、字段校验、单位、坐标系、缺失语义 |
| 控制契约 | 每个按钮对应命令、参数、权限、超时、受理与终态、重复点击保护 |
| 生命周期 | 会话、状态端口、流端口、Worker、定时器、RAF、GPU 对象分别由谁创建/释放 |
| 构建与发布 | 精确依赖、本地模式、Worker 入口、geometry 来源、产物结构、CI 与版本策略 |
| 验收 | 无设备时可验证的部分，真实 Desktop、真机和发布必须补充的证据 |

## 职责边界

```text
Vue 页面 / 展示组件
  ├─ 低频 view-model：状态、参数、错误、命令进度
  ├─ 型号数据适配：单位、坐标、有效点与几何映射
  └─ PluginSession：唯一客户端、绑定上下文、句柄与生命周期
       └─ @dexpilot/plugin-sdk → Desktop Provider → 既有后端/Adapter/设备

宿主高频端口 → Worker 解码/校验 → 有界帧邮箱 → 渲染适配
                                               └─ @dexpilot/visualization
静态 geometry 清单/资产 ───────────────────────────┘
```

| 层 | 拥有的职责 | 不放入本层的内容 |
| --- | --- | --- |
| Desktop | 安装、信任、权限、可信实例绑定、后端连接、系统能力 | 新型号页面细节 |
| Plugin SDK | 浏览器通信、契约、公开控制辅助 | Electron 实现、后端凭据、型号解码 |
| visualization | 主题、公共 UI/图表、通用视口与几何工具 | SDK 调用、设备控制、录制、型号判断 |
| 插件 session/domain | 状态选择、命令终态、帧解码、业务与生命周期 | 直接访问后端或其他插件源码 |
| 插件 view | 数据展示、交互、用户反馈 | 在每个组件里各建客户端或 WebSocket |

设备运行库 `sdk` 组件与 npm `@dexpilot/plugin-sdk` 是两件事：前者可能是原生二进制运行依赖，由 Host/Adapter 使用；后者是前端浏览器客户端。不能把原生 SDK 打进页面，或由 iframe 启动进程。

## 推荐目录

按复杂度删减；这是插件内部模块，不引入新的 npm 包。

```text
plugin.yaml                  # 源清单，打包器补充哈希/源等安装信息
package.json / pnpm-lock.yaml / .npmrc
index.html / vite.config.ts / tsconfig.json
src/
  main.ts / App.vue / router.ts
  session/                   # client、上下文重绑定、资源所有权
  domain/                    # 设备字段校验、命令结果、能力与状态机
  composables/               # Vue 使用 session/domain 的薄连接层
  pages/ / components/       # 页面和本型号专用显示
  visualization/             # 业务帧到公共显示数据的转换
  workers/                   # 仅存在高频流时添加
  assets/ / styles/          # 本插件静态资源与必要样式覆盖
tests/                       # 领域测试、会话竞态与构建契约
integration/                 # 显式 Desktop/模拟宿主检查，可选
scripts/                     # 依赖切换、打包、版本/路径校验、上传
.gitlab-ci.yml
```

小型状态页可以只有 `device-state.ts`，不为满足目录树而制造抽象。已有 Vue 项目保持合理的原目录，先抽清接入边界。除用户授权创建的目标插件工程，不把现有模块顺便拆成额外仓库、公共包或 vendor 快照。

## 状态与资源设计

- 区分 waiting-host、unbound、subscribing、ready、offline、error；UI 展示的 ready 需要有效业务快照，订阅创建成功只说明端口可用。
- `instanceId`、Adapter、流实例、SN 与型号不是同一标识。根据可信上下文和目录映射，不能截断字符串或取第一台设备。
- `onContextChanged` 是局部 patch；合并上下文，绑定变化增加 generation，清空旧数据并重建资源。迟到请求只释放、不再更新页面。
- 暂停时停止渲染和高频工作；恢复时重建必要资源并确认当前代次。恢复页面不等于重启硬件。
- 录制/命令进行中明确退出策略，支持取消退出后恢复交互。自动恢复失败后提供手动重试；仍失败时能安全离开并重新打开。
- 清理错误不能阻止其余资源回收。记录失败并采用有界等待；浏览器卸载不会保证异步清理完成，宿主仍需兜底。

## 身份和依赖分开表达

`plugin.yaml.id` 是插件身份；`components[].id` 是宿主内组件；registry `package_id` 是独立制品身份；`adapters` 是运行适配器；`support_models` 是设备 registry 精确型号。已有项目以现行映射为准，新项目确定后写入一处身份配置供打包/上传共用，避免散落硬编码。

前端 npm 依赖在构建期解析；安装时组件/型号发行依赖由发布清单与宿主解析。不能让安装器执行 `npm install`，也不能把 `plugin.yaml` 的 API 兼容范围当作 npm 包版本。
