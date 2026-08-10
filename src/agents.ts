// Agent 定义与可用性探测
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { sep } from 'node:path';
import { AgentSpec } from './types.js';
import { loadConfig } from './config.js';
import { findInPath } from './path.js';

export { loadConfig };

/** 探测单个 agent 是否可用 */
export function isAgentAvailable(spec: AgentSpec): boolean {
  const head = spec.command[0];
  if (!head) return false;

  // 绝对路径（含平台路径分隔符或盘符）→ 检查文件存在
  if (head.includes(sep) || /^[A-Za-z]:/.test(head)) {
    return existsSync(head);
  }
  // 相对路径（POSIX 下含 /）→ 检查文件存在
  if (head.includes('/')) {
    return existsSync(head);
  }
  // 纯命令名 → PATH 探测
  if (findInPath(head) === null) return false;
  // 参数中的绝对路径文件也必须存在
  for (const arg of spec.command.slice(1)) {
    if ((arg.includes(sep) || /^[A-Za-z]:/.test(arg)) && !existsSync(arg)) {
      return false;
    }
  }
  return true;
}

/** 探测并返回版本信息（尽力而为） */
export function probeVersion(spec: AgentSpec): string | undefined {
  try {
    const result = spawnSync(spec.command[0], ['--version'], {
      timeout: 2000,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      shell: spec.shell === true,
      encoding: 'utf8',
    });
    const output = ((result.stdout || '') + (result.stderr || '')).trim();
    const match = output.match(/v?(\d+\.\d+[\.\d]*)/);
    return match ? match[1] : undefined;
  } catch {
    return undefined;
  }
}
