// 终端渲染：结果对比表格、状态着色（零依赖手写 ANSI）
import { RunResult, DiscoverResult } from './types.js';

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

export function setColorEnabled(enabled: boolean): void {
  useColor = enabled;
}

function paint(code: keyof typeof COLORS, text: string): string {
  return useColor ? `${COLORS[code]}${text}${COLORS.reset}` : text;
}

/** 计算字符串在终端的显示宽度（CJK 字符占 2 列） */
function displayWidth(s: string): number {
  const stripped = s.replace(/\x1b\[[0-9;]*m/g, '');
  let w = 0;
  for (const ch of stripped) {
    const code = ch.codePointAt(0)!;
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3000 && code <= 0x303f) ||
      (code >= 0xff00 && code <= 0xffef) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x20000 && code <= 0x2a6df)
    ) {
      w += 2;
    } else {
      w += 1;
    }
  }
  return w;
}

function padEnd(s: string, targetWidth: number): string {
  const diff = targetWidth - displayWidth(s);
  return diff > 0 ? s + ' '.repeat(diff) : s;
}

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

/** 渲染 discover 结果 */
export function renderDiscover(results: DiscoverResult[]): string {
  const lines: string[] = [];
  const found = results.filter((r) => r.found);
  const notFound = results.filter((r) => !r.found && !r.inConfig);
  const inCfg = results.filter((r) => r.inConfig);

  if (found.length > 0) {
    lines.push(paint('bold', `已安装的 agent（${found.length}）：`));
    for (const r of found) {
      const version = r.version ? ` v${r.version}` : '';
      const cfgTag = r.inConfig ? paint('dim', ' [已在配置中]') : paint('green', ' [可添加]');
      lines.push(`  ${paint('green', '✓')} ${paint('cyan', r.key.padEnd(16))} ${r.name}${paint('dim', version)}${cfgTag}`);
      if (r.description) lines.push(`    ${paint('dim', r.description)}`);
    }
    lines.push('');
  }

  if (inCfg.length > 0) {
    lines.push(paint('bold', `配置文件中的 agent（${inCfg.length}）：`));
    for (const r of inCfg) {
      const tag = r.found ? paint('green', '✓') : paint('red', '✗');
      lines.push(`  ${tag} ${paint('cyan', r.key.padEnd(16))} ${r.name}`);
    }
    lines.push('');
  }

  if (notFound.length > 0) {
    lines.push(paint('dim', `未检测到（${notFound.length}）：`));
    for (const r of notFound) {
      lines.push(`  ${paint('dim', '·')} ${r.key.padEnd(16)} ${paint('dim', r.description)}`);
    }
    lines.push('');
  }

  lines.push(paint('dim', '使用 orb add <key> 将已安装的 agent 添加到配置'));
  lines.push(paint('dim', '使用 orb add <key> --command "cmd arg1 arg2" 添加自定义 agent'));
  return lines.join('\n');
}

/** 渲染 list 结果（扩展版，含来源信息） */
export function renderList(agents: { key: string; name: string; available: boolean; source: string; command: string }[]): string {
  const lines: string[] = [];
  lines.push(paint('bold', `已注册 agent（${agents.length}）：`));
  lines.push('');
  for (const a of agents) {
    const tag = a.available ? paint('green', '✓') : paint('red', '✗');
    const src = paint('dim', `[${a.source}]`);
    lines.push(`  ${tag} ${a.key.padEnd(16)} ${a.name.padEnd(20)} ${src}`);
    lines.push(`    ${paint('dim', a.command)}`);
  }
  return lines.join('\n');
}
