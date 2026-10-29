# 设备数据处理与触觉示例

## 新型号先定义自己的数据契约

本章 F20/F80/F60 是既有实现示例，不是所有设备的通用协议。接新型号先明确资源名、绑定实例、kind/subkind、二进制或文本、帧头边界、端序、尺寸/通道、单位、坐标系、无效值、时间戳单位、序号来源、丢帧策略与 geometry profile。图像、wrench、点云分别解码；模型支持集采用 registry 精确值。

流目录可能包含多实例多通道。根据宿主上下文与获准 `streams` 目录明确选择实例、kind、subkind，每一路端口独立 ACK 和 release。不得把二进制图像/wrench 文本套入六通道 Float32，也不能用 SN 拼接流路由。

将已知设备原始数据转换成插件内部 canonical frame，再供页面消费；该结构由当前插件维护，不新增公共包。保留原始物理指标和用于显示的位移/颜色，避免显示增强改变测量值。

## 状态快照

状态是低频权威数据，不是高频帧。F20/F80/F60 常见订阅：

```ts
device.status // 运行参数、设备列表、流水线状态、实际帧率
device.info   // 当前实例物模型、properties、services、capabilities
streams       // F60 录制/流状态等
```

F20/F80 的 `device.status` 典型数据：

```ts
{
  instance_id: "f80_tactile",
  resolution: 480,
  frame_rate: 120,
  available_resolutions: [128, 240, 480],
  available_frame_rates: [30, 60, 90, 120],
  devices: [{
    sn: "F80TD60004",
    pipeline_state: "running",
    actual_frame_rate: 29.75,
    degraded: false,
    micro_force_mode: false
  }]
}
```

F60 的 `device.status` 结构相近，但设备温度通常不在 `devices[]` 中；对象温度和设备温度来自触觉流 header 的 `temperature: { object, ambient }`。F60 录制状态来自独立 `streams` 快照，不能从 `device.status` 猜测。

处理步骤：先检查 `snapshot`、resource、`instance_id`、Adapter 和字段类型；未知值保留 `null`；以 `mounted`、`pipeline_state`、`degraded` 和 `actual_frame_rate` 分别表达挂载、流水线、健康和吞吐。`degraded` 不能单独当作已暂停，暂停后应调用 `get_tactile_pipeline_state` 对账。

## F20/F80 触觉帧

帧格式是 `JSON header + '\n' + little-endian Float32 payload`：

```json
{"kind":"tactile_point_field","layout":"yimu_f80","height":480,"width":480,"channels":6}
```

payload 长度必须是 `height * width * 6 * 4`。每点 6 个值：`[Fx, Fy, Fz, Dx, Dy, Dz]`。校验通过后 Worker 产生：

```ts
{
  type: "frame-result",
  seq: number,
  timestamp: number,
  coords: Float32Array,       // [X,Y,Z] * posCount
  colors: Uint32Array,        // 仅有效点，顺序与 validIndices 一致
  regionForces: Float32Array, // [Fx,Fy,Fz,cx,cy,cz] * regionCount
  regionCount: number,
  aggregated: {
    totalForce, forceX, forceY, forceZ,
    maxDisplacement, forcedArea, pressure
  },
  deep: { maxDepth, deepMaxAndMinX, deepMaxAndMinY, deepMaxAndMinZ }
}
```

F20/F80 的 `seq` 是插件 Worker 自己递增的处理序号；输入帧 header 没有稳定序号时不能把它误称为后端 source sequence。

模型加载返回每个 resolution 的 `positions`、`regions`、`mapping`、`area`、`supplemental` 和 topology。`positions` 是完整矩形格点，NaN 表示无效点；`validIndices` 选择可视点；`area` 用于受力面积；`regions` 和 `mapping` 用于区域力；补点只用于静态表面显示。

## F60 触觉帧

F60 帧支持 `tactile_point_field` 与 `tactile_pointcloud`。header 可能包含 `width`/`height`、`point_field_rows`/`point_field_cols`、嵌套 `header.seq`、`header.timestamp_ns`、`aggregates` 和温度。

```ts
{
  type: "frame-result",
  seq: number,                 // 优先使用 header.seq
  timestamp: number,           // timestamp_ns 转毫秒
  profileId: string,
  dataWidth: number,
  dataHeight: number,
  gridWidth: number,
  gridHeight: number,
  coords: Float32Array,        // 完整矩形格网 XYZ
  colors: Uint32Array,         // 仅有效点，按 validIndices 顺序
  regionForces: Float32Array,  // [Fx,Fy,Fz,cx,cy,cz] * regionCount
  temperatures: [number|null, number|null], // object, ambient ℃
  aggregated: { forceX, forceY, forceZ, totalForce, maxDisplacement, forcedArea },
  deep: { deepMaxAndMinX, deepMaxAndMinY, deepMaxAndMinZ }
}
```

F60 真实几何 profile 以 Manifest 为准。当前 `640x480` profile 的矩形点数是 `640 * 480`，有效点、区域、补点和统一 surface index 数量都必须从 profile/资产读取。统一径向三角化只在构建期完成；运行期不重建拓扑。

## Worker、租约和背压

Worker 初始化时接收模型快照和显示配置；收到 stream port 后解析帧，校验 layout，输出 canonical frame。解码前限制头部长度、尺寸和总字节数；JSON 换行后的 payload 未必满足 4 字节对齐，应使用 DataView 或对齐缓冲，不直接对任意 byteOffset 构造 Float32Array。主线程收到结果后创建 lease：

```ts
const lease = createFrameResultLease(frame, recycleBuffers);
mailbox.publish(lease);
// 渲染提交或丢弃后必须：
lease.release();
```

`createFrameResultLease`、mailbox、`FramePipelineCoordinator`、`ResolutionGate` 是既有插件内部实现名称，不是 SDK/visualization 的公开导出。新插件按需要在自己的模块内实现有界缓冲和状态门控，或复用当前项目已有实现，不从另一插件跨仓导入。

F20/F80 使用固定结果缓冲池和 `FramePipelineCoordinator`；F60 使用 canonical frame 校验、结果缓冲池和 render mailbox。规则是：

- 结果缓冲耗尽时最多暂存一个最新输入。
- mailbox 只保留少量 pending frame，旧帧释放 lease。
- 最简单可靠的 ACK 时机是本帧处理完成或明确丢弃后的 finally。若提前 ACK，必须先把帧接管进有严格容量和淘汰回收策略的内部队列；不能只是启动异步处理就无界确认。ACK 不表示已经渲染，也不表示已录制落盘。
- 页面提交新帧后释放上一帧；渲染中断也必须释放。
- `pause`、`system-suspend`、设备切换和 Worker 销毁时清空 pending 与 lease。
- 不使用 `setInterval` 逐帧拉取，不把帧数组放入 Vue 深度 ref/reactive，不经普通 window 消息克隆大数组。主线程只发布低频指标或使用 shallowRef/markRaw 包装显示句柄。

transfer 后发送方 buffer 会 detached，记录每个缓冲的 owner；帧被覆盖、拒绝、渲染异常、设备切换、Worker 初始化失败/崩溃都要回收租约。停止 Worker 前释放宿主 stream，端口连接超时或 opened/error 到达时只操作当前代次。

## 分辨率和错帧

F20/F80 通过 `ResolutionGate` 维护 desired/loaded resolution。设备状态是分辨率权威来源；帧只用于判断能否处理。切换期间或重连回放旧分辨率帧时直接丢弃，不回切模型、不重连流。

F60 通过 profile 的 `dataWidth/dataHeight/gridWidth/gridHeight` 校验；真实矩形尺寸不匹配则发出 `frame-layout-mismatch`，不强行插值。仅明确标识为 simulation 的输入才允许测试重采样。

## visualization 适配

适配顺序：

1. 从模型 bundle 建立静态 Geometry、有效索引、区域索引和 sensor index。
2. 用 `buildCompactPointPositions` 建立有效点显示缓冲，补点追加在末尾，补点 `sensorIndex=-1`。
3. 每个 canonical frame 用 `applyCompactPointFrame` 或位置纹理环更新坐标和颜色。
4. Surface 使用固定 indices；F20/F80 可用矩形 surface material，F60 使用构建期统一 surface indices 和 rectangular material。
5. 平滑位置和动态法线使用同一份显示位移来源；原始 force/displacement 指标保持原值。

颜色数组的常见陷阱：`frame.coords` 是完整矩形顺序，`frame.colors` 通常是有效点紧凑顺序；更新点云时必须用 `validIndices` 做映射，不能直接用颜色数组下标读取完整坐标。

## 录制、物模型和命令

F60 录制流程使用物模型描述的 `duration_sec`、`format`、`start_recording`、`stop_recording`；命令回执里的 `accepted`/`file_path` 不是“文件已完成”。通过 `streams` 状态看到录制从 true 变 false 后，才显示完成并用 `revealPath` 打开结果。

物模型读取规则：只读取宿主显式提供的 `device.info` 中 `properties`、`services`、`capabilities`；不按字段相似度猜测服务名。运行时可用分辨率/帧率与物模型 `specs_list` 取交集，交集为空时不要伪造选项。

## 资源释放检查

组件卸载前必须按顺序停止页面交互、停止/释放流、释放状态订阅、销毁 Worker、停止 RAF、释放 mailbox leases、解除事件监听和 dispose Three.js 资源。导航离开时使用 `onBeforeLeave` 阻止录制中离开；系统 suspend/resume 使用 lifecycle 回调，不自动重发硬件命令。
