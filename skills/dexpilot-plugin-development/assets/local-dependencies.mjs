// 复制到插件 scripts/，由 Vite 配置调用；只依赖 Node 内置模块。
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

const dependencies = [
  { name: '@dexpilot/plugin-sdk', env: 'DEXPILOT_PLUGIN_SDK_DIR', directory: 'dexpilot-plugin-sdk' },
  { name: '@dexpilot/visualization', env: 'DEXPILOT_VISUALIZATION_DIR', directory: 'dexpilot-visualization' },
];
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const within = (parent, child) => {
  const value = relative(parent, child);
  return value !== '..' && !value.startsWith('../') && !value.startsWith('..\\') && !isAbsolute(value);
};
const exactVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const exactAlias = name => new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$');
function importTarget(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && !Array.isArray(value)) return importTarget(value.import ?? value.default);
  return null;
}

export function dependencyMode(projectRoot, { mode = 'production', env = process.env } = {}) {
  const root = realpathSync(projectRoot), local = mode === 'local-source';
  const inCI = env.CI !== undefined && !['', '0', 'false'].includes(String(env.CI).toLowerCase());
  if (local && (inCI || env.DEXPILOT_RELEASE_BUILD === '1')) throw new Error('CI/发布构建禁止本地依赖模式');
  const nodeModules = resolve(root, 'node_modules');
  const declared = json(resolve(root, 'package.json')).dependencies ?? {};
  const aliases = [], directories = [], packages = {}, resolvedPackages = {};
  for (const dependency of dependencies) {
    if (typeof declared[dependency.name] !== 'string' || !exactVersion.test(declared[dependency.name])) {
      throw new Error(`必须始终声明精确 npm 版本：${dependency.name}`);
    }
    const directory = realpathSync(local
      ? resolve(env[dependency.env] || resolve(dirname(root), dependency.directory))
      : resolve(nodeModules, dependency.name));
    const manifest = json(resolve(directory, 'package.json'));
    if (manifest.name !== dependency.name) throw new Error(`依赖身份不匹配：${dependency.name}`);
    if (!local) {
      if (!within(nodeModules, directory)) throw new Error(`生产依赖必须来自本仓 node_modules：${dependency.name}`);
      if (manifest.version !== declared[dependency.name]) throw new Error(`安装版本与声明不一致：${dependency.name}`);
    } else {
      // 此模板面向基线包的显式 exports；未来条件/通配导出需按该包契约适配。
      for (const [entry, value] of Object.entries(manifest.exports ?? {})) {
        const target = importTarget(value);
        if (!/^\.(?:\/[^*]+)?$/.test(entry) || !target?.startsWith('./')) throw new Error(`需适配本地入口：${dependency.name} ${entry}`);
        const path = dependency.name === '@dexpilot/plugin-sdk' && entry === '.'
          ? resolve(directory, 'src/index.js') : resolve(directory, target);
        if (!existsSync(path)) throw new Error(`本地入口缺失，请先构建依赖：${path}`);
        if (!within(directory, realpathSync(path))) throw new Error(`本地导出越过包目录：${entry}`);
        aliases.push({ find: exactAlias(dependency.name + (entry === '.' ? '' : entry.slice(1))), replacement: path });
      }
      if (!manifest.exports || !Object.keys(manifest.exports).length) throw new Error(`缺少本地 exports：${dependency.name}`);
      directories.push(directory);
    }
    packages[dependency.name] = { version: manifest.version };
    resolvedPackages[dependency.name] = directory;
  }
  return { root, mode: local ? 'local' : 'registry', aliases, directories, packages, resolvedPackages };
}

export function dependencySourcesPlugin(root, { env = process.env } = {}) {
  let selected;
  function checkedModules(context) {
    const modules = [...context.getModuleIds()].filter(id => !id.startsWith('\0')).map(id => {
      const path = id.split('?')[0];
      return isAbsolute(path) && existsSync(path) ? realpathSync(path) : path;
    });
    if (selected.mode === 'registry') {
      for (const id of modules) {
        if (isAbsolute(id) && existsSync(id) && !within(selected.root, id)) {
          throw new Error(`生产模块图包含仓库外源码：${id}`);
        }
      }
    }
    return modules;
  }
  return {
    name: 'dexpilot-dependency-sources',
    config(_config, environment) {
      selected = dependencyMode(root, { ...environment, env });
      return {
        resolve: { alias: selected.aliases, dedupe: ['vue', 'echarts', 'three'] },
        // Vite 自动 Worker 使用独立 Rollup 图，不能只检查页面主图。
        worker: { plugins: () => [{ name: 'dexpilot-worker-source-boundary', generateBundle() { checkedModules(this); } }] },
        ...(selected.mode === 'local' ? { server: { fs: { allow: [selected.root, ...selected.directories] } } } : {}),
      };
    },
    generateBundle() {
      const modules = checkedModules(this);
      const packages = Object.fromEntries(Object.entries(selected.resolvedPackages).map(([name, directory]) => {
        const moduleCount = modules.filter(id => isAbsolute(id) && within(directory, id)).length;
        if (!moduleCount) throw new Error(`构建未使用声明的公共依赖：${name}`);
        return [name, { ...selected.packages[name], moduleCount }];
      }));
      this.emitFile({ type: 'asset', fileName: 'dependency-sources.json',
        source: JSON.stringify({ mode: selected.mode, packages }, null, 2) + '\n' });
    },
  };
}
