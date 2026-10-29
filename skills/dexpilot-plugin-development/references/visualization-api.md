# visualization API 参考

基线为本地已安装的 `@dexpilot/visualization@1.0.0`。它是业务无关的 Vue、ECharts、Three.js 和主题组件库，不导入 SDK、Desktop 或设备型号源码。正式采用前核对目标 npm 包 exports 与 peerDependencies；源码目录新增组件不等于目标包已发布。

## 导入方式

```ts
import "@dexpilot/visualization/theme.css";
import { MetricStrip, MetricCard, ScrollArea, IconButton } from "@dexpilot/visualization/ui";
import { ChartPanel, ChartRows, LineChart, createSeriesWindow } from "@dexpilot/visualization/charts";
import { Icon } from "@dexpilot/visualization/icons";
import { bindRectangularGridSurfaceMaterial } from "@dexpilot/visualization/geometry";
import { PointCloudView, SurfaceView, ThreeViewport } from "@dexpilot/visualization/viewports";
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

## 选择视口层级

基线安装的 1.0.0 包包含 `viewports`；历史 0.3.0 不包含，不能仅修改 import 就使用。以下按复杂度选择：

| 需求 | 选择 |
| --- | --- |
| 通用点云/三角曲面 | PointCloudView / SurfaceView |
| 自定义模型、相机/场景 | ThreeViewport / createThreeViewport |
| 型号 GPU 形变、位置纹理、特定拓扑 | geometry 底层工具 + 插件自身渲染适配 |

```vue
<script setup lang="ts">
import { PointCloudView } from '@dexpilot/visualization/viewports';
import type { GeometryViewHandle, PointCloudData } from '@dexpilot/visualization/viewports';
import { onBeforeUnmount } from 'vue';
const initialPositions = new Float32Array(0);
let view: GeometryViewHandle<PointCloudData> | null = null;
function ready(handle: GeometryViewHandle<PointCloudData>) { view = handle; }
onBeforeUnmount(() => { view = null; });
// onFrame 是本插件的渲染适配入口，传入前已过滤无效点并转为线性 RGB。
function onFrame(positions: Float32Array, colors?: Float32Array) {
  view?.update({ positions, colors });
}
</script>
<template>
  <div style="height: 320px"><PointCloudView :positions="initialPositions" @ready="ready" /></div>
</template>
```

输入 positions/colors 必须有限且为连续 XYZ/线性 RGB；SurfaceData 另有三角 indices 和 normals。不是紧凑 `Uint32Array` 颜色，也不接受把 NaN 无效格点直接传入。每次 update 是完整快照：省略颜色会恢复统一色，省略法线会重算，省略索引改为非索引几何。

`handle.update(data)` 同步复制输入到内部属性缓冲，返回后可释放帧租约；同尺寸时复用内部缓冲。若使用 props，引用变化触发更新，原位改数组需递增 `revision`。不深度 watch TypedArray。默认按失效合并渲染、首次有效数据自动取景；后续不要每帧 fit。父容器必须有有效尺寸。

SurfaceView 缺少 normals 时在 CPU 计算法线，不能宣称其等同 F60 的 GPU 实时形变。高频性能需按目标点数验证，不能因为通用示例流畅就替换型号优化路径。

## 资源所有权

Three 视口拥有自己的 renderer、canvas、RAF、OrbitControls；调用方拥有场景中的 Geometry、Material、Texture，或使用高层组件时按组件文档处理。销毁顺序：停止 RAF → 解除事件/流 → 从 scene 移除 → 释放 texture、render target、geometry、material。共享 renderer 不能由单个插件组件释放。

PointCloudView/SurfaceView 释放自己创建的 geometry、默认材质和灯光；外部 material/texture 与追加到场景的对象由调用方释放。卸载后清空 handle，停止向已销毁对象 update。处理 error/contextLost/contextRestored，恢复时重建自己拥有的 GPU 资源，并保留人工重试和重新打开入口。
