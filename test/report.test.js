// report 渲染单元测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderTable, renderSingle, renderParallel, renderDiscover, renderList, setColorEnabled } from '../dist/report.js';

/** 构造一条结果 */
function result(overrides = {}) {
  return {
    agent: 'fake',
    agentName: 'Fake Agent',
    prompt: 'task',
    ok: true,
    exitCode: 0,
    stdout: 'done',
    stderr: '',
    durationMs: 1234,
    summary: 'done',
    ...overrides,
  };
}

test('renderTable 包含表头与耗时', () => {
  const out = renderTable([
    result({ agentName: 'AgentA', durationMs: 1000 }),
    result({ agentName: 'AgentB', ok: false, exitCode: 1, error: '退出码 1', durationMs: 2000 }),
  ]);
  assert.match(out, /Agent/);
  assert.match(out, /1\.0s/);
  assert.match(out, /2\.0s/);
  assert.match(out, /成功/);
  assert.match(out, /失败/);
});

test('renderSingle 成功时隐藏 stderr 噪音', () => {
  const out = renderSingle(result({ stderr: 'banner noise\nmore noise' }));
  assert.doesNotMatch(out, /banner noise/);
});

test('renderSingle 失败时展示 stderr', () => {
  const out = renderSingle(result({ ok: false, error: '退出码 1', stderr: 'real error msg' }));
  assert.match(out, /real error msg/);
  assert.match(out, /退出码 1/);
});

test('renderParallel 逐条展示摘要', () => {
  const out = renderParallel([
    result({ summary: '第一件事完成' }),
    result({ ok: false, summary: '第二件失败', error: '退出码 2' }),
  ]);
  assert.match(out, /第一件事完成/);
  assert.match(out, /第二件失败/);
});

test('禁用颜色后无 ANSI 转义序列', () => {
  setColorEnabled(false);
  const out = renderSingle(result({ ok: false, error: '退出码 1', stderr: 'err' }));
  assert.doesNotMatch(out, /\x1b\[/);
  setColorEnabled(true);
});

test('renderDiscover 展示已安装和未检测到的 agent', () => {
  const out = renderDiscover([
    { key: 'codex', name: 'Codex', description: 'OpenAI CLI', found: true, version: '0.1.0', inConfig: false },
    { key: 'aider', name: 'Aider', description: 'AI pair programming', found: false, inConfig: true },
    { key: 'unknown', name: 'Unknown', description: 'Not installed', found: false, inConfig: false },
  ]);
  assert.match(out, /已安装/);
  assert.match(out, /codex/);
  assert.match(out, /未检测到/);
  assert.match(out, /unknown/);
});

test('renderList 展示所有 agent 及来源', () => {
  const out = renderList([
    { key: 'codex', name: 'Codex', available: true, source: 'registry', command: 'codex exec' },
    { key: 'custom', name: 'My Agent', available: false, source: 'config', command: 'my-cmd' },
  ]);
  assert.match(out, /已注册/);
  assert.match(out, /codex/);
  assert.match(out, /custom/);
  assert.match(out, /registry/);
  assert.match(out, /config/);
});
