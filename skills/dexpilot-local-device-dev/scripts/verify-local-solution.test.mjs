import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { verifyLocalSolution } from './verify-local-solution.mjs';

const desktop = process.env.DEXPILOT_DESKTOP_DIR;
if (!desktop) throw new Error('测试需要 DEXPILOT_DESKTOP_DIR 指向已安装依赖的 Desktop checkout');
const require = createRequire(join(resolve(desktop), 'package.json'));
const { ZipFile } = require('yazl');
const hash = value => createHash('sha256').update(value).digest('hex');
const apis = { desktop_api: '1.0.0', plugin_api: '2.0.0', backend_api: '1.0.0' };

async function archive(kind, { required = true, entry = kind } = {}) {
  // 仅供格式验证的未执行脚本，不是设备 SDK 或真实 Adapter。
  const runtime = { schema_version: '1.0', kind: kind+'-runtime', target: 'macos-arm64',
    entry, workdir: '.', ...(kind==='sdk' ? { mode:'process' } : { adapter_name:'test_adapter', sdk_required:required }) };
  const files = [{ path:entry, bytes:Buffer.from('#!/bin/sh\nexit 0\n'), mode:0o755 },
    { path:'runtime.json', bytes:Buffer.from(JSON.stringify(runtime)), mode:0o644 }];
  const inventory = Buffer.from(JSON.stringify({ schema_version:'1.0', files:files.map(f=>({path:f.path,size:f.bytes.length,sha256:hash(f.bytes),mode:'0'+f.mode.toString(8)})) }));
  const zip=new ZipFile(), chunks=[];
  const result=new Promise((done, reject)=>{zip.outputStream.on('data', c=>chunks.push(c));zip.outputStream.on('end', ()=>done(Buffer.concat(chunks)));zip.outputStream.on('error',reject);zip.on('error',reject);});
  for(const f of [...files,{path:'files.json',bytes:inventory,mode:0o644}]) zip.addBuffer(f.bytes,f.path,{mtime:new Date('2000-01-01T00:00:00Z'),forceDosTimestamp:true,mode:0o100000|f.mode});
  zip.end(); return result;
}
async function fixture(t, { required=true }={}) {
  const root=await mkdtemp(join(tmpdir(),'dexpilot-local-skill-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,'frontend/payload'),{recursive:true});
  const frontend={id:'ai.test.frontend',version:'1.0.0',type:'frontend',role:'exhibit',target:'universal',source:'link:./frontend'};
  const {source,...coordinates}=frontend;
  await writeFile(join(root,'frontend/module.json'),JSON.stringify({schema_version:'1.0',module:{...coordinates,entry:'payload/index.html'},permissions:{states:['device.info'],streams:[],commands:[],files:[]}}));
  await writeFile(join(root,'frontend/payload/index.html'),'<p>未连接设备</p>');
  const manifest={schema_version:'2.0',solution:{id:'ai.test.local',version:'1.0.0',display_name:'本地校验夹具',target:{vendor:'test',model:'test',adapter:'test_adapter',platform:'macos-arm64'}},dependencies:[frontend]};
  for(const kind of ['adapter','sdk']) {
    const bytes=await archive(kind,{required});
    await writeFile(join(root,kind+'.zip'),bytes);
    manifest.dependencies.push({id:'ai.test.'+kind,version:'1.0.0',type:kind,target:'macos-arm64',source:'file:./'+kind+'.zip',archive_format:'component-zip',size:bytes.length,sha256:hash(bytes),component:{kind}});
  }
  const solutionPath=join(root,'solution.json');
  const save=()=>writeFile(solutionPath,JSON.stringify(manifest)); await save();
  const check=(options={})=>verifyLocalSolution({desktop,solutionPath,hostTarget:'macos-arm64',...options});
  return {root,manifest,solutionPath,save,check};
}

test('完整本地方案预检只读，不安装或执行组件',async t=>{
  const f=await fixture(t),before=await readdir(f.root),original=await readFile(f.solutionPath);
  const result=await f.check();
  assert.equal(result.components.length,3);assert.equal(result.installed,false);assert.equal(result.started,false);assert.equal(result.network,false);
  assert.deepEqual(await readdir(f.root),before);assert.deepEqual(await readFile(f.solutionPath),original);
});
test('归档哈希不符时拒绝',async t=>{
  const f=await fixture(t); f.manifest.dependencies[1].sha256='0'.repeat(64);await f.save();
  await assert.rejects(f.check(),/哈希|SHA-256/);
});
test('原生开发链接即使 Schema 允许也被拒绝',async t=>{
  const f=await fixture(t),d=f.manifest.dependencies[1]; d.source='link:./adapter';delete d.sha256;delete d.archive_format;delete d.component;delete d.size;await f.save();
  await assert.rejects(f.check(),/不支持.*链接/);
});
test('缺少 SDK 不能由 allow-no-sdk 绕过 runtime 要求',async t=>{
  const f=await fixture(t);f.manifest.dependencies.pop();await f.save();
  await assert.rejects(f.check(),/唯一设备 SDK/);await assert.rejects(f.check({allowNoSdk:true}),/sdk_required/);
});
test('明确无需外置 SDK 的 Adapter 可显式省略',async t=>{
  const f=await fixture(t,{required:false});f.manifest.dependencies.pop();await f.save();
  assert.equal((await f.check({allowNoSdk:true})).components.length,2);
});
test('旧 .dxc 的 runtime.sdk_required 也不能被省略 SDK 开关绕过',async t=>{
  const f=await fixture(t),zip=new ZipFile(),chunks=[];
  const done=new Promise((accept,reject)=>{zip.outputStream.on('data',c=>chunks.push(c));zip.outputStream.on('end',()=>accept(Buffer.concat(chunks)));zip.outputStream.on('error',reject);});
  const module={id:'ai.test.adapter',version:'1.0.0',type:'adapter',target:'macos-arm64',entry:'payload/adapter'};
  for(const [name,body,mode] of [
    ['module.json',JSON.stringify({schema_version:'1.0',module}),0o644],
    ['payload/adapter','#!/bin/sh\nexit 0\n',0o755],
    ['payload/runtime.json',JSON.stringify({entry:'adapter',sdk_required:true,adapter_name:'test_adapter'}),0o644],
  ])zip.addBuffer(Buffer.from(body),name,{mode:0o100000|mode});
  zip.end();const bytes=await done;await writeFile(join(f.root,'adapter.dxc'),bytes);
  f.manifest.dependencies[1]={id:module.id,version:module.version,type:'adapter',target:module.target,source:'file:./adapter.dxc',archive_format:'dxc',size:bytes.length,sha256:hash(bytes)};
  f.manifest.dependencies.pop();await f.save();
  await assert.rejects(f.check({allowNoSdk:true}),/sdk_required/);
});
test('平台不匹配与远程来源分别拒绝',async t=>{
  const f=await fixture(t);f.manifest.dependencies[1].target='windows-amd64';await f.save();
  await assert.rejects(f.check(),/平台/);
  f.manifest.dependencies[1].target='macos-arm64';f.manifest.dependencies[1].source='official';await f.save();
  await assert.rejects(f.check(),/本地.*来源/);
});
test('目标 Adapter 名不一致时拒绝',async t=>{
  const f=await fixture(t);f.manifest.solution.target.adapter='other_adapter';await f.save();
  await assert.rejects(f.check(),/目标 Adapter/);
});
test('缺失前端入口时拒绝',async t=>{
  const f=await fixture(t);await rm(join(f.root,'frontend/payload/index.html'));
  await assert.rejects(f.check(),/入口不存在/);
});
test('组件格式可接受但当前 Host 不能扫描的嵌套 SDK 入口被拒绝',async t=>{
  const f=await fixture(t),bytes=await archive('sdk',{entry:'nested/sdk'});
  await writeFile(join(f.root,'sdk.zip'),bytes);
  Object.assign(f.manifest.dependencies[2],{size:bytes.length,sha256:hash(bytes)});await f.save();
  await assert.rejects(f.check(),/直接子文件/);
});
test('完整夹具可被实际安装器装入临时库并识别 Adapter 与 SDK',async t=>{
  const f=await fixture(t);await f.check();
  const {installSolution}=await import(pathToFileURL(join(desktop,'src/main/plugins/solution-installer.js')));
  const {readSolutionAdapters}=await import(pathToFileURL(join(desktop,'src/main/plugins/solution-adapters.js')));
  const storePath=join(f.root,'isolated-store');
  const record=await installSolution(f.solutionPath,{storePath,developmentMode:true,hostTarget:'macos-arm64',hostApiVersions:apis,approvePermissions:async()=>true});
  assert.equal(record.dependencies.length,3);
  const state=await readSolutionAdapters({storePath,developmentMode:true,hostTarget:'macos-arm64',hostApiVersions:apis,pluginLayout:true});
  assert.deepEqual(state.diagnostics,[]);assert.equal(state.artifacts.length,1);assert.equal(state.artifacts[0].sdk.id,'ai.test.sdk');
  assert.equal(state.artifacts[0].runtimeState,'inactive');
});
