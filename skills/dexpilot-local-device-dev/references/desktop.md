# Desktop 启动与现有会话复用

## 完整本地方案的启动方式

完成独立方案安装后，在 Desktop 仓库使用同一 `PLUGIN_STORE`。下面是 macOS/Linux shell 示例；Windows PowerShell 用 `$env:变量='值'`，路径/二进制采用本机格式，不把 Bash 语法复制到 PowerShell。

**托管模式：**

```bash
DEXPILOT_PLUGIN_STORE_PATH="$PLUGIN_STORE" \
DEXPILOT_ALLOW_UNSIGNED_PLUGINS=1 \
DEXPILOT_BACKEND_EXECUTABLE="$HOST_BIN" \
  pnpm exec electron-vite dev -- --user-data-dir="$DESKTOP_DATA"
```

**复用外部 Host：**

```bash
# 当前进程环境不能残留 DEXPILOT_BACKEND_EXECUTABLE，否则会进入托管模式。
env -u DEXPILOT_BACKEND_EXECUTABLE \
  DEXPILOT_PLUGIN_STORE_PATH="$PLUGIN_STORE" \
  DEXPILOT_ALLOW_UNSIGNED_PLUGINS=1 \
  DEXPILOT_GATEWAY_URL="$GATEWAY_URL" \
  pnpm exec electron-vite dev -- --user-data-dir="$DESKTOP_DATA"
```

electron-vite 5.0.0 会把 `--` 后参数传给 Electron；启动后核对真实 app.getPath('userData')/日志和进程参数，不能只凭命令认为隔离生效。插件库还会有独立的 storage locator 与 plugin-data；读取宿主报告的实际路径，不手改位置记录或跨 userData 共用同一存储身份。

不要将未签名开关写入全局 shell 或正式安装包环境。它仅在 `app.isPackaged === false` 的显式开发进程启用。配置使用源代码开发窗口，不启动 release/**/DexPilot.app 冒充当前源码。

上述直接启动方式消费已经安装好的完整方案，避免 `dev:plugins` 再生成同 ID 的纯前端方案而删除/冲突于 Adapter、SDK 绑定。

## 只联调已知前端时

后端和原生设备已经就绪，仅需要准备已登记的前端/geometry，且该版本满足准备脚本输入约束时，可从 Desktop 使用（基线 F20/F60 测试版被外层版本检查拒绝，需走 components.md 的独立装配路径）：

```bash
DEXPILOT_GATEWAY_URL="$GATEWAY_URL" \
DEXPILOT_DEV_PLUGINS_DIR="$DEV_ROOT/frontend-only" \
  pnpm dev:plugins --plugin f20
```

仅用于外接时同样先清除本进程残留的 BACKEND_EXECUTABLE。内置脚本会配置其 dev-plugin-store 与开发模式；它不透传任意 CLI 参数，不给它追加未知的 --user-data-dir。需要同时隔离 userData 时，先 `plugins:dev` 准备，再按上节直接启动。

普通 `pnpm dev` 默认既不准备开发插件，也不自动连接你想要的插件库。旧 Electron 窗口刷新不能把普通模式切换为正确开发存储；核对它的 cwd、PID 和环境来源，复用正确会话，必要时只重启本任务的错误会话。

## 托管模式中的生效阶段

1. Desktop 从已安装完整方案重新验签/校验，尊重显式禁用；构造 `userData/backend/adapter-runtime/current` 候选视图。
2. 每个顶层条目为真实目录，内部 adapter/sdk 指向经过验证的载荷；不是源码随意创建的跨型号共享目录。
3. Host 实际收到的是 `adapter-admission/current`。无需准备的组件先准入；已识别的 TouchSensor 进程型 SDK 由宿主执行规定的无设备 `--help` 预热，成功后增量准入。
4. Host 就绪和后台会话建立后使用授权的 `device:scan_adapters`，读取 added/replaced/rejected/retired/unmounted 回执；准备成功不代表注册成功。
5. 对真实设备完成发现/连接与绑定后，页面通过 SDK 获取权威状态和流。

SDK 在运行态由 Adapter/后端管理；Desktop 仅对已明确支持的 SDK 做无设备准备，不对其他供应商盲目执行 --help，更不启动校准/采集试探。外部 Host 不进入此受管预热/准入流程，其所有者须自行落实依赖。

当前托管启动器继承 Desktop 用户与权限；不使用管理员 AppleScript/UAC/pkexec。权限不足时针对具体文件/设备/TCC 修复，不清空标定或整树 chmod 777。

## 迭代更新

- 纯页面/资源：退出当前设备详情后更新对应开发 payload，重新进入；清单入口/权限/版本变更必须重新校验与导入。
- Adapter/SDK：停止采集与自有 Host，确认 SDK/子进程已退出，重新打包并校验完整方案，按新坐标或独立核验库安装，再启动注册。原安装模块不可原地覆盖。
- 复用外部 Host：Desktop 内的停止/重启不拥有该进程。需重启时识别真正所有者，保留其他设备/业务会话；用户未授权中断时先完成独立准备。
- 活跃方案已绑定原生组件时，不把纯前端方案覆盖回去；将前端改动合入完整开发方案后再安装。
