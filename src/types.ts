// AgentOrb 核心类型定义

/** prompt 传递方式 */
export type PromptMode = 'positional' | 'flag' | 'stdin';

/** 单个 Agent 的运行时规格 */
export interface AgentSpec {
  /** 唯一 key，如 codebuddy / codex / claude / aider */
  key: string;
  /** 展示名称 */
  name: string;
  /** 完整 argv（不含 prompt，prompt 按 promptMode 追加） */
  command: string[];
  /** prompt 传递方式：positional=追加末尾，flag=用 promptFlag，stdin=写入 stdin */
  promptMode?: PromptMode;
  /** flag 模式下的 flag 名（如 "--prompt"、"-p"），默认 "--prompt" */
  promptFlag?: string;
  /** 是否通过 shell 解析执行（.cmd / PATH 命令需要 true） */
  shell?: boolean;
  /** 工作目录 */
  cwd?: string;
  /** 额外环境变量 */
  env?: Record<string, string>;
  /** 来源标识：registry(注册表) / config(配置文件) / env(环境变量) */
  source?: 'registry' | 'config' | 'env';
}

/** 注册表条目（已知 agent 的元数据模板） */
export interface RegistryEntry {
  /** 注册表唯一 key */
  key: string;
  /** 显示名 */
  name: string;
  /** 一句话描述 */
  description: string;
  /** 默认命令数组（不含 prompt） */
  defaultCommand: string[];
  /** prompt 传递方式 */
  promptMode: PromptMode;
  /** flag 模式的 flag 名 */
  promptFlag?: string;
  /** 是否需要 shell 执行 */
  shell?: boolean;
  /** 用于探测是否安装的命令（版本检测） */
  detectCommand?: string[];
  /** 相关环境变量（如 API key） */
  envVars?: string[];
  /** 备注（安装方式、限制等） */
  notes?: string;
  /** 限定平台（不填则全平台） */
  platforms?: NodeJS.Platform[];
}

/** 配置文件中 agent 的原始格式 */
export interface AgentConfigEntry {
  name: string;
  command: string | string[];
  promptMode?: PromptMode;
  promptFlag?: string;
  shell?: boolean;
  cwd?: string;
  env?: Record<string, string>;
  enabled?: boolean;
}

/** 配置文件顶层结构 */
export interface OrbConfigFile {
  version: number;
  agents: Record<string, AgentConfigEntry>;
}

/** 运行时合并后的完整配置 */
export interface OrbConfig {
  /** 合并后的 agent 列表 */
  agents: AgentSpec[];
  /** 配置文件路径 */
  configPath: string;
}

/** 单次 Agent 执行结果 */
export interface RunResult {
  agent: string;
  agentName: string;
  prompt: string;
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  error?: string;
  /** 展示用摘要（截断后） */
  summary: string;
}

/** 一次编排的完整结果 */
export interface OrbResult {
  command: string;
  prompts: string[];
  timestamp: string;
  results: RunResult[];
}

/** discover 命令的探测结果 */
export interface DiscoverResult {
  key: string;
  name: string;
  description: string;
  found: boolean;
  detectedPath?: string;
  version?: string;
  inConfig: boolean;
}
