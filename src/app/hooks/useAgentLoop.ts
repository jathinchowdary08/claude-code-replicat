/** Bridges the async agent loop generator to React state for the Ink UI. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from 'ink';
import type Anthropic from '@anthropic-ai/sdk';
import type { Runtime } from '../../runtime.js';
import { runAgent } from '../../agent/loop.js';
import type { ConfirmPermission, PermissionResolution } from '../../agent/events.js';
import { createCancelScope, type CancelScope } from '../../util/cancel.js';
import { addUsage, emptyUsage, totalTokens, type UsageTotals } from '../../llm/tokens.js';
import { formatError } from '../../util/errors.js';
import type { ToolResult, TodoItem } from '../../tools/types.js';
import type { PermissionMode } from '../../permissions/mode.js';
import { buildCommandRegistry } from '../../commands/registry.js';
import { isSlashCommand } from '../../commands/parse.js';
import type { CommandContext, SlashCommand } from '../../commands/types.js';
import { SessionStore } from '../../session/store.js';
import { maybeCompact, estimateTokens } from '../../agent/compaction.js';
import { resolveModel } from '../../llm/models.js';

export type HistoryItem =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string; streaming: boolean }
  | { kind: 'thinking'; text: string; streaming: boolean }
  | { kind: 'tool'; id: string; name: string; title: string; status: 'running' | 'done' | 'denied'; result?: ToolResult; reason?: string }
  | { kind: 'error'; text: string };

export interface PendingPrompt {
  kind: 'permission' | 'plan';
  title: string;
  body?: string;
  toolName?: string;
  onAnswer: (value: PermissionResolution | boolean) => void;
}

export interface AgentLoop {
  items: HistoryItem[];
  status: 'idle' | 'running';
  usage: UsageTotals;
  cost: number;
  contextTokens: number;
  todos: TodoItem[];
  model: string;
  mode: PermissionMode;
  pending: PendingPrompt | null;
  modelPicker: boolean;
  sessionPicker: boolean;
  send: (text: string) => void;
  cancel: () => void;
  chooseModel: (id: string) => void;
  closeModelPicker: () => void;
  resumeSession: (id: string) => void;
  closeSessionPicker: () => void;
  cycleMode: () => void;
  suggestCommands: (prefix: string) => SlashCommand[];
}

function reconstructItems(messages: Anthropic.MessageParam[]): HistoryItem[] {
  const items: HistoryItem[] = [];
  for (const m of messages) {
    const content = m.content;
    if (typeof content === 'string') {
      items.push(
        m.role === 'user'
          ? { kind: 'user', text: content }
          : { kind: 'assistant', text: content, streaming: false },
      );
      continue;
    }
    for (const raw of content) {
      const block = raw as { type: string; text?: string; id?: string; name?: string };
      if (block.type === 'text' && block.text) {
        items.push(
          m.role === 'user'
            ? { kind: 'user', text: block.text }
            : { kind: 'assistant', text: block.text, streaming: false },
        );
      } else if (block.type === 'tool_use') {
        items.push({ kind: 'tool', id: block.id ?? '', name: block.name ?? 'tool', title: block.name ?? 'tool', status: 'done' });
      }
    }
  }
  return items;
}

export function useAgentLoop(rt: Runtime): AgentLoop {
  const { exit } = useApp();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [status, setStatus] = useState<'idle' | 'running'>('idle');
  const [usage, setUsage] = useState<UsageTotals>(emptyUsage());
  const [cost, setCost] = useState(0);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [model, setModel] = useState(rt.model);
  const [mode, setMode] = useState<PermissionMode>(rt.permissions.mode);
  const [pending, setPending] = useState<PendingPrompt | null>(null);
  const [modelPicker, setModelPicker] = useState(false);
  const [sessionPicker, setSessionPicker] = useState(false);
  const [contextTokens, setContextTokens] = useState(0);

  const messagesRef = useRef<Anthropic.MessageParam[]>([...rt.initialMessages]);
  const cancelRef = useRef<CancelScope | null>(null);
  const usageRef = useRef<UsageTotals>(emptyUsage());
  const costRef = useRef(0);
  const registry = useMemo(() => buildCommandRegistry(rt.ctx.cwd), [rt.ctx.cwd]);

  const push = useCallback((item: HistoryItem) => setItems((prev) => [...prev, item]), []);

  const appendAssistant = useCallback((delta: string, kind: 'assistant' | 'thinking') => {
    setItems((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.kind === kind && last.streaming) {
        const copy = prev.slice();
        copy[copy.length - 1] = { ...last, text: last.text + delta };
        return copy;
      }
      return [...prev, { kind, text: delta, streaming: true }];
    });
  }, []);

  const finalizeStreaming = useCallback(() => {
    setItems((prev) => {
      const last = prev[prev.length - 1];
      if (last && (last.kind === 'assistant' || last.kind === 'thinking') && last.streaming) {
        const copy = prev.slice();
        copy[copy.length - 1] = { ...last, streaming: false };
        return copy;
      }
      return prev;
    });
  }, []);

  const updateTool = useCallback((id: string, patch: Partial<Extract<HistoryItem, { kind: 'tool' }>>) => {
    setItems((prev) => prev.map((it) => (it.kind === 'tool' && it.id === id ? { ...it, ...patch } : it)));
  }, []);

  // Plan-mode exit is resolved through the same prompt machinery.
  useEffect(() => {
    rt.ctx.requestPlanExit = (plan: string) =>
      new Promise<boolean>((resolve) => {
        setPending({
          kind: 'plan',
          title: 'Exit plan mode and start implementing?',
          body: plan,
          onAnswer: (value) => {
            const ok = value === true || (typeof value === 'object' && value.behavior === 'allow');
            if (ok) {
              rt.permissions.mode = 'default';
              rt.ctx.planMode = false;
              setMode('default');
            }
            setPending(null);
            resolve(ok);
          },
        });
      });
  }, [rt]);

  useEffect(() => {
    void rt.hooks.run('SessionStart', { cwd: rt.ctx.cwd });
  }, [rt]);

  const confirmPermission = useCallback<ConfirmPermission>(
    (req) =>
      new Promise<PermissionResolution>((resolve) => {
        setPending({
          kind: 'permission',
          title: req.title,
          toolName: req.tool.name,
          onAnswer: (value) => {
            setPending(null);
            resolve(typeof value === 'boolean' ? { behavior: value ? 'allow' : 'deny' } : value);
          },
        });
      }),
    [],
  );

  /** Append a user turn and run the agent over the running conversation. */
  const runTurn = useCallback(
    (sendText: string, showUser?: string) => {
      if (showUser) push({ kind: 'user', text: showUser });
      setStatus('running');
      const scope = createCancelScope();
      cancelRef.current = scope;

      void (async () => {
        try {
          const pre = await rt.hooks.run('UserPromptSubmit', { prompt: sendText });
          if (pre.block) {
            push({ kind: 'error', text: pre.reason ?? 'Blocked by a UserPromptSubmit hook.' });
            return;
          }
          const userMessage: Anthropic.MessageParam = { role: 'user', content: sendText };
          messagesRef.current.push(userMessage);
          rt.session.appendMessage(userMessage);
          for await (const ev of runAgent({
            client: rt.client,
            model: rt.model,
            system: rt.system,
            registry: rt.registry,
            messages: messagesRef.current,
            signal: scope.signal,
            permissions: rt.permissions,
            hooks: rt.hooks,
            ctx: rt.ctx,
            confirmPermission,
            enableCompaction: true,
            thinkingBudget: rt.thinkingBudget,
            onMessage: (m) => rt.session.appendMessage(m),
          })) {
            switch (ev.type) {
              case 'assistant_text':
                appendAssistant(ev.delta, 'assistant');
                break;
              case 'thinking':
                appendAssistant(ev.delta, 'thinking');
                break;
              case 'tool_request':
                finalizeStreaming();
                push({ kind: 'tool', id: ev.id, name: ev.name, title: ev.title, status: 'running' });
                break;
              case 'tool_result':
                updateTool(ev.id, { status: 'done', result: ev.result });
                if (ev.name === 'TodoWrite') setTodos([...rt.ctx.todos]);
                break;
              case 'tool_denied':
                updateTool(ev.id, { status: 'denied', reason: ev.reason });
                break;
              case 'usage':
                usageRef.current = addUsage(usageRef.current, ev.usage);
                costRef.current += ev.cost;
                setUsage(usageRef.current);
                setCost(costRef.current);
                setContextTokens(ev.usage.input + ev.usage.cacheRead);
                break;
              case 'error':
                finalizeStreaming();
                push({ kind: 'error', text: formatError(ev.error) });
                break;
              case 'turn_end':
                finalizeStreaming();
                break;
            }
          }
        } finally {
          setStatus('idle');
          cancelRef.current = null;
        }
      })();
    },
    [rt, push, appendAssistant, finalizeStreaming, updateTool, confirmPermission],
  );

  /** Handle a `/slash` command line entered at the prompt. */
  const handleCommand = useCallback(
    async (text: string) => {
      const ctx: CommandContext = {
        cwd: rt.ctx.cwd,
        model: rt.model,
        mode: rt.permissions.mode,
        costSummary: () =>
          `${totalTokens(usageRef.current).toLocaleString()} tokens · $${costRef.current.toFixed(4)}`,
        listSessions: () => SessionStore.list(rt.ctx.cwd).map((s) => s.id),
      };
      const result = await registry.run(text, ctx);
      if (!result) return;
      switch (result.kind) {
        case 'message':
          push({ kind: 'assistant', text: result.text, streaming: false });
          break;
        case 'clear':
          messagesRef.current = [];
          rt.ctx.todos.length = 0;
          setTodos([]);
          setContextTokens(0);
          setItems([{ kind: 'assistant', text: 'Conversation cleared.', streaming: false }]);
          break;
        case 'set-model':
          rt.model = result.model;
          setModel(result.model);
          push({ kind: 'assistant', text: `Model set to ${result.model}.`, streaming: false });
          break;
        case 'set-mode':
          rt.permissions.mode = result.mode;
          rt.ctx.planMode = result.mode === 'plan';
          setMode(result.mode);
          push({ kind: 'assistant', text: `Permission mode set to ${result.mode}.`, streaming: false });
          break;
        case 'pick-model':
          setModelPicker(true);
          break;
        case 'pick-session':
          setSessionPicker(true);
          break;
        case 'prompt':
          runTurn(result.text); // the slash command was already shown as the user line
          break;
        case 'compact': {
          push({ kind: 'assistant', text: 'Compacting conversation…', streaming: false });
          const did = await maybeCompact({
            client: rt.client,
            model: rt.model,
            messages: messagesRef.current,
            contextWindow: resolveModel(rt.model).contextWindow,
            force: true,
          });
          push({
            kind: 'assistant',
            text: did ? 'Context compacted.' : 'Nothing to compact yet.',
            streaming: false,
          });
          break;
        }
        case 'quit':
          exit();
          break;
        case 'noop':
          break;
      }
    },
    [registry, rt, push, runTurn, exit],
  );

  const send = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      if (isSlashCommand(text)) {
        push({ kind: 'user', text });
        void handleCommand(text);
        return;
      }
      runTurn(text, text);
    },
    [push, handleCommand, runTurn],
  );

  const cancel = useCallback(() => cancelRef.current?.cancel(), []);
  const suggestCommands = useCallback((prefix: string) => registry.suggest(prefix), [registry]);
  const chooseModel = useCallback(
    (id: string) => {
      rt.model = id;
      setModel(id);
      setModelPicker(false);
      push({ kind: 'assistant', text: `Model set to ${resolveModel(id).label}.`, streaming: false });
    },
    [rt, push],
  );
  const closeModelPicker = useCallback(() => setModelPicker(false), []);
  const resumeSession = useCallback(
    (id: string) => {
      try {
        const loaded = SessionStore.load(rt.ctx.cwd, id);
        messagesRef.current = [...loaded.messages];
        rt.session = SessionStore.at(rt.ctx.cwd, id);
        setContextTokens(estimateTokens(loaded.messages));
        setItems([
          ...reconstructItems(loaded.messages),
          {
            kind: 'assistant',
            text: `Resumed session ${id} — ${loaded.messages.length} messages restored.`,
            streaming: false,
          },
        ]);
      } catch (err) {
        push({ kind: 'error', text: formatError(err) });
      }
      setSessionPicker(false);
    },
    [rt, push],
  );
  const closeSessionPicker = useCallback(() => setSessionPicker(false), []);
  const cycleMode = useCallback(() => {
    const order: PermissionMode[] = ['default', 'acceptEdits', 'plan'];
    const next = order[(order.indexOf(rt.permissions.mode) + 1) % order.length]!;
    rt.permissions.mode = next;
    rt.ctx.planMode = next === 'plan';
    setMode(next);
  }, [rt]);

  return {
    items,
    status,
    usage,
    cost,
    contextTokens,
    todos,
    model,
    mode,
    pending,
    modelPicker,
    sessionPicker,
    send,
    cancel,
    chooseModel,
    closeModelPicker,
    resumeSession,
    closeSessionPicker,
    cycleMode,
    suggestCommands,
  };
}
