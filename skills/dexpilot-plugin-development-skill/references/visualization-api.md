# visualization API 参考

适用 `@dexpilot/visualization@0.3.0`。它是业务无关的 Vue、ECharts、Three.js 和主题组件库，不导入 SDK、Desktop 或设备型号源码。

## 导入方式

```ts
import "@dexpilot/visualization/theme.css";
import { MetricStrip, MetricCard, ScrollArea, IconButton } from "@dexpilot/visualization/ui";
import { ChartPanel, ChartRows, LineChart, createSeriesWindow } from "@dexpilot/visualization/charts";
import { Icon } from "@dexpilot/visualization/icons";
import { bindRectangularGridSurfaceMaterial } from "@dexpilot/visualization/geometry";
```

插件页面使用 `main.viz-monitor`，消费 `--canvas`、`--surface-base`、`--text-primary`、`--brand-primary`、`--status-success`、`--warning`、`--status-error` 等公共 Token。不要在每个型号复制一份主题 CSS。

## UI 组件

```vue
<MetricStrip :columns="3">
  <MetricCard label="帧率" :value="actualFps ?? '—'" unit="Hz" />
  <MetricCard label="受力面积" :value="area ?? '—'" unit="mm²" />
</MetricStrip>

<ScrollArea label="设备数据">
  <!-- 列表、设置或图表 -->
</ScrollArea>
```

`ScrollArea` 保留原生滚动，提供不占布局宽度的 6px 覆盖式滚动条，滚动停止约 2 秒后淡出；支持滚轮、触控板、键盘、拖动和动态尺寸。`IconButton` 是带焦点和选中态的原生按钮；图标从 `Icon` 消费，不把 SVG 复制进型号插件。

## 图表

```ts
const window = createSeriesWindow(3, 240);
window.append([[forceX, forceY, forceZ]]);
const { offset, data } = window.snapshot();
```

`LineChartSeries`：`{ id, name?, color, data: (number | null)[], areaOpacity?, lineWidth? }`。非有限值转为 `null`；公共图表不解释单位、阈值或物理含义。`ChartRows` 的每行包含 `id`、`label`、`color`、曲线 `series` 和已格式化的 `values`。

F60 参考做法是：Worker 输出每帧的 `aggregated` 和 `deep`，主线程以约 30Hz 定时批量加入曲线；力和位移使用独立批次，实时帧率不等于图表刷新率。图表窗口有界，旧样本淘汰。

## 几何工具

已发布 `geometry` 入口提供底层工具：

- `buildCompactPointPositions(positions, validIndices)`：按有效索引压紧 XYZ。
- `buildCombinedPointPositions(...)`：有效点后追加静态补点。
- `buildCombinedSensorIndices(validIndices, supplementalPointCount)`：有效点保留原始 sensor index，补点使用 `-1`。
- `createLinearPointColors(pointCount, packed)`、`applyCompactPointFrame(...)`：将 `0xRRGGBB` 转为线性 RGB 并更新紧凑点云。
- `updateIndexedVertexNormals(...)`：按索引重算面积加权法线。
- `createPositionTextureRing(...)`：循环复用位置纹理。
- `createSmoothedSurfacePositions(...)`：GPU 浮点渲染目标可用时走 GPU，否则 CPU 回退；回退不能宣称等同实时 GPU 性能。
- `bindSquareGridSurfaceMaterial(...)` / `bindRectangularGridSurfaceMaterial(...)`：以位置纹理和 baseline 更新 Shader 曲面，输入由调用方拥有。
- `createRafLoop(...)` / `createRenderInvalidator(...)`：控制绘制调度和合并失效。

底层几何 API 的通用数据：

```ts
positions: Float32Array // 连续 XYZ
indices: Uint16Array | Uint32Array // 三角索引，长度为 3 的倍数
normals?: Float32Array
colors?: Float32Array // 线性 RGB，与 positions 等长
```

调用方负责：有限数值检查、坐标系转换、有效点选择、型号拓扑、资源销毁和 `revision`/引用更新。每帧更新完整坐标快照；不要让 Vue 深度监听每个浮点数。

注意：当前 published `0.3.0` 不包含本地新增的 `viewports`、`PointCloudView`、`SurfaceView` 入口。分享给开发者时应要求他们先确认 registry 包实际 exports；本地候选代码不能当成已发布能力。

## 资源所有权

Three 视口拥有自己的 renderer、canvas、RAF、OrbitControls；调用方拥有场景中的 Geometry、Material、Texture，或使用高层组件时按组件文档处理。销毁顺序：停止 RAF → 解除事件/流 → 从 scene 移除 → 释放 texture、render target、geometry、material。共享 renderer 不能由单个插件组件释放。
