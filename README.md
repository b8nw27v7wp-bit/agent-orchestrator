# AgentOrb —— 多 Agent 编排 CLI

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![npm](https://img.shields.io/npm/v/agent-orb-cli)](https://www.npmjs.com/package/agent-orb-cli)
[![Tests](https://img.shields.io/badge/tests-22%2F22-passing-brightgreen)]()
[![License](https://img.shields.io/badge/license-ISC-blue)]()

> 统一调度市面主流 coding agent CLI（24~25 个，取决于本机是否装 WorkBuddy），支持任务分发、并行执行、多 agent 结果对比。

AgentOrb 对应 CrewAI / AutoGen / Agent SDK 的编排概念，但调度的是**真实 CLI agent 进程**，而非 API 调用。不预设 agent 用什么 API 或模型——只定义"怎么调"。

---

## 🚀 安装

```bash
# 全局安装（推荐）
npm install -g agent-orb-cli

# 或直接运行
npx agent-orb-cli list
```

要求 Node.js >= 18。

---

## 🎯 核心功能

| 命令 | 说明 |
|------|------|
| `orb list` | 列出所有预定义 agent（25 条，CodeBuddy 需装有 WorkBuddy 才注册，否则 24）及状态、版本、来源 |
| `orb discover` | 自动探测系统已安装的 agent |
| `orb add <key>` | 添加 agent 到配置文件（注册表或自定义） |
| `orb remove <key>` | 从配置文件移除 agent |
| `orb run <agent> <prompt>` | 指定 agent 执行单个任务 |
| `orb all <prompt>` | 所有可用 agent 执行同一任务，输出对比表 |
| `orb parallel <task1> <task2> ...` | 多个任务并行分发到不同 agent |

### 全局选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--json` | 结构化 JSON 输出 | 否 |
| `--timeout <秒>` | 单任务超时秒数 | 180 |
| `--no-color` | 禁用 ANSI 颜色 | 否 |

---

## 📖 使用示例

```bash
# 列出所有预定义 agent（未装 WorkBuddy 时 24 个）
orb list

# 探测系统已安装的 agent
orb discover
orb discover --new   # 只显示未配置的新发现

# 从注册表添加已安装的 agent 到配置
orb add aider --from-registry

# 添加自定义 agent（支持引号包裹含空格路径）
orb add mybot --command '"C:\Program Files\tool.exe" --mode agent' --prompt-mode flag --prompt-flag "--input"

# 从配置移除
orb remove mybot

# 指定 agent 执行任务
orb run codex "修复这个 bug"
orb run aider "解释这段代码" --timeout 300

# 所有可用 agent 执行同一任务，输出对比表
orb all "只回复OK"

# 多任务并行分发
orb parallel "任务一" "任务二" "任务三"

# JSON 结构化输出（适合管道）
orb all "只回复OK" --json

# 结果自动保存到 results/<时间戳>-<命令>.json
```

---

## 🤖 内置注册表（25 个预定义 Agent，CodeBuddy 按本机 WorkBuddy 探测注册）

| key | 名称 | prompt 模式 | 探测方式 |
|-----|------|------------|----------|
| `codebuddy` | CodeBuddy | positional | WorkBuddy 脚本文件存在 |
| `codex` | Codex | positional | `codex --version` |
| `claude` | Claude Code | positional | `claude --version` |
| `gemini` | Gemini CLI | positional | `gemini --version` |
| `aider` | Aider | flag (`--message`) | `aider --version` |
| `goose` | Goose | positional | `goose --version` |
| `amazon-q` | Amazon Q | flag (`--input`) | `q --version` |
| `openhands` | OpenHands | flag (`--task`) | `openhands --version` |
| `cline` | Cline | flag (`--prompt`) | `cline --version` |
| `continue` | Continue | positional | `continue --version` |
| `cursor-agent` | Cursor Agent | positional | `cursor-agent --version` |
| `copilot` | GitHub Copilot CLI | flag (`--prompt`) | `gh copilot --version` |
| `windsurf` | Windsurf | positional | `windsurf --version` |
| `devin` | Devin CLI | positional | `devin --version` |
| `sweep` | Sweep | positional | `sweep --version` |
| `mentat` | Mentat | positional | `mentat --version` |
| `gpt-engineer` | GPT Engineer | positional | `gpt-engineer --version` |
| `smol-developer` | smol developer | positional | `smol-developer --version` |
| `magick` | Magick CLI | positional | `magick --version` |
| `autogpt` | AutoGPT | flag (`--prompt`) | `autogpt --version` |
| `metagpt` | MetaGPT | positional | `metagpt --version` |
| `roo` | Roo Code | flag (`--prompt`) | `roo --version` |
| `crush` | Crush | positional | `crush version` |
| `qwen-code` | Qwen Code | positional | `qwen-code --version` |
| `deepseek` | DeepSeek CLI | positional | `deepseek --version` |

注册表只定义"怎么调"和"怎么探测"，**不绑定 API / 模型**。用户通过 `orb add` 或配置文件自行配置。

---

## ⚙️ 配置管理

### 配置文件 `~/.orb/agents.json`

```json
{
  "version": 1,
  "agents": {
    "my-agent": {
      "name": "My Agent",
      "command": ["python", "agent.py"],
      "promptMode": "flag",
      "promptFlag": "--input",
      "enabled": true
    }
  }
}
```

### 优先级（高→低）

1. **配置文件** — 用户显式添加
2. **环境变量** `ORB_<KEY>_CMD` — 覆盖注册表 agent 命令
3. **环境变量** `ORB_AGENTS_EXTRA` — 注册额外自定义 agent
4. **注册表默认值** — 25 个预定义 agent（`codebuddy` 仅在探测到 WorkBuddy 时注入）

### Prompt 传递模式

| 模式 | 行为 | 适用 agent |
|------|------|-----------|
| `positional` | prompt 追加到 argv 末尾 | codex, claude, aider... |
| `flag` | prompt 通过指定 flag 传入 | aider (`--message`), amazon-q (`--input`) |
| `stdin` | prompt 通过 stdin 管道写入 | 支持 stdin 的 agent |

---

## 📁 项目结构

```
agent-orchestrator/
├── src/
│   ├── index.ts          # commander CLI 入口（bin: orb）
│   ├── types.ts          # 类型定义（AgentSpec, RegistryEntry, RunResult...）
│   ├── registry.ts       # 25 个预定义 agent 注册表（codebuddy 条件注入）
│   ├── config.ts         # 配置文件管理 + 环境变量解析
│   ├── discover.ts       # 自动探测已安装 agent
│   ├── agents.ts         # agent 可用性探测 + 版本检测
│   ├── path.ts           # PATH 查找工具（共享模块）
│   ├── runner.ts         # spawn 子进程、超时、多 prompt 模式
│   └── report.ts         # 终端表格渲染（CJK 对齐）
├── test/
│   ├── agents.test.js    # 注册表 + 配置 + 探测测试（7 项）
│   ├── report.test.js    # 终端渲染测试（7 项）
│   └── runner.test.js    # 子进程执行 + prompt 模式测试（8 项）
├── dist/                 # 编译输出
├── results/              # 运行结果自动保存
├── package.json
├── tsconfig.json
├── PROJECT.md
└── README.md
```

---

## 🧪 测试

```bash
git clone https://github.com/b8nw27v7wp-bit/agent-orchestrator.git
cd agent-orchestrator
npm install
npm test
# 22 tests, 0 failures
```

---

## 🛠 技术约束

- **Node.js >= 18**，TypeScript strict，ESM
- **唯一依赖**：commander。表格/颜色/对齐全部手写
- spawn 一律显式 argv + `shell: false`；stdin 模式 agent 通过 pipe 写入
- `StringDecoder` 正确处理跨 chunk 的 UTF-8 多字节字符
- 子进程输出 UTF-8 解码，超长输出截断到 2000 字符（结果文件保存全文）
- Windows 下 `taskkill /T /F` 终止整个子进程树
- 终端表格支持 CJK 字符宽度计算

---

## 📊 性能参考

| Agent | 单次执行（简单任务） | 说明 |
|-------|---------------------|------|
| CodeBuddy (hy3) | ~10s | WorkBuddy 内置，速度快 |
| Codex (DeepSeek) | ~20s | 走 API，含模型推理 |
| Claude Code | ~15-30s | 取决于任务复杂度 |

---

## 📄 License

ISC
