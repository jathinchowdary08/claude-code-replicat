/**
 * Permission rule parsing and matching. A rule is `Tool` or `Tool(specifier)`,
 * e.g. `Read`, `Edit`, `Bash(npm run test:*)`, `Bash(git push)`.
 */
import type { Tool } from '../tools/types.js';

export interface ParsedRule {
  tool: string;
  specifier?: string;
}

export function parseRule(raw: string): ParsedRule {
  const trimmed = raw.trim();
  const m = /^([A-Za-z0-9_]+)\((.*)\)$/.exec(trimmed);
  if (m) return { tool: m[1]!, specifier: m[2] };
  return { tool: trimmed };
}

/** The string a specifier is matched against, per tool. */
export function matchableTarget(toolName: string, input: unknown): string {
  const obj = (input ?? {}) as Record<string, unknown>;
  switch (toolName) {
    case 'Bash':
      return String(obj.command ?? '');
    case 'Read':
    case 'Write':
    case 'Edit':
      return String(obj.file_path ?? '');
    case 'LS':
    case 'Glob':
    case 'Grep':
      return String(obj.path ?? obj.pattern ?? '');
    default:
      try {
        return JSON.stringify(obj);
      } catch {
        return '';
      }
  }
}

/** Glob-style match: `*` matches any run of characters. Anchored. */
export function specifierMatches(specifier: string, target: string): boolean {
  // Exact match shortcut.
  if (specifier === target) return true;
  const escaped = specifier.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  // A trailing `*` (or none) allows prefix matches; anchor the start.
  return new RegExp(`^${escaped}$`).test(target);
}

export function ruleMatches(rule: ParsedRule, tool: Tool, input: unknown): boolean {
  if (rule.tool !== tool.name) return false;
  if (rule.specifier === undefined) return true;
  return specifierMatches(rule.specifier, matchableTarget(tool.name, input));
}

export function anyRuleMatches(rules: ParsedRule[], tool: Tool, input: unknown): boolean {
  return rules.some((r) => ruleMatches(r, tool, input));
}
