# DexPilot 本地设备联调 Skill

此包用于本地启动 Desktop 和 dexpilot，并为选定型号装配前端、Adapter、设备 SDK 及所需 geometry。它与前端工程开发 Skill 分工：前者处理运行环境与安装联调，后者处理页面工程、SDK 调用和 CI。

将完整目录以 `dexpilot-local-device-dev` 名称放入接收者的 Skills 目录；Codex 常用 `~/.codex/skills/` 或团队项目 `.agents/skills/`。同名已存在时先比较并保留原版，不直接覆盖。分享 ZIP 时保留全部 references/scripts/assets。

入口：[SKILL.md](SKILL.md)。支持如下请求：

> 使用 $dexpilot-local-device-dev，在当前工作区启动 F60 本地联调。前端使用本地源码，Adapter 使用本机构建，设备 SDK 使用我提供的本地组件包；由 Desktop 托管 Host。先校验后安装到独立开发库，确认页面和后端注册，未授权的采集操作先保持停止。

> 使用 $dexpilot-local-device-dev，复用正在运行的 dexpilot，仅为 F20 启动开发 Desktop 和本地前端。不要关闭现有 Host，也不要覆盖原生 SDK 或正式插件库。

> 使用 $dexpilot-local-device-dev，检查戴盟在这台电脑上能否完成前端、Adapter 和 SDK 联调；区分源码模拟与厂商真机支持，不启动尚未支持的平台二进制。

内含只读方案校验器，支持本地 JSON/YAML Solution 2.0、前端/geometry 开发链接和本地模块归档。它复用目标 Desktop 源码校验器，无需新增共享包，不执行硬件、不安装、不下载。运行方法见 [组件安装](references/components.md)。

本包不含 SDK 二进制、标定、真实凭据、许可证或任何作者个人绝对路径。真实设备输入由使用者提供。文档和脚本验证范围见 [基线](references/baseline.md)。
