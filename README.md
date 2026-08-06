# AgentOrb —— 多 Agent 编排 CLI

统一调度本机多个 CLI AI agent（CodeBuddy / Codex / Claude Code），支持任务分发、并行执行、多 agent 结果对比。对应市面 CrewAI / AutoGen / Agent SDK 的编排概念，但调度的是真实 CLI agent 进程。

## 安装

```bash
npm install        # 安装依赖
npm run build      # 编译 TS → dist/
npm link           # 全局注册 orb 命令（可选）
```

要求 Node.js >= 18。

## 用法

```bash
# 列出可用 agent 及状态
orb list                      # 或 --json 输出结构化结果

# 指定 agent 执行单个任务
orb run codex "修复这个 bug"
orb run claude "解释这段代码" --timeout 300

# 所有可用 agent 执行同一任务，输出对比表
orb all "只回复OK"

# 多个任务并行分发到不同 agent（轮询分配）
orb parallel "任务一" "任务二" "任务三"

# 全局选项
--timeout <秒>     # 单任务超时（默认 180）
--json             # 结构化 JSON 输出（不写结果文件）
--no-color         # 禁用 ANSI 颜色
```

每次运行自动保存结果到 `results/<时间戳>-<命令>.json`（含 agent、prompt、输出全文、耗时、退出码）。

## 内置 Agent

| key | 名称 | 说明 |
|-----|------|------|
| `codebuddy` | CodeBuddy (hy3) | WorkBuddy 内置 CLI |
| `codex` | Codex (DeepSeek) | npm @openai/codex，DeepSeek provider |
| `claude` | Claude Code | VS Code 插件捆绑二进制 |

## 自定义配置（环境变量）

```bash
# 覆盖内置 agent 的调用命令（JSON 数组字符串）
export ORB_CODEBUDDY_CMD='["node","C:\\path\\codebuddy","-p"]'
export ORB_CODEX_CMD='["codex","exec","--skip-git-repo-check"]'
export ORB_CLAUDE_CMD='["claude","-p"]'

# 注册自定义 agent（JSON：key → {name, command[]}）
export ORB_AGENTS_EXTRA='{"deepseek":{"name":"DeepSeek CLI","command":["ds","chat"]}}'
```

## 开发

```bash
npm test    # 编译 + 运行单元测试（node:test，零测试依赖）
npm run build
```

代码结构：

- `src/index.ts` — commander CLI 入口（bin: orb），注册 list/run/all/parallel
- `src/types.ts` — AgentSpec、RunResult、OrbResult 等类型
- `src/agents.ts` — 内置 agent 定义 + 可用性探测 + 环境变量覆盖
- `src/runner.ts` — spawn 子进程、超时终止（Windows 下 taskkill /T 杀进程树）、输出收集
- `src/report.ts` — 终端表格/单结果/并行摘要渲染（零依赖手写 ANSI）
- `test/` — node:test 单元测试（runner / report / agents）
