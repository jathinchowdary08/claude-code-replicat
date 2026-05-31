/** Bridges the async agent loop generator to React state for the Ink UI. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type Anthropic from '@anthropic-ai/sdk';
import type { Runtime } from '../../runtime.js';
import { runAgent } from '../../agent/loop.js';
import type { ConfirmPermission, PermissionResolution } from '../../agent/events.js';
import { createCancelScope, type CancelScope } from '../../util/cancel.js';
import { addUsage, emptyUsage, type UsageTotals } from '../../llm/tokens.js';
import { formatError } from '../../util/errors.js';
import type { ToolResult } from '../../tools/types.js';

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
  pending: PendingPrompt | null;
  send: (text: string) => void;
  cancel: () => void;
}

export function useAgentLoop(rt: Runtime): AgentLoop {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [status, setStatus] = useState<'idle' | 'running'>('idle');
  const [usage, setUsage] = useState<UsageTotals>(emptyUsage());
  const [cost, setCost] = useState(0);
  const [pending, setPending] = useState<PendingPrompt | null>(null);

  const messagesRef = useRef<Anthropic.MessageParam[]>([]);
  const cancelRef = useRef<CancelScope | null>(null);

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
    setItems((prev) =>
      prev.map((it) => (it.kind === 'tool' && it.id === id ? { ...it, ...patch } : it)),
    );
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
            }
            setPending(null);
            resolve(ok);
          },
        });
      });
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

  const send = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      push({ kind: 'user', text });
      messagesRef.current.push({ role: 'user', content: text });
      setStatus('running');
      const scope = createCancelScope();
      cancelRef.current = scope;

      void (async () => {
        try {
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
                break;
              case 'tool_denied':
                updateTool(ev.id, { status: 'denied', reason: ev.reason });
                break;
              case 'usage':
                setUsage((u) => addUsage(u, ev.usage));
                setCost((c) => c + ev.cost);
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

  const cancel = useCallback(() => cancelRef.current?.cancel(), []);

  return { items, status, usage, cost, pending, send, cancel };
}
