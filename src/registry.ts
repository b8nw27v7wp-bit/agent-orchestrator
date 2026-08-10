// Agent 注册表 —— 预定义市面主流 coding agent CLI 的调用模式
// 不绑定 API / 模型，只定义"怎么调"和"怎么探测"
import { existsSync } from 'node:fs';
import { RegistryEntry } from './types.js';

/** 探测 WorkBuddy codebuddy 脚本路径（不写死盘符） */
function findCodebuddy(): string | null {
  const candidates = [
    process.env.WORKBUDDY_HOME && `${process.env.WORKBUDDY_HOME}\\resources\\app.asar.unpacked\\cli\\bin\\codebuddy`,
    'D:\\WorkBuddy\\resources\\app.asar.unpacked\\cli\\bin\\codebuddy',
    'C:\\WorkBuddy\\resources\\app.asar.unpacked\\cli\\bin\\codebuddy',
    `${process.env.LOCALAPPDATA || ''}\\Programs\\WorkBuddy\\resources\\app.asar.unpacked\\cli\\bin\\codebuddy`,
    `${process.env.USERPROFILE || ''}\\AppData\\Local\\Programs\\WorkBuddy\\resources\\app.asar.unpacked\\cli\\bin\\codebuddy`,
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

const CODEBUDDY_SCRIPT = findCodebuddy();

export const REGISTRY: readonly RegistryEntry[] = [
  // ── 国内常用 ──
  ...(CODEBUDDY_SCRIPT ? [{
    key: 'codebuddy',
    name: 'CodeBuddy',
    description: 'WorkBuddy 内置 CLI agent',
    defaultCommand: ['node', CODEBUDDY_SCRIPT, '-p'] as string[],
    promptMode: 'positional' as const,
    detectCommand: ['node', CODEBUDDY_SCRIPT, '--version'] as string[],
    notes: 'WorkBuddy 桌面应用捆绑。设置 WORKBUDDY_HOME 环境变量指定安装路径',
  }] : []),
  {
    key: 'qwen-code',
    name: 'Qwen Code',
    description: '通义千问 coding agent CLI',
    defaultCommand: ['qwen-code'],
    promptMode: 'positional',
    detectCommand: ['qwen-code', '--version'],
    envVars: ['DASHSCOPE_API_KEY'],
    notes: 'npm i -g @anthropic-ai/qwen-code 或类似包名',
  },
  {
    key: 'deepseek',
    name: 'DeepSeek CLI',
    description: 'DeepSeek coding agent',
    defaultCommand: ['deepseek'],
    promptMode: 'positional',
    detectCommand: ['deepseek', '--version'],
    envVars: ['DEEPSEEK_API_KEY'],
  },

  // ── OpenAI 系 ──
  {
    key: 'codex',
    name: 'Codex',
    description: 'OpenAI Codex CLI agent',
    defaultCommand: ['codex', 'exec', '--skip-git-repo-check', '--sandbox', 'read-only'],
    promptMode: 'positional',
    detectCommand: ['codex', '--version'],
    envVars: ['OPENAI_API_KEY', 'CODEX_HOME'],
    notes: 'npm i -g @openai/codex；Windows 如经 .cmd 调用需 shell:true',
  },

  // ── Anthropic 系 ──
  {
    key: 'claude',
    name: 'Claude Code',
    description: 'Anthropic Claude Code CLI',
    defaultCommand: ['claude', '-p'],
    promptMode: 'positional',
    detectCommand: ['claude', '--version'],
    envVars: ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_USE_BEDROCK'],
    notes: 'npm i -g @anthropic-ai/claude-code 或 VS Code 插件捆绑',
  },

  // ── Google 系 ──
  {
    key: 'gemini',
    name: 'Gemini CLI',
    description: 'Google Gemini CLI coding agent',
    defaultCommand: ['gemini'],
    promptMode: 'positional',
    detectCommand: ['gemini', '--version'],
    envVars: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    notes: 'npm i -g @anthropic-ai/gemini-cli 或类似包名',
  },

  // ── Amazon ──
  {
    key: 'amazon-q',
    name: 'Amazon Q',
    description: 'Amazon Q Developer CLI',
    defaultCommand: ['q', 'chat', '--no-interactive'],
    promptMode: 'flag',
    promptFlag: '--input',
    detectCommand: ['q', '--version'],
    envVars: ['AWS_PROFILE'],
    notes: '需要 AWS Builder ID 或 IAM Identity Center',
  },

  // ── 通用 / 开源 CLI agent ──
  {
    key: 'aider',
    name: 'Aider',
    description: 'AI pair programming in your terminal',
    defaultCommand: ['aider', '--yes-always', '--no-git'],
    promptMode: 'flag',
    promptFlag: '--message',
    detectCommand: ['aider', '--version'],
    envVars: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'DEEPSEEK_API_KEY'],
    notes: 'pip install aider-chat；支持多 provider',
  },
  {
    key: 'goose',
    name: 'Goose',
    description: 'Block 开源 coding agent',
    defaultCommand: ['goose', 'run', '--text'],
    promptMode: 'positional',
    detectCommand: ['goose', '--version'],
    envVars: ['GOOSE_PROVIDER__TYPE', 'GOOSE_PROVIDER__HOST'],
    notes: 'brew install block/tap/goose 或 cargo install goose',
  },
  {
    key: 'openhands',
    name: 'OpenHands',
    description: '开源 AI coding agent (原 OpenDevin)',
    defaultCommand: ['openhands'],
    promptMode: 'flag',
    promptFlag: '--task',
    detectCommand: ['openhands', '--version'],
    envVars: ['LLM_API_KEY', 'LLM_MODEL'],
    notes: 'pip install openhands',
  },
  {
    key: 'cline',
    name: 'Cline',
    description: '自主 coding agent（VS Code 扩展 CLI）',
    defaultCommand: ['cline'],
    promptMode: 'flag',
    promptFlag: '--prompt',
    detectCommand: ['cline', '--version'],
    envVars: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY'],
    notes: 'VS Code 扩展，CLI 模式需额外配置',
  },
  {
    key: 'continue',
    name: 'Continue',
    description: '开源 AI code assistant CLI',
    defaultCommand: ['continue'],
    promptMode: 'positional',
    detectCommand: ['continue', '--version'],
    envVars: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'],
    notes: 'npm i -g @continuedev/cli',
  },
  {
    key: 'cursor-agent',
    name: 'Cursor Agent',
    description: 'Cursor IDE 的 agent CLI',
    defaultCommand: ['cursor-agent'],
    promptMode: 'positional',
    detectCommand: ['cursor-agent', '--version'],
    notes: '需要 Cursor IDE 安装',
  },
  {
    key: 'copilot',
    name: 'GitHub Copilot CLI',
    description: 'GitHub Copilot agent 模式',
    defaultCommand: ['gh', 'copilot', 'suggest', '--target', 'shell'],
    promptMode: 'flag',
    promptFlag: '--prompt',
    detectCommand: ['gh', 'copilot', '--version'],
    envVars: ['GITHUB_TOKEN'],
    notes: 'gh extension install github/gh-copilot；Windows 需 shell:true',
  },
  {
    key: 'windsurf',
    name: 'Windsurf',
    description: 'Codeium Windsurf agent CLI',
    defaultCommand: ['windsurf'],
    promptMode: 'positional',
    detectCommand: ['windsurf', '--version'],
    envVars: ['CODEIUM_API_KEY'],
    notes: '需要 Windsurf IDE',
  },
  {
    key: 'devin',
    name: 'Devin CLI',
    description: 'Devin AI agent command line',
    defaultCommand: ['devin'],
    promptMode: 'positional',
    detectCommand: ['devin', '--version'],
    notes: '需要 Devin 订阅',
  },
  {
    key: 'sweep',
    name: 'Sweep',
    description: 'AI-powered bug fixing & refactoring',
    defaultCommand: ['sweep'],
    promptMode: 'positional',
    detectCommand: ['sweep', '--version'],
    envVars: ['SWEEP_API_KEY'],
    notes: 'pip install sweepai',
  },
  {
    key: 'mentat',
    name: 'Mentat',
    description: 'AI coding assistant CLI',
    defaultCommand: ['mentat'],
    promptMode: 'positional',
    detectCommand: ['mentat', '--version'],
    envVars: ['OPENAI_API_KEY'],
    notes: 'pip install mentat',
  },
  {
    key: 'gpt-engineer',
    name: 'GPT Engineer',
    description: '从自然语言生成代码库',
    defaultCommand: ['gpt-engineer'],
    promptMode: 'positional',
    detectCommand: ['gpt-engineer', '--version'],
    envVars: ['OPENAI_API_KEY'],
    notes: 'pip install gpt-engineer',
  },
  {
    key: 'smol-developer',
    name: 'smol developer',
    description: 'AI junior developer',
    defaultCommand: ['smol-developer'],
    promptMode: 'positional',
    detectCommand: ['smol-developer', '--version'],
    envVars: ['OPENAI_API_KEY'],
    notes: 'pip install smol-developer',
  },
  {
    key: 'magick',
    name: 'Magick CLI',
    description: 'AI agent 编排 CLI',
    defaultCommand: ['magick'],
    promptMode: 'positional',
    detectCommand: ['magick', '--version'],
    notes: 'npm i -g @magickml/cli',
  },
  {
    key: 'autogpt',
    name: 'AutoGPT',
    description: '自主 AI agent',
    defaultCommand: ['autogpt'],
    promptMode: 'flag',
    promptFlag: '--prompt',
    detectCommand: ['autogpt', '--version'],
    envVars: ['OPENAI_API_KEY'],
    notes: 'pip install agpt 或 docker',
  },
  {
    key: 'metagpt',
    name: 'MetaGPT',
    description: '多角色 AI 软件公司',
    defaultCommand: ['metagpt'],
    promptMode: 'positional',
    detectCommand: ['metagpt', '--version'],
    envVars: ['OPENAI_API_KEY'],
    notes: 'pip install metagpt',
  },
  {
    key: 'roo',
    name: 'Roo Code',
    description: '自主 coding agent（前 Roo-Cline）',
    defaultCommand: ['roo'],
    promptMode: 'flag',
    promptFlag: '--prompt',
    detectCommand: ['roo', '--version'],
    envVars: ['ANTHROPIC_API_KEY'],
    notes: 'VS Code 扩展，CLI 模式有限',
  },
  {
    key: 'crush',
    name: 'Crush',
    description: 'Charm.sh 开源 coding agent',
    defaultCommand: ['crush'],
    promptMode: 'positional',
    detectCommand: ['crush', 'version'],
    envVars: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'],
    notes: 'go install github.com/charmbracelet/crush@latest',
  },
];

/** 按 key 查找注册表条目 */
export function findRegistryEntry(key: string): RegistryEntry | undefined {
  return REGISTRY.find((e) => e.key === key);
}
