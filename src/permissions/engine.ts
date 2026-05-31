/** Decides whether a tool call is allowed, denied, or needs to ask the user. */
import type { Tool } from '../tools/types.js';
import type { PermissionMode } from './mode.js';
import { anyRuleMatches, parseRule, type ParsedRule } from './rules.js';
import { GrantStore } from './store.js';

export type Decision = 'allow' | 'deny' | 'ask';

export interface DecisionResult {
  decision: Decision;
  reason?: string;
}

const EDIT_TOOLS = new Set(['Write', 'Edit']);

export class PermissionEngine {
  private allow: ParsedRule[];
  private deny: ParsedRule[];
  readonly grants: GrantStore;
  mode: PermissionMode;

  constructor(opts: { mode: PermissionMode; allow?: string[]; deny?: string[]; grants?: GrantStore }) {
    this.mode = opts.mode;
    this.allow = (opts.allow ?? []).map(parseRule);
    this.deny = (opts.deny ?? []).map(parseRule);
    this.grants = opts.grants ?? new GrantStore();
  }

  decide(tool: Tool, input: unknown): DecisionResult {
    // Explicit deny always wins.
    if (anyRuleMatches(this.deny, tool, input)) {
      return { decision: 'deny', reason: `Blocked by a deny rule for ${tool.name}.` };
    }

    if (this.mode === 'bypassPermissions') return { decision: 'allow' };

    // Plan mode is read-only: block anything that mutates.
    if (this.mode === 'plan' && !tool.readOnly) {
      return { decision: 'deny', reason: `In plan mode — ${tool.name} is not allowed (read-only).` };
    }

    if (tool.readOnly) return { decision: 'allow' };

    if (anyRuleMatches(this.allow, tool, input)) return { decision: 'allow' };
    if (this.grants.isGranted(tool.name, input)) return { decision: 'allow' };

    if (this.mode === 'acceptEdits' && EDIT_TOOLS.has(tool.name)) return { decision: 'allow' };

    return { decision: 'ask' };
  }
}
