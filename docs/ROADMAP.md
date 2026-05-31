# Roadmap — Agent Code

The phased build order and verification strategy. Each phase is independently runnable. For the
system design, see [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Phase 1 — Core agent (primary deliverable)

Build order:

1. Scaffold: `package.json` / `tsconfig.json` / `tsup.config.ts` / `vitest.config.ts` /
   `eslint.config.js`.
2. `tools/types.ts` + `tools/registry.ts`.
3. Core tools: Read, Write, Edit, Bash (+ background), Glob, Grep, LS, TodoWrite, Task,
   BashOutput, KillShell, ExitPlanMode.
4. `llm/`: `client.ts`, `stream.ts`, `retry.ts`, `tokens.ts`, `models.ts`.
5. `permissions/`: `mode.ts`, `engine.ts`, `rules.ts`, `store.ts`.
6. `config/settings.ts` (+ `schema.ts`, `paths.ts`).
7. `context/`: `project.ts`, `environment.ts`, `gitignore.ts`.
8. `agent/`: `systemPrompt.ts`, `loop.ts`, `subagent.ts`, `events.ts`, `reminders.ts`.
9. `index.ts` print mode.
10. Ink `app/App.tsx` + components.
11. `util/`: `errors.ts`, `logger.ts`, `fs.ts`, `cancel.ts`, `redact.ts`.
12. Unit tests.

**Exit criteria:** `agent -p "..."` and interactive mode both work end-to-end against the real
filesystem with permission gating, subagents, and background shells.

## Phase 2 — Sessions & resume

- JSONL transcript persistence; `--continue` / `--resume <id>`.
- WebFetch / WebSearch tools (allow-listed + content-sanitized).

## Phase 3 — Interactive UX

- Slash commands, plan-mode UX, `@`-file mentions, pasted-image input, richer TodoWrite view.

## Phase 4 — Polish

- Extended thinking UI, hooks system, NotebookEdit, cost/token UI, context compaction,
  `--output-format json`, secret-redaction hardening.

## Phase 5 — MCP client

- `@modelcontextprotocol/sdk` stdio + HTTP transports; expose MCP tools/prompts/resources into
  the registry and slash-command menu; `.agent/mcp.json` config.

## Phase 6 — Packaging

- README, `npm i -g`, CI (typecheck + lint + vitest), release workflow.

---

## Verification

- **Unit tests (vitest):** every tool against tmp-dir fixtures (Read/Write/Edit round-trips,
  Edit uniqueness failure, Bash timeout + truncation, background shell lifecycle, Glob/Grep
  results, gitignore respect, **path-sandbox escape rejection**, **secret redaction**);
  permission rule matching across modes; **agent loop driven by a mocked LLM stream** asserting
  `tool_use → tool_result → continue` and final `end_turn`; **Task subagent** returns only its
  final message.
- **Typecheck/lint:** `npm run typecheck` (strict) + `npm run lint` clean.
- **Manual smoke (print mode, real key):**
  - `agent -p "create hello.txt with 'hi' then read it back"` → Write asks/allows, Read returns it.
  - `agent -p "list TODO comments"` → Grep runs, summary returned.
  - `agent --permission-mode plan -p "how would you add a CLI flag?"` → no mutations, ExitPlanMode.
- **Manual smoke (interactive):** `npm run dev` → multi-turn convo, streaming visible, `esc`
  cancels mid-tool, permission prompt allow/deny works, StatusBar shows tokens/cost.
- **Cross-platform:** Bash tool verified on Windows (pwsh) and POSIX (sh).
