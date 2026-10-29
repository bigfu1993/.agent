# 从零创建插件

## 最小可交付范围

先做「真实宿主上下文 + 一个已确认的状态资源 + 公共 UI + 生产构建 + 前端组件制品」。没有高频流就不加 Worker；没有控制契约就保持 commands 为空。只读页面也能成为合格插件。

1. 确认目标目录是否已存在、Git 边界与工作区规约。用户要求创建新插件可建立该插件工程；不顺带拆出其他共享依赖或初始化远端。
2. 确认身份和宿主支持的 Adapter。参考 [assets/plugin.example.yaml](../assets/plugin.example.yaml)，替换示例身份，选择已获支持的 states；示例不是新设备注册结果。
3. 使用 Vue 3/Vite，TS 为新工程建议；迁移项目不强制改语言。`package.json` 保留 `private: true`，运行依赖和开发工具分别声明。
4. 按 [dependencies.md](dependencies.md) 安装精确私有依赖并生成锁文件，建立生产与本地源码模式。
5. 入口先导入公共主题；创建单个 session，等待 SDK ready；状态未到达时显示等待，脱离 Desktop 时显示接入提示。
6. 先验证状态过滤、缺失/离线、设备切换与卸载。再接入明确授权的命令及其终态；需要时添加 Worker 与几何。
7. 按 [ci-release.md](ci-release.md) 实现打包和 dry-run，最后接入 CI；验证不能依赖相邻仓库。

## Manifest 起点

复制示例后，必须修改 `id`、显示名、设备类别、Adapter、版本与实际资源权限。`package.json.version`、`plugin.yaml.version`、前端 release 版本和 tag 保持一致。源清单不是安装清单，完整入口、归档 source、摘要与信任信息由对应打包器生成。

设备有高频流时，才加入：

```yaml
workers:
  - id: tactile
    entry: workers/tactile.js
    kinds: [tactile]
permissions:
  states: [device.status, device.info, streams]
  streams:
    - { worker: tactile, kind: tactile }
  commands: []
  files: []
```

这是已知触觉契约的组件内片段。新设备要换成它实际的 Worker、kind 和资源集合；`subkind` 来自流目录，不能猜测。Worker 文件名必须在最终 ZIP 中真实存在。

## Vite 7 构建示例

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { dependencySourcesPlugin } from './scripts/local-dependencies.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  base: './',
  plugins: [vue(), dependencySourcesPlugin(root)],
  build: { outDir: 'dist', sourcemap: false },
});
```

模板根据 Vite 7 工程核验。若现有工程使用其他大版本，按对应版本配置，不为套用模板无故升级。`base: './'` 是嵌入式部署支持的相对资源路径，见 [Vite base 配置](https://vite.dev/config/shared-options.html#base)。

需要固定 Worker 入口时，在 Vite 7 的 `build.rollupOptions.input` 增加 `workers/tactile: resolve(root, 'src/workers/tactile.ts')`，并将该 chunk 的 `entryFileNames` 固定为 `workers/tactile.js`。页面通过 `new Worker(new URL('./workers/tactile.js', document.baseURI), {type:'module'})` 创建与清单相符的入口；其他 chunk 可继续哈希命名。若改用 Vite 自动 Worker 构建，打包器须从最终产物生成正确 entry，不能仍声明一个不存在的固定名字。

使用路由时选 `createWebHashHistory()` 或内存路由；宿主加载 `index.html`，不应依赖 Web 服务器 history fallback。动态 import、字体、图片、WASM、模型、CSS URL 都要在组件目录内可解析。外部 CDN 依赖必须移为明确的构建依赖或打包资源。

## SDK 与页面装配

- session 返回低频状态和业务操作，由页面消费；组件卸载回收 session。
- `state.subscribe` 收到的数据先做运行时校验，不用 TS 断言代替。
- `createDexPilotPluginClient` 等真实方法见 [sdk-api.md](sdk-api.md)；不要自行发 `dxp:*` 消息模拟宿主权限。
- 普通浏览器没有宿主握手；独立预览使用显式 mock host，页面标记「模拟」。mock 代码从生产入口排除，不自动回退为虚假成功。

首个版本应有可执行的 `test`、`build`、`build:dev`、`pack:modules`、`publish:artifacts --dry-run` 命令；暂缺宿主或签名环境时交付本地制品及明确待验证项。
