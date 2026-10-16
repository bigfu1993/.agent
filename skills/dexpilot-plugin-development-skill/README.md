# DexPilot 插件开发 Skill

这是一份可分享给设备插件开发者的技能包，面向 F20/F80/F60 等 DexPilot Desktop 插件。

入口文件：[SKILL.md](SKILL.md)

参考资料：

- [SDK API](references/sdk-api.md)：客户端、状态、流、命令、文件、几何、展示、生命周期和错误。
- [visualization API](references/visualization-api.md)：主题、UI、图表、Three.js 几何工具、数据缓冲和资源所有权。
- [设备数据处理](references/device-data-processing.md)：F20/F80/F60 的状态、帧格式、Worker、背压、分辨率、录制和释放。

## 使用方式

把整个目录复制到目标 Codex 的 skills 目录，或把三份 `references/` 文档作为团队插件开发规范随仓库分发。开始开发某个具体型号时，先读 `SKILL.md`，再按任务读取对应参考文件。

## 当前版本边界

文档依据当前源码和已安装包整理：`@dexpilot/plugin-sdk@0.1.0`、`@dexpilot/visualization@0.3.0`、F20/F80 与 F60 插件现有实现。当前工作区仍有 Desktop/F20/F80 的未提交改动，因此文档把“已发布契约”和“当前工作区实现”分开描述；新增 API 必须重新核对 registry 包的 exports、Desktop Provider 和插件 Manifest。

这份 Skill 不表示真机、原生 Adapter、跨平台 Electron、正式签名或 Nexus 发布已经验收。它要求开发者在报告中把这些验证边界分开说明。
