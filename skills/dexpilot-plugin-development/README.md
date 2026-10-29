# DexPilot 前端设备插件 Skill

给使用 AI 编程助手的设备插件开发者：支持从零建工程，以及将已有 Vue 项目迁移到 DexPilot Desktop。包含架构规划、双模式依赖、SDK/visualization 接入、数据流、GitLab CI、打包发布与验收方法。

## 安装与分享

分享整个目录或配套 ZIP，不要只发送 `SKILL.md`。ZIP 中顶层目录为 `dexpilot-plugin-development/`，将其放入接收者工具支持的 Skills 目录。

Codex 常用个人目录为 `~/.codex/skills/dexpilot-plugin-development/`，也可按团队约定放入项目 `.agents/skills/dexpilot-plugin-development/`。不要同时安装多份同名版本。发现同名目录时先比较内容并保留旧版，勿直接覆盖。其他支持 `SKILL.md` 的助手按其文档安装即可；核心内容不依赖专有工具。

入口：[SKILL.md](SKILL.md)。只需要人读文档时，可以从入口的按需阅读表选择主题。

## 可直接使用的请求

**从零创建：**

> 使用 $dexpilot-plugin-development，为新的设备型号创建 Vue 3 前端插件。先从提供的 Adapter/registry 信息确认身份和状态接口，规划目录与权限，再实现最小可运行状态页。开发支持本地 SDK/visualization，CI 使用私有 npm 精确依赖，交付构建、打包与 GitLab CI。设备流尚未明确的部分列为待接入，不伪造数据。

**迁移已有项目：**

> 使用 $dexpilot-plugin-development，把当前 Vue 项目改造成 DexPilot 设备插件。先盘点 HTTP/WS、Electron、路由和资源路径，保留现有业务页面，将设备接入改为 Plugin SDK；补齐依赖切换、Manifest、生命周期释放和 CI。保持已有 Git 改动与发布身份。

**仅规划：**

> 使用 $dexpilot-plugin-development，只给出这个插件的工程架构、依赖策略、SDK/visualization 对接表、迁移阶段与 CI 设计，暂不修改代码。

## 包中提供什么

- 入口与主题参考：架构、新建、迁移、依赖、SDK、visualization、设备数据、CI、验证和基线索引。
- 可运行的 Vite 依赖来源插件与 Node 测试；复制到目标工程后可扩展已有配置。
- 最小 `plugin.yaml` 与 GitLab CI 示例。它们是工程模板，不是已经实现了目标硬件协议的整套脚手架；CI 中的打包/上传命令需按文档实现或适配现有脚本。

## 核验范围

基线核验日期：2026-10-28。参考当前本地源码和已安装的 SDK/visualization `1.0.0`；通信契约仍为 Plugin API `2.0.0`。正式采用前核验目标私有 npm 包和 Desktop Provider。本次不代表新型号真机、远端 CI 或 Nexus 发布已通过。

本包不含凭据、设备数据、私钥、node_modules 或作者个人绝对路径。团队内部域名用于说明既有仓库约定；没有访问权限的接收者需由所属团队提供访问方式。
