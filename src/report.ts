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

/** 计算字符串在终端的显示宽度（CJK 字符占 2 列） */
function displayWidth(s: string): number {
  // 先去除 ANSI 转义序列
  const stripped = s.replace(/\x1b\[[0-9;]*m/g, '');
  let w = 0;
  for (const ch of stripped) {
    const code = ch.codePointAt(0)!;
    // CJK 统一表意文字 + 全角符号范围（宽度 2）
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||   // CJK 基本
      (code >= 0x3000 && code <= 0x303f) ||   // CJK 符号
      (code >= 0xff00 && code <= 0xffef) ||   // 全角字符
      (code >= 0x3400 && code <= 0x4dbf) ||   // CJK 扩展 A
      (code >= 0x20000 && code <= 0x2a6df)    // CJK 扩展 B
    ) {
      w += 2;
    } else {
      w += 1;
    }
  }
  return w;
}

/** 按显示宽度右填充空格 */
function padEnd(s: string, targetWidth: number): string {
  const diff = targetWidth - displayWidth(s);
  return diff > 0 ? s + ' '.repeat(diff) : s;
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

  // 计算列宽（按显示宽度，处理 CJK 和 ANSI）
  const widths = headers.map((h, i) =>
    Math.max(displayWidth(h), ...rows.map((row) => displayWidth(row[i]))),
  );

  const line = (cells: string[]) =>
    cells.map((c, i) => padEnd(c, widths[i] + 2)).join('');

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
