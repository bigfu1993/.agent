# 私有 npm 与本地源码双模式

## 配置原则

`dependencies` 是运行代码依赖，`devDependencies` 是 Vite/TypeScript/Vitest 等构建与测试工具。「开发时使用本地 SDK」是解析来源切换，不是把 SDK 移到 `devDependencies`，也不通过临时改 `package.json` 实现。

| 场景 | 包声明/锁文件 | 实际解析 | 输出 |
| --- | --- | --- | --- |
| 普通 dev/test/build | 精确 registry 版本 | 本仓 node_modules | dev server / dist |
| 显式源码联调 | 同一份精确版本，保持不变 | 本地 SDK/visualization 的明确 exports 别名 | dev server / dist-dev |
| CI/生产打包 | frozen lockfile | 私有 npm 包 | dist + 来源证明 + 前端组件制品 |

`.npmrc` 可提交无凭据内容：

```ini
registry=https://repository.yimu.info/repository/npm-group/
```

只配置项目，不改开发者全局 npm/nvm 设置。公司依赖拉取固定走 `npm-group`；只有维护 SDK/visualization 等真正的 npm 发布包时，才设置 `publishConfig.registry` 为 `https://repository.yimu.info/repository/npm-hosted/`。前端插件应用保留 `private: true`，其 ZIP 发布不是 `npm publish`。

## 已核验的版本组合

截至基线日期，示例插件使用 SDK `1.0.0`、visualization `1.0.0`、Vue `3.5.41`、ECharts `6.1.0`、Three `0.184.0`、Vite `7.3.6`、pnpm `11.5.1`，Node 要求 `>=22.22.3`。这些是可参考组合，不宣称始终最新；现有项目按已验证工具链维护。

visualization `1.0.0` 的 peer 范围：Vue `>=3.5.0 <4`、ECharts `>=6.0.0 <7`、Three `>=0.184.0 <0.185.0`（Three peer 可选，使用几何/视口时必须安装）。公共 npm 包使用精确版本，无 `^`、`~`、`latest`、`file:`、`link:` 或 `workspace:`。

```bash
# 先确认目标版本可取、包含需要的入口；这是查询，不是发布。
pnpm view @dexpilot/plugin-sdk@1.0.0 version exports dist --json
pnpm view @dexpilot/visualization@1.0.0 version exports peerDependencies dist --json
pnpm add --save-exact @dexpilot/plugin-sdk@1.0.0 @dexpilot/visualization@1.0.0
pnpm add --save-exact vue@3.5.41 echarts@6.1.0 three@0.184.0
```

新工程按需添加 `@vitejs/plugin-vue`、Vite、TypeScript、`vue-tsc`、Vitest、Vue Test Utils、jsdom、打包器依赖，并锁定工具版本。不要给不使用 Three 的状态页添加整套 3D 依赖。

## 本地联调接线

复制 [assets/local-dependencies.mjs](../assets/local-dependencies.mjs) 到目标 `scripts/local-dependencies.mjs`，在 Vite 的 plugins 中加入 `dependencySourcesPlugin(root)`。它读取包实际 exports，SDK 主入口映射到 `src/index.js`，SDK 契约等生成入口仍使用本地 `dist`；因此先构建本地 SDK。visualization 按自身导出的 Vue/TS 源码接入，Vite 需要 Vue 插件。

脚本默认寻找插件同级的 `dexpilot-plugin-sdk`、`dexpilot-visualization`；也支持启动进程的 `DEXPILOT_PLUGIN_SDK_DIR`、`DEXPILOT_VISUALIZATION_DIR` 环境变量。相对值按进程工作目录解析，跨目录调用建议使用绝对路径；不要将个人路径提交到仓库。

```json
{
  "scripts": {
    "dev": "vite --mode development",
    "dev:local": "vite --mode local-source",
    "build": "vite build --mode production",
    "build:dev": "vite build --mode local-source --outDir dist-dev",
    "test": "vitest run",
    "typecheck": "vue-tsc --noEmit"
  }
}
```

`--mode local-source` 仅切换依赖来源，不自动安装插件、注册开发方案、启动 Desktop 或启用 mock。模板使用进程环境变量，不读取 `.env.local`；如项目要支持 dotenv，应在 Vite 配置显式 `loadEnv` 后传给模板，绝不将凭据暴露为 `VITE_*`。

模板有以下实际约束：

- CI 或 `DEXPILOT_RELEASE_BUILD=1` 时拒绝 local-source；生产模式忽略本地目录变量。
- 两种模式都要求 package 声明精确 npm 版本；本地仓库允许是尚未发布的候选版本，但只能供本地验证。
- 生产依赖 realpath 必须落在本仓 node_modules 内且名称/版本相符；允许 pnpm 内部符号链接，拒绝链接到相邻源码。
- 对 SDK 子入口采用精确别名，避免主入口吞掉 `/contract` 等路径；Vue/ECharts/Three 使用 dedupe。
- 生产构建检查页面及独立 Worker 模块图的跨仓导入，Worker 通过 `worker.plugins` 接入；合并既有 Worker 配置时须保留该 guard。主构建输出 `dependency-sources.json`，其中 moduleCount 统计主构建图；模板要求两种公共包在主图实际被消费，不要求每个 Worker 导入 UI。
- 模板面向独立仓库与基线包的显式 exports；特殊 monorepo/global virtual store、条件/通配导出需按真实布局适配并补验证，不能直接删除保护。

Vite 别名不会自动改变 `vue-tsc` 的类型解析。默认 typecheck 使用已安装包类型，能提前暴露未发布 API。若源码联调确实需要候选类型，新建仅本地使用的 tsconfig 映射；CI 仍使用 registry 类型。Vitest 的 local 配置也必须显式区分，普通测试不能依赖相邻仓库。

## 生产来源检查

来源证明是构建日志证据，不是签名或防篡改证明；打包器仍需同时检查：

1. package/锁文件的 specifier、解析版本、integrity 和 tarball 来源；不含本地路径/私有候选 tgz。检查 workspace、overrides、patchedDependencies、pnpm hooks、Vite/TS/Vitest aliases，防止绕过。
2. 私有包下载 URL 位于公司 HTTPS npm 源；缺失 tarball URL 时结合有效 registry 与独立安装确认，不能只做字符串搜索。
3. 从独立目录、无相邻源码、干净 node_modules 运行 `pnpm install --frozen-lockfile`、类型检查、测试和生产打包。默认安装包含构建用 devDependencies；构建前不要用 `--prod` 删除 Vite。
4. 校验产物 `dependency-sources.json.mode === 'registry'`，版本与清单一致；本地 dist-dev 不能被 `--skip-build` 当作生产产物。

`--frozen-lockfile` 防止安装时更改锁文件；缓存离线成功仅证明缓存可用，不代表本次私有源可达。见 [pnpm install](https://pnpm.io/cli/install)。

## 认证与未发布能力

读取认证使用已有登录或 CI 文件变量提供的受限 `.npmrc`，由 `NPM_CONFIG_USERCONFIG` 指向临时文件。URL 作用域匹配 npm-group；发布 npm 时 hosted 的认证另行匹配。文件排除出缓存与 job artifacts，不打印，不在命令参数中携带 token。

本地 SDK 有新方法、registry 没有时：先完成 SDK 的版本升级、发布和回读，再升级插件精确依赖与锁文件。未授权发布时记录阻塞项，继续本地可验证工作；不能覆盖同版本包、静默回退公网源或把本地源码塞入生产 ZIP。

## 将开发页面接入 Desktop

依赖来源切换与宿主加载是两步。`build:dev` 只生成页面并不代表已激活；宿主仍需认识插件身份、Adapter 绑定和权限。

当前 Desktop 对已支持型号提供：

```bash
# 在 Desktop 仓库执行；仅适用于该版本支持的型号选择项。
pnpm dev:plugins --plugin f20
pnpm plugins:dev --plugin f20
pnpm test:plugins:dev
```

第一条准备所选插件并启动开发宿主，第二条只重新构建/同步，第三条校验开发资源。普通 `pnpm dev` 不自动准备或加载开发方案。再次同步前先停止采集并离开设备详情；无需杀掉正在使用的开发环境。隔离验收可通过 `DEXPILOT_DEV_PLUGINS_DIR` 指定新的开发输出根，配合独立应用数据目录。

基线 Desktop 的选择器仅包含 dmtac/f20/f60/f80，不接受任意新型号。新建插件不能凭空执行 `--plugin new-model`；应生成目标宿主接受的开发方案，或在明确授权的 Desktop 开发注册位置加入该型号。

当前 Solution/Module 开发链接为 `source: link:./frontend`，相对开发方案目录解析；目标目录有 `module.json` 和 `payload/`，用 SDK 开发方案/模块校验器检查身份、入口、Worker、权限和平台。link 不声明归档 SHA-256，不允许越界/符号链接。可在 Desktop 仓库先读安装脚本参数声明与使用文档（基线脚本不提供 --help），再使用类似命令：

```bash
node scripts/install-solution.mjs --solution ./demo.solution.yaml --store ./artifacts/demo-dev-store --development
```

新增权限按宿主流程批准；只有明确接受该权限集时才加 `--approve-permissions`。内容更新后重新加载页面，module.json 的权限/入口等声明变更后重新导入。不能手改 active.json，也不能关闭正式模式验签来加载开发包。

一些现有插件的 build:dev 还生成 `dist-dev-components/development.json`，供 Desktop 的准备脚本转换为开发方案；这是宿主集成约定，不是 npm 依赖模式的一部分。使用该管线时按目标脚本的字段/版本校验生成描述，不把它当成通用可安装包。
