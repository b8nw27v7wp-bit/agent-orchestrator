// 终端渲染：结果对比表格、状态着色（零依赖手写 ANSI）
import { RunResult } from './types.js';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

let useColor = true;

/** 启用/禁用颜色 */
export function setColorEnabled(enabled: boolean): void {
  useColor = enabled;
}

function paint(code: keyof typeof COLORS, text: string): string {
  return useColor ? `${COLORS[code]}${text}${COLORS.reset}` : text;
}

/** 单个结果的单行状态标签 */
function statusTag(r: RunResult): string {
  if (!r.ok) return paint('red', '✗ 失败');
  return paint('green', '✓ 成功');
}

/** 渲染结果对比表格（多 agent 同一任务） */
export function renderTable(results: RunResult[]): string {
  const headers = ['Agent', '状态', '耗时', '摘要'];
  const rows = results.map((r) => [
    r.agentName,
    statusTag(r),
    `${(r.durationMs / 1000).toFixed(1)}s`,
    r.summary.replace(/\r?\n/g, ' '),
  ]);

  // 计算列宽（忽略 ANSI 码长度）
  const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => stripAnsi(row[i]).length)),
  );

  const line = (cells: string[]) =>
    cells.map((c, i) => c.padEnd(widths[i] + 2)).join('');

  const lines: string[] = [];
  lines.push(paint('bold', line(headers)));
  lines.push('-'.repeat(widths.reduce((a, b) => a + b + 2, 0)));
  for (const row of rows) lines.push(line(row));
  return lines.join('\n');
}

/** 渲染单个 agent 的完整结果（run 命令） */
export function renderSingle(r: RunResult): string {
  const lines: string[] = [];
  lines.push(`${paint('cyan', r.agentName)}  ${statusTag(r)}  ${paint('dim', `(${(r.durationMs / 1000).toFixed(1)}s)`)}`);
  if (r.error) lines.push(paint('yellow', `! ${r.error}`));
  lines.push('─'.repeat(40));
  const body = r.stdout.trim();
  lines.push(body ? body : paint('dim', '(无标准输出)'));
  // 成功时隐藏 stderr（多为 agent 启动横幅噪音，如 codex 的版本/配置回显）；失败时展示
  const stderrTrimmed = r.stderr.trim();
  if (stderrTrimmed && !r.ok) lines.push(paint('dim', `[stderr] ${stderrTrimmed.slice(0, 500)}`));
  return lines.join('\n');
}

/** 渲染编排完成摘要（parallel 命令） */
export function renderParallel(results: RunResult[]): string {
  const lines: string[] = [];
  for (const r of results) {
    lines.push(`${statusTag(r)}  ${paint('cyan', r.agentName)}  ${paint('dim', `(${(r.durationMs / 1000).toFixed(1)}s)`)}`);
    if (r.error) lines.push(paint('yellow', `   ! ${r.error}`));
    lines.push(`   ${r.summary.replace(/\r?\n/g, ' ')}`);
    lines.push('');
  }
  return lines.join('\n');
}
