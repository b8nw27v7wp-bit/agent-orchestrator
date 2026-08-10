// 子进程执行器：spawn、超时、输出收集
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { AgentSpec, RunResult } from './types.js';
import { StringDecoder } from 'node:string_decoder';

const MAX_DISPLAY_CHARS = 2000;

/** 终止整个子进程树，避免 agent 拉起的孙进程残留 */
function killTree(child: ChildProcess): void {
  if (child.pid === undefined) return;
  if (process.platform === 'win32') {
    try {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
    } catch {
      child.kill();
    }
  } else {
    try {
      child.kill('SIGKILL');
    } catch { /* 已退出 */ }
  }
}

/** 截断长文本用于展示 */
function truncate(text: string, max = MAX_DISPLAY_CHARS): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n...[截断 ${text.length - max} 字符]`;
}

/** 提取摘要：非空行首行或首行部分 */
function summarize(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return '(无输出)';
  const first = lines[0];
  return first.length > 120 ? first.slice(0, 120) + '…' : first;
}

/**
 * 构建完整的 argv（含 prompt）
 * 根据 promptMode 决定 prompt 如何传递
 */
function buildArgv(spec: AgentSpec, prompt: string): string[] {
  const mode = spec.promptMode ?? 'positional';
  switch (mode) {
    case 'flag': {
      const flag = spec.promptFlag ?? '--prompt';
      return [...spec.command, flag, prompt];
    }
    case 'stdin':
      // stdin 模式：argv 不含 prompt，prompt 通过 stdin 写入
      return [...spec.command];
    case 'positional':
    default:
      return [...spec.command, prompt];
  }
}

/**
 * 执行单个 agent 任务
 * @param spec Agent 规格
 * @param prompt 任务提示词
 * @param timeoutMs 超时毫秒数
 */
export function runAgent(spec: AgentSpec, prompt: string, timeoutMs = 180_000): Promise<RunResult> {
  return new Promise((resolve) => {
    if (spec.command.length === 0) {
      resolve({
        agent: spec.key,
        agentName: spec.name,
        prompt,
        ok: false,
        exitCode: null,
        stdout: '',
        stderr: '',
        durationMs: 0,
        error: '命令为空：agent 的 command 数组没有元素',
        summary: '(命令为空)',
      });
      return;
    }

    const argv = buildArgv(spec, prompt);
    const mode = spec.promptMode ?? 'positional';
    const useStdin = mode === 'stdin';
    const startedAt = Date.now();
    let stdout = '';
    let stderr = '';
    let killed = false;

    const child = spawn(argv[0], argv.slice(1), {
      shell: spec.shell === true,
      cwd: spec.cwd,
      env: { ...process.env, ...(spec.env ?? {}) },
      windowsHide: true,
      // stdin 模式需要 pipe，其他模式 ignore
      stdio: useStdin ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
    });

    // stdin 模式：写入 prompt 后关闭
    if (useStdin && child.stdin) {
      child.stdin.write(prompt);
      child.stdin.end();
    }

    const timer = setTimeout(() => {
      killed = true;
      killTree(child);
    }, timeoutMs);

    // StringDecoder 正确处理跨 chunk 的多字节 UTF-8 字符（如中文）
    const stdoutDecoder = new StringDecoder('utf8');
    const stderrDecoder = new StringDecoder('utf8');

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += stdoutDecoder.write(chunk);
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += stderrDecoder.write(chunk);
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startedAt;
      const message = `启动失败: ${err.message}`;
      resolve({
        agent: spec.key,
        agentName: spec.name,
        prompt,
        ok: false,
        exitCode: null,
        stdout,
        stderr,
        durationMs,
        error: message,
        summary: summarize(message),
      });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      // flush decoder 残留字节
      stdout += stdoutDecoder.end();
      stderr += stderrDecoder.end();
      const durationMs = Date.now() - startedAt;
      const full = stdout + (stderr ? `\n[stderr]\n${stderr}` : '');
      const timedOut = killed;
      const error = timedOut
        ? `超时终止（超过 ${Math.round(timeoutMs / 1000)}s）`
        : code !== 0
          ? `退出码 ${code}`
          : undefined;

      resolve({
        agent: spec.key,
        agentName: spec.name,
        prompt,
        ok: !timedOut && code === 0,
        exitCode: code,
        stdout: truncate(stdout, 50_000),
        stderr: truncate(stderr, 10_000),
        durationMs,
        error,
        summary: summarize(full),
      });
    });
  });
}

/** 并行执行多个任务（每个任务分配给指定 agent），全部完成后返回 */
export async function runAll(agents: AgentSpec[], prompts: string[], timeoutMs: number): Promise<RunResult[]> {
  return Promise.all(prompts.map((prompt, i) => runAgent(agents[i % agents.length], prompt, timeoutMs)));
}
