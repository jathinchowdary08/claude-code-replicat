import { z } from 'zod';
import { PERMISSION_MODES } from '../permissions/mode.js';

const hookConfigSchema = z.object({
  matcher: z.string().optional(),
  command: z.string(),
  timeout: z.number().int().positive().optional(),
});

export const settingsSchema = z.object({
  model: z.string().optional(),
  permissionMode: z.enum(PERMISSION_MODES as [string, ...string[]]).optional(),
  permissions: z
    .object({
      allow: z.array(z.string()).default([]),
      deny: z.array(z.string()).default([]),
    })
    .optional(),
  env: z.record(z.string(), z.string()).optional(),
  hooks: z.record(z.string(), z.array(hookConfigSchema)).optional(),
  theme: z.string().optional(),
  web: z
    .object({
      /** If non-empty, WebFetch may only reach these hosts (and subdomains). */
      allowedHosts: z.array(z.string()).default([]),
      /** Network timeout in milliseconds for WebFetch/WebSearch. */
      timeoutMs: z.number().int().positive().optional(),
    })
    .optional(),
  thinking: z
    .object({
      /** Enable extended thinking (defaults the budget to 4096 tokens). */
      enabled: z.boolean().optional(),
      /** Thinking token budget; implies enabled when set. */
      budgetTokens: z.number().int().positive().optional(),
    })
    .optional(),
});

export type Settings = z.infer<typeof settingsSchema>;
