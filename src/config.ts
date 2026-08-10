// 配置文件管理：~/.orb/agents.json + 环境变量
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { OrbConfigFile, AgentConfigEntry, OrbConfig, AgentSpec } from './types.js';
import { findRegistryEntry, REGISTRY } from './registry.js';

const CONFIG_DIR = join(homedir(), '.orb');
const CONFIG_FILE = join(CONFIG_DIR, 'agents.json');

/** 获取配置文件路径 */
export function getConfigPath(): string {
  return CONFIG_FILE;
}

/** 读取配置文件，不存在则返回空结构 */
export function loadConfigFile(): OrbConfigFile {
  if (!existsSync(CONFIG_FILE)) {
    return { version: 1, agents: {} };
  }
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw) as OrbConfigFile;
    if (!parsed || typeof parsed !== 'object' || !parsed.agents || typeof parsed.agents !== 'object' || Array.isArray(parsed.agents)) {
      return { version: 1, agents: {} };
    }
    return parsed;
  } catch {
    return { version: 1, agents: {} };
  }
}

/** 保存配置文件 */
export function saveConfigFile(config: OrbConfigFile): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

/** 引号感知的命令字符串拆分（支持单引号和双引号包裹含空格的路径） */
export function parseCommandString(cmd: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ' ' || ch === '\t') {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

/** 将配置文件条目转为运行时 AgentSpec */
function configEntryToSpec(key: string, entry: AgentConfigEntry, source: 'config' | 'env'): AgentSpec {
  const cmd = Array.isArray(entry.command) ? entry.command : parseCommandString(entry.command);
  return {
    key,
    name: entry.name || key,
    command: cmd,
    promptMode: entry.promptMode,
    promptFlag: entry.promptFlag,
    shell: entry.shell,
    cwd: entry.cwd,
    env: entry.env,
    source,
  };
}

/** 从注册表条目构建 AgentSpec（调用方保证 key 存在于注册表） */
function registryEntryToSpec(key: string): AgentSpec | null {
  const entry = findRegistryEntry(key);
  if (!entry) return null;
  return {
    key: entry.key,
    name: entry.name,
    command: entry.defaultCommand,
    promptMode: entry.promptMode,
    promptFlag: entry.promptFlag,
    shell: entry.shell,
    source: 'registry',
  };
}

/** 解析 ORB_AGENTS_EXTRA 环境变量 */
function parseExtraAgentsEnv(): Record<string, AgentConfigEntry> {
  const raw = process.env.ORB_AGENTS_EXTRA;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) return parsed;
  } catch { /* 忽略 */ }
  return {};
}

/** 解析 ORB_<KEY>_CMD 环境变量覆盖 */
function parseCmdOverride(envKey: string): string[] | undefined {
  const raw = process.env[envKey];
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((x: unknown) => typeof x === 'string')) return parsed;
  } catch { /* 忽略 */ }
  return undefined;
}

/**
 * 加载合并后的完整 agent 配置
 * 优先级：配置文件 > 环境变量 ORB_<KEY>_CMD > ORB_AGENTS_EXTRA > 注册表默认值
 * 配置文件中 enabled=false 的 agent 会被跳过
 */
export function loadConfig(): OrbConfig {
  const fileConfig = loadConfigFile();
  const agents: AgentSpec[] = [];
  const seenKeys = new Set<string>();

  // 1. 配置文件中的 agent（优先级最高）
  for (const [key, entry] of Object.entries(fileConfig.agents)) {
    if (entry.enabled === false) continue;
    agents.push(configEntryToSpec(key, entry, 'config'));
    seenKeys.add(key);
  }

  // 2. 环境变量 ORB_<KEY>_CMD 覆盖注册表 agent
  for (const entry of REGISTRY) {
    if (seenKeys.has(entry.key)) continue;
    const envKey = `ORB_${entry.key.toUpperCase().replace(/-/g, '_')}_CMD`;
    const override = parseCmdOverride(envKey);
    if (override) {
      agents.push({
        key: entry.key,
        name: entry.name,
        command: override,
        promptMode: entry.promptMode,
        promptFlag: entry.promptFlag,
        shell: entry.shell,
        source: 'env',
      });
      seenKeys.add(entry.key);
    }
  }

  // 3. ORB_AGENTS_EXTRA 自定义 agent
  const extra = parseExtraAgentsEnv();
  for (const [key, entry] of Object.entries(extra)) {
    if (seenKeys.has(key)) continue;
    agents.push(configEntryToSpec(key, entry, 'env'));
    seenKeys.add(key);
  }

  // 4. 注册表默认 agent（未被上述来源覆盖的）
  for (const entry of REGISTRY) {
    if (seenKeys.has(entry.key)) continue;
    const spec = registryEntryToSpec(entry.key);
    if (spec) {
      agents.push(spec);
      seenKeys.add(entry.key);
    }
  }

  return { agents, configPath: CONFIG_FILE };
}

/** 添加 agent 到配置文件 */
export function addAgentToConfig(key: string, entry: AgentConfigEntry): void {
  const config = loadConfigFile();
  config.agents[key] = entry;
  saveConfigFile(config);
}

/** 从配置文件移除 agent */
export function removeAgentFromConfig(key: string): boolean {
  const config = loadConfigFile();
  if (!(key in config.agents)) return false;
  delete config.agents[key];
  saveConfigFile(config);
  return true;
}

/** 列出配置文件中的 agent key */
export function getConfigAgentKeys(): string[] {
  const config = loadConfigFile();
  return Object.keys(config.agents);
}
