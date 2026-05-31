/** Token usage accounting and cost estimation. */
import { resolveModel } from './models.js';

export interface UsageTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export function emptyUsage(): UsageTotals {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
}

/** Extract a UsageTotals from an Anthropic message `usage` object. */
export function usageFrom(usage: {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}): UsageTotals {
  return {
    input: usage.input_tokens ?? 0,
    output: usage.output_tokens ?? 0,
    cacheRead: usage.cache_read_input_tokens ?? 0,
    cacheWrite: usage.cache_creation_input_tokens ?? 0,
  };
}

export function addUsage(a: UsageTotals, b: UsageTotals): UsageTotals {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite: a.cacheWrite + b.cacheWrite,
  };
}

/** Estimate the dollar cost of the given usage for a model. */
export function costOf(model: string, u: UsageTotals): number {
  const m = resolveModel(model);
  return (
    (u.input * m.inputCost +
      u.output * m.outputCost +
      u.cacheRead * m.cacheReadCost +
      u.cacheWrite * m.cacheWriteCost) /
    1_000_000
  );
}

export function totalTokens(u: UsageTotals): number {
  return u.input + u.output + u.cacheRead + u.cacheWrite;
}
