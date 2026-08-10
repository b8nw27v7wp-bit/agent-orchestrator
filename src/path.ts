// PATH 工具：在系统 PATH 中查找可执行文件
import { existsSync, readdirSync } from 'node:fs';
import { sep } from 'node:path';

/**
 * 在 PATH 中查找可执行文件，返回完整路径或 null
 * Windows 下自动尝试 .exe/.cmd/.bat/.ps1 扩展名
 */
export function findInPath(cmd: string): string | null {
  const isWin = process.platform === 'win32';
  const exts = isWin ? ['.exe', '.cmd', '.bat', '.ps1', ''] : [''];
  const dirs = (process.env.PATH ?? '').split(isWin ? ';' : ':');
  for (const dir of dirs) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = dir.endsWith(sep) || dir.endsWith('/') ? dir + cmd + ext : dir + sep + cmd + ext;
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

/**
 * 快速检查命令是否存在于 PATH（基于目录扫描缓存）
 * 适合批量探测场景（如 discover），避免对每个命令都遍历 PATH
 */
let _pathExeCache: Set<string> | null = null;
export function isInPathFast(cmd: string): boolean {
  if (!_pathExeCache) {
    const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', '.ps1'] : [''];
    const dirs = (process.env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':');
    const cache = new Set<string>();
    for (const dir of dirs) {
      if (!dir) continue;
      try {
        const files = readdirSync(dir);
        for (const f of files) {
          const lower = f.toLowerCase();
          if (process.platform === 'win32') {
            if (exts.some((ext) => lower.endsWith(ext))) {
              cache.add(lower.replace(/\.(exe|cmd|bat|ps1)$/, ''));
            }
          } else {
            cache.add(lower);
          }
        }
      } catch { /* 无权限或不存在，跳过 */ }
    }
    _pathExeCache = cache;
  }
  return _pathExeCache.has(cmd.toLowerCase());
}
