#!/usr/bin/env node
// AgentOrb —— 多 Agent 编排 CLI 入口
import { Command } from 'commander';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadConfig, addAgentToConfig, removeAgentFromConfig, parseCommandString } from './config.js';
import { isAgentAvailable, probeVersion } from './agents.js';
import { discoverAgents, discoverNew } from './discover.js';
import { REGISTRY, findRegistryEntry } from './registry.js';
import { runAgent, runAll } from './runner.js';
import { renderTable, renderSingle, renderParallel, renderDiscover, renderList, setColorEnabled } from './report.js';
import { AgentSpec, AgentConfigEntry, OrbResult, PromptMode } from './types.js';

const program = new Command();

program
  .name('orb')
  .description('多 Agent 编排 CLI：统一调度市面主流 coding agent')
  .version('2.0.0')
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

/** 统一出口 */
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
    console.error('没有可用的 agent。运行 orb discover 查看已安装的 agent，或 orb add 添加自定义 agent。');
    process.exit(1);
  }
  return ok;
}

// ── list：列出所有 agent ──
program
  .command('list')
  .description('列出所有注册/配置的 agent 及状态')
  .action(() => {
    const opts = program.opts();
    const config = loadConfig();
    const items = config.agents.map((a) => {
      const available = isAgentAvailable(a);
      const version = available ? probeVersion(a) : undefined;
      return {
        key: a.key,
        name: a.name,
        available,
        version,
        source: a.source ?? 'unknown',
        command: a.command.join(' '),
        promptMode: a.promptMode ?? 'positional',
      };
    });

    if (opts.json) {
      console.log(JSON.stringify(items, null, 2));
      return;
    }

    console.log(renderList(items));
  });

// ── discover：探测系统已安装的 agent ──
program
  .command('discover')
  .description('自动探测系统已安装的 coding agent')
  .option('--new', '只显示新发现的（未在配置中的）')
  .action((cmdOpts: { new?: boolean }) => {
    const opts = program.opts();
    const results = cmdOpts.new ? discoverNew() : discoverAgents();

    if (opts.json) {
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    console.log(renderDiscover(results));
  });

// ── add：添加 agent 到配置 ──
program
  .command('add <key>')
  .description('添加 agent 到配置文件')
  .option('--name <name>', '显示名称')
  .option('--command <cmd>', '命令（空格分隔，如 \"aider --yes-always\"）')
  .option('--prompt-mode <mode>', 'prompt 传递方式：positional / flag / stdin', 'positional')
  .option('--prompt-flag <flag>', 'flag 模式的 flag 名（如 --prompt、-p）')
  .option('--shell', '通过 shell 执行（Windows .cmd 命令需要）')
  .option('--from-registry', '从注册表加载默认配置（不指定 --command 时自动使用）')
  .action((key: string, cmdOpts: { name?: string; command?: string; promptMode?: string; promptFlag?: string; shell?: boolean; fromRegistry?: boolean }) => {
    // 判断是从注册表还是自定义
    const registryEntry = findRegistryEntry(key);
    const useRegistry = cmdOpts.fromRegistry || (!cmdOpts.command && registryEntry);

    let entry: AgentConfigEntry;

    if (useRegistry && registryEntry) {
      entry = {
        name: cmdOpts.name ?? registryEntry.name,
        command: registryEntry.defaultCommand,
        promptMode: registryEntry.promptMode,
        promptFlag: registryEntry.promptFlag,
        shell: registryEntry.shell,
      };
      console.log(`从注册表加载 ${key} 默认配置`);
    } else {
      if (!cmdOpts.command) {
        console.error(`未知 agent: ${key}。请用 --command 指定调用命令，或用 orb discover 查看可用的注册表 agent。`);
        console.error(`注册表包含: ${REGISTRY.map((e) => e.key).join(', ')}`);
        process.exit(1);
      }
      const promptMode = (cmdOpts.promptMode ?? 'positional') as PromptMode;
      if (!['positional', 'flag', 'stdin'].includes(promptMode)) {
        console.error(`无效的 prompt-mode: "${promptMode}"。可选: positional, flag, stdin`);
        process.exit(1);
      }
      entry = {
        name: cmdOpts.name ?? key,
        command: parseCommandString(cmdOpts.command),
        promptMode,
        promptFlag: cmdOpts.promptFlag,
        shell: cmdOpts.shell,
      };
    }

    addAgentToConfig(key, entry);
    console.log(`✓ 已添加 agent "${key}" 到配置文件`);
    console.log(`  命令: ${Array.isArray(entry.command) ? entry.command.join(' ') : entry.command}`);
    console.log(`  prompt 模式: ${entry.promptMode ?? 'positional'}`);
  });

// ── remove：从配置移除 agent ──
program
  .command('remove <key>')
  .description('从配置文件移除 agent')
  .action((key: string) => {
    if (removeAgentFromConfig(key)) {
      console.log(`✓ 已从配置中移除 agent "${key}"`);
    } else {
      console.error(`配置中未找到 agent "${key}"`);
      process.exit(1);
    }
  });

// ── run：指定 agent 执行单个任务 ──
program
  .command('run <agent> <prompt...>')
  .description('指定 agent 执行单个任务')
  .action(async (agentKey: string, promptArgs: string[]) => {
    const opts = program.opts();
    setColorEnabled(opts.color !== false);
    const config = loadConfig();
    const spec = config.agents.find((a) => a.key === agentKey);
    if (!spec) {
      console.error(`未知 agent: ${agentKey}。可用: ${config.agents.map((a) => a.key).join(', ')}`);
      process.exit(1);
    }
    if (!isAgentAvailable(spec)) {
      console.error(`agent ${spec.name} 当前不可用（命令不存在）。运行 orb list 检查状态。`);
      process.exit(1);
    }
    const prompt = promptArgs.join(' ');
    const result = await runAgent(spec, prompt, Number(opts.timeout) * 1000);
    emit(
      { command: `run-${agentKey}`, prompts: [prompt], timestamp: new Date().toISOString(), results: [result] },
      () => renderSingle(result),
    );
  });

// ── all：所有可用 agent 执行同一任务 ──
program
  .command('all <prompt...>')
  .description('所有可用 agent 执行同一任务，输出对比表')
  .action(async (promptArgs: string[]) => {
    const opts = program.opts();
    setColorEnabled(opts.color !== false);
    const config = loadConfig();
    const agents = availableAgents(config.agents);
    const prompt = promptArgs.join(' ');
    const results = await Promise.all(agents.map((a) => runAgent(a, prompt, Number(opts.timeout) * 1000)));
    emit(
      { command: 'all', prompts: [prompt], timestamp: new Date().toISOString(), results },
      () => renderTable(results),
    );
  });

// ── parallel：多任务并行分发 ──
program
  .command('parallel <tasks...>')
  .description('多个任务并行分发到不同 agent（轮询分配）')
  .action(async (tasks: string[]) => {
    const opts = program.opts();
    setColorEnabled(opts.color !== false);
    const config = loadConfig();
    const agents = availableAgents(config.agents);
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
