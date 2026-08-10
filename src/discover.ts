// 自动探测系统已安装的 agent
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { sep } from 'node:path';
import { REGISTRY } from './registry.js';
import type { RegistryEntry } from './types.js';
import { getConfigAgentKeys } from './config.js';
import { DiscoverResult } from './types.js';
import { isInPathFast, findInPath } from './path.js';

/** 探测单个注册表条目是否已安装 */
function probeEntry(entry: RegistryEntry): { found: boolean; detectedPath?: string; version?: string } {
  const cmd = entry.defaultCommand[0];
  if (!cmd) return { found: false };

  // 绝对路径：直接检查文件
  if (cmd.includes(sep) || /^[A-Za-z]:/.test(cmd)) {
    if (!existsSync(cmd)) return { found: false };
    return tryVersion(entry, cmd);
  }

  // PATH 命令：先用缓存快速判断，再精确查找路径
  if (!isInPathFast(cmd)) return { found: false };
  const exact = findInPath(cmd);
  if (!exact) return { found: false };

  return tryVersion(entry, exact);
}

/** 尝试获取版本信息（仅在确认已安装后调用） */
function tryVersion(entry: RegistryEntry, detectedPath: string): { found: boolean; detectedPath?: string; version?: string } {
  if (!entry.detectCommand || entry.detectCommand.length === 0) {
    return { found: true, detectedPath };
  }

  try {
    const result = spawnSync(entry.detectCommand[0], entry.detectCommand.slice(1), {
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      shell: entry.shell === true,
      encoding: 'utf8',
    });

    const output = ((result.stdout || '') + (result.stderr || '')).trim();
    const versionMatch = output.match(/v?(\d+\.\d+[\.\d]*[-\w]*)/);
    return {
      found: true,
      detectedPath,
      version: versionMatch ? versionMatch[1] : undefined,
    };
  } catch {
    return { found: true, detectedPath };
  }
}

/**
 * 探测所有注册表 agent 的安装状态
 * @param includeConfigKeys 是否包含已在配置文件中的 agent（默认 true）
 */
export function discoverAgents(includeConfigKeys = true): DiscoverResult[] {
  const configKeys = new Set(getConfigAgentKeys());

  return REGISTRY.map((entry) => {
    const inConfig = configKeys.has(entry.key);
    if (!includeConfigKeys && inConfig) {
      return {
        key: entry.key,
        name: entry.name,
        description: entry.description,
        found: false,
        inConfig: true,
      };
    }

    const probe = probeEntry(entry);
    return {
      key: entry.key,
      name: entry.name,
      description: entry.description,
      found: probe.found,
      detectedPath: probe.detectedPath,
      version: probe.version,
      inConfig,
    };
  });
}

/** 只返回已安装但未在配置中的 agent */
export function discoverNew(): DiscoverResult[] {
  return discoverAgents(false).filter((r) => r.found && !r.inConfig);
}
