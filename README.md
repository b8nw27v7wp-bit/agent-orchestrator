# AgentOrb —— 多 Agent 编排 CLI

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![npm](https://img.shields.io/npm/v/agent-orb-cli)](https://www.npmjs.com/package/agent-orb-cli)
[![License](https://img.shields.io/badge/license-ISC-blue)]()

> 一条命令把同一个任务丢给本机所有 coding agent（Codex / Claude Code / Gemini / Aider 等，24~25 个），并行跑完输出结果对比表。

AgentOrb 对应 CrewAI / AutoGen / Agent SDK 的编排概念，但调度的是**真实的 CLI agent 进程**，不是 API 调用。它不预设 agent 用什么模型——只定义「怎么调」和「怎么探测」。所以你能拿它做模型横评、把任务分给不同 agent、或者让几个 agent 同时试同一个 bug。

## 它能做什么

### 让多个 agent 跑同一件事，然后对比

- `orb all "<prompt>"`：所有可用 agent 并行执行同一任务，输出一张对比表（谁成功、耗时、输出摘要）
- 结果自动落盘 `results/<时间戳>-<命令>.json`，可回溯比对
- 适合选型：同一个需求让 Codex / Claude Code / Gemini 各写一遍，看谁的产出合口味

### 单发与并行分发

- `orb run <agent> "<prompt>"`：指定 agent 跑一个任务
- `orb parallel "<任务1>" "<任务2>" "<任务3>"`：多个任务并行分发给不同 agent
- `--timeout <秒>` 单任务超时（默认 180），超时终止整个子进程树
- `--json` 输出结构化结果，方便接管道或喂给别的脚本

### 探测与配置

- `orb discover`：扫描系统已安装的 agent（逐个跑 `--version` 探测），`--new` 只看未配置的新发现
- `orb list`：列出全部预定义 agent 及其安装状态、版本、来源
- `orb add <key>` / `orb remove <key>`：写入/移除 `~/.orb/agents.json`；支持自定义命令（含空格路径可用引号包裹）
- 配置优先级：**配置文件 > `ORB_<KEY>_CMD` 环境变量 > `ORB_AGENTS_EXTRA` 注册额外 agent > 注册表默认值**

## 技术栈

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 语言 | TypeScript（strict，ESM） | `tsc` 编译到 `dist/`，Node.js ≥ 18 |
| CLI | commander（唯一依赖） | 表格、颜色、CJK 宽度对齐全部手写，零额外依赖 |
| 子进程 | `child_process.spawn` + 显式 argv + `shell: false` | 不拼 shell 字符串，避免注入；stdin 模式走 pipe |
| 输出解码 | `StringDecoder` | 正确处理跨 chunk 的 UTF-8 多字节字符（中文输出不花屏） |
| 超时终止 | `taskkill /T /F`（Windows）/ 进程组 | 杀整棵子进程树，不留孤儿 |
| 结果 | JSON 落盘 `results/` | 超长输出终端截断到 2000 字符，文件里存全文 |
| 测试 | Node 内置 `node --test` | 22 项，零测试依赖 |

## 安装

```bash
npm install -g agent-orb-cli     # 全局安装（推荐）
npx agent-orb-cli list           # 或直接 npx 运行
```

## 命令一览

| 命令 | 说明 |
| --- | --- |
| `orb list` | 列出所有预定义 agent（25 条；CodeBuddy 需装有 WorkBuddy 才注册，否则 24）及状态、版本、来源 |
| `orb discover` | 自动探测系统已安装的 agent |
| `orb add <key>` | 添加 agent 到配置文件（注册表或自定义） |
| `orb remove <key>` | 从配置文件移除 agent |
| `orb run <agent> <prompt>` | 指定 agent 执行单个任务 |
| `orb all <prompt>` | 所有可用 agent 执行同一任务，输出对比表 |
| `orb parallel <task1> <task2> ...` | 多个任务并行分发到不同 agent |

全局选项：`--json`（结构化输出）、`--timeout <秒>`（默认 180）、`--no-color`。

## 使用示例

```bash
orb list                        # 列出预定义 agent（未装 WorkBuddy 时 24 个）
orb discover                    # 探测本机已安装的
orb discover --new              # 只显示未配置的新发现
orb add aider --from-registry   # 从注册表加入配置
orb add mybot --command '"C:\Program Files\tool.exe" --mode agent' --prompt-mode flag --prompt-flag "--input"
orb run codex "修复这个 bug"
orb run aider "解释这段代码" --timeout 300
orb all "只回复OK"              # 所有可用 agent 并行，输出对比表
orb parallel "任务一" "任务二" "任务三"
orb all "只回复OK" --json       # 结构化输出，适合管道
```

## 内置注册表（25 个预定义 agent）

| key | 名称 | prompt 模式 | 探测方式 |
| --- | --- | --- | --- |
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

注册表只定义「怎么调」和「怎么探测」，**不绑定 API / 模型**，用户通过 `orb add` 或配置文件自行配置。

## 配置管理

配置文件 `~/.orb/agents.json`：

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

Prompt 传递模式：

| 模式 | 行为 | 适用 agent |
| --- | --- | --- |
| `positional` | prompt 追加到 argv 末尾 | codex, claude, aider... |
| `flag` | prompt 通过指定 flag 传入 | aider (`--message`), amazon-q (`--input`) |
| `stdin` | prompt 通过 stdin 管道写入 | 支持 stdin 的 agent |

## 项目结构

```
agent-orchestrator/
├── src/
│   ├── index.ts          # commander CLI 入口（bin: orb）
│   ├── types.ts          # 类型定义（AgentSpec, RegistryEntry, RunResult...）
│   ├── registry.ts       # 25 个预定义 agent 注册表（codebuddy 条件注入）
│   ├── config.ts         # 配置文件管理 + 环境变量解析
│   ├── discover.ts       # 自动探测已安装 agent
│   ├── agents.ts         # agent 可用性探测 + 版本检测
│   ├── path.ts           # PATH 查找工具
│   ├── runner.ts         # spawn 子进程、超时、多 prompt 模式
│   └── report.ts         # 终端表格渲染（CJK 对齐）
├── test/
│   ├── agents.test.js    # 注册表 + 配置 + 探测（7 项）
│   ├── report.test.js    # 终端渲染（7 项）
│   └── runner.test.js    # 子进程执行 + prompt 模式（8 项）
├── dist/                 # 编译输出
├── results/              # 运行结果自动保存
└── PROJECT.md
```

## 测试

```bash
npm install
npm test        # = tsc 构建 + node --test，22 tests / 0 failures
```

## 性能参考

| Agent | 单次执行（简单任务） | 说明 |
| --- | --- | --- |
| CodeBuddy (hy3) | ~10s | WorkBuddy 内置，速度快 |
| Codex (DeepSeek) | ~20s | 走 API，含模型推理 |
| Claude Code | ~15–30s | 取决于任务复杂度 |

## 已知限制

- 只负责「调起来、收结果」，不做多轮 agent 之间的对话协商——没有共享黑板、没有投票收敛，要那种协作得自己在外层写。
- 依赖各 agent CLI 的非交互模式；有的 agent 交互式提示会卡住，只能靠 `--timeout` 兜底。
- 探测靠 `--version` 命令，装了但版本命令不规范的 agent 需要手工 `orb add` 指定命令。
- 输出对比表只做摘要截断（终端 2000 字符），不做质量打分。

## License

ISC
