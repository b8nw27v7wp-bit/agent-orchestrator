# AgentOrb —— 多 Agent 编排 CLI

统一调度市面主流 coding agent CLI，支持任务分发、并行执行、多 agent 结果对比。
对应 CrewAI / AutoGen / Agent SDK 的编排概念，但调度的是**真实 CLI agent 进程**。

## 功能需求

### 核心命令

1. `orb list` — 列出所有注册/配置的 agent，显示可用状态、版本、来源
2. `orb discover` — 自动探测系统已安装的 coding agent（支持 `--new` 只显示未配置的）
3. `orb add <key>` — 添加 agent 到配置文件（支持 `--from-registry` 或 `--command` 自定义）
4. `orb remove <key>` — 从配置文件移除 agent
5. `orb run <agent> <prompt...>` — 指定 agent 执行单个任务
6. `orb all <prompt...>` — 所有可用 agent 执行同一任务，输出结果对比表
7. `orb parallel <task1> <task2> ...` — 多个不同任务并行分发到不同 agent

### 全局选项

- `--json`（结构化输出）、`--timeout <秒>`（默认 180）、`--no-color`

### 每次运行结果自动保存到 `results/<timestamp>-<command>.json`

## Agent 注册表（src/registry.ts）

预定义 25 个市面主流 coding agent 的调用模式（不绑定 API/模型）：

| key | 名称 | prompt 模式 | 说明 |
|-----|------|------------|------|
| codebuddy | CodeBuddy | positional | WorkBuddy 内置 CLI |
| codex | Codex | positional | OpenAI Codex CLI |
| claude | Claude Code | positional | Anthropic CLI |
| gemini | Gemini CLI | positional | Google Gemini |
| aider | Aider | flag (--message) | AI pair programming |
| goose | Goose | positional | Block 开源 agent |
| amazon-q | Amazon Q | flag (--input) | AWS Developer CLI |
| openhands | OpenHands | flag (--task) | 原 OpenDevin |
| cline | Cline | flag (--prompt) | VS Code 扩展 CLI |
| copilot | GitHub Copilot CLI | flag (--prompt) | GitHub Copilot |
| qwen-code | Qwen Code | positional | 通义千问 |
| deepseek | DeepSeek CLI | positional | DeepSeek |
| crush | Crush | positional | Charm.sh 开源 agent |
| ... | 共 25 个 | | |

## 优先级机制

agent 来源的合并优先级（高→低）：
1. **配置文件** `~/.orb/agents.json` — 用户显式添加/修改
2. **环境变量** `ORB_<KEY>_CMD` — 覆盖注册表 agent 命令
3. **环境变量** `ORB_AGENTS_EXTRA` — 注册额外自定义 agent
4. **注册表默认值** — 25 个预定义 agent

## Prompt 模式

| 模式 | 行为 | 示例 |
|------|------|------|
| positional | prompt 追加到 argv 末尾 | `codex exec "fix bug"` |
| flag | prompt 通过指定 flag 传入 | `aider --message "fix bug"` |
| stdin | prompt 通过 stdin 管道写入 | `echo "fix bug" \| agent` |

## 配置文件格式（~/.orb/agents.json）

```json
{
  "version": 1,
  "agents": {
    "my-agent": {
      "name": "My Agent",
      "command": ["python", "agent.py"],
      "promptMode": "flag",
      "promptFlag": "--input",
      "shell": false,
      "enabled": true
    }
  }
}
```

## 代码结构

- `src/index.ts` — commander CLI 入口（bin: orb），注册所有子命令
- `src/types.ts` — AgentSpec、RegistryEntry、RunResult、OrbResult 类型
- `src/registry.ts` — 25 个预定义 agent 的注册表
- `src/config.ts` — 配置文件管理 + 环境变量解析 + 合并逻辑
- `src/discover.ts` — 自动探测系统已安装的 agent
- `src/agents.ts` — agent 可用性探测 + 版本检测
- `src/runner.ts` — spawn 子进程、超时 kill、多 prompt 模式、输出收集
- `src/report.ts` — 终端表格渲染（CJK 对齐、discover 结果、list 结果）

## 技术约束

- Node.js >= 18，TypeScript strict 模式，ESM
- 只允许依赖：commander。表格/颜色手写，不新增依赖
- spawn 一律显式传 argv 数组 + `shell: false`
- 子进程输出按 UTF-8 解码，超长输出截断到 2000 字符（结果文件里保存全文）
- Windows 下 `taskkill /T /F` 终止整个子进程树
- 中文注释，代码整洁

## 验收标准

- `npm run build`（tsc）零错误
- `npm test` 22 项测试全部通过
- `orb list` 显示 25 个注册 agent 及状态
- `orb discover` 探测到系统已安装的 agent
- `orb add aider --from-registry` / `orb remove aider` 配置文件操作正常
- `orb run codex "只回复OK"` 正常返回
- `orb all "只回复OK"` 所有可用 agent 响应并渲染对比表
- `--json` 输出合法 JSON
