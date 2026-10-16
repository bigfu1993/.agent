# Plugin SDK API 参考

适用 `@dexpilot/plugin-sdk@0.1.0` / Plugin API `2.0.0`。SDK 是浏览器客户端，不提供 HTTP、WebSocket、Electron IPC、Node、文件系统或设备协议透传。

## 创建客户端与上下文

```ts
import { createDexPilotPluginClient } from "@dexpilot/plugin-sdk";

const client = createDexPilotPluginClient({
  lifecycleCapabilities: { lifecycle: true, visualReady: true, beforeLeave: true },
});
const context = await client.ready();
```

`ready()` 等待宿主的 `dxp:init`，只返回首次快照，不是实时引用。上下文形状：

```ts
{
  apiVersion: "2.0.0",
  platform: "darwin" | "win32" | "linux" | null,
  presentation: boolean,
  plugin: { id, componentId, version?, slot?, workers? },
  instanceId: string | null,
  deviceAdapter: string | null,
  deviceConnecting?: boolean,
  permissions: { states, streams, commands, files } | null,
  capabilities: Record<string, unknown> | null
}
```

插件应保存 `instanceId` 和 `deviceAdapter`，只处理绑定设备；`context.changed` 到达时更新本地上下文，必要时重建订阅和流。

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
});

worker.postMessage({ type: "attach", consumerId: "host-stream" }, [stream.port]);
// 页面保留 stream 句柄，退出时仍要调用：
await stream.release();
```

流端口消息：

```ts
{ type: "opened", kind: "tactile" }
{ type: "frame", buffer: ArrayBuffer }
{ type: "reconnecting", kind: "tactile" }
{ type: "error", code: string }
```

`buffer` 是 transferable，格式由设备 Worker 解码。Worker 每处理完输入帧发送一次 `{type: "ack"}`；暂停、错误或不支持的帧也要 ACK，不能让宿主队列停住。桌面流管理器保留一个发送中帧和一个 pending 最新帧，旧 pending 会被覆盖。

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

当前 F20/F80/F60 命令示例：`start_tactile_pipeline`、`pause_tactile_pipeline`、`get_tactile_pipeline_state`、`device.setResolution`、`device.setFrameRate`、`device.recalibrate`。F20/F80 还声明 `device.sleep`、`device.wake`、`device.restart`、`device.getInfo`、`device.getStatus`；F60 还声明录制、固件升级和自检命令。

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

文件 API 只允许宿主管理的导出：`chooseExportDirectory()`、`saveText({ suggestedName, content, mimeType })`、`revealPath({ path })`。插件得到的是显示名或宿主结果，不得到任意文件系统权限。

生命周期 API：

```ts
const removeBeforeLeave = client.lifecycle.onBeforeLeave(() =>
  recording ? { allowed: false, reason: "正在录制" } : { allowed: true },
);
const removeSuspend = client.lifecycle.onSuspend(() => stopRendering());
const removeResume = client.lifecycle.onResume(() => restartRendering());
```

`client.destroy()` 幂等，但不会等待所有宿主资源释放；正常路径仍需先 `release()` 状态和流句柄。

## 错误

重点错误码：`PLUGIN_PERMISSION_DENIED`、`PLUGIN_METHOD_NOT_ALLOWED`、`PLUGIN_HOST_ERROR`、`PLUGIN_CLIENT_DESTROYED`、`STATE_PORT_MISSING`、`STREAM_PORT_MISSING`、`DEVICE_INSTANCE_REQUIRED`。同时检查 `error.code`、`error.message` 和公开的 `error.data.results`，不要把内部 trace 当作稳定接口。
