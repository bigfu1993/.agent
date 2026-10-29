# CI、打包与发布

## 区分三类交付

| 交付物 | 用途 | 发布位置 |
| --- | --- | --- |
| npm SDK / visualization | 插件构建期依赖 | npm-hosted；消费者从 npm-group 拉取 |
| frontend 组件 ZIP | 页面、Worker、资源、元信息与校验清单 | 制品源的 frontend 组件坐标 |
| 型号发行/方案 | 精确绑定 frontend、adapter、sdk、geometry 等组件 | release 坐标和现行 registry/签名流程 |

前端插件工程默认只构建前端组件；只有明确需要时才组合现有原生 Adapter/SDK/geometry。源代码不能假装成可运行的跨平台二进制。纯静态前端通常为 `universal`，不等于原生组件也可 universal。

## 发布标签与一致性

前端插件仅接受：

```text
0.1.0-test.1
0.1.0
```

正则：`^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-test\.(0|[1-9][0-9]*))?$`。无 `v`、无多余前导零、无 beta/rc/其他预发布形式；测试序号建议从 1 递增，规则允许非负整数。脚本还需拒绝超出安全整数范围的数字。

校验 `package.json.version`、`plugin.yaml.version`、本次 frontend release 版本、组件内相应版本与 `CI_COMMIT_TAG` 一致（有 tag 时逐字相等）。其他独立原生依赖保留各自版本，不强行改成前端版本。此标签规则不覆盖 SDK npm 或多型号 geometry 仓库自身的发布规则。

普通 commit/MR：类型检查、测试、生产构建、打包、无网络上传的 dry-run；有效 tag：同样构建成功后，独立 publish 作业复用这些字节。禁止 publish 作业再安装依赖/重新打包。CI `rules` 和上传脚本都校验，手动调用不能绕过 tag/版本检查。

## 产物与打包器职责

当前 registry frontend 示例布局：

```text
module-artifacts/
  registry-artifacts.json
  registry/<package-id>/<version>/
    <package-id>-<version>-universal.zip
    <package-id>-<version>-universal.zip.sha256
    release.json

ZIP 根目录：
  index.html
  assets/...
  workers/...                  # 声明 Worker 时存在
  dependency-sources.json
  frontend-legacy.json          # 当前宿主兼容元数据，按目标加载契约生成
  files.json
```

`release.json` 的示意字段（示例身份必须替换）：

```json
{
  "component": "frontend",
  "package_id": "ai.example.frontend.demo",
  "version": "0.1.0-test.1",
  "target": "universal",
  "support_models": ["example-model"],
  "file": "ai.example.frontend.demo-0.1.0-test.1-universal.zip",
  "artifactPath": "dexpilot-plugins/frontend/ai.example.frontend.demo/0.1.0-test.1/universal/ai.example.frontend.demo-0.1.0-test.1-universal.zip",
  "size": 12345,
  "sha256": "由打包器写入实际六十四位十六进制摘要",
  "frontend": {
    "entry": "index.html",
    "slot": "exhibit",
    "adapters": ["example_adapter"],
    "workers": [],
    "permissions": { "states": ["device.info"], "streams": [], "commands": [], "files": [] }
  }
}
```

这个片段说明字段关系，size/sha256 不可照抄。`support_models` 严格采用 registry 的精确值；例如 f60 使用 `f60`，不自动 lowercase，也不把 Adapter 当型号。

打包器应完成：

1. 读取统一身份配置；校验源清单、版本、兼容范围、权限与 Worker 绑定。
2. 强制 registry 生产构建，核对来源证明；即使支持 `--skip-build`，也必须校验已有产物来源、完整性和入口。
3. 固定 ZIP 顺序、mtime、文件 mode 等影响内容的字段；不打入 node_modules、源码副本、认证文件、个人路径或无关日志。
4. 检查归档路径无绝对路径/`..`/越界符号链接；入口和所有 Worker 文件真实存在。
5. 生成 `files.json`（每个 payload 文件的 path/size/sha256/mode，排除清单自身）、ZIP 摘要与 release.json；三者必须描述同一份字节。
6. 生成 `registry-artifacts.json`，供发布作业定位本次产物，避免全目录 glob 混入旧版本。
7. 本地同坐标不同内容报错，或使用新的隔离核验输出目录；远端仍必须升级版本，不借临时目录规避不可变性。

保留已有 `.dxpkg/.dxc` 安装链时沿用其格式：旧 `.dxpkg` 包含 `manifest.json` 和组件归档；标准模块 `.dxc` 包含 `module.json` 与 `payload/`。二者不可混用 Schema，也不直接把 npm tgz 改扩展名。SDK `package-contract` 校验结构，不代替解包、入口、摘要、签名及权限核验。

参考现有打包器时先检查设备特有限制：DexHand 脚本当前限制单个只读前端、无 Worker/geometry，不能原封不动当作任意触觉插件脚手架；F20 脚本可能包含特定 geometry 生成任务。提取适用流程到当前插件内部脚本，不引入额外共享依赖。

## 远端路径

```text
dexpilot-plugins/<component>/<package-id>/<version>/<platform-path>/<filename>
dexpilot-plugins/release/<plugin-id>/<version>/<platform-path>/<filename>
```

平台路径为 `macos/arm64`、`windows/amd64`、`linux/amd64` 或单层 `universal`。清单 target 用 `macos-arm64` 等形式，运行时 `darwin/x64` 别名需由现行契约归一化，不凭文件名猜平台。

远端目录和文件名不加 build-id、流水线号或时间戳。`buildId` 只用于追溯元数据、本地暂存、GitLab artifacts 标识。旧包可保留既有产品前缀，但也移除构建编号层。`release.json` 同坐标同样不可变：若内含变化的追溯值造成冲突，应复用原发布结果或升版本，不覆盖它。

制品根地址由 `ARTIFACTS_INNER_REPOSITORY` 提供，要求不含凭据/查询/片段的 HTTPS 目录。构建 dry-run 也需要该非敏感配置；不硬编码过时的仓库根地址。

## GitLab CI 接线

采用 [assets/gitlab-ci.example.yml](../assets/gitlab-ci.example.yml) 前，在工程中实现这些命令：

| 命令 | 契约 |
| --- | --- |
| `pnpm typecheck` | TS/Vue 类型检查；纯 JS 工程按现有策略替换 |
| `pnpm test` | 不依赖相邻源码的测试，含版本/路径/打包/权限约束 |
| `pnpm pack:modules` | 内部生产 build 一次，完成上文输出，不上传 |
| `pnpm publish:artifacts --dry-run` | 仅校验本地产物、身份、版本、路径与摘要；零上传，可设计为零网络 |
| `node scripts/release/publish-artifacts.mjs` | 仅 Node 内置模块读取 job artifacts、校验 tag、预检、上传和 GET 回读，输出报告 |

新建 Skill 模板不会凭空提供目标设备的完整打包器。代理应按上述契约实现脚本或适配现有脚本，使 CI 中每条命令真实存在，不能只提交 YAML。

`needs: artifacts` 连接构建与发布，cache 只存 pnpm store；构建产物用 job artifacts 传递。当前示例是 Linux Docker Runner；Windows PowerShell 必须匹配 Windows Shell Runner，不能因为 tag 同名就假设环境正确。Runner/镜像是团队配置，复制前核验。GitLab 语法与 `needs`、`rules`、`resource_group` 见 [官方 YAML 参考](https://docs.gitlab.com/ci/yaml/)。

| CI 配置 | 说明 |
| --- | --- |
| `ARTIFACTS_INNER_REPOSITORY` | 非敏感制品 HTTPS 根地址，build/dry-run/publish 均可见 |
| `NPM_READ_CONFIG` | 可选文件变量，含只读 npm-group 认证；无需认证的环境可省略 |
| `NEXUS_USERNAME` / `NEXUS_PASSWORD` | 上传脚本读取的受保护、masked 变量，分配最小写权限 |
| 受保护版本 tag | 与发布规则匹配，使上传凭据仅供可信发布使用 |
| `PLUGIN_CI_IMAGE` / `PLUGIN_RUNNER_TAG` | 验证过的镜像和运行环境，不是发布坐标 |

不向不可信 MR 暴露发布凭据；私有依赖只读凭据的可见范围按团队 CI 策略设置。缺少凭据不通过打印现有配置排查。若资源由 Git LFS 管理，在构建前核验 git-lfs 与水合结果，不能把 LFS pointer 打进 ZIP。

## 上传的不可变事务

先对整批文件逐个预检，任何远端同坐标不同内容都在 PUT 前失败；404 才上传，相同内容可复用。先上传 ZIP/校验文件，最后上传 release.json。上传后完整 GET，比对大小与 SHA-256，HTTP 200 不能单独算成功。

网络超时/代理错误时先 GET 对账；没有确定结果不要盲目重复上传。串行化同项目发布，仓库本身也禁止覆盖，以防检查与写入之间的并发竞争。失败报告保留已完成步骤，使用同一产物可恢复重试，不删除远端文件绕过冲突。

制品上传完成不等于商店可见或 Desktop 可安装；还要按现行 registry 完成型号发行/方案、签名和受信任发布。用户未授权真实上传时，止于可审阅制品与 dry-run；已授权则在凭据可用时继续完成上传和回读，不再额外询问。
