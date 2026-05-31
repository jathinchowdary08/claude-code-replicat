# Agent Code

A faithful, **production-grade** clone of Claude Code: an interactive **terminal AI coding
agent**. Built from scratch in TypeScript (ESM, Node ≥18), it talks to the Anthropic Messages
API, streams output to an Ink (React-in-the-terminal) UI, executes a core tool set against the
local filesystem and shell, and gates dangerous actions behind a permission system.

> **Status:** Design phase. This repository currently contains the **architecture and roadmap
> only** — no application code yet. Implementation follows the phased plan in
> [`docs/ROADMAP.md`](docs/ROADMAP.md).

## What it will do

- **Interactive mode** — a multi-turn TUI: streaming assistant output, live tool calls, diff
  previews, interactive permission prompts, slash commands, a status bar with model/cost/tokens.
- **Print mode** (`agent -p "…"`) — non-interactive, single-shot, scriptable for CI.
- **Core tools** — Read, Write, Edit, Bash (foreground + background), Glob, Grep, LS, TodoWrite,
  Task (subagents), BashOutput, KillShell, ExitPlanMode.
- **Permissions** — `default` / `acceptEdits` / `plan` / `bypassPermissions` modes with
  allow/deny rule matching; deny always wins.
- **Production concerns** — typed errors that never crash the TUI, structured logging, secret
  redaction, path sandboxing, retries with backoff, graceful cancellation, CI.

Later phases add session persistence/resume, WebFetch/WebSearch, NotebookEdit, extended
thinking, a hooks system, `@`-file mentions, image input, MCP client support, and packaging.

## Documentation

| Document | Contents |
|----------|----------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | The system design: directory layout, the core agent loop, tool specs, permission model, CLI/TUI, and supporting systems. |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | The phased build order (Phase 1 → 6), exit criteria per phase, and the full verification strategy. |

## Tech stack

- **Runtime:** TypeScript (ESM), Node ≥18
- **TUI:** Ink + React + Yoga layout + chalk
- **Provider:** Anthropic via `@anthropic-ai/sdk` (streaming, tool use, prompt caching,
  extended thinking)
- **Build/test:** tsup, vitest, eslint
- **Auth:** `ANTHROPIC_API_KEY` (env or settings)
