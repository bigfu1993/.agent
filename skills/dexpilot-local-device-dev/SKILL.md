---
name: dexpilot-local-device-dev
description: 在本地启动 DexPilot Desktop 与 dexpilot Host、为指定型号装配或安装本地前端插件、Adapter、设备 SDK 和几何组件，并验证联调与安全退出时使用。支持 Desktop 托管 Host 和独立外部 Host；不用于插件功能开发、正式发布或后端重构。
---

# DexPilot 本地设备联调

把选定型号的本地组件接到真实开发 Desktop 与 Host，分别确认安装、激活、后端注册和设备数据。用户只要求写说明时不启动服务；要求启动/安装时完成已授权操作，不因本技能再增加逐步审批。

本技能可整体分享，不要求接收者安装其他 Skill。版本与已知差异见 [基线](references/baseline.md)；所有路径以接收者实际 checkout 为准。

## 先收集，后启动

读工作区/仓库规范、Git 状态、package scripts、后端 `docs/BUILD.md`/CLI、实际 Host `--help`、选定型号清单、当前进程和端口。只询问无法从文件或现有会话确定的项目：

| 输入 | 必须区分 |
| --- | --- |
| 型号与设备 | 开发选择器值、registry 型号、插件 ID、Adapter 名、实例 ID、SN 各自独立；不猜型号大小写 |
| 启动模式 | 已有 Host 继续外接；需要从 Desktop 统一启停则使用托管模式；不同时启动两份 Host |
| 组件来源 | 本地前端源码、几何输出、已构建 Adapter、供应商设备 SDK 或内嵌 SDK 的 Adapter |
| 平台与目录 | 本机 OS/arch、实际入口、独立插件库、Electron userData、Host 状态/录制目录 |
| 操作范围 | 仅打开/观察，或还要连接设备、启动采集；已有明确授权持续有效 |

「SDK」须明确是前端 npm `@dexpilot/plugin-sdk`、Go `adaptersdk`，还是设备运行 SDK。本任务涉及三者，但它们不能相互代替。前端 npm SDK 安装成功不能证明设备 SDK 可用。

## 执行路径

1. [预检与型号选择](references/preflight.md)：确认目录、版本、平台、占用和原生组件来源。
2. [构建与启动 Host](references/backend.md)：按当前构建入口准备 Host/Adapter，决定托管或外部运行；后端源码与原有配置默认只读。
3. [装配与安装本地组件](references/components.md)：前端/geometry 可开发链接；Adapter/设备 SDK 用本地校验包，形成完整型号开发方案。
4. 用 [scripts/verify-local-solution.mjs](scripts/verify-local-solution.mjs) 对方案 dry-run：只读、无网络、不执行组件、不安装；读取目标 Desktop 的实际校验器。再通过其安装器写入明确的开发库。
5. [启动 Desktop](references/desktop.md)：显式绑定同一插件库与隔离 userData；托管时由 Desktop 拉起 Host，外接时先确认 Host 健康。
6. [验证、恢复与退出](references/verify-recover.md)：核对实际窗口、后端会话、原生准备/准入、设备与数据链路；失败给出恢复路径。

## 关键约束

- 仅操作选定型号与已确认目录。保留 dirty worktree、标定、用户配置、License、认证与运行中的其他会话；不 reset/clean/stash，不全局 kill。
- `pnpm dev:plugins --plugin <selector>` 当前只处理已登记的前端与几何；不是完整原生安装命令。自行组装完整方案后，不再用同名纯前端准备命令覆盖它。
- 当前原生运行链拒绝 `link:` Adapter/SDK，即使开发方案 Schema 允许本地链接。原生组件需 `file:` 的不可变 `.dxc` 或 `component-zip`；设备 SDK 当前运行 Manager 使用 `component-zip`。
- 托管 Host 的候选目录与准入目录由 Desktop 生成。不得手改 active.json、复制文件进现有 modules 或手工覆盖 admission/current 来绕过哈希、权限、准备和事务。
- 后端读取/构建/启动属于本地联调；不借此修改 Go 源码、覆盖原配置、添加用户、重置密码、关闭鉴权或导入 License。需要配置差异时在独立运行目录创建副本，保留原文与未知字段。
- 当前托管启动继承 Desktop 用户与权限，不主动提权/降权。OS 设备权限、相机授权和供应商 SDK 支持仍需实际确认，不用 sudo 或禁用安全检查绕过。
- 只在明确开发进程中允许未签名开发方案；不给安装版放宽信任。创建/安装开发包不授权 Git push、远端发布或替换正式安装版。

## 交付结果

汇报实际路径与命令、Host/Desktop PID 与端口、配置/插件库位置、型号各组件身份/版本/平台、安装/激活/SDK 准备/Host 注册/设备挂载/真实数据分别的结果，以及如何停止和再次启动。目录存在、HTTP 200、active.json 或模拟帧均不能单独代表真机可用。
