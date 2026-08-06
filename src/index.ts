#!/usr/bin/env node
// AgentOrb —— 多 Agent 编排 CLI 入口
import { Command } from 'commander';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getAgents, isAgentAvailable } from './agents.js';
import { runAgent, runAll } from './runner.js';
import { renderTable, renderSingle, renderParallel, setColorEnabled } from './report.js';
import { AgentSpec, OrbResult, RunResult } from './types.js';

const program = new Command();

program
  .name('orb')
  .description('多 Agent 编排 CLI：统一调度本机 CodeBuddy / Codex / Claude Code')
  .version('1.0.0')
  .option('--json', '输出 JSON 结构化结果')
  .option('--no-color', '禁用 ANSI 颜色')
  .option('--timeout <seconds>', '单任务超时秒数', '180');

/** 保存结果到 results/ 目录 */
function saveResult(result: OrbResult): string {
  const dir = resolve('results');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = join(dir, `${stamp}-${result.command}.json`);
  writeFileSync(file, JSON.stringify(result, null, 2), 'utf8');
  return file;
}

/** 统一出口：按 --json 输出或渲染 */
function emit(result: OrbResult, render: () => string): void {
  const opts = program.opts();
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(render());
    console.log(`\n结果已保存: ${saveResult(result)}`);
  }
}

/** 过滤出可用 agent，全不可用则报错退出 */
function availableAgents(specs: AgentSpec[]): AgentSpec[] {
  const ok = specs.filter(isAgentAvailable);
  if (ok.length === 0) {
    console.error('没有可用的 agent。请检查 codebuddy/codex/claude 是否已安装。');
    process.exit(1);
  }
  return ok;
}

program
  .command('list')
  .description('列出可用 agent 及状态')
  .action(() => {
    const opts = program.opts();
    const agents = getAgents();
    const items = agents.map((a) => ({
      key: a.key,
      name: a.name,
      available: isAgentAvailable(a),
      command: a.command.join(' '),
    }));
    if (opts.json) {
      console.log(JSON.stringify(items, null, 2));
      return;
    }
    for (const it of items) {
      const tag = it.available ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
      console.log(`${tag} ${it.name.padEnd(24)} ${it.key.padEnd(10)} ${it.command}`);
    }
  });

program
  .command('run <agent> <prompt...>')
  .description('指定 agent 执行单个任务')
  .action(async (agentKey: string, promptArgs: string[]) => {
    const opts = program.opts();
    setColorEnabled(opts.color !== false);
    const spec = getAgents().find((a) => a.key === agentKey);
    if (!spec) {
      console.error(`未知 agent: ${agentKey}。可用: ${getAgents().map((a) => a.key).join(', ')}`);
      process.exit(1);
    }
    const s: AgentSpec = spec;
    if (!isAgentAvailable(s)) {
      console.error(`agent ${s.name} 当前不可用（命令不存在）`);
      process.exit(1);
    }
    const prompt = promptArgs.join(' ');
    const result = await runAgent(s, prompt, Number(opts.timeout) * 1000);
    emit(
      { command: `run-${agentKey}`, prompts: [prompt], timestamp: new Date().toISOString(), results: [result] },
      () => renderSingle(result),
    );
  });

program
  .command('all <prompt...>')
  .description('所有可用 agent 执行同一任务，输出对比表')
  .action(async (promptArgs: string[]) => {
    const opts = program.opts();
    setColorEnabled(opts.color !== false);
    const agents = availableAgents(getAgents());
    const prompt = promptArgs.join(' ');
    const results = await Promise.all(agents.map((a) => runAgent(a, prompt, Number(opts.timeout) * 1000)));
    emit(
      { command: 'all', prompts: [prompt], timestamp: new Date().toISOString(), results },
      () => renderTable(results),
    );
  });

program
  .command('parallel <tasks...>')
  .description('多个任务并行分发到不同 agent（轮询分配）')
  .action(async (tasks: string[]) => {
    const opts = program.opts();
    setColorEnabled(opts.color !== false);
    const agents = availableAgents(getAgents());
    const results = await runAll(agents, tasks, Number(opts.timeout) * 1000);
    emit(
      { command: 'parallel', prompts: tasks, timestamp: new Date().toISOString(), results },
      () => renderParallel(results),
    );
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
