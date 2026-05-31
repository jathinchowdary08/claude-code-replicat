/**
 * Tool registry: converts zod schemas to the Anthropic tool format, validates
 * model-supplied input, and dispatches by name with uniform error handling.
 */
import { z } from 'zod';
import { errorResult, type Tool, type ToolContext, type ToolResult } from './types.js';
import { formatError, isCancel } from '../util/errors.js';
import { logger } from '../util/logger.js';

/** The tool definition shape sent to the Anthropic Messages API. */
export interface ApiToolSchema {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export function toApiSchema(tool: Tool): ApiToolSchema {
  const json = z.toJSONSchema(tool.schema) as Record<string, unknown>;
  // Anthropic requires an object schema at the top level.
  if (json.type !== 'object') {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: { type: 'object', properties: {}, ...json },
    };
  }
  // Drop the $schema marker; the API doesn't need it.
  delete json.$schema;
  return { name: tool.name, description: tool.description, input_schema: json };
}

export interface ToolRegistry {
  tools: Tool[];
  byName: Map<string, Tool>;
  api: ApiToolSchema[];
  get(name: string): Tool | undefined;
  dispatch(name: string, rawInput: unknown, ctx: ToolContext, signal: AbortSignal): Promise<ToolResult>;
}

export function buildRegistry(tools: Tool[]): ToolRegistry {
  const byName = new Map(tools.map((t) => [t.name, t]));
  const api = tools.map(toApiSchema);

  async function dispatch(
    name: string,
    rawInput: unknown,
    ctx: ToolContext,
    signal: AbortSignal,
  ): Promise<ToolResult> {
    const tool = byName.get(name);
    if (!tool) return errorResult(`Unknown tool: ${name}`);

    const parsed = tool.schema.safeParse(rawInput);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
      return errorResult(`Invalid input for ${name}: ${detail}`);
    }

    try {
      return await tool.run(parsed.data, ctx, signal);
    } catch (err) {
      if (isCancel(err)) throw err; // let cancellation propagate to the loop
      logger.error(`tool ${name} failed:`, err);
      return errorResult(formatError(err));
    }
  }

  return { tools, byName, api, get: (n) => byName.get(n), dispatch };
}
