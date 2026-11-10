// 只读本地方案预检：复用目标 Desktop 校验器，不下载、不安装、不执行组件。
import { readFile, lstat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';

const defaultApis = { desktop_api: '1.0.0', plugin_api: '2.0.0', backend_api: '1.0.0' };
const fail = message => { throw new Error(message); };

async function regularBytes(path) {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`输入必须为普通文件：${path}`);
  return readFile(path);
}

export async function verifyLocalSolution({ desktop, solutionPath, hostTarget, allowNoSdk = false, hostApis = defaultApis }) {
  if (!desktop || !solutionPath) fail('需要 desktop 与 solutionPath');
  const desktopRoot = resolve(desktop), manifestPath = resolve(solutionPath);
  const load = name => import(pathToFileURL(join(desktopRoot, 'src/main/plugins', name)).href);
  const [{ validateSolutionManifest }, { validateModuleBytes }, { readLinkedModule }, { normalizeHostTarget }] = await Promise.all([
    load('solution-manifest.js'), load('module-store.js'), load('module-link.js'), load('module-target.js'),
  ]);
  const target = hostTarget ?? normalizeHostTarget(process.platform, process.arch);
  const input = await regularBytes(manifestPath);
  let manifest;
  try {
    const require = createRequire(join(desktopRoot, 'package.json'));
    manifest = /\.ya?ml$/i.test(manifestPath)
      ? require('js-yaml').load(input.toString('utf8'), { schema: require('js-yaml').JSON_SCHEMA })
      : JSON.parse(input.toString('utf8'));
  } catch { fail('方案 JSON/YAML 解析失败；未打印原文'); }
  validateSolutionManifest(manifest, { developmentMode: true, hostTarget: target, hostApiVersions: hostApis });
  const grouped = type => manifest.dependencies.filter(d => d.type === type);
  if (grouped('frontend').length !== 1 || grouped('adapter').length !== 1) fail('完整本地设备方案必须恰好有一个 frontend 和一个 adapter');
  if (grouped('sdk').length > 1 || !allowNoSdk && grouped('sdk').length !== 1) fail('需要唯一设备 SDK；已内嵌或无需外置时显式使用 --allow-no-sdk');
  if (grouped('resource').length > 1) fail('此预检支持每方案至多一个 geometry，请按目标运行 Manager 明确扩展');
  const checked = [];
  for (const dependency of manifest.dependencies) {
    const native = ['adapter', 'sdk'].includes(dependency.type);
    if (!['frontend', 'adapter', 'sdk', 'resource'].includes(dependency.type) || dependency.type === 'resource' && dependency.role !== 'geometry') fail('此工具只核验 frontend/adapter/sdk/geometry');
    if (!/^(file|link):/.test(dependency.source)) fail('只接受本地 file/link 来源；不会下载 official 制品');
    if (native && dependency.source.startsWith('link:')) fail('原生运行链不支持 Adapter/SDK 开发链接');
    if (native && dependency.target !== target) fail('原生组件必须匹配本次宿主精确平台');
    if (dependency.type === 'sdk' && dependency.archive_format !== 'component-zip') fail('当前设备 SDK 运行 Manager 要求 component-zip');
    const path = resolve(dirname(manifestPath), dependency.source.slice(dependency.source.indexOf(':') + 1));
    const validated = dependency.source.startsWith('link:')
      ? await readLinkedModule(path, dependency, hostApis)
      : await validateModuleBytes(await regularBytes(path), dependency, hostApis);
    let runtime = validated.runtime;
    // 旧 .dxc 校验返回 entries，但不投影 payload/runtime.json，需补读其依赖声明。
    if (dependency.type === 'adapter' && !runtime && validated.entries.has('payload/runtime.json')) {
      try { runtime = JSON.parse(validated.entries.get('payload/runtime.json').toString('utf8')); }
      catch { fail('Adapter runtime.json 无法解析'); }
      if (!runtime || typeof runtime !== 'object' || Array.isArray(runtime)
        || runtime.sdk_required !== undefined && typeof runtime.sdk_required !== 'boolean'
        || runtime.entry !== undefined && validated.manifest.module.entry !== 'payload/'+runtime.entry
        || runtime.target !== undefined && runtime.target !== target) fail('Adapter runtime.json 与模块声明不一致');
    }
    if (dependency.type === 'sdk') {
      // Desktop 组件格式允许的入口不一定能被当前 Host 插件扫描器接受。
      const entry = validated.runtime?.entry;
      if (!entry || /[\\/]/.test(entry)) fail('当前 Host 插件扫描要求 SDK entry 为 sdk/ 的直接子文件');
      if (target.startsWith('windows-') && !/\.(exe|cmd)$/i.test(entry)) fail('当前 Windows Host SDK 扫描只接受 .exe/.cmd 入口');
      if (!target.startsWith('windows-') && !(validated.modes?.get('payload/'+entry) & 0o111)) fail('当前 Host SDK 扫描要求入口具有执行位');
    }
    if (dependency.type === 'adapter' && runtime?.sdk_required && !grouped('sdk').length) fail('Adapter runtime.sdk_required 为 true，不能省略设备 SDK');
    if (dependency.type === 'adapter' && runtime?.adapter_name && runtime.adapter_name !== manifest.solution.target.adapter) fail('Adapter 运行声明与方案目标 Adapter 不一致');
    if (dependency.type === 'frontend') {
      const metadataBytes = validated.entries.get('payload/frontend-legacy.json');
      let metadata = dependency.component?.frontend;
      if (metadataBytes) {
        try { metadata = JSON.parse(metadataBytes.toString('utf8')); }
        catch { fail('前端兼容元数据无法解析'); }
      }
      if (metadata?.adapters && !metadata.adapters.includes(manifest.solution.target.adapter)) fail('前端声明未包含目标 Adapter');
      if (metadata?.geometry_component_by_adapter?.[manifest.solution.target.adapter] && !grouped('resource').length) fail('前端要求 geometry，但方案未提供');
    }
    checked.push({ id: dependency.id, version: dependency.version, type: dependency.type,
      target: dependency.target, source: dependency.source, entry: validated.manifest.module.entry,
      ...(dependency.sha256 ? { sha256: dependency.sha256, size: dependency.size } : {}),
      ...(runtime ? { runtime } : {}),
      ...(validated.manifest.permissions ? { permissions: validated.manifest.permissions } : {}) });
  }
  return { dryRun: true, installed: false, started: false, network: false, hostTarget: target,
    solution: manifest.solution, components: checked,
    note: '仅证明本地声明/文件与目标 Desktop 校验器相符；未证明信任批准、SDK 运行、Host 注册或真机可用' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: {
      desktop: { type: 'string' }, solution: { type: 'string' }, 'host-target': { type: 'string' },
      'host-apis': { type: 'string' }, 'allow-no-sdk': { type: 'boolean', default: false }, help: { type: 'boolean' },
    } });
    if (values.help) console.log('用法：node scripts/verify-local-solution.mjs --desktop <Desktop仓库> --solution <本地JSON或YAML> [--host-target macos-arm64] [--host-apis 版本表.json] [--allow-no-sdk]\n只读校验，不下载、不执行组件、不安装；host-target 仅控制校验目标，不保证当前机器可运行。');
    else {
      let hostApis;
      if (values['host-apis']) { try { hostApis = JSON.parse(await regularBytes(resolve(values['host-apis']))); } catch { fail('宿主 API 版本表无效'); } }
      const result = await verifyLocalSolution({ desktop: values.desktop, solutionPath: values.solution,
        hostTarget: values['host-target'], allowNoSdk: values['allow-no-sdk'], ...(hostApis ? { hostApis } : {}) });
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error(`${error.code ?? 'LOCAL_SOLUTION_INVALID'}: ${error.message}`);
    process.exitCode = 1;
  }
}
