# 装配和安装完整本地型号

## 先辨认格式

| 输入 | 正确用途 |
| --- | --- |
| 前端 dist-dev | 页面构建结果，还不是已激活插件 |
| development.json | 特定 Desktop 准备脚本的输入，不是通用安装格式 |
| module.json + payload/ | 可用于前端/geometry 的开发链接，或标准模块 .dxc |
| runtime.json + files.json + 载荷的组件 ZIP | 当前 Adapter/SDK/前端/geometry 组件格式；不能再外包一层目录 |
| Solution 2.0 JSON/YAML | 一次安装的完整平铺依赖，开发模式允许 file/link |
| plugin-install-set | 旧原生安装集；当前仅支持 adapter，不是 Adapter+SDK 完整型号方案 |

优先沿用当前组件与 Solution 安装器。前端、Adapter、SDK、geometry 放入同一完整方案，使共享依赖和启用关系可验证；不向 active.json 人工追加字段。

## 1. 构建所选前端和几何

安装选定前端、npm SDK、visualization 各仓锁定依赖后，先构建本地 npm SDK 的生成契约，再运行前端实际 `build:dev`。各仓模式名字可能不同：F20/F60 等现有脚本使用 development，上一份通用模板用 local-source，不能强行统一命令。

先检查 Desktop 准备脚本是否接受本次版本：基线 F20 的 1.0.0-test.1 与 F60 的 0.1.5-test.8 会被外层纯三段版本判断拒绝，**这两者应直接 build:dev 后按下文手工装配模块/方案**，保留原版本。只有已登记且满足该版本脚本输入约束时，才可从 Desktop 执行以下便捷入口：

```bash
DEXPILOT_DEV_PLUGINS_DIR="$DEV_ROOT/frontend-preparation" \
  pnpm plugins:dev --plugin f60
```

这会构建并激活**前端/geometry 专用的临时准备库**，输出 `dev-linked-solutions/` 与 `dev-plugin-store/`。用不同目录把它与最终完整型号库分开，防止以后重新准备纯前端时覆盖原生方案。脚本会在准备库接受生成的权限集，执行前确认目标插件来源/权限在本次授权范围内。

基线仅 f20/f80/f60/dmtac 有内置选择器。脚本还有固定身份、组件来源目录与版本形状要求；遇到版本 suffix 或自定义目录被拒绝时，不能为了联调擅自改产品版本。直接构建选定插件，按实际 `componentVersion`/模块契约装配独立开发模块；不改后端、不假造新 selector。

手工装配使用当前 `dist-dev-components/development.json` 的每个组件 source/entry/permissions/workers；复制到独立 module 的 payload，生成 `schema_version:1.0` 和 module 的 id/version/type/role/target/entry。frontend 的 type/role 为 frontend/exhibit，geometry 为 resource/geometry；全部入口加 payload/ 前缀。把原 frontend 描述去除 source 后写入 payload/frontend-legacy.json，保留 config、adapters 和几何映射。固定 ID 映射参考 Desktop 的 scripts/prepare-local-solutions.mjs，版本由 scripts/component-version.mjs 确认。生成后用 readLinkedModule 校验，不仅检查 JSON 可解析。其他型号没有内置映射时使用其已确认身份，不借用 F60 的 ID。

最终开发模块如下；`module.json` 必须来自目标契约验证，entry/Worker 均以 payload/ 开头：

```text
dev-run/
  solution.json
  frontend/
    module.json
    payload/index.html
    payload/assets/...
    payload/workers/...                 # 按实际声明
    payload/frontend-legacy.json        # 保留现有配置/展示元信息
  geometry/                            # 需要时
    module.json
    payload/geometry-manifest.json
    payload/...
  components/
    adapter.zip
    sdk.zip
```

geometry 清单、实际资源、型号与分辨率必须一致。`DEXPILOT_GEOMETRY_DIR` 指向当前构建输出根，不是任意 CSV 目录；检查 geometry-build.json 与资产摘要。型号无需 geometry 时不造空组件。

前端/geometry 链接目录只包含 module.json 与 payload，内部不放 node_modules、源码软链或其他特殊文件；当前 linked reader 还有条目数等约束，应使用实际校验器确认。前端权限变更需重新导入，纯资源改动仍需重新加载页面；开发链接不是 HMR。

## 2. 准备 Adapter 和设备 SDK

当前运行链**不允许 Adapter/SDK 使用 link:**。使用本机构建的完整程序或供应商原包，生成本地不可变组件 ZIP；保留程序权限、动态库、模型、配置与工作目录，不能只抽取一个 exe 省略依赖。

每份 ZIP 根包含 runtime.json、files.json 与实际载荷。files.json 的每项为 path/size/sha256/mode，完整覆盖除自身之外的全部文件；归档 mode 必须一致。固定条目排序和时间戳，生成后计算整个 ZIP 的 size 与 SHA-256。优先用该组件现有打包器；若缺少，则在本次工具/输出目录编写打包脚本，不改后端源码或供应商私有内容。

runtime 示例（身份、target、entry 全部按真实输入替换）：

```json
{
  "schema_version": "1.0",
  "kind": "adapter-runtime",
  "target": "macos-arm64",
  "entry": "f60",
  "workdir": ".",
  "adapter_name": "f60_tactile",
  "sdk_required": true
}
```

SDK 的 kind 为 sdk-runtime，另有 `mode: process|library`，entry 保留供应商名称与后缀。F60 macOS 可能是 TouchSensor.App，Windows 可能是 TouchSensor.App.cmd；这不是所有 SDK 的命名规则。Adapter 在当前受管链要求根目录唯一可扫描入口，Windows 必须 .exe；其辅助工具应按合法目录结构保留，SDK 批处理入口则有专门支持。

**组件格式与 Host 扫描能力仍有差异**：基线 Host 要求 sdk/runtime.json.entry 是 sdk/ 的直接子文件；Windows 只认 .exe/.cmd，POSIX 要求执行位。组件 ZIP 校验允许某些嵌套或 .bat/库入口，不表示该 Host 可扫描。此 Skill 的预检额外检查这些已知限制；使用未来版本时重新核验 Host。保持供应商结构，选择其支持的根入口或请求明确的适配方案，不为通过扫描静默改名、移动私有资源或伪造 executable。

构建输出通过 file/可执行头、Go build 信息、运行声明和目标机支持核验。shell/.cmd 外包装通过静态校验不意味着内嵌平台与真实依赖已通过运行验证。设备 SDK 有同名不同版本时只选明确的兼容组合，不自动取最大版本。

有完整原生 SDK 要求的型号，方案必须唯一提供相应 sdk。SDK 已内嵌或该型号确实无需外置 SDK 时，记录供应商/Adapter 依据，可省略独立 sdk；不用空 ZIP 或伪造 universal 通过检查。

## 3. 生成完整开发方案

以 [assets/local-solution.example.json](../assets/local-solution.example.json) 为结构参考。它是不可直接安装的示例，所有身份、版本、路径、平台、摘要和大小必须从实际本地文件生成。实际 frontend/geometry module ID 和版本需与各自 module.json 一致。

- solution.target.platform 使用本机精确平台，允许 frontend/geometry 为 universal；原生依赖须精确本机 target。
- frontend/geometry 使用 `link:./frontend` / `link:./geometry` 时不写 sha256；也可选已有本地不可变归档。
- Adapter/SDK 用 `file:./components/…zip`、`archive_format: component-zip`、真实 size/sha256 与 component 声明。SDK runtime 必须与 ZIP 内 runtime.json 一致，也可由目标安装器校验后读取。
- 依赖按完整平铺列表锁定，不让模块自己声明传递依赖。已知 sdk_required 的 Adapter 不得缺 SDK，同 Adapter 被多方案引用时 SDK 坐标必须一致。
- 不把原正式签名带入改过依赖的开发方案。开发包不修改远端版本/原始制品；若同库同坐标的字节变化被拒绝，使用独立运行库或合法新开发版本，并保留已发布坐标的不可变性。

## 4. Dry-run，再安装

```bash
# 在技能包根执行，路径替换为实际目录；只读验证，无网络/进程启动/安装。
node scripts/verify-local-solution.mjs \
  --desktop "$DESKTOP_DIR" --solution "$DEV_ROOT/solution.json"
```

校验器默认要求恰好一个前端、一个 Adapter、一个设备 SDK；型号明确内嵌/不需要外置 SDK 时才加 `--allow-no-sdk`，仍不能绕过 runtime.sdk_required。前端/geometry 允许 link 或本地归档，拒绝远程 official 来源；不下载软件。它调用目标 Desktop 已安装依赖与源码验证器，因此目标 checkout 需具备 node_modules；缺入口表示宿主版本不匹配，不能跳过校验。

默认 API 表为 desktop_api 1.0.0 / plugin_api 2.0.0 / backend_api 1.0.0；目标改变时提供 `--host-apis <版本表.json>`，并在安装器使用同一版本表。`--host-target` 只改变文件校验目标，不使异构二进制在本机可运行。脚本一次读入归档校验，内存不足时使用目标宿主已有流式/summary 校验接口做等价预检，不能省略摘要或改为只看文件名。

检查输出权限是否在本次安装授权内，再从 Desktop 仓库调用现有安装器：

```bash
node scripts/install-solution.mjs --solution "$DEV_ROOT/solution.json" \
  --store "$PLUGIN_STORE" --development --approve-permissions
```

`--approve-permissions` 实际批准方案新增权限；只在已授权范围内使用。若缺少必要授权，先展示确切新增权限再询问，已有授权无需重问。安装脚本不提供 --help；先阅读参数解析和使用文档。

安装 CLI 不能管理运行中的 Host 维护窗口。首次安装使用尚未运行的独立库；替换原生组件前先停止自有 Host/SDK 并确认退出，或使用 Desktop 受管维护入口。不要与运行中的安装/准备队列同时写同一库。

安装 CLI 输出 activePath 与依赖的 id/version/target/relative_root；它不直接输出所有链接和信任字段。沿 activePath 只读回读激活记录的 linkDirectory/status/trust/publisher 等，核对实际库与来源。不能因安装回执成功就断言 Adapter 已被扫描或 SDK 已运行。

旧 `install-native-set.mjs` 仅装 Adapter 候选并返回 backendState:not-confirmed，不能安装独立 SDK 或形成完整型号绑定；只有维护已有 legacy 安装时使用，并另行明确版本激活与 SDK 来源。
