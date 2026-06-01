/**
 * Pure presentation helpers shared by the TUI components. Kept free of Ink/React
 * so the formatting logic can be unit-tested directly.
 */
import type { ToolResult } from '../tools/types.js';

export function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/** Elapsed seconds as `45s` or `4m 15s`. */
export function fmtElapsed(s: number): string {
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

/** Relative timestamp like `5s ago`, `2m ago`, `3h ago`, `4d ago`. */
export function relTime(ms: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Replace a leading home directory with `~`. */
export function tildePath(p: string, home: string): string {
  return home && p.startsWith(home) ? `~${p.slice(home.length)}` : p;
}

/** First `n` lines of text, with a trailing `…` when truncated. */
export function firstLines(s: string, n: number): string {
  const lines = s.split('\n');
  return lines.length > n ? `${lines.slice(0, n).join('\n')} …` : lines.slice(0, n).join('\n');
}

/**
 * The `⎿` result lines shown after a tool runs: prefer a concise summary that
 * differs from the action label, otherwise the actual output (so e.g. Bash shows
 * its output, not a repeat of the title).
 */
export function toolSummaryLines(result: ToolResult, action: string, max = 8): string[] {
  if (result.title && result.title !== action) return [result.title];
  const body = result.output.trim() ? firstLines(result.output, max) : (result.title ?? '(done)');
  return body.split('\n');
}

/**
 * Claude-Code-style tool header: a `Name arg` title becomes `Name(arg)`; anything
 * else (e.g. a Bash description) is passed through unchanged.
 */
export function toolHeader(name: string, title: string): string {
  if (!title || title === name) return name;
  if (title.startsWith(`${name} `)) return `${name}(${title.slice(name.length + 1)})`;
  return title;
}

/** Percent of the context window still free, clamped to 0-100. */
export function contextLeftPct(tokens: number, window: number): number {
  if (window <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((1 - tokens / window) * 100)));
}
