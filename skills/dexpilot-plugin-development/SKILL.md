---
name: dexpilot-plugin-development
description: 在从零创建 DexPilot 前端设备插件、把已有 Vue 项目迁移为插件，或规划插件架构、SDK 与 visualization 接入、本地源码和私有 npm 依赖、GitLab CI 及制品发布时使用。适用于前端插件工程，不用于新增后端协议或原生设备 SDK 实现。
---

# DexPilot 前端设备插件工程

交付可独立构建、可由 Desktop 加载、权限明确、资源可释放的设备插件工程。支持「新建」和「Vue 迁移」；已有功能修复只读取相关章节，不重新搭建整个工程。用户要求仅规划时交付设计；要求落地时继续实现并验证，已有授权不重复确认。

本技能自包含，可整体分享，不依赖作者电脑上的其他 Skill。基线与源码索引见 [references/baseline.md](references/baseline.md)；其中版本是核验快照，不是永久的最新版要求。

## 先确定工程契约

先读目标仓库 `AGENTS.md`、Git 状态、README、`package.json`、锁文件、Vite 配置、`plugin.yaml`、CI 和打包脚本。从实际代码或宿主契约提取以下信息；仅询问缺失且影响正确性的项，其余写明假设后继续。

| 项目 | 需要确定的内容 |
| --- | --- |
| 工作模式 | 从零新建、现有 Vue 迁移、局部修改，是否保留原独立网页入口 |
| 身份 | 插件 ID、前端 package ID、component ID、Adapter ID、registry 型号值；已有身份不随意改名 |
| 数据与控制 | 状态资源、实例选择、流 kind/subkind、帧协议、命令及终态、文件权限 |
| 依赖 | SDK/visualization 精确版本与实际 exports，Vue/ECharts/Three peer 范围，本地源码路径 |
| 运行与交付 | 目标 Desktop/Plugin API、前端组件 ZIP 或已有兼容包、几何组件、CI Runner、制品源和签名流程 |

未知设备协议不能用 F20 示例补齐。没有硬件协议时仍可完成工程、空态、授权状态页和明确标识的模拟测试；报告待接入项。

## 路径与按需阅读

1. **规划架构**：读 [references/architecture.md](references/architecture.md)，输出职责、目录、数据流、权限、依赖和验收计划；保持现有模块与发布边界。
2. **从零新建**：读 [references/new-plugin.md](references/new-plugin.md)，先完成最小状态页，再按真实能力加命令、流与几何。
3. **迁移已有 Vue**：读 [references/vue-migration.md](references/vue-migration.md)，保留可复用页面，以会话与数据接入层替换旧宿主耦合。
4. **依赖与本地联调**：读 [references/dependencies.md](references/dependencies.md)。可采用 [assets/local-dependencies.mjs](assets/local-dependencies.mjs)，配套 [scripts/dependency-mode.test.mjs](scripts/dependency-mode.test.mjs) 验证边界。
5. **SDK、生命周期与权限**：读 [references/sdk-api.md](references/sdk-api.md)。高频传感器再读 [references/device-data-processing.md](references/device-data-processing.md)。
6. **公共显示能力**：读 [references/visualization-api.md](references/visualization-api.md)，使用目标包实际公开入口。
7. **CI、打包与发布**：读 [references/ci-release.md](references/ci-release.md)，按目标工程落实 [assets/gitlab-ci.example.yml](assets/gitlab-ci.example.yml) 的命令契约。
8. **交付验证**：读 [references/verification.md](references/verification.md)，逐项说明证据与未覆盖范围。

## 不可遗漏的边界

- 页面运行在 `dxp-plugin://` 沙箱 iframe，只经 Plugin SDK 请求宿主设备能力；不读取 token、不调用 Electron/Node/原始 IPC、不直连设备 HTTP/WS。同源打包资源和宿主授权的几何 URL 可读取。
- SDK 管通信、公共契约与已公开的控制辅助；visualization 管业务无关显示。型号协议、单位、阈值、映射和页面流程在插件内；后端只读。不为复用另拆新包或 vendor 副本，除非用户明确授权。
- npm 精确版本始终写入 `package.json` 和锁文件；仅显式 `local-source` 使用本地别名。CI 和生产打包拒绝本地依赖，不能复制相邻仓库来让 CI 通过。
- 首个有效快照前显示等待/缺失；不把默认值写入设备。命令已受理、终态确认、收到真实数据分别判断。
- 设备切换、异步迟到、暂停、恢复、离开与卸载必须有所有权和释放策略；高频数组经 Worker/transferable/有界缓冲传递，不进入深度响应式状态。
- 插件发布标签只接受无 `v` 的 `x.x.x` 或 `x.x.x-test.N`，且与发布清单一致；普通提交/MR 只验证和 dry-run。版本规则、路径和不可变发布细节以 CI 章节为准。
- 本技能只定义开发方法。创建工程不自动授权 Git push、npm 发布、制品上传或替换用户正在使用的插件。

## 完成时交付

给出工程入口、身份与权限表、开发/生产/打包命令、依赖来源、CI 变量、实际测试结果和剩余接入项。区分静态核验、本地 registry 构建、Desktop 加载、Electron 模拟、真机、远端 CI、发布回读；不把一种证据写成另一种。分享本技能的方法见 [README.md](README.md)。
