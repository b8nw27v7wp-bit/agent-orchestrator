// agents 探测 + config + registry 单元测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAgentAvailable, probeVersion } from '../dist/agents.js';
import { loadConfig } from '../dist/config.js';
import { REGISTRY, findRegistryEntry } from '../dist/registry.js';

test('REGISTRY 包含 20+ 个注册 agent', () => {
  assert.ok(REGISTRY.length >= 20, `注册表应有 20+ agent，实际 ${REGISTRY.length}`);
  const keys = REGISTRY.map((e) => e.key);
  assert.ok(keys.includes('codebuddy'));
  assert.ok(keys.includes('codex'));
  assert.ok(keys.includes('claude'));
  assert.ok(keys.includes('aider'));
  assert.ok(keys.includes('gemini'));
  assert.ok(keys.includes('amazon-q'));
});

test('findRegistryEntry 按 key 查找', () => {
  const codex = findRegistryEntry('codex');
  assert.ok(codex);
  assert.equal(codex.name, 'Codex');
  assert.equal(codex.promptMode, 'positional');
  const aider = findRegistryEntry('aider');
  assert.ok(aider);
  assert.equal(aider.promptMode, 'flag');
  assert.equal(aider.promptFlag, '--message');
  assert.equal(findRegistryEntry('nonexistent'), undefined);
});

test('loadConfig 返回所有注册表 agent（无配置文件时）', () => {
  const config = loadConfig();
  assert.ok(config.agents.length >= 20, `应有 20+ agent，实际 ${config.agents.length}`);
  const keys = config.agents.map((a) => a.key);
  assert.ok(keys.includes('codex'));
  assert.ok(keys.includes('claude'));
  assert.ok(keys.includes('aider'));
  // 注册表 agent 来源应为 registry
  const codex = config.agents.find((a) => a.key === 'codex');
  assert.equal(codex.source, 'registry');
});

test('isAgentAvailable：不存在的路径返回 false，node 可执行文件返回 true', () => {
  assert.equal(isAgentAvailable({ key: 'x', name: 'x', command: ['Z:\\no\\such\\file.exe'] }), false);
  assert.equal(isAgentAvailable({ key: 'x', name: 'x', command: [process.execPath] }), true);
});

test('ORB_CODEX_CMD 环境变量覆盖注册表 codex 命令', () => {
  const old = process.env.ORB_CODEX_CMD;
  process.env.ORB_CODEX_CMD = JSON.stringify(['node', 'custom-codex.js', 'exec']);
  try {
    const config = loadConfig();
    const codex = config.agents.find((a) => a.key === 'codex');
    assert.ok(codex, '应存在 codex agent');
    assert.deepEqual(codex.command, ['node', 'custom-codex.js', 'exec']);
    assert.equal(codex.source, 'env');
  } finally {
    if (old === undefined) delete process.env.ORB_CODEX_CMD;
    else process.env.ORB_CODEX_CMD = old;
  }
});

test('ORB_AGENTS_EXTRA 注册自定义 agent，非法 JSON 被忽略', () => {
  const old = process.env.ORB_AGENTS_EXTRA;
  process.env.ORB_AGENTS_EXTRA = JSON.stringify({ myagent: { name: 'My Agent', command: ['node', 'x.js'] } });
  try {
    const config = loadConfig();
    const mine = config.agents.find((a) => a.key === 'myagent');
    assert.ok(mine);
    assert.equal(mine.name, 'My Agent');
    assert.equal(mine.source, 'env');
  } finally {
    if (old === undefined) delete process.env.ORB_AGENTS_EXTRA;
    else process.env.ORB_AGENTS_EXTRA = old;
  }
  // 非法 JSON → 忽略，不抛错
  process.env.ORB_AGENTS_EXTRA = '{broken';
  try {
    const config = loadConfig();
    assert.ok(config.agents.length > 0, '即使 ORB_AGENTS_EXTRA 非法，仍应返回 agent 列表');
  } finally {
    if (old === undefined) delete process.env.ORB_AGENTS_EXTRA;
    else process.env.ORB_AGENTS_EXTRA = old;
  }
});

test('registry agent 的 promptMode 正确传递', () => {
  const config = loadConfig();
  const aider = config.agents.find((a) => a.key === 'aider');
  assert.ok(aider);
  assert.equal(aider.promptMode, 'flag');
  assert.equal(aider.promptFlag, '--message');

  const codex = config.agents.find((a) => a.key === 'codex');
  assert.ok(codex);
  assert.equal(codex.promptMode, 'positional');
});
