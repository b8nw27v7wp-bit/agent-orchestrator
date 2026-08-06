# AgentOrb —— 多 Agent 编排 CLI

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-15%2F15-passing-brightgreen)]()
[![License](https://img.shields.io/badge/license-ISC-blue)]()

> 统一调度本机多个 CLI AI agent，支持任务分发、并行执行、多 agent 结果对比。

AgentOrb 对应市面 CrewAI / AutoGen / Agent SDK 的编排概念，但调度的是**真实 CLI agent 进程**（CodeBuddy / Codex / Claude Code），而非 API 调用。

---

## 🎯 核心功能

| 命令 | 说明 |
|------|------|
| `orb list` | 列出可用 agent，探测各 agent 命令是否可用 |
| `orb run <agent> <prompt>` | 指定 agent 执行单个任务 |
| `orb all <prompt>` | 所有可用 agent 执行同一任务，输出结果对比表 |
| `orb parallel <task1> <task2> ...` | 多个不同任务并行分发到不同 agent（轮询分配） |

### 全局选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--json` | 结构化 JSON 输出 | 否 |
| `--timeout <秒>` | 单任务超时秒数 | 180 |
| `--no-color` | 禁用 ANSI 颜色 | 否 |

---

## 🚀 快速开始

### 安装

```bash
# 克隆项目
git clone <repo-url>
cd agent-orchestrator

# 安装依赖
npm install

# 编译 TypeScript
npm run build

# （可选）全局注册 orb 命令
npm link
```

要求 Node.js >= 18。

### 使用示例

```bash
# 列出可用 agent 及状态
orb list
# ✓ CodeBuddy (hy3)       codebuddy  node D:\WorkBuddy\...
# ✓ Codex (DeepSeek)      codex      node C:\Users\...\codex.js
# ✓ Claude Code            claude     C:\Users\...\claude.exe

# 指定 agent 执行任务
orb run codex "修复这个 bug"
orb run claude "解释这段代码" --timeout 300

# 所有 agent 执行同一任务，输出对比表
orb all "只回复OK"
# Agent             状态    耗时   摘要
# -------------------------------------------
# CodeBuddy (hy3)   ✓ 成功  10.2s  OK
# Codex (DeepSeek)  ✓ 成功  19.8s  OK
# Claude Code       ✗ 失败  30.3s  (无输出)

# 多任务并行分发（轮询分配到不同 agent）
orb parallel "任务一" "任务二" "任务三"

# JSON 结构化输出（适合管道）
orb all "只回复OK" --json

# 结果自动保存到 results/<时间戳>-<命令>.json
```

---

## 🤖 内置 Agent

| key | 名称 | 调用方式 | 探测方式 |
|-----|------|----------|----------|
| `codebuddy` | CodeBuddy (hy3) | `node D:\WorkBuddy\...\codebuddy -p --model hy3` | 脚本文件存在 |
| `codex` | Codex (DeepSeek) | `node C:\Users\...\codex.js exec --skip-git-repo-check --sandbox read-only` | `codex --version` 可执行 |
| `claude` | Claude Code | `C:\Users\...\claude.exe -p` | exe 文件存在 |

### Agent 探测逻辑

1. **绝对路径**（含盘符或反斜杠）→ 检查文件是否存在
2. **相对路径**（含 `/`）→ 检查相对文件是否存在
3. **纯命令名**（如 `codex`）→ 在 PATH 中查找可执行文件
4. **参数中的绝对路径** → 也必须存在（防止脚本文件被删除后误报可用）

---

## ⚙️ 自定义配置（环境变量）

```bash
# 覆盖内置 agent 的调用命令（JSON 数组字符串）
export ORB_CODEBUDDY_CMD='["node","C:\\path\\codebuddy","-p"]'
export ORB_CODEX_CMD='["codex","exec","--skip-git-repo-check"]'
export ORB_CLAUDE_CMD='["claude","-p"]'

# 注册自定义 agent（JSON：key → {name, command[]}）
export ORB_AGENTS_EXTRA='{"deepseek":{"name":"DeepSeek CLI","command":["ds","chat"]}}'
```

---

## 📁 项目结构

```
agent-orchestrator/
├── src/
│   ├── index.ts          # commander CLI 入口（bin: orb）
│   ├── types.ts          # AgentSpec、RunResult、OrbResult 类型定义
│   ├── agents.ts         # 内置 agent 定义 + 可用性探测 + 环境变量覆盖
│   ├── runner.ts         # spawn 子进程、超时终止、输出收集
│   └── report.ts         # 终端表格/单结果/并行摘要渲染（零依赖手写 ANSI）
├── test/
│   ├── agents.test.js    # agent 定义与探测测试
│   ├── report.test.js    # 终端渲染测试
│   └── runner.test.js    # 子进程执行测试
├── dist/                 # 编译输出（tsc）
├── results/              # 运行结果自动保存（JSON）
├── package.json          # 项目配置（bin: orb）
├── tsconfig.json         # TypeScript 配置（strict 模式）
├── PROJECT.md            # 功能需求文档
└── README.md             # 项目说明
```

---

## 🧪 测试

```bash
# 编译 + 运行全部测试
npm test

# 输出示例：
# ✔ getAgents 返回三个内置 agent
# ✔ isAgentAvailable：不存在的路径返回 false，node 可执行文件返回 true
# ✔ ORB_CODEX_CMD 环境变量覆盖内置 codex 命令
# ✔ ORB_AGENTS_EXTRA 注册自定义 agent，非法 JSON 被忽略
# ✔ renderTable 包含表头与耗时
# ✔ renderSingle 成功时隐藏 stderr 噪音
# ✔ renderSingle 失败时展示 stderr
# ✔ renderParallel 逐条展示摘要
# ✔ 禁用颜色后无 ANSI 转义序列
# ✔ 正常退出：ok=true，stdout 正确收集
# ✔ 非零退出：ok=false，error 含退出码
# ✔ 超时终止：killTree 生效且快速返回
# ✔ stdin 置 ignore：agent 读不到 stdin 输入
# ✔ summary 截断到 120 字符
# ✔ runAll 轮询分配：每个任务分给对应 agent
# ℹ tests 15, pass 15, fail 0
```

测试使用 Node.js 内置 `node:test` 模块，零测试依赖。

---

## 🛠 技术约束

- **Node.js >= 18**，TypeScript strict 模式，ESM（`"type": "module"`）
- **唯一依赖**：commander（CLI 框架）。表格/颜色/对齐全部手写
- spawn 一律显式传 argv 数组 + `shell: false`（Windows `.cmd` 命令除外）
- 子进程输出按 UTF-8 解码，超长输出截断到 2000 字符（结果文件保存全文）
- Windows 下 `taskkill /T /F` 终止整个子进程树，避免孙进程残留
- 终端表格支持 CJK 字符宽度计算（中文字符占 2 列）

---

## 📊 性能参考

| Agent | 单次执行（简单任务） | 说明 |
|-------|---------------------|------|
| CodeBuddy (hy3) | ~10s | WorkBuddy 内置，速度快 |
| Codex (DeepSeek) | ~20s | 走 API，含模型推理 |
| Claude Code | ~15-30s | 取决于任务复杂度 |

---

## 📝 开发日志

- **v1.0.0** — 核心功能交付（list/run/all/parallel）
- **v1.0.1** — 修复 agent 探测逻辑 + CJK 终端对齐

---

## 📄 License

ISC
