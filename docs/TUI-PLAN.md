# TUI Plan — Full Claude Code UI/UX & functional parity

> Status: design. This refines the user's Phase 1–5 TUI rewrite plan, corrects the points where
> it diverged from real Claude Code, and adds a complete **parity checklist** so nothing is
> missed. Companion to [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`ROADMAP.md`](ROADMAP.md).

## Context

`agent-code` already has a working Phase 1–4 agent (streaming loop, tools, permissions,
sessions, slash commands, web/notebook tools, Ink TUI). The TUI is the weak point: garbled
output as the conversation grows, input lag, glyphs that ignore color, todos that don't clear,
broken `/resume`, and a layout that isn't Claude-Code-faithful.

**Goal:** rebuild the TUI on a stable render architecture, match Claude Code **detail-for-detail**,
finish functional parity, and lock it with `ink-testing-library` snapshot tests.

**Target terminal:** Windows Terminal (truecolor + full Unicode, fast redraw → full-width
boxes/glyphs are safe).

### One caveat the implementer must honor
Claude Code's exact **glyphs, spinner words, hint strings, and some keybindings change between
versions**. This plan gives the structure and the known-good values, but for literal parity:
**run a live Claude Code session on the target terminal and snapshot the real bytes** (glyph
codepoints, spinner gerund list, mode-line strings) — treat that capture as the source of truth,
not this doc's examples.

---

## Guiding principles (corrected)

1. **Two regions only.** An immutable transcript in Ink `<Static>` (printed once, never
   redrawn) and a small live region. This is the single fix that kills garbling and input lag.
2. **The live region always includes the input** — *even while a turn is running*. Claude Code
   lets you type and **queue** a follow-up mid-turn; the input never goes dead. (Correction vs the
   draft's "input only redraws while idle.")
3. **Committed transcript does NOT reflow on resize.** `<Static>` content is already flushed to
   scrollback at its print-time width and cannot reflow — and CC's history doesn't either. Only
   the live region reflows. (Correction vs "everything reflows.")
4. **Turn lifecycle:** active-turn blocks render live; on `turn_end` they commit atomically into
   the transcript. Then queued input (if any) flushes.
5. **Theme module** is the only place for the palette and glyphs. Components never hardcode
   colors or dots.
6. **Glyphs:** use Claude Code's *actual* glyphs (`⏺` assistant, `✻` spinner) since the target
   is truecolor Windows Terminal where they render in color via VS16. Keep a `●`/ASCII fallback
   for non-truecolor terminals behind a capability check. (Correction vs the draft banning `⏺`/`✻`.)
7. Every component is a pure function of props → snapshot-testable.

---

## Architecture (keep — this part of the draft was right)

```mermaid
flowchart TD
  LOOP["useAgentLoop()"] -->|transcript: HistoryItem[]| STATIC["&lt;Static&gt; (immutable, print-once)"]
  LOOP -->|live: HistoryItem[]| LIVE["Live region"]
  LIVE --> ACTIVE["active turn blocks"]
  LIVE --> SPIN["Thinking spinner + Todos"]
  LIVE --> INPUT["InputBox (always interactive)"]
  LIVE --> STATUSLINE["mode line + low-context warning"]
  RESIZE["useTerminalSize()"] -->|width| LIVE
  STATIC -.generation key remount on /clear.-> STATIC
```

`useAgentLoop` owns `transcript` (finalized) and `live` (current turn). Commit happens **in the
loop** on `turn_end`/idle — not via an App effect guessing from `items.length`. Remove the
`committed/gen` heuristics from `App.tsx`.

---

## Phase 1 — Render core rewrite (stability)

Files: `src/app/App.tsx`, `src/app/hooks/useAgentLoop.ts`, new `src/app/theme.ts`,
new `src/app/hooks/useTerminalSize.ts`.

1. **Transcript/live split** as above.
2. **Pending-input queue** in `useAgentLoop`: keystrokes accepted during a turn accumulate;
   on `turn_end` the queued message is submitted as the next turn. Show a queued-message hint.
3. **`/clear` & screen reset:** clear `transcript` + `messagesRef` + todos, remount `<Static>`
   via a generation key so scrollback visibly resets.
4. **Resize handling:** `useTerminalSize()` (subscribe to stdout `'resize'`) feeds width to the
   live region only.
5. **Theme module** (`theme.ts`): colors (accent `#d97757`, dim, user, tool, error, success,
   warning, diffAdd/diffDel) and glyphs (`assistantDot ⏺`, `userPrompt >`, `toolResult ⎿`,
   `spinner ✻`, `modeArrow ⏵⏵`, todo `☐/◐/☑`), plus a `caps` object (truecolor?/unicode?) that
   selects fallbacks.

**Exit criteria:** long conversations never garble; typing is instant regardless of length
(snapshot/perf test: render 200 transcript items + simulate typing — history renders once,
live redraw stays cheap); typing **during** a turn queues without lag.

---

## Phase 2 — Visual parity (component-by-component)

Each component gets a CC-faithful render + a snapshot test. Files under `src/app/components/`.

| Component | CC-faithful spec |
|-----------|------------------|
| **Banner.tsx** | `<Static>`; rounded-border welcome box (`✻ Welcome to Agent Code`), version, `model · context · account`, cwd, tips box, `? for shortcuts`. Colors from theme. |
| **Markdown.tsx** (rewrite) | Headings, bold/italic/`~~strike~~`, inline code, fenced code blocks w/ language label + optional highlight, ordered/unordered/**nested** lists, blockquotes, hr, links, simple tables. Biggest visual gap. Keep it **minimal like CC** — don't over-render tables. |
| **MessageItem** (in MessageList) | assistant = `⏺` + hanging-indent markdown; user = dim `>` echo; error = red. Route through theme. |
| **ToolUseView.tsx** (rewrite) | Header `⏺ Tool(args)` (`Bash(npm test)`, `Read(src/x.ts)`, `Update(file)`, `Write(file)`, `Search(pat)`); results on `⎿` lines, per-tool: Bash→output (truncated `… +N lines`); Read→`Read N lines`; Edit/Write→inline DiffView; Grep→`N matches`; Glob/LS→counts; Web→title/url. Collapsed by default w/ expand hint. |
| **DiffView.tsx** (refine) | red/green, `@@` hunk headers, context lines, `+N more`, line numbers. |
| **Thinking.tsx** (refine) | `✻ Gerund… (1m 20s · ↑ 3.2k tokens · esc to interrupt)`. Spinner word rotates from CC's gerund list (capture live). Theme colors. |
| **ThinkingBlock.tsx** (new) | extended-thinking content: dim italic, collapsible header. |
| **TodoView.tsx** | checkbox list (`☐/◐/☑`) under the spinner; **hide when all done / on clear**. Theme. |
| **Mode line** (not a StatusBar) | `⏵⏵ accept edits on (shift+tab)` / `plan mode on (shift+tab)`; `? for shortcuts`. **No persistent always-on status bar** — CC doesn't have one. (Correction vs draft's StatusBar.) Model/cost live behind `/status` and `/cost`. |
| **Low-context warning** | transient line `Context left until auto-compact: N%` shown only when low (uses `estimateTokens` vs `resolveModel().contextWindow`). |
| **SelectList.tsx** (new shared primitive) | ↑↓ + Enter + number keys. All pickers refactor onto it. |
| **ModelPicker / SessionPicker / CommandMenu / FileMentionMenu** | built on SelectList → identical look/behavior. |
| **PermissionPrompt.tsx** | SelectList options: `Yes` / `Yes, and don't ask again for {scope} in this project` / `No, and tell Claude what to do differently`. For Edit/Write show the diff **inside** the prompt. |

---

## Phase 3 — Input & keybindings (CC parity)

Files: `src/app/components/InputBox.tsx` (rewrite), `src/app/App.tsx`.

**Editing:** multiline with real cursor (left/right/home/end, word ops); Enter submits;
Shift+Enter / `\`+Enter inserts newline; placeholder `Try "fix the failing test"`.

**Paste & images:** bracketed paste captures large pastes as one block (no per-char lag);
pasted image data → attach as an image block, shown as an `[Image #1]` pill; degrade gracefully
if unsupported.

**Input modes (prefix-triggered):**
- `/` → command menu (SelectList dropdown, Tab to complete)
- `@` → file-mention menu (lazy file index, Tab to complete)
- `!` → bash mode (distinct border/label; runs command directly)
- `#` → memory mode (append to AGENTS.md/CLAUDE.md)
- `/vim` → vim mode with `NORMAL`/`INSERT` indicator

**Keybindings** (verify literals against live CC — bindings drift):

| Key | Action |
|-----|--------|
| Enter | submit |
| Shift+Enter / `\`+Enter | newline |
| Shift+Tab | cycle mode: default → accept edits → plan |
| Esc | interrupt current turn |
| Esc Esc (double) | edit previous message / rewind menu |
| ↑ / ↓ | input history |
| Ctrl+C ×2 | quit |
| Ctrl+D | quit (EOF on empty input) |
| Ctrl+L | clear screen |
| Ctrl+R | expand/collapse truncated tool output *(verify — CC uses this for expand, not reverse-search)* |
| Tab | accept autocomplete |
| Ctrl+←/→ | word movement |

> Note: the draft listed **Ctrl+R reverse-search** as parity — it is **not** a CC feature; CC's
> Ctrl+R toggles output expansion. Either map Ctrl+R to expand (parity) or keep reverse-search
> as a clearly-labeled **addition** on a different key.

---

## Phase 4 — Functional parity

- **`/resume` (finish):** reconstruct transcript with full fidelity — persist & replay
  `tool_use`/`tool_result`/`thinking` blocks, not just text. Files: `src/session/store.ts`,
  `useAgentLoop.ts` `reconstructItems`.
- **Permissions parity:** "don't ask again this session" works in-memory; add **persisting an
  allow rule** to `.agent/settings.json` when chosen (optional toggle) + per-command scope for
  Bash. Files: `src/permissions/*`, `src/config/settings.ts`.
- **Slash-command set** — round out to CC's meaningful set via the existing registry
  (`src/commands/*`):
  `/help /clear /compact /cost /config /model /memory /init /resume /rewind /status /export
  /add-dir /agents /mcp /permissions /hooks /vim /doctor /bug /release-notes /quit`.
  `/doctor` additionally reports **build freshness** (dist mtime vs running build) — *flagged as
  a custom extension, not CC parity*.
- **Context/compaction UX:** visible `Compacting conversation…` + low-context warning;
  auto-compaction already in `agent/compaction.ts`.
- **Tool output fidelity:** ensure each tool returns a CC-style `title`/`ui` so ToolUseView
  renders correctly (touch `src/tools/*.ts` result shapes only where needed).
- **Notifications:** terminal bell / OS notification when the agent finishes while the terminal
  is unfocused (CC parity; behind a setting).

---

## Phase 5 — Tests + dev workflow

- **Snapshot tests** (`test/app/*.test.tsx`) via ink-testing-library for: Banner, MessageItem
  (user/assistant/error), ToolUseView (bash/read/edit/denied/truncated), DiffView, Thinking,
  ThinkingBlock, TodoView, mode-line, low-context warning, SelectList, ModelPicker,
  SessionPicker, CommandMenu, FileMentionMenu, PermissionPrompt, InputBox (empty/typing/menu/
  bash-mode/vim), and an **App-level** test: "transcript commits to `<Static>` / typing doesn't
  redraw history / typing during a turn queues."
- **Logic tests:** markdown parser, diff formatter, command parser, session reconstruction,
  permission persistence, queued-input flush.
- **Dev workflow:** `npm link` + `npm run watch` so the global `acode` always reflects `dist`;
  `/doctor` warns if the running build is stale.

---

## Full Claude Code parity checklist (so nothing's missed)

**Startup / chrome**
- [ ] Welcome box (rounded border, `✻`), version, model, cwd
- [ ] Tips / what's-new line · [ ] `? for shortcuts` hint · [ ] account/login status

**Transcript**
- [ ] User `>` dim echo · [ ] Assistant `⏺` + markdown hanging indent · [ ] Error red
- [ ] Tool `⏺ Tool(args)` + `⎿` result · [ ] per-tool result formatting · [ ] truncation + expand hint
- [ ] Inline diff for edits (numbers, red/green, `@@`) · [ ] Thinking block (dim italic, collapsible)

**Live region**
- [ ] Spinner: `✻ Gerund… (Xm Ys · ↑ N tokens · $cost · esc to interrupt)`
- [ ] Todos under spinner, auto-hide when done · [ ] `Compacting conversation…` state
- [ ] Mode line `⏵⏵ accept edits on (shift+tab)` · [ ] low-context warning when near limit
- [ ] Queued-message indicator (typing mid-turn)

**Input**
- [ ] Bordered multiline box + cursor + placeholder · [ ] Enter submit / Shift+Enter newline
- [ ] `/` commands · [ ] `@` mentions · [ ] `!` bash · [ ] `#` memory · [ ] `/vim` mode
- [ ] History ↑/↓ · [ ] bracketed paste · [ ] image paste pill · [ ] Tab autocomplete

**Keybindings**
- [ ] Shift+Tab modes · [ ] Esc interrupt · [ ] Esc-Esc rewind/edit · [ ] Ctrl+C×2 quit
- [ ] Ctrl+L clear · [ ] Ctrl+D EOF quit · [ ] Ctrl+R expand · [ ] Ctrl+←/→ word nav

**Permissions**
- [ ] Selectable Yes / Yes-don't-ask / No-with-feedback · [ ] inline diff in prompt
- [ ] per-Bash-command scope · [ ] persist allow rule to settings

**Slash commands**
- [ ] help clear compact cost config model memory init resume rewind status export add-dir
      agents mcp permissions hooks vim doctor bug release-notes quit

**Cross-cutting**
- [ ] truecolor + Unicode caps detection w/ fallbacks · [ ] OS/bell notification on idle finish
- [ ] no garble on long convos · [ ] no input lag at any length · [ ] history doesn't reflow on resize

**Known divergences (intentional, labeled as additions — not CC):**
- `/doctor` build-freshness check · any Ctrl+R reverse-search (if kept off the expand binding)

---

## Verification

1. `npm run typecheck && npm test` — all logic + snapshot tests green.
2. `npm run build` then `node dist/index.js` (bypasses any stale global `acode`):
   - Banner matches CC; type immediately — no lag; type **during** a running turn — it queues.
   - Multi-tool task (e.g. "run the python tests"): `⏺` assistant lines, `Tool(args)` + `⎿`
     results, todos under spinner, `✻ Baking… (1m 20s · ↑ 3.2k tokens · esc to interrupt)`.
   - Grow past one screen — no garble, history scrolls naturally, **resize doesn't reflow history**.
   - `/model`, `/resume` (loads a session w/ tool blocks), Shift+Tab (mode indicator),
     permission prompt (selectable + inline diff), `/clear` (resets), `@` mention, `/` menu, `!`
     bash, `#` memory, `/vim`.
3. `npm link` once so `acode` tracks `dist`; `/doctor` reports build freshness.

## Sequencing

P1 render core → P2 visuals (**Markdown + ToolUseView are the biggest wins**) → P3 input/keys →
P4 functionality → P5 tests written alongside each component. Each phase ends with
`typecheck + test + build` green and a rebuilt `dist`.
