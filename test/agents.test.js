// agents 探测单元测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAgents, isAgentAvailable, loadConfig } from '../dist/agents.js';

test('getAgents 返回三个内置 agent', () => {
  const agents = getAgents();
  const keys = agents.map((a) => a.key);
  assert.ok(keys.includes('codebuddy'));
  assert.ok(keys.includes('codex'));
  assert.ok(keys.includes('claude'));
});

test('isAgentAvailable：不存在的路径返回 false，node 可执行文件返回 true', () => {
  assert.equal(isAgentAvailable({ key: 'x', name: 'x', command: ['Z:\\\\no\\\\such\\\\file.exe'] }), false);
  assert.equal(isAgentAvailable({ key: 'x', name: 'x', command: [process.execPath] }), true);
});

test('ORB_CODEX_CMD 环境变量覆盖内置 codex 命令', () => {
  const old = process.env.ORB_CODEX_CMD;
  process.env.ORB_CODEX_CMD = JSON.stringify(['node', 'custom-codex.js', 'exec']);
  try {
    const agents = getAgents();
    const codex = agents.find((a) => a.key === 'codex');
    assert.deepEqual(codex.command, ['node', 'custom-codex.js', 'exec']);
  } finally {
    if (old === undefined) delete process.env.ORB_CODEX_CMD;
    else process.env.ORB_CODEX_CMD = old;
  }
});

test('ORB_AGENTS_EXTRA 注册自定义 agent，非法 JSON 被忽略', () => {
  const old = process.env.ORB_AGENTS_EXTRA;
  process.env.ORB_AGENTS_EXTRA = JSON.stringify({ myagent: { name: 'My Agent', command: ['node', 'x.js'] } });
  try {
    const agents = getAgents();
    const mine = agents.find((a) => a.key === 'myagent');
    assert.ok(mine);
    assert.equal(mine.name, 'My Agent');
  } finally {
    if (old === undefined) delete process.env.ORB_AGENTS_EXTRA;
    else process.env.ORB_AGENTS_EXTRA = old;
  }
  // 非法 JSON → 忽略，不抛错
  process.env.ORB_AGENTS_EXTRA = '{broken';
  try {
    assert.deepEqual(loadConfig().extraAgents, {});
  } finally {
    if (old === undefined) delete process.env.ORB_AGENTS_EXTRA;
    else process.env.ORB_AGENTS_EXTRA = old;
  }
});
