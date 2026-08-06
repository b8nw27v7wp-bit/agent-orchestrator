// 内置 Agent 定义与探测
import { existsSync } from 'node:fs';
import { AgentSpec, OrbConfig } from './types.js';

const CODEBUDDY_SCRIPT = 'D:\\WorkBuddy\\resources\\app.asar.unpacked\\cli\\bin\\codebuddy';
const CLAUDE_EXE = 'C:\\Users\\18434\\.vscode\\extensions\\anthropic.claude-code-2.1.220-win32-x64\\resources\\native-binary\\claude.exe';

/** 解析 JSON 数组字符串环境变量，失败返回 undefined */
function parseCmdEnv(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((x) => typeof x === 'string') ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** 读取 ORB_AGENTS_EXTRA 自定义 agent（JSON: key → {name, command[]}） */
function parseExtraAgents(raw: string | undefined): Record<string, { name: string; command: string[] }> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) return parsed;
  } catch {
    // 忽略非法 JSON
  }
  return {};
}

/** 从环境变量读取覆盖配置 */
export function loadConfig(): OrbConfig {
  return {
    codebuddyCmd: parseCmdEnv(process.env.ORB_CODEBUDDY_CMD),
    codexCmd: parseCmdEnv(process.env.ORB_CODEX_CMD),
    claudeCmd: parseCmdEnv(process.env.ORB_CLAUDE_CMD),
    extraAgents: parseExtraAgents(process.env.ORB_AGENTS_EXTRA),
  };
}

/** 构建内置 agent 列表（应用环境变量覆盖） */
export function getAgents(config: OrbConfig = loadConfig()): AgentSpec[] {
  const agents: AgentSpec[] = [
    {
      key: 'codebuddy',
      name: 'CodeBuddy (hy3)',
      command: config.codebuddyCmd ?? ['node', CODEBUDDY_SCRIPT, '-p', '--model', 'hy3'],
      shell: false,
    },
    {
      key: 'codex',
      name: 'Codex (DeepSeek)',
      // 直接调 npm 包的 JS 入口，避免 shell 解析 .cmd（消除 DEP0190 传参警告）
      command: config.codexCmd ?? [
        'node',
        'C:\\Users\\18434\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\bin\\codex.js',
        'exec',
        '--skip-git-repo-check',
        '--sandbox',
        'read-only',
      ],
      shell: false,
    },
    {
      key: 'claude',
      name: 'Claude Code',
      command: config.claudeCmd ?? [CLAUDE_EXE, '-p'],
      shell: false,
    },
  ];

  // 追加自定义 agent
  for (const [key, spec] of Object.entries(config.extraAgents ?? {})) {
    agents.push({ key, name: spec.name ?? key, command: spec.command, shell: false });
  }
  return agents;
}

/** 探测 agent 是否可用（文件存在 / 命令可执行） */
export function isAgentAvailable(spec: AgentSpec): boolean {
  const head = spec.command[0];
  if (!head) return false;
  // 绝对路径（含盘符或反斜杠）→ 检查文件存在
  if (head.includes('\\') || /^[A-Za-z]:/.test(head)) {
    return existsSync(head);
  }
  // 相对路径（脚本文件）→ 检查相对文件
  if (head.includes('/')) {
    return existsSync(head);
  }
  // 纯命令名（codex 等）→ 通过 PATH 探测
  if (findInPath(head) === null) return false;
  // 额外检查：命令参数中的绝对路径文件也必须存在
  for (const arg of spec.command.slice(1)) {
    if ((arg.includes('\\') || /^[A-Za-z]:/.test(arg)) && !existsSync(arg)) {
      return false;
    }
  }
  return true;
}

/** 在 PATH 中查找可执行文件（Windows: .exe/.cmd/.bat/.ps1） */
function findInPath(cmd: string): string | null {
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', '.ps1', ''] : [''];
  const dirs = (process.env.PATH ?? '').split(';');
  for (const dir of dirs) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = dir.endsWith('\\') || dir.endsWith('/') ? dir + cmd + ext : dir + '\\' + cmd + ext;
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}
