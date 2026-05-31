/** Anthropic client factory. */
import Anthropic from '@anthropic-ai/sdk';
import { ConfigError } from '../util/errors.js';

export interface ClientOptions {
  apiKey?: string;
  baseURL?: string;
}

export function createClient(opts: ClientOptions = {}): Anthropic {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ConfigError(
      'ANTHROPIC_API_KEY is not set. Add it to your environment or a .env file (see .env.example).',
    );
  }
  const baseURL = opts.baseURL ?? process.env.ANTHROPIC_BASE_URL;
  return new Anthropic({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
    // We implement our own retry/backoff around streaming.
    maxRetries: 0,
  });
}
