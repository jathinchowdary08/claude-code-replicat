/**
 * Known models, their context windows, and pricing (USD per million tokens).
 * Prices are approximate and used only for the local cost estimate in the UI.
 */
export interface ModelInfo {
  id: string;
  label: string;
  contextWindow: number;
  maxOutput: number;
  inputCost: number;
  outputCost: number;
  cacheWriteCost: number;
  cacheReadCost: number;
}

export const MODELS: Record<string, ModelInfo> = {
  'claude-opus-4-8': {
    id: 'claude-opus-4-8',
    label: 'Opus 4.8',
    contextWindow: 200_000,
    maxOutput: 32_000,
    inputCost: 15,
    outputCost: 75,
    cacheWriteCost: 18.75,
    cacheReadCost: 1.5,
  },
  'claude-sonnet-4-6': {
    id: 'claude-sonnet-4-6',
    label: 'Sonnet 4.6',
    contextWindow: 200_000,
    maxOutput: 64_000,
    inputCost: 3,
    outputCost: 15,
    cacheWriteCost: 3.75,
    cacheReadCost: 0.3,
  },
  'claude-haiku-4-5-20251001': {
    id: 'claude-haiku-4-5-20251001',
    label: 'Haiku 4.5',
    contextWindow: 200_000,
    maxOutput: 32_000,
    inputCost: 0.8,
    outputCost: 4,
    cacheWriteCost: 1,
    cacheReadCost: 0.08,
  },
};

export const DEFAULT_MODEL = 'claude-sonnet-4-6';
export const DEFAULT_MAX_TOKENS = 8192;

export function resolveModel(id: string): ModelInfo {
  return (
    MODELS[id] ?? {
      id,
      label: id,
      contextWindow: 200_000,
      maxOutput: DEFAULT_MAX_TOKENS,
      inputCost: 3,
      outputCost: 15,
      cacheWriteCost: 3.75,
      cacheReadCost: 0.3,
    }
  );
}
