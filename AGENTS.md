# Codex 全局开发规范

仅保存跨项目、可复用、可检查的长期规则。项目专属规则写项目 `AGENTS.md`；冲突时以更具体规则为准。

## 规则维护

- 长期要求先判维度：全局写 `/Users/bigfu/.codex/AGENTS.md`，项目写对应仓库 `AGENTS.md` 或项目文档。
- 总结、梳理、留存、复盘、归档必须先拆分全局/项目维度；混合内容分别写入并在回复中说明。
- 全局维度：方法、偏好、安全、验证、工具。项目维度：业务、接口、目录、命令、产品、验收。
- 规则必须可执行、可检查；新增或修改规则时，同步检查实现、文档和验证命令。
- 不把一次性状态、业务细节、流程图细节、接口细节长期堆进全局规范。

## 上下文压缩复盘

- 发现上下文被压缩/恢复后，先读摘要，提炼目标、偏好、提示词优先级和已验证工作方式。
- 稳定工作流、重复任务、工具顺序、检查清单优先生成或更新 skill；不适合 skill 的内容再写全局/项目规则。
- 只沉淀去敏后的长期规则、踩坑、决策依据和提示词逻辑；不保存完整聊天记录、密钥、隐私、业务机密或临时路径。
- 更新时合并同类规则，避免重复；新增规则写清触发条件、执行动作和验证方式。

## 协作语言

- 默认中文沟通；面向用户的说明、错误、文档默认中文；代码命名保持英文，除非既有业务语境要求中文。

## 对话执行与结果结构

- 每次处理用户请求前，先将用户原始表达梳理成更精准、更利于执行的中文提示词或任务复述；若请求很短，也要用一句话明确执行目标。
- 梳理后的提示词用于指导后续执行；若存在明显歧义、风险或前置条件缺失，先在提示词后说明需要确认的问题或采用的合理假设。
- 执行完成后的最终回复默认包含 3 个部分：`1. 执行结果`、`2. 阶段进度`、`3. 下一步建议`。
- `执行结果` 用小白也容易理解的方式按有序列表总结实际做了什么、得到什么结果、验证了什么。
- `阶段进度` 必须包含阶段目标、进度百分比和“尚未完成”有序列表；阶段目标未设定时写“阶段目标未设定”，进度百分比无法精确计算时标注为估算。
- `下一步建议` 必须说明建议动作和原因；建议应贴合当前阶段目标，不提前扩大到无关能力。

## Context Sync 规则

- 踩坑了 → 调用 `write_context` 写到 `gotchas`。
- 做了架构决策 → 调用 `write_context` 写到 `architecture`。
- 发现 API 特殊行为 → 调用 `write_context` 写到 `api_notes`。
- 用户说 `/sync-save` → 调用 `sync_push`。
- 用户说 `/sync-load` → 调用 `sync_load`。

## 安全策略

### 执行安全

- 每次执行前先做安全预判：不破坏用户改动、不泄密、不越权、不误停进程、不做不可逆操作。
- 安全性只用于执行前判断；确认安全后，实际执行采用最快、最短、最小变更路径。
- 无法确认安全或涉及破坏性/越权操作时，先请求用户确认。

### 代码安全

- 不提交密码、密钥、token、`.pem`、本地数据库凭据。
- 私密配置放 `.env.*.local` 并确保被 `.gitignore` 忽略；示例配置用 `.env.example` 或占位符。
- 不修改或回滚用户已有改动，除非用户明确要求。
- 数据库变更必须新增迁移；已应用迁移不得修改。

## 开发规范

### 通用方法论

- 先读现状再改：定位 owner、数据源、状态归属、复用点和验证方式。
- 真实闭环优先：状态、权限、流程、归属、结果必须由数据库、后端契约和前端消费链路闭环；不得用本地状态、缓存、toast、假按钮或 mock 替代。
- 数据链路从源头推进：迁移、模型、服务、domain 类型、api-client、hooks、页面和文档保持一致；只改一端必须说明边界。
- 复用先于新增；新增前搜索页面、组件、hooks、类型、工具函数。
- 每次新增能力、模块、接口或文件前，先站在全局架构、长期复用和跨模块边界角度评估，再选择当前约束下的最优可执行方案。
- 每次修改既有实现前，先判断最小变更粒度和真实影响面；按最小完整功能单元设计执行，不扩大无关范围。
- 批量治理分批做，每批先定范围和问题类型，完成后跑对应验证。
- 删除或拆分前用 `rg` 查显式 import、JSX、生成声明和 auto-import 暴露项。

### 文件命名与目录语义

- `src` 下的文件名不重复携带所在目录或模块前缀；目录已经表达作用域，例如优先使用 `src/logd/service.c`，避免 `src/logd/logd_service.c`。
- 仅当文件会脱离该目录单独发布、生成产物要求固定名称、或项目既有约定必须保留前缀时，才允许保留目录前缀。

### 注释规范

- 类、组件、接口、类型、公共方法、导出函数、关键常量和重要业务变量必须补标准注释。
- 新增/维护注释默认中文；Java 用 JavaDoc，TS/JS 用 TSDoc/JSDoc。
- 注释解释业务意图、约束、边界和非显然原因；同步更新，删除调试、废弃和误导注释。

### 前端规范

- 前端开发、重构、UI/交互和页面验证必须先使用全局 skill `/Users/bigfu/.codex/skills/frontend-development/SKILL.md`。
- 全局 AGENTS 只保留入口规则；具体组件组织、状态归属、表单布局、响应式、本地运行进程管理、运行态验证和交付检查以 `frontend-development` skill 为准。
- 若项目 `AGENTS.md`、设计系统或用户要求有更具体前端规则，先合并到当前任务约束，再按 `frontend-development` skill 执行。

### 后端规范

- 后端按既有模块边界组织 Controller、Application Service、Model、Repository/Mapper、Migration。
- Controller 只处理 HTTP 边界；Application Service 处理事务和业务编排。
- Model 承载请求/响应、枚举、状态常量和 API/domain 契约；稳定状态值集中维护。
- 后端必须用真实数据库状态和接口契约提供可信结果。
- 迁移用 Flyway、Liquibase 等系统管理；预期失败用稳定错误码；异常让前端展示真实错误。

### UI 与交互

- UI 与交互细则已收敛到 `frontend-development` skill；涉及前端界面时按该 skill 的“UI 与交互标准”和“验证闭环”执行。
- 非前端视觉文档和流程图仍按本文“文档规范/流程图与视觉文档”执行。

### 验证规则

- 每次代码或产品功能修改后必须验证相关功能，静态检查不算结束。
- 前端页面改动按 `frontend-development` skill 做本地单进程运行、可访问页面、核心交互、桌面/移动和 console/截图验证；接口改动至少验证健康检查和目标接口；前后端联动需闭环联调。
- 先复用默认端口已有项目进程；同一项目本地运行时只保留一个前端服务进程；确需重启后端时主动重启并验证。
- 不涉及后端代码、配置、迁移或运行依赖时，不重启后端。
- 临时启动的额外进程验证后主动停止；不误停用户进程。
- 无法运行态验证时，最终回复说明未检验项、阻塞原因和替代检查。

## 文档规范

### 通用规范

- 文档按模块分类、附稳定编号、按主流程/总分/前后置/必选顺序编排。
- 新增、删除、合并条目时同步检查编号和引用。
- 完成、废弃、替换的条目使用 Markdown 删除线 `~~...~~`，不只改状态词。

### 流程图与视觉文档

- 精确流程图优先用可控 SVG；Mermaid 仅作低精度草图。
- 先定语义、编号、上下游，再改节点、尺寸、分行、锚点、间距、分支、回流线和文档。
- 主链路同轴向下；异常、否定、修改、回退走侧向分支或外侧回流。
- 流程节点用矩形，判断节点用菱形；判断分支必须标“是/否”，否分支用红色线和箭头。
- 同一语义终点只保留一个；共享后续链路先无箭头汇入，再由公共链路保留方向箭头。
- 用户要求节点“直接指向”时，重新判断是否应并入主链路，清理多余终点、绕线、旧编号和旧说明。
- 同行只放相同编号或同编号分支；空间不足先扩画布或调整距离，不压缩节点。
- 回流线绕外侧，跨阶段/长距离回退用虚线；流程变更后清理失效线、标签、箭头。
- 每次流程图修改后必须做 SVG XML 解析、旧文案/编号搜索、整体与局部渲染检查、`git diff --check`。

## Skill 使用映射

- 工作优先匹配已有 skill；前端开发、React/Vue/页面/UI/交互/本地运行进程管理/运行态验证优先触发 `frontend-development` skill；匹配不到或 skill 不足时，再按系统浏览规则联网寻找权威方案。
- 使用 skill 前完整阅读对应 `SKILL.md`；相对路径、脚本、模板、资源按 `SKILL.md` 所在目录解析。
- 用户点名或任务明显匹配时必须用对应 skill；多 skill 取最小覆盖集合并说明顺序。
- skill 缺失、失败或工具不可用时说明原因，用最接近方式继续。
- 工作中发现 skill 缺步骤、顺序、验证或检查清单时，优先逐步更新 skill；无法归入 skill 再写全局/项目规则。

### Skill Root 映射

| 代号 | 路径 |
| --- | --- |
| `r0` | `/Users/bigfu/.codex/skills` |
| `r1` | `/Users/bigfu/.codex/skills/.system` |
| `r2` | `/Users/bigfu/.codex/plugins/cache/openai-bundled` |
| `r3` | `/Users/bigfu/.codex/plugins/cache/openai-bundled/sites/0.1.33/skills` |
| `r4` | `/Users/bigfu/.codex/plugins/cache/openai-curated-remote/build-ios-apps/0.1.2/skills` |
| `r5` | `/Users/bigfu/.codex/plugins/cache/openai-curated-remote/build-macos-apps/0.1.4/skills` |
| `r6` | `/Users/bigfu/.codex/plugins/cache/openai-curated-remote/build-web-apps/0.1.2/skills` |
| `r7` | `/Users/bigfu/.codex/plugins/cache/openai-curated-remote` |
| `r8` | `/Users/bigfu/.codex/plugins/cache/openai-curated-remote/figma/2.0.16/skills` |
| `r9` | `/Users/bigfu/.codex/plugins/cache/openai-curated-remote/test-android-apps/0.1.2/skills` |
| `r10` | `/Users/bigfu/.codex/plugins/cache/openai-primary-runtime` |
| `r11` | `/Users/bigfu/.codex/plugins/cache/openai-primary-runtime/spreadsheets/26.802.11031/skills` |

### Skill 文件映射

- 默认路径：`root/<skill目录>/SKILL.md`；带插件前缀的 skill 以映射目录为准，当前会话技能清单更新时同步维护本文。
- `r1`：`imagegen`，`openai-docs`，`plugin-creator`，`skill-creator`，`skill-installer`。
- `r0`：`animation-vocabulary`，`apple-design`，`emil-design-eng`，`find-animation-opportunities`，`frontend-development`，`improve-animations`，`pick-ui-library`，`review-animations`。
- `r2`：`browser:control-in-app-browser` → `browser/26.727.40816/skills/control-in-app-browser`；`visualize:visualize` → `visualize/1.0.16/skills/visualize`。
- `r3`：`sites:sites-building`，`sites:sites-hosting`。
- `r4`：`build-ios-apps:` 下的 `ios-app-intents`，`ios-debugger-agent`，`ios-ettrace-performance`，`ios-memgraph-leaks`，`ios-simulator-browser`，`swiftui-liquid-glass`，`swiftui-performance-audit`，`swiftui-ui-patterns`，`swiftui-view-refactor`。
- `r5`：`build-macos-apps:` 下的 `appkit-interop`，`build-run-debug`，`liquid-glass`，`packaging-notarization`，`signing-entitlements`，`swiftpm-macos`，`swiftui-patterns`，`telemetry`，`test-triage`，`view-refactor`，`window-management`。
- `r6`：`build-web-apps:` 下的 `frontend-app-builder`，`frontend-testing-debugging`，`react-best-practices`，`stripe-best-practices`；`shadcn` → `shadcn-best-practices`；`supabase-postgres-best-practices` → `supabase-best-practices`。
- `r7`：`build-web-data-visualization:data-visualization` → `build-web-data-visualization/0.1.21/skills/data-visualization`。
- `r8`：`figma:` 下的 `figma-code-connect`，`figma-create-new-file`，`figma-design-to-code`，`figma-generate-design`，`figma-generate-diagram`，`figma-generate-library`，`figma-implement-motion`，`figma-swiftui`，`figma-use`，`figma-use-figjam`，`figma-use-motion`，`figma-use-slides`。
- `r9`：`test-android-apps:android-emulator-qa`，`test-android-apps:android-performance`。
- `r10`：`documents:documents` → `documents/26.802.11031/skills/documents`；`pdf:pdf` → `pdf/26.802.11031/skills/pdf`；`presentations:Presentations` → `presentations/26.802.11031/skills/presentations`；`template-creator:template-creator` → `template-creator/26.802.11031/skills/template-creator`。
- `r11`：`spreadsheets:Spreadsheets` → `spreadsheets`；`spreadsheets:excel-live-control` → `excel-live-control`。
