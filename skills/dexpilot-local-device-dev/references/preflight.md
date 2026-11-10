# 预检与型号选择

## 路径与占用

先确认 workspace 是多仓集合还是单仓；逐仓查看 `git status --short`、当前 HEAD、README/AGENTS 和入口。用户已有的 backend 配置改动与未跟踪二进制可能正在使用，不更改、不当作本次产物。

取得 Node/pnpm/Go 的实际路径与版本。当前前端示例为 pnpm 11.5.1、Node 22.22.3，Go 版本由目标 `go/go.mod` 与 launcher 的 `go.mod` 分别约束。缺工具只补当前任务需要的工具，不自动全局升级。

启动前观察本次相关 PID、父子关系、可执行路径、cwd、监听端口与日志；macOS/Linux 可用 `lsof -nP -iTCP:<端口> -sTCP:LISTEN`，Windows 用 `Get-NetTCPConnection` 后核对 OwningProcess。不要输出完整环境、会话 token 或敏感参数。端口被占用时识别所有者，不能按端口杀进程。

记录三个独立目录：

1. **插件库**：安装的 modules、方案和 active 记录。
2. **Electron userData**：后端受管配置、日志与会话数据。
3. **Host 数据目录**：外部模式由 CLI/配置决定；托管模式默认 userData/backend。

设置 `DEXPILOT_PLUGIN_STORE_PATH` 不会同时隔离后端数据。首次启动后回读真实存储定位记录；存在定位/身份冲突时处理原记录，不创建替代空库掩盖问题。

## 型号映射

以下是基线映射，使用时仍读目标 plugin.yaml、registry 和后端 Adapter 自描述。选择器值不是通用型号转换规则。

| 开发选择器 | 前端仓库 | 插件 ID | Adapter 名 | 原生来源/边界 |
| --- | --- | --- | --- | --- |
| f20 | dexpilot-plugin-f20 | ai.yimu.tactile.f20 | f20_tactile | Go Adapter 短名 f20；TouchSensor SDK 以兼容声明为准 |
| f80 | dexpilot-plugin-f80 | ai.yimu.tactile.f80 | f80_tactile | Go Adapter 短名 f80；SDK 与 F20 是否共用必须核实 |
| f60 | dexpilot-plugin-f60 | ai.yimu.tactile.f60 | f60_tactile | Go Adapter 短名 f60；本型号 SDK/geometry |
| dmtac | dexpilot-plugin-dmtac | ai.yimu.tactile.dmtac | dm_tac_w2 | Python Adapter；SDK 可能内嵌，平台分开检查 |
| 无内置 selector | dexpilot-plugin-dexhand | ai.yimu.dexhand | yimu-dexhand | Go 短名 yimu-dexhand；以真实型号/包依赖为准 |

前端包 ID 不总是 plugin ID 加后缀；现有 F20/F80/F60 是 `ai.yimu.frontend.<model>`，已有 DexHand 是其历史身份。独立 frontend 的 package ID、源 component ID `exhibit` 和最终方案都要准确对应，不能批量替换。

F20/F60/F80 的 registry 型号使用精确 `f20/f60/f80`；历史 Solution.target.model 可能使用 F20/F60/F80，保留目标接口接受的值。戴盟、DexHand 不由此推导，不自动大小写转换。

## 必需输入清单

| 类别 | 输入与检查 |
| --- | --- |
| 前端 | 源码 checkout、package/plugin 版本、build:dev 实际模式、本地 npm SDK 与 visualization 源码或精确 registry 依赖 |
| geometry | 当前型号/分辨率的构建记录、清单、完整资产；不靠另一型号文件补齐 |
| Adapter | 本机目标可执行文件及资源、Adapter 名/协议版本、runtime.sdk_required、归档身份与 SHA-256 |
| 设备 SDK | 供应商原始入口、依赖库/模型、平台、启动与退出契约、runtime.entry/workdir/mode、完整校验清单 |
| Host | 明确二进制来源、build-info 或 Go build 信息、实际 --help、所需 flags、配置与状态目录 |
| Desktop | 源码入口、目标 launcher 与元信息、所用插件库、运行模式、后端地址 |

设备 SDK 不存在/平台不支持时，继续完成前端和可用的模拟检查，明确原生阻塞；不把 mock 声称为安装好了 SDK，也不把 SDK 名称相似的包互换。

## 私有依赖

npm 项目使用 `.npmrc` 中 `https://repository.yimu.info/repository/npm-group/`，`pnpm install --frozen-lockfile`。本地前端联调按该仓显式 build:dev 脚本选择源码，不将 package/lock 改成 link 以便启动。

Go 下载在进程环境中设置 `GOPROXY=https://repository.yimu.info/repository/go-group/`、`GONOPROXY=none`；保留现有精准的私有前缀及公共 sumdb 校验，不用 `go env -w` 改全局。已下载缓存不证明源当前可达。私有认证通过已有凭据机制提供，不写进命令、Skill 或日志。
