---
name: dexpilot-plugin-development
description: 在 DexPilot Desktop 中开发、评审或调试 F20/F80/F60 等设备插件时使用；覆盖 Plugin SDK、公共 visualization、状态订阅、高频触觉流、Worker 背压、几何资源和生命周期释放。
---

# DexPilot 设备插件开发

这是一份面向插件开发者的开发技能。插件运行在 Desktop 的 `dxp-plugin://` 沙箱 iframe 中，通过 `@dexpilot/plugin-sdk` 访问宿主，通过 `@dexpilot/visualization` 渲染公共 UI、图表和几何。设备协议、Adapter、权限执行和文件写入属于 Desktop/后端，插件只消费宿主已经授权的数据。

当前基线：

- `@dexpilot/plugin-sdk@0.1.0`，通信协议 `Plugin API 2.0.0`。
- `@dexpilot/visualization@0.3.0`，已发布入口包括 `theme.css`、`ui`、`charts`、`icons`、`geometry`。
- F20/F80 共用一个插件；F60 独立插件。
- 生产依赖使用公司 npm registry 的精确版本；本地源码别名只能由显式开发模式启用。
- F20/F80/F60 的真实设备、字段和几何规则不同，不能根据型号名称猜测数据结构。

## 开发流程

1. 先读取目标插件的 `plugin.yaml`、`package.json`、`AGENTS.md`，确认组件 ID、Adapter、权限和 Worker 声明。
2. 创建 SDK 客户端并等待 `client.ready()`；不要用默认值覆盖宿主状态。
3. 订阅低频状态，收到第一个有效快照后再初始化设备相关页面；设备切换时释放旧订阅并重新绑定。
4. 需要高频数据时声明 Worker 和 stream 权限，用 `client.stream.open()` 获取 `MessagePort`，转交 Worker；主线程不搬运大数组。
5. 在 Worker 中解码、校验、转换和聚合帧，输出插件内部的 canonical frame；页面只消费固定快照和可回收的帧租约。
6. 用 visualization 组件承载主题、指标、图表、滚动和通用 Three.js 能力；型号数据适配留在插件。
7. 页面卸载、设备切换、系统 suspend 和导航离开时释放 stream、state subscription、Worker、RAF、纹理和 Three.js 资源。
8. 完成后分别验证单元测试、插件生产构建、Desktop 安装器/`dxp-plugin://` 资源、Electron 沙箱和真机边界。构建通过不等于设备已验收。

## 关键处理原则

- 状态快照、命令回执和真实执行结果是三件事。收到 RPC 成功响应不能直接显示“设备已完成”。
- 状态数据是 `unknown` 业务对象：按资源、`instanceId`、Adapter 和版本校验后再进入页面状态；无效值显示缺失或错误。
- 高频流是 latest-only 实时显示链路，不是无损录制链路。每帧处理完成后只发送一次 `{type: "ack"}`。
- 触觉大数组使用 transferable `ArrayBuffer` 和 Worker；保留一个正在处理帧与一个待处理最新帧，避免 Vue 响应式和无限队列。
- F20/F80 触觉帧是正方形 `resolution × resolution × 6`；F60 允许矩形源尺寸，并且必须使用帧头声明的布局和映射规则。
- 几何资产是静态资源，动态帧只更新坐标、颜色、区域力和遥测；不要每帧重新三角化或重新加载模型。
- F60 的统一径向拓扑只适用于 F60；F20/F80 使用各自矩形模型和分辨率资产。
- 组件库只负责业务无关的显示和生命周期，不负责设备身份、阈值、温度解释、录制、控制或型号拓扑。

## 按需阅读

- SDK 方法、事件、权限、错误和请求结构：阅读 [references/sdk-api.md](references/sdk-api.md)。
- visualization 入口、组件输入、几何缓冲和资源所有权：阅读 [references/visualization-api.md](references/visualization-api.md)。
- F20/F80/F60 帧结构、Worker、背压、模型加载和状态处理：阅读 [references/device-data-processing.md](references/device-data-processing.md)。

## 完成标准

插件应满足：Manifest 权限与实际调用集合一致；状态和流在生命周期结束时全部释放；无未授权命令、外部网络或 Electron/Node 访问；生产构建使用 registry 精确依赖；资源和帧数据经过尺寸、布局、序号、有限数值和 Adapter 校验；验证报告准确区分静态测试、Electron 预览、后端状态、真机和制品发布。
