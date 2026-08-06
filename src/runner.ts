// 子进程执行器：spawn、超时、输出收集
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { AgentSpec, RunResult } from './types.js';

const MAX_DISPLAY_CHARS = 2000;

/** 终止整个子进程树，避免 agent 拉起的孙进程残留 */
function killTree(child: ChildProcess): void {
  if (child.pid === undefined) return;
  if (process.platform === 'win32') {
    // Windows：taskkill /T 按父子关系递归终止；/F 强制
    try {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
    } catch {
      child.kill();
    }
  } else {
    // POSIX：尽力 SIGKILL（未 detach 时子进程组同属当前进程组，只杀直接子进程）
    try {
      child.kill('SIGKILL');
    } catch {
      /* 已退出 */
    }
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
 * 执行单个 agent 任务
 * @param spec Agent 规格
 * @param prompt 任务提示词
 * @param timeoutMs 超时毫秒数
 */
export function runAgent(spec: AgentSpec, prompt: string, timeoutMs = 180_000): Promise<RunResult> {
  return new Promise((resolve) => {
    const argv = [...spec.command, prompt];
    const startedAt = Date.now();
    let stdout = '';
    let stderr = '';
    let killed = false;

    const child = spawn(argv[0], argv.slice(1), {
      shell: spec.shell === true,
      cwd: spec.cwd,
      env: { ...process.env, ...(spec.env ?? {}) },
      windowsHide: true,
      // stdin 置 ignore：避免 agent（如 codex exec）误判管道并等待 stdin 输入
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      killed = true;
      killTree(child);
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
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
