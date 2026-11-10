# Host 与原生组件的构建、启动

## 选择所有者

| 模式 | 谁启动/停止 Host | 原生组件如何生效 |
| --- | --- | --- |
| Desktop 托管开发 | Desktop launcher；`DEXPILOT_BACKEND_EXECUTABLE` 指向本地 Host | 从已安装完整方案校验，生成候选与准入视图，准备 SDK 后扫描 |
| 外部独立 Host | 用户或本任务创建的终端/进程 | 自己维护配置、插件式扫描根、SDK 依赖与重扫；Desktop 不生成或管理该 Host 的运行视图 |

已有服务优先复用匹配实例；若要验证全套安装与准备流程且没有既定外部服务，优先托管。不要为了套流程关闭用户已有的外部 Host。

## 构建当前 Go Host / Adapter

当前 Make 从 `dexpilot` 仓库根调用，先读 `make help`、`docs/BUILD.md`。只构建选定产品与 Adapter，例如：

```bash
# cwd 为 dexpilot 仓库；只编译，不运行服务。
GOPROXY=https://repository.yimu.info/repository/go-group/ GONOPROXY=none \
  GO_PRODUCTS=host GO_ADAPTERS=f60 VERSION=local-dev make go-build
```

当前输出为 `go/dist/<GOOS>-<GOARCH>/local-dev/bin/host/dexpilot[.exe]` 与 `bin/adapters/f60/f60[.exe]`，附 build-info.json。Go 使用 darwin/arm64、windows/amd64 等；插件 target 使用 macos-arm64、windows-amd64，不要混淆路径格式。不因只改前端去运行全部构建/全仓测试。

普通 build 不装设备 SDK、不生成完整组件 ZIP、不启动服务。`VERSION` 标记 Host 工件版本，不自动修改 Adapter Meta 或设备 SDK 版本。`go-build-local` 会额外写旧 go/bin，非本流程默认操作。

对实际要执行的文件运行 `--help`。当前源码支持 `--adapter-dirs`，不代表磁盘上旧 go/bin 或仓库根二进制也支持；缺 flag 时选择当前构建，不猜参数、不回退到另一种目录布局。

后端只读边界允许编译生成物，不允许借机改源码、生成已跟踪协议或覆盖 go/config.integration.yaml。已有用户改动保留，构建结果记录源码 dirty 状态。

## Python Adapter 与设备 SDK

戴盟等 Python Adapter 不在 Go 短名清单内。阅读它自己的 README/packaging 与 BUILD：按本机 Python、独立 venv、锁文件、供应商 SDK 输入执行 prepare/env-check/build；prepare 是显式安装依赖步骤，generate 可能修改生成文件，先核对范围，不为启动而全仓重生成。

基线戴盟 macOS ARM64 仅支持 source sim/H5，真实 SDK/冻结路线为原生 Linux/Windows amd64；不把 Windows 包拿到 Mac 执行。onefile 可以内嵌 Python、SDK 与模型，此时外置 sdk 组件可能不适用，应记录「SDK 已内嵌」并校验真实包，而非人为制造空 sdk/。

TouchSensor 等供应商 SDK 保持完整结构，入口由 runtime.json 声明。已知 F60 专用 `scripts/package-f60-sdk.mjs` 可把受支持的原始 .run/.cmd 包装为校验 ZIP；只适用于其定义的平台和版本格式，不拿来处理任意供应商。读参数声明后使用，不猜通用 --sdk-dir 命令。

## 外部 Host：独立配置与扫描根

从明确的开发/集成模板复制到本次运行目录，保留原文件。检查并修正副本中所有绝对 storage/episode/frame/event 路径、显式 adapters、instances 自动挂载、SDK executable 和端口；`--data-dir` 不覆盖已有绝对路径或非空 storage_path。不能只改一个 data-dir 就声称已隔离。

两类扫描布局：

```text
平铺 Adapter 根：adapters/<目录>/<唯一入口和资源>       → --adapter-dir
插件式根：plugins/<条目>/adapter/<入口和资源>
                       /sdk/<SDK 完整目录>           → --adapter-dirs
```

外部模式自行在任务运行目录装配真实目录和副本，保留权限与完整资源，不写 Desktop 的受管视图。源码目录可作输入，但与已安装模块区分；若需要测「完整安装」，先通过隔离方案安装器校验归档，再从验证后的记录定位载荷用于外部运行副本。每次重建 Adapter/SDK 先确认旧实例已停，不原地覆盖运行中的文件。

```bash
# 以下变量由本次实际路径填写，不复用示例端口，先核对占用。
"$HOST_BIN" --config "$RUN_CONFIG" --endpoint 127.0.0.1:8080 \
  --data-dir "$HOST_DATA" --adapter-dirs "$LOCAL_PLUGIN_ROOT"
```

这个前台进程收到 SIGINT/SIGTERM 后按生命周期关闭。保存 PID、命令、日志和子进程身份；需要后台保持时用有会话 ID 的终端/进程管理，不使用无记录的 nohup 或进程名批量清理。

当前源码语义：

- `--adapter-dir` 在 flags 内累加，整体覆盖 YAML adapter_paths。
- `--adapter-dirs` 与 YAML adapter_plugin_paths **取并集**，去重；启动隔离配置必须检查旧根，否则可能加载旧 SDK。基线 CLI 文档此处有过时的「覆盖」描述，以 `internal/config/adapter_env.go` 和测试为准。
- 显式 `adapters` 声明、其他扫描根和自动 instances 仍可能加载其他设备；不得遗漏。
- Host 为相应 Adapter 将同级 sdk 目录前置到 PATH，并将已验证 runtime.entry 传为 DEXPILOT_SDK_ENTRY；无声明时保留旧的默认查找。Host 不独立启动所有 SDK，Adapter 是否消费该环境、怎样启动、附带参数与退出仍以真实实现为准；不能仅凭 PATH 判定 SDK 已启动。
- 不存在 `--plugin-dir`、`--sdk-dir` 这种通用启动参数；只有实际 help 证实的 flag 可用。

## 托管 Host：由 Desktop 启动

构建并验证 Host 后，不另开它。检查 Desktop 的 `resources/host-launcher/<node-platform>-<node-arch>/` 入口与 launcher-release.json；需要时从 Desktop 执行 `pnpm build:host-launcher`，遵守该工具链。现有 launcher 不一定等于当前源码版本，不能只检查文件存在。

由 Desktop 启动时设置 `DEXPILOT_BACKEND_EXECUTABLE`；宿主生成 userData/backend/host-runtime.yaml 与 host-compat.yaml，使用自身端口选择和扫描根。它不直接消费你手里的任意 config.integration.yaml；如需要相同参数，先在隔离 userData 中准备经核对的受管源配置，不能编造一个 BACKEND_CONFIG 环境变量。

托管模式默认优选 51880，冲突时可能改用空闲端口；以本次运行状态为准。健康与登录握手分开，登录失败不重启健康 Host，也不替用户创建账号或禁用鉴权。
