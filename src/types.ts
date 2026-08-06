// Agent 编排核心类型定义

/** 单个 Agent 的规格定义 */
export interface AgentSpec {
  /** 唯一 key，如 codebuddy / codex / claude */
  key: string;
  /** 展示名称 */
  name: string;
  /** 完整 argv（不含 prompt，prompt 会在运行时追加到末尾） */
  command: string[];
  /** 是否通过 shell 解析执行（.cmd / PATH 命令需要 true） */
  shell?: boolean;
  /** 工作目录 */
  cwd?: string;
  /** 额外环境变量 */
  env?: Record<string, string>;
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

/** 可选覆盖配置（来自环境变量） */
export interface OrbConfig {
  codebuddyCmd?: string[];
  codexCmd?: string[];
  claudeCmd?: string[];
  extraAgents?: Record<string, { name: string; command: string[] }>;
}
