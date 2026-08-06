# AgentOrb —— 多 Agent 编排 CLI

统一调度本机多个 CLI AI agent（CodeBuddy / Codex / Claude Code），支持任务分发、并行执行、多 agent 结果对比。对应市面 CrewAI / AutoGen / Agent SDK 的编排概念，但调度的是真实 CLI agent 进程。

## 功能需求

1. `orb list` — 列出可用 agent，探测各 agent 命令是否可用（--json 支持）
2. `orb run <agent> <prompt...>` — 指定 agent 执行单个任务
3. `orb all <prompt...>` — 所有可用 agent 执行同一任务，输出结果对比（表格：agent / 耗时 / 结果摘要）
4. `orb parallel <task1> <task2> ...` — 多个不同任务并行分发到不同 agent（轮询分配），全部完成后汇总
5. 全局选项：`--json`（结构化输出）、`--timeout <秒>`（默认 180）、`--no-color`
6. 每次运行结果自动保存到 `results/<timestamp>-<command>.json`（含 agent、prompt、输出、耗时、退出码）
7. 超时自动终止子进程；agent 报错（非零退出）时捕获 stderr 并友好提示，不崩溃

## Agent 定义（src/agents.ts）

三个内置 agent，探测方式：命令存在于 PATH 或文件存在。

| key | 显示名 | 调用方式（spawn） | 探测 |
|-----|--------|------------------|------|
| codebuddy | CodeBuddy | `node "D:\WorkBuddy\resources\app.asar.unpacked\cli\bin\codebuddy" -p --model hy3 <prompt>` | 脚本文件存在 |
| codex | Codex | `codex exec --skip-git-repo-check --sandbox read-only <prompt>`（走 PATH，Windows 下经 shell 解析 .cmd） | `codex --version` 可执行 |
| claude | Claude Code | `"C:\Users\18434\.vscode\extensions\anthropic.claude-code-2.1.220-win32-x64\resources\native-binary\claude.exe" -p <prompt>` | exe 文件存在 |

- Agent 定义含 `key / name / command[] / cwd? / env?`，command 是完整 argv 数组（不含 prompt，prompt 追加在末尾）
- 支持环境变量覆盖：`ORB_CODEBUDDY_CMD`、`ORB_CODEX_CMD`、`ORB_CLAUDE_CMD`（JSON 数组字符串），用于用户自定义 agent 路径
- 也支持 `ORB_AGENTS_EXTRA`（JSON：key → {name, command[]}）注册自定义 agent

## 代码结构

- `src/index.ts` — commander CLI 入口（bin: orb），注册 list/run/all/parallel 子命令
- `src/types.ts` — AgentSpec、RunResult、OrbResult 等类型
- `src/agents.ts` — 内置 agent 定义 + 探测（文件存在性 / 命令可执行性）
- `src/runner.ts` — spawn 子进程、超时 kill、stdout/stderr 收集、耗时统计
- `src/report.ts` — 终端表格渲染（简单对齐 + ANSI 颜色，不引第三方表格库）、结果对比摘要

## 技术约束

- Node.js >= 18，TypeScript strict 模式，ESM（"type": "module"）
- 只允许依赖：commander（已装）。表格/颜色手写，不新增依赖
- spawn 一律显式传 argv 数组 + `shell: false`；Windows 下 .cmd 命令（如 codex）需要 `shell: true` 或改调 .cmd 文件，二选一并在代码里注释原因
- 子进程输出按 UTF-8 解码，超长输出截断到 2000 字符（结果文件里保存全文）
- 中文注释，代码整洁

## 验收标准

- `npm run build`（tsc）零错误
- `node dist/index.js list` 显示全部可用 agent 及状态
- `node dist/index.js run codex "只回复OK"` 正常返回
- `node dist/index.js all "只回复OK"` 三个 agent 都响应并渲染对比表
- `node dist/index.js parallel "task1" "task2"` 并行执行成功
- `--json` 输出合法 JSON

请先阅读现有 package.json / tsconfig.json，实现全部代码，然后运行 `npm run build` 确认编译通过。不要修改 package.json 的 dependencies（只允许 commander），如需构建脚本可更新 scripts.build。
