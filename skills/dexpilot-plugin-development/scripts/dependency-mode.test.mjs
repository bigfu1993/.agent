import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { dependencyMode, dependencySourcesPlugin } from '../assets/local-dependencies.mjs';

function fixture(t) {
  const parent = mkdtempSync(join(tmpdir(), 'plugin-deps-test-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const root = join(parent, 'plugin');
  const write = (file, content) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  };
  const names = ['@dexpilot/plugin-sdk', '@dexpilot/visualization'];
  const dirs = ['dexpilot-plugin-sdk', 'dexpilot-visualization'];
  const project = { dependencies: Object.fromEntries(names.map(name => [name, '1.0.0'])) };
  write(join(root, 'package.json'), project);
  const installed = [], local = [];
  names.forEach((name, i) => {
    const locations = [join(root, 'node_modules', name), join(parent, dirs[i])];
    installed.push(locations[0]); local.push(locations[1]);
    for (const dir of locations) {
      write(join(dir, 'package.json'), { name, version: '1.0.0', exports: i === 0
        ? { '.': { types: './dist/index.d.ts', import: './dist/index.js' }, './contract': './dist/contract.js' }
        : { './ui': './src/ui.js', './theme.css': './src/theme.css' } });
      for (const file of ['src/index.js', 'dist/index.js', 'dist/contract.js', 'src/ui.js', 'src/theme.css']) write(join(dir, file), '');
    }
  });
  return { root, parent, installed, local, names, project, write };
}

test('生产默认解析仓库内 registry 包且不改 package.json', t => {
  const f = fixture(t), before = readFileSync(join(f.root, 'package.json'));
  const result = dependencyMode(f.root, { env: {} });
  assert.equal(result.mode, 'registry');
  assert.equal(result.aliases.length, 0);
  assert.equal(result.packages[f.names[0]].version, '1.0.0');
  assert.deepEqual(readFileSync(join(f.root, 'package.json')), before);
});
test('显式开发模式使用 SDK 源码且子路径精确匹配', t => {
  const f = fixture(t), result = dependencyMode(f.root, { mode: 'local-source', env: {} });
  const entry = result.aliases.find(a => a.find.test('@dexpilot/plugin-sdk'));
  assert.equal(entry.replacement, realpathSync(join(f.local[0], 'src/index.js')));
  assert.equal(entry.find.test('@dexpilot/plugin-sdk/contract'), false);
  assert.ok(result.aliases.some(a => a.find.test('@dexpilot/visualization/theme.css')));
});
test('CI 和发布构建拒绝显式本地模式', t => {
  const f = fixture(t);
  for (const env of [{ CI: 'true' }, { DEXPILOT_RELEASE_BUILD: '1' }]) {
    assert.throws(() => dependencyMode(f.root, { mode: 'local-source', env }), /禁止本地/);
  }
});
test('生产忽略本地目录环境变量', t => {
  const f = fixture(t);
  assert.equal(dependencyMode(f.root, { env: { DEXPILOT_PLUGIN_SDK_DIR: '/missing' } }).mode, 'registry');
});
test('生产拒绝范围及本地依赖声明', t => {
  const f = fixture(t);
  for (const spec of ['^1.0.0', 'workspace:*', 'file:../sdk', 'link:../sdk', 'latest']) {
    f.project.dependencies[f.names[0]] = spec;
    f.write(join(f.root, 'package.json'), f.project);
    assert.throws(() => dependencyMode(f.root, { env: {} }), /精确/);
  }
});
test('生产拒绝同名不同版本包', t => {
  const f = fixture(t);
  f.write(join(f.installed[0], 'package.json'), { name: f.names[0], version: '9.0.0' });
  assert.throws(() => dependencyMode(f.root, { env: {} }), /版本/);
});
test('生产拒绝链接到相邻源码', t => {
  const f = fixture(t);
  rmSync(f.installed[0], { recursive: true });
  symlinkSync(f.local[0], f.installed[0], 'dir');
  assert.throws(() => dependencyMode(f.root, { env: {} }), /node_modules/);
});
test('允许 pnpm 在本仓 node_modules 内的正常符号链接', t => {
  const f = fixture(t), target = join(f.root, 'node_modules/.pnpm/sdk/node_modules/@dexpilot/plugin-sdk');
  f.write(join(target, 'package.json'), { name: f.names[0], version: '1.0.0' });
  rmSync(f.installed[0], { recursive: true });
  symlinkSync(target, f.installed[0], 'dir');
  assert.equal(dependencyMode(f.root, { env: {} }).mode, 'registry');
});
test('本地缺失生成入口时失败而非回退 registry', t => {
  const f = fixture(t);
  rmSync(join(f.local[0], 'dist/contract.js'));
  assert.throws(() => dependencyMode(f.root, { mode: 'local-source', env: {} }), /入口/);
});
test('构建证明不泄漏本机目录且统计实际模块', t => {
  const f = fixture(t), plugin = dependencySourcesPlugin(f.root, { env: {} });
  plugin.config({}, { mode: 'production' });
  let output;
  plugin.generateBundle.call({ getModuleIds: () => [join(f.installed[0], 'dist/index.js'), join(f.installed[1], 'src/ui.js')], emitFile: value => { output = value; } });
  const proof = JSON.parse(output.source);
  assert.equal(output.fileName, 'dependency-sources.json');
  assert.equal(proof.mode, 'registry');
  assert.equal(proof.packages[f.names[0]].moduleCount, 1);
  assert.equal(output.source.includes(f.parent), false);
});
test('生产模块图拒绝绕过依赖配置的相邻源码导入', t => {
  const f = fixture(t), plugin = dependencySourcesPlugin(f.root, { env: {} });
  plugin.config({}, { mode: 'production' });
  assert.throws(() => plugin.generateBundle.call({ getModuleIds: () => [join(f.local[0], 'src/index.js')], emitFile() {} }), /仓库外/);
});
test('Vite 独立 Worker 构建也拒绝仓库外源码且不要求导入 UI', t => {
  const f = fixture(t), plugin = dependencySourcesPlugin(f.root, { env: {} });
  const config = plugin.config({}, { mode: 'production' });
  const [guard] = config.worker.plugins();
  assert.throws(() => guard.generateBundle.call({ getModuleIds: () => [join(f.local[0], 'src/index.js')] }), /仓库外/);
  assert.doesNotThrow(() => guard.generateBundle.call({ getModuleIds: () => [join(f.installed[0], 'dist/index.js')] }));
});
