# 基线、来源与更新方法

## 核验快照

日期：2026-10-28。以下来自当次工作区源码、项目配置、锁文件及 DexHand node_modules 内实际安装包；未在此次编写过程中重新访问公司 npm/制品仓库或运行远端 CI。

| 对象 | 当次证据 |
| --- | --- |
| Plugin SDK | 源码 HEAD `62ef0f9`；源码与已安装包版本 `1.0.0`；Plugin API `2.0.0`；已安装类型/实现含 subkind、目录/路径接口、触觉控制辅助 |
| visualization | 源码 HEAD `107065a`；源码与已安装包版本 `1.0.0`；exports 包含 theme.css/ui/icons/charts/geometry/viewports |
| DexHand 前端 | HEAD `5a6c9da`；package/plugin 版本 `0.1.1-test.1`；SDK/visualization 均精确 `1.0.0` |
| F20 前端 | HEAD `2ff4acd`；版本 `1.0.0-test.1`；固定 tactile Worker 入口与 geometry 关联 |
| 当前布局 | F20、F80、F60 有独立前端工程；旧 F20/F80 共包仅作兼容历史，不是新型号的默认结构 |
| 发布约定 | 工作区 AGENTS.md：无 v 的正式/test.N 标签，无 build-id 远端路径，同坐标不可变 |

HEAD 只用于追溯，不要求使用者回退到这些提交。工作区源码、已安装包、远端已发布包和目标宿主可能不同步，必须分别检查。旧文档里的「未发布」标题或旧 0.3.0 示例，不能盖过当次实际包内容。

## 源码定位（团队有对应仓库时）

以下为仓库名与仓库内路径，不依赖任何人的绝对路径；没有这些仓库仍可按本 Skill 执行，具体设备接口由目标团队提供。

| 仓库 | 优先查看的文件 |
| --- | --- |
| `dexpilot-plugin-sdk` | `package.json`、`src/index.d.ts`、`src/client.js`、`src/tactile-pipeline.js`、`docs/api-reference.md`、`docs/protocol.md`、`docs/permissions.md`、`docs/package-contract.md` |
| `dexpilot-visualization` | `package.json`、`src/*/index.ts`、`src/viewports/PointCloudView.vue`、`src/viewports/useGeometryView.ts`、`docs/geometry-views.md`、`docs/three-viewport.md` |
| `dexpilot-plugin-dexhand` | `plugin.yaml`、`vite.config.mjs`、`scripts/local-dependencies.mjs`、`src/device-state.js`、`scripts/package-modules.mjs`、`scripts/release/*`、`.gitlab-ci.yml` |
| `dexpilot-plugin-f20` / `dexpilot-plugin-f80` | `plugin.yaml`、`vite.config.ts`、`src/workers/`、模型/分辨率与帧租约实现 |
| `dexpilot-plugin-f60` | `plugin.yaml`、`src/workers/tactile.ts`、`src/workers/tactileContract.ts`、profile/geometry 与渲染实现 |
| `dexpilot-plugin-dmtac` | `plugin.yaml`：多 kind 与文件权限的实际案例；流布局以目标实现为准 |
| `dexpilot-desktop` | `src/renderer/platform/plugins/`、`src/renderer/src/components/PluginFrame*` 与目标版本的安装/模块契约；只读核对 Provider |

## 外部工具语义

- 相对 base、alias、dedupe：[Vite shared options](https://vite.dev/config/shared-options.html)。示例构建配置基于项目 Vite 7；不要把官网当前大版本新增配置直接套入旧项目。
- 冻结锁文件与 devDependencies：[pnpm install](https://pnpm.io/cli/install)。工具行为以锁定的 pnpm 版本为准。
- 构建产物传递与触发：[GitLab CI YAML](https://docs.gitlab.com/ci/yaml/)。自托管 GitLab 版本与 Runner 支持需现场验证。

## 更新顺序

先核对源码/目标包 exports 与宿主 Provider，再改 API 示例；依赖变化同步类型检查、锁文件和构建来源证明。发布规则变化同时检查 CI rules、版本校验、打包/上传路径、文件名、清单与回归测试。最后更新本页日期与验证范围。

不得把历史成功次数、旧提交的发布结果或缓存安装结果写成本次远端验证。发布了新 Skill 也不代表它生成的每个新型号插件已完成真实设备验收。

## 本技能的交付检查

- Node 内置测试覆盖依赖模式、精确版本、pnpm 链接、跨仓模块与独立 Worker，共 12 项通过。
- 用现有 DexHand Vue 工程和本包模板完成 Vite 7.3.6 生产/本地源码两种构建；来源证明分别为 registry/local。使用当次已安装依赖，未重新在线安装；有原工程大于 500 kB chunk 的提示，不影响构建完成。
- 用真实 Vite 自动 Worker 管线验证跨仓源码被拒绝、仓库内 Worker 可以构建。
- 用 Node/js-yaml 检查 frontmatter、YAML、相对链接、代码围栏与个人路径/冲突残留；独立场景检查覆盖从零新建和 Vue 迁移。
- 官方 `quick_validate.py` 在本机因缺少 Python yaml 模块无法执行；依赖安装也未成功。本次不将替代结构检查表述为官方脚本通过。
- 未进行新型号真机、远端 CI、npm/制品上传、签名与公证验证；未修改参考业务仓库。
