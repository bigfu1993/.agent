# Plugin SDK API 参考

基线为本地已安装的 `@dexpilot/plugin-sdk@1.0.0` / Plugin API `2.0.0`。包版本和通信版本分别管理。SDK 是浏览器客户端，不提供 HTTP、WebSocket、Electron IPC、Node、任意文件系统或设备协议透传。方法可调用还取决于目标 Desktop Provider、权限与设备能力。

## 包入口与权限

主入口提供客户端、协议常量、错误、WebGL 恢复绑定和触觉流水线控制辅助。`/contract`、`/contract.json` 是机器契约；`/manifest-schema`、`/manifest.schema.json` 是旧式 Manifest 的局部定义；`/package-contract` 与 module/solution Schema 用于构建侧模块/方案校验。不要将后者混入页面运行逻辑，也不要把旧局部 Schema 当完整安装验证器。

| 调用 | Manifest 权限 |
| --- | --- |
| `state.subscribe` | states 包含每个 resource |
| `stream.open` | streams 精确匹配 worker/kind，workers 声明该 id、kind 和真实入口 |
| `command.call` / `device.*` | commands 包含实际逻辑命令名 |
| getExportDirectory / chooseExportDirectory / saveText | files: export.text |
| chooseDirectory / copyPath / revealPath | files: choose.directory / copy.path / reveal.path |
| getContext / config / geometry / presentation | 当前无独立权限键，仍受可信上下文和 Provider 约束 |

## 创建客户端与上下文

```ts
import { createDexPilotPluginClient } from "@dexpilot/plugin-sdk";

const client = createDexPilotPluginClient({
  lifecycleCapabilities: { lifecycle: true, visualReady: true, beforeLeave: true },
});
const context = await client.ready();
```

`ready()` 等待宿主的 `dxp:init`，只返回首次快照，不是实时引用，也没有内置初始化超时。页面自行显示等待/重试/从 Desktop 打开的提示；超时 UI 不等于取消 ready Promise，关闭后仍须防止迟到结果。上下文形状：

```ts
{
  apiVersion: "2.0.0",
  platform: "darwin" | "win32" | "linux" | null,
  backendIsLocal?: boolean,
  presentation: boolean,
  plugin: { id, componentId, version?, slot?, workers? },
  instanceId: string | null,
  deviceAdapter: string | null,
  deviceConnecting?: boolean,
  permissions: { states, streams, commands, files } | null,
  capabilities: Record<string, unknown> | null
}
```

插件应保存 `instanceId` 和 `deviceAdapter`，只处理绑定设备；`context.changed` 到达时更新本地上下文，必要时重建订阅和流。`backendIsLocal` 缺失不能假定后端与 Desktop 共享本机目录。

真实事件 API 为 `client.onContextChanged(callback)`、`onConfigChanged(callback)`、`onDeviceStatus(callback)`，都同步返回解绑函数。上下文回调参数是 `Partial<PluginContext>`，须合并；需要完整权威值时调用 `client.getContext()`。

会话模块的重绑定算法（generation/队列属于插件，不是 SDK API）：绑定变化时递增 generation、清空旧显示、释放旧句柄并串行开启新订阅；每次 await 后检查当前 generation 与 disposed。旧请求迟到时立即 release，不覆盖新实例。初始化期间先缓存 context patch，再合并首次快照，或在 ready 后重取当前上下文，避免漏掉切换。

## 状态订阅

```ts
const subscription = await client.state.subscribe({
  resources: ["device.status"],
});

subscription.port.onmessage = ({ data }) => {
  if (data?.type !== "snapshot") return;
  // data.resource: 订阅资源名
  // data.version: 宿主资源版本
  // data.data: 后端业务对象，SDK 不固定完整字段
};

await subscription.release();
```

消息统一为：

```ts
{ type: "snapshot", resource: string, version: unknown, data: unknown }
```

当前 Desktop 的资源映射：`device.status` → `tactile`，`device.info` → `things`；F20/F80/F60 页面按宿主返回的绑定实例筛选。不要把 `device.status` 的默认映射扩展成其他设备的契约。

订阅句柄包含 `{ subscriptionId, port, release }`。`release()` 幂等；组件卸载时先释放句柄，再销毁客户端。订阅迟到时，如果页面已经卸载，立即释放句柄并丢弃消息。

## 高频流

Manifest 必须声明 Worker 和对应 stream 权限：

```ts
const stream = await client.stream.open({
  workerId: "tactile",
  kind: "tactile",
  subkind: "point_field",
});

worker.postMessage({ type: "attach", consumerId: "host-stream" }, [stream.port]);
// 页面保留 stream 句柄，退出时仍要调用：
await stream.release();
```

流端口消息：

```ts
{ type: "opened", kind: "tactile" }
{ type: "frame", buffer: ArrayBuffer }
{ type: "frame", text: string }
{ type: "reconnecting", kind: "tactile" }
{ type: "error", code: string }
```

`subkind` 来自获准的 `streams` 目录。F20/F60/F80 示例为 tactile/point_field；其他型号不可套用。同一 kind 可能有 image/depth/shear 等多路。多实例不能选第一台；`instanceId` 只有在宿主绑定范围内才有效。旧 SDK/Provider 可能不支持 subkind，必须核验消费包而非仅看本地源码。

`buffer` 是 transferable，格式由设备 Worker 解码；文本帧读取 `text`，不能对所有流构造 Float32Array。每帧处理或明确丢弃后 ACK 一次；暂停、校验错误、未知类型的 frame 也要 ACK，控制消息不 ACK。宿主链路通常保留一个发送中帧和一个 pending 最新帧，不能用其代替无损录制。

```js
// Worker 端片段；decodeAndPublish 是插件自有解码函数，不是 SDK 导出。
self.onmessage = event => {
  if (event.data.type !== 'attach') return;
  const port = event.ports[0];
  port.onmessage = async ({ data }) => {
    if (data.type !== 'frame') return;
    try { await decodeAndPublish(data); }
    catch (error) { self.postMessage({ type: 'decode-error', message: String(error) }); }
    finally { port.postMessage({ type: 'ack' }); }
  };
  port.start();
};
```

上例每处理完成才确认，保持单路背压；替换为有界内部队列时 ACK 时机须遵循 [设备数据处理](device-data-processing.md)。页面保留 stream handle，即使 port 已转移也调用 release；只 terminate Worker 不够。

## 命令

```ts
const result = await client.command.call(
  "start_tactile_pipeline",
  { target_sn: sn },
  { timeoutMs: 35_000 },
);
```

常用便捷方法：

```ts
await client.device.setResolution({ resolution: 480 });
await client.device.setFrameRate({ fps: 60 });
await client.device.recalibrate();
await client.device.restart();
await client.device.getInfo();
await client.device.getStatus();
```

命令集合以型号 Provider 与权限为准，不从另一个插件复制整组权限。`device.getStatus()` 在当前宿主是历史配置读取兼容接口，不是实时状态；实时参数读状态订阅。便捷 `device.*` 不接收通用超时选项，需要 options 时用 `command.call`。

已核验的 SDK 1.0.0 提供控制辅助，优先复用，避免在每个插件复制终态解析：

```ts
import { controlTactilePipeline, readTactilePipelineState,
  createPausedPipelineVerifier } from '@dexpilot/plugin-sdk';
await controlTactilePipeline(client.command, sn, true);
const state = await readTactilePipelineState(client.command, sn);
```

仍需声明 start/pause/get_tactile_pipeline_state 命令。控制辅助会校验目标 SN 与终态，并针对既定连接/超时错误查询一次状态，不重发启停；暂停核验器实例由插件拥有，卸载 dispose。其他设备不能假定也支持这套命令。

调用方必须校验业务结果：

```ts
const response = await client.command.call("pause_tactile_pipeline", { target_sn: sn }, { timeoutMs: 35_000 });
if (!Array.isArray(response?.results) || response.results.length !== 1) {
  throw new Error("后端没有返回当前传感器的终态");
}
const item = response.results[0];
if (item.sn !== sn || item.code !== "ok" || item.pipeline_state !== "stopped") {
  throw new Error(item.error_message || "流水线状态未确认");
}
```

超时只表示结果未确认。对启停操作，可以随后调用 `get_tactile_pipeline_state` 对账；不要无条件自动重发硬件命令。参数设置按顺序提交，前一项失败就停止后续项。

## 配置、文件、几何和展示

```ts
const config = await client.config.get();
await client.config.setFrontend({ exchangeMode: true });
const geometry = await client.geometry.getManifest();
await client.presentation.enter();
await client.presentation.exit();
```

`config.get()` 当前返回 frontend/backend 分区；`setFrontend(patch)` 合并前端顶层配置，不是设备参数下发。按 Manifest 的 adapter/component scope 与兼容范围管理持久化。

`geometry.getManifest()` 返回 `{componentId, version, url}` 描述；再读取 url 的 JSON，以清单 URL 为基准解析相对资产，不硬编码另一个插件目录。几何组件由目标方案/Manifest 关联，文件自身的布局按型号解释。

文件调用都在 `client.file` 下：导出目录选择返回显示名，saveText 返回文件名；`chooseDirectory({defaultPath?})` 可返回用户选中的绝对路径，`copyPath({path})` 复制路径文本，`revealPath({path})` 打开已有路径。知道路径不等于拥有读写权限。选择取消是正常结果，旧宿主能力缺失要给出反馈。远程后端路径不保证可在 Desktop 本机使用。

生命周期 API：

```ts
const removeBeforeLeave = client.lifecycle.onBeforeLeave(() =>
  recording ? { allowed: false, reason: "正在录制" } : { allowed: true },
);
const removeSuspend = client.lifecycle.onSuspend(() => stopRendering());
const removeResume = client.lifecycle.onResume(() => restartRendering());
```

上述 stopRendering/restartRendering 是项目函数，完整会话还需管理流、Worker 与重入。`on*` 返回的解绑函数全部保存。只声明自己实现的能力；声明 `visualReady:true` 就必须在对应 resume generation 具有首个可展示画面后调用 `client.lifecycle.visualReady(generation)`，不能只在 mounted 时盲发。

| 时点 | 应执行的动作 |
| --- | --- |
| suspend | 禁止新交互/新开流，递增代次；停止 RAF/定时器、释放高频流、清空 pending/lease、暂停或销毁 Worker；低频状态可为业务需要保留，若释放则记录恢复需求 |
| resume | 串行核对当前上下文和设备；仅重建已释放的状态订阅、Worker 和流，加载必要模型；恢复绘制并按真实画面上报 visualReady；不自动重发硬件命令 |
| beforeLeave | 录制/保存/不可中断操作返回 allowed:false；允许后锁定新操作，避免离开检查通过后又启动采集 |
| leaveCanceled | 用 `client.lifecycle.onLeaveCanceled` 解除退出锁，不自动启动设备 |
| dispose | 标记 disposed 并递增代次；解除事件，释放所有句柄；无论清理是否失败都回收 Worker/RAF/GPU，最后 destroy |

suspend/resume 回调可返回 Promise，SDK 等待其完成后确认；回调抛错会导致该次确认缺失，因此捕获可恢复错误并明确终态。release 没有额外统一超时，清理应有有界等待和 finally 兜底，不能一个未响应端口卡住退出。`client.destroy()` 幂等，但不是等待宿主释放的替代方法；正常路径先 release，再 destroy。

## 错误

重点错误码：`PLUGIN_PERMISSION_DENIED`、`PLUGIN_METHOD_NOT_ALLOWED`、`PLUGIN_HOST_ERROR`、`PLUGIN_CLIENT_DESTROYED`、`STATE_PORT_MISSING`、`STREAM_PORT_MISSING`、`DEVICE_INSTANCE_REQUIRED`。同时检查 `error.code`、`error.message` 和公开的 `error.data.results`，不要把内部 trace 当作稳定接口。
