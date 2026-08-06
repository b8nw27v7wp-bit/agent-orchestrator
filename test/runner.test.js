// runner 单元测试（node:test，零依赖；测 dist 编译产物）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAgent, runAll } from '../dist/runner.js';

/** 构造假 agent：直接跑 node -e，避免依赖真实 CLI */
function fakeAgent(code) {
  return {
    key: 'fake',
    name: 'Fake Agent',
    command: [process.execPath, '-e', code],
    shell: false,
  };
}

test('正常退出：ok=true，stdout 正确收集', async () => {
  const r = await runAgent(fakeAgent("console.log('hello orb')"), 'task', 5000);
  assert.equal(r.ok, true);
  assert.equal(r.exitCode, 0);
  assert.match(r.stdout, /hello orb/);
  assert.equal(r.error, undefined);
  assert.ok(r.durationMs >= 0);
});

test('非零退出：ok=false，error 含退出码', async () => {
  const r = await runAgent(fakeAgent('process.exit(3)'), 'task', 5000);
  assert.equal(r.ok, false);
  assert.equal(r.exitCode, 3);
  assert.match(r.error, /退出码 3/);
});

test('超时终止：killTree 生效且快速返回', async () => {
  const started = Date.now();
  const r = await runAgent(fakeAgent('setTimeout(() => {}, 10000)'), 'task', 300);
  const elapsed = Date.now() - started;
  assert.equal(r.ok, false);
  assert.match(r.error, /超时终止/);
  assert.ok(elapsed < 3000, `应在超时后立即返回，实际 ${elapsed}ms`);
});

test('stdin 置 ignore：agent 读不到 stdin 输入', async () => {
  const code = `
    process.stdin.on('data', () => { console.log('GOT-STDIN'); process.exit(1); });
    setTimeout(() => { console.log('NO-STDIN'); process.exit(0); }, 400);
  `;
  const r = await runAgent(fakeAgent(code), 'task', 5000);
  assert.equal(r.ok, true, `stdin 被 ignore，不应读到输入: ${r.stderr}`);
  assert.match(r.stdout, /NO-STDIN/);
  assert.doesNotMatch(r.stdout, /GOT-STDIN/);
});

test('summary 截断到 120 字符', async () => {
  const r = await runAgent(fakeAgent("console.log('x'.repeat(500))"), 'task', 5000);
  assert.ok(r.summary.length <= 123, `summary 过长: ${r.summary.length}`);
  assert.match(r.summary, /…$/);
});

test('runAll 轮询分配：每个任务分给对应 agent', async () => {
  const a = { ...fakeAgent("console.log('A')"), key: 'a' };
  const b = { ...fakeAgent("console.log('B')"), key: 'b' };
  const results = await runAll([a, b], ['t1', 't2', 't3'], 5000);
  assert.equal(results.length, 3);
  assert.deepEqual(results.map((r) => r.agent), ['a', 'b', 'a']);
  assert.ok(results.every((r) => r.ok));
});
