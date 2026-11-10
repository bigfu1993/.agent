# 核验基线与维护入口

日期：2026-10-28。依据当前源码、CLI 与无设备夹具整理，接收者应按目标 checkout 复核。HEAD 只用于追溯，不要求回退至这些提交。

| 对象 | 本次核验 |
| --- | --- |
| Desktop | HEAD 5aadd2f；源码开发命令、安装器、Module/Solution/原生扫描视图与 SDK 准备实现 |
| dexpilot | HEAD cec1f584；保留用户已有 config.integration.yaml 改动和未跟踪二进制/launchd 内容，无本次源码修改 |
| 构建 | 当前 Make 使用 go/dist/平台/版本；Go 主模块 1.26、toolchain go1.26.6；不再默认以 go/bin 作为新构建输出 |
| 旧二进制 | 实际 go/bin/dexpilot --help 不含 --adapter-dirs，不能用于当前托管插件式扫描；本次未构建或启动 Host |
| CLI 与源码差异 | --adapter-dirs 在实现与测试中合并 YAML 根；当前 CLI 文档误写覆盖，Skill 已按实现修正 |
| 前端准备差异 | dev:plugins selector 只有 f20/f80/f60/dmtac；外层脚本仅接受纯三段 built.version，当前 F20/F60 测试版需独立装配路径 |
| 原生链接 | solution-adapters.js 显式拒绝 Adapter/SDK link；设备 SDK 运行 Manager 使用 component-zip |
| SDK 入口差异 | 组件格式允许部分嵌套/.bat 入口，当前 Host pluginscan 要直接子文件，Windows 只接受 .exe/.cmd；预检脚本按当前链路补充限制 |
| electron-vite | 已安装 5.0.0，源码确认 -- 后参数通过 ELECTRON_CLI_ARGS 传给 Electron |

## 核验范围

- 本 Skill 预检与回归测试 11 项通过，其中用实际 Desktop 安装器在临时库中安装前端链接、Adapter ZIP、SDK ZIP；方案扫描能够识别 Adapter/SDK 绑定。旧 Adapter .dxc 中的 runtime.sdk_required 另行读取并验证，防止遗漏外置 SDK。
- 测试原生入口仅是格式夹具，未执行；不代表供应商 SDK、真实 Adapter 或硬件支持。
- 独立无窗口 Electron 探针验证 --user-data-dir 对 app.getPath('userData') 生效；未启动 DexPilot Desktop 主程序或 Host。沙箱内首次探针 SIGABRT，无输出；在允许的宿主执行环境中复跑成功。
- Node/js-yaml 格式检查覆盖 frontmatter、相对引用、JSON/YAML 和个人路径残留；官方 quick_validate.py 因当前 Python 缺少 yaml 模块未能运行，不将替代结构检查表述为官方脚本通过。
- 未进行新型号真机、Windows/Linux 实机、厂商 SDK 准备、远端下载/上传或完整 Desktop+Host 联调。本次交付是经过静态与隔离夹具验证的操作 Skill。

## 目标仓库内的核对位置

| 主题 | 仓库内路径 |
| --- | --- |
| Host flags 与覆盖语义 | dexpilot/go/cmd/dexpilot/main.go；go/internal/config/adapter_env.go 与测试 |
| Go 构建 | dexpilot/docs/BUILD.md、make/go.mk、make/go-adapters.list、scripts/go/build.sh、scripts/go/dev.sh |
| Host 插件扫描 | dexpilot/go/internal/adapter/catalog/pluginscan.go、scan.go；internal/application/adaptercatalog/pluginstore.go |
| Python/SDK 平台 | dexpilot/python/adapters/型号/README.md 与 packaging/README.md |
| 前端选择与装配 | dexpilot-desktop/scripts/plugin-repositories.mjs、prepare-local-plugins.mjs、prepare-local-solutions.mjs、dev.mjs |
| 安装/完整性 | dexpilot-desktop/scripts/install-solution.mjs；src/main/plugins/solution-manifest.js、module-link.js、module-store.js、component-archive.js |
| 原生运行关系 | dexpilot-desktop/src/main/plugins/solution-adapters.js；src/main/runtime/adapter-runtime-view.js、adapter-runtime-admission.js、backend-sdk-preparation.js |
| Host 模式/生命周期 | dexpilot-desktop/src/main/runtime/backend-managed-context.js、backend-plugin-directory.js、backend-standalone.js、backend-controller.js |
| 存储 | dexpilot-desktop/src/main/runtime/storage-paths.js、desktop-storage.js、plugin-storage.js |

完整安装目录的未来设计与当前 Module/Solution + 候选/准入视图不是同一实现。不要只照 model-plugin-sdk-adapter-host-handoff.md 的规划目录推断当前安装位置；以实际 active 记录和 runtime 实现为准。

Electron 路径 API 的公开语义见 [app.getPath / setPath](https://www.electronjs.org/docs/latest/api/app)；目标应用可自定义路径，因此仍需本次回读。

## 维护本 Skill

在 Skill 根运行：

```bash
DEXPILOT_DESKTOP_DIR="$DESKTOP_DIR" node --test scripts/verify-local-solution.test.mjs
```

测试只使用本地目标源码、已安装 yazl/js-yaml 与临时目录，不联网或执行设备。修改安装格式/Host 入口约束后同步脚本、示例与测试；更新启动策略时先核对实际 argv、进程所有权和当前执行环境。若目标 Desktop 删除内部校验入口，更新调用位置，不在此 Skill 复制一套过时安装器。
