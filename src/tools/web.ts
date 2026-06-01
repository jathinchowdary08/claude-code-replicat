/**
 * Phase 2 web tools: WebFetch (fetch a URL, sanitize to text) and WebSearch
 * (query a search engine, return ranked results). Both are read-only.
 *
 * Safety: only http(s) is allowed; requests to loopback/private/link-local hosts
 * are refused (SSRF mitigation) unless the host is explicitly allow-listed in
 * settings (`web.allowedHosts`). Fetched content is stripped of scripts/markup
 * and capped before being returned to the model.
 */
import { z } from 'zod';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { errorResult, textResult, type Tool } from './types.js';
import { loadSettings } from '../config/settings.js';

const MAX_CONTENT = 100_000;
const DEFAULT_TIMEOUT_MS = 30_000;
const USER_AGENT = 'agent-code/0.1 (+https://github.com/agent-code)';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** True for IPs that must never be reached from a fetched URL. */
function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const p = ip.split('.').map(Number);
    const [a, b] = [p[0] ?? 0, p[1] ?? 0];
    if (a === 10) return true;
    if (a === 127) return true; // loopback
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  // IPv6: loopback, unspecified, unique-local (fc00::/7), link-local (fe80::/10).
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
    return true;
  }
  // IPv4-mapped IPv6.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1]) return isPrivateIp(mapped[1]);
  return false;
}

async function assertReachable(host: string, allowedHosts: string[]): Promise<void> {
  if (allowedHosts.length > 0) {
    const ok = allowedHosts.some((h) => host === h || host.endsWith(`.${h}`));
    if (!ok) {
      throw new Error(`Host "${host}" is not in the configured web.allowedHosts allow-list.`);
    }
    return; // explicit allow-list overrides the private-range check
  }
  const literal = isIP(host);
  if (literal) {
    if (isPrivateIp(host)) throw new Error(`Refusing to fetch a private/loopback address: ${host}`);
    return;
  }
  if (host === 'localhost') throw new Error('Refusing to fetch localhost.');
  const { address } = await lookup(host);
  if (isPrivateIp(address)) {
    throw new Error(`Refusing to fetch "${host}" — it resolves to a private/loopback address.`);
  }
}

/** Best-effort HTML → readable text. */
export function htmlToText(html: string): string {
  let s = html;
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<head\b[\s\S]*?<\/head>/gi, ' ');
  s = s.replace(/<\/(p|div|section|article|li|tr|h[1-6]|br)>/gi, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  s = s.replace(/[ \t\f\r]+/g, ' ');
  s = s.replace(/\n[ \t]+/g, '\n').replace(/[ \t]+\n/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

function decodeEntities(s: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    '#39': "'",
  };
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
    const key = code.toLowerCase();
    if (key in named) return named[key]!;
    if (key.startsWith('#x')) return safeCodePoint(parseInt(key.slice(2), 16));
    if (key.startsWith('#')) return safeCodePoint(parseInt(key.slice(1), 10));
    return m;
  });
}

function safeCodePoint(n: number): string {
  if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return '';
  try {
    return String.fromCodePoint(n);
  } catch {
    return '';
  }
}

function truncate(text: string, max = MAX_CONTENT): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[content truncated — ${text.length - max} more characters]`;
}

async function fetchWithTimeout(
  url: string,
  signal: AbortSignal,
  timeoutMs: number,
  headers: Record<string, string>,
): Promise<Response> {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal, headers, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}

function webSettings(cwd: string): { allowedHosts: string[]; timeoutMs: number } {
  try {
    const s = loadSettings(cwd) as { web?: { allowedHosts?: string[]; timeoutMs?: number } };
    return {
      allowedHosts: s.web?.allowedHosts ?? [],
      timeoutMs: s.web?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    };
  } catch {
    return { allowedHosts: [], timeoutMs: DEFAULT_TIMEOUT_MS };
  }
}

// ---------------------------------------------------------------------------
// WebFetch
// ---------------------------------------------------------------------------

const fetchSchema = z.object({
  url: z.string().describe('The absolute http(s) URL to fetch.'),
});
type FetchInput = z.infer<typeof fetchSchema>;

export const webFetchTool: Tool<FetchInput> = {
  name: 'WebFetch',
  schema: fetchSchema,
  readOnly: true,
  description: [
    'Fetch a single http(s) URL and return its content as readable text (HTML is',
    'stripped of markup and scripts; large pages are truncated). Use this to read',
    'documentation, articles, or API responses. Only public hosts are reachable.',
  ].join(' '),
  prompt: (i) => `Fetch ${i.url}`,
  async run(input, ctx, signal) {
    let url: URL;
    try {
      url = new URL(input.url);
    } catch {
      return errorResult(`Invalid URL: ${input.url}`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return errorResult(`Unsupported protocol "${url.protocol}". Only http and https are allowed.`);
    }

    const { allowedHosts, timeoutMs } = webSettings(ctx.cwd);
    try {
      await assertReachable(url.hostname, allowedHosts);
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }

    let res: Response;
    try {
      res = await fetchWithTimeout(url.toString(), signal, timeoutMs, {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,text/plain,application/json;q=0.9,*/*;q=0.8',
      });
    } catch (err) {
      if (signal.aborted) throw err;
      return errorResult(`Failed to fetch ${url.hostname}: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!res.ok) {
      return errorResult(`HTTP ${res.status} ${res.statusText} for ${url.toString()}`);
    }

    const contentType = res.headers.get('content-type') ?? '';
    const raw = await res.text();
    const isHtml = contentType.includes('html') || /^\s*<(!doctype|html)/i.test(raw);
    const body = isHtml ? htmlToText(raw) : raw.trim();
    const out = truncate(body);
    return textResult(`URL: ${url.toString()}\nContent-Type: ${contentType || 'unknown'}\n\n${out}`, {
      title: `Fetched ${url.hostname} (${out.length} chars)`,
    });
  },
};

// ---------------------------------------------------------------------------
// WebSearch
// ---------------------------------------------------------------------------

const searchSchema = z.object({
  query: z.string().min(1).describe('The search query.'),
  allowed_domains: z
    .array(z.string())
    .optional()
    .describe('If set, only include results whose host matches one of these domains.'),
  blocked_domains: z
    .array(z.string())
    .optional()
    .describe('Exclude results whose host matches one of these domains.'),
});
type SearchInput = z.infer<typeof searchSchema>;

interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

/** Parse DuckDuckGo's HTML results page into structured hits. */
export function parseDuckDuckGo(html: string): SearchHit[] {
  const hits: SearchHit[] = [];
  const blockRe = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null) {
    const rawHref = m[1] ?? '';
    const title = htmlToText(m[2] ?? '').trim();
    const url = normalizeDdgHref(rawHref);
    if (!url || !title) continue;
    // The snippet follows in a result__snippet anchor/div; find the nearest one.
    const after = html.slice(blockRe.lastIndex, blockRe.lastIndex + 1500);
    const snipMatch = after.match(/class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    const snippet = snipMatch ? htmlToText(snipMatch[1] ?? '').trim() : '';
    hits.push({ title, url, snippet });
  }
  return hits;
}

function normalizeDdgHref(href: string): string {
  let h = href;
  if (h.startsWith('//')) h = `https:${h}`;
  try {
    const u = new URL(h, 'https://duckduckgo.com');
    // DDG wraps targets as /l/?uddg=<encoded-url>
    const uddg = u.searchParams.get('uddg');
    if (uddg) return decodeURIComponent(uddg);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
    return '';
  } catch {
    return '';
  }
}

function hostMatches(url: string, domains: string[]): boolean {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

export const webSearchTool: Tool<SearchInput> = {
  name: 'WebSearch',
  schema: searchSchema,
  readOnly: true,
  description: [
    'Search the web and return ranked results (title, URL, and snippet). Use this to',
    'find up-to-date information or pages to read with WebFetch. Optionally restrict',
    'results with `allowed_domains` or exclude with `blocked_domains`.',
  ].join(' '),
  prompt: (i) => `Search: ${i.query}`,
  async run(input, ctx, signal) {
    const { timeoutMs } = webSettings(ctx.cwd);
    const endpoint = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(input.query)}`;
    let res: Response;
    try {
      res = await fetchWithTimeout(endpoint, signal, timeoutMs, {
        'User-Agent': USER_AGENT,
        Accept: 'text/html',
      });
    } catch (err) {
      if (signal.aborted) throw err;
      return errorResult(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!res.ok) return errorResult(`Search failed: HTTP ${res.status} ${res.statusText}`);

    let hits = parseDuckDuckGo(await res.text());
    if (input.allowed_domains?.length) {
      hits = hits.filter((h) => hostMatches(h.url, input.allowed_domains!));
    }
    if (input.blocked_domains?.length) {
      hits = hits.filter((h) => !hostMatches(h.url, input.blocked_domains!));
    }
    hits = hits.slice(0, 10);

    if (hits.length === 0) {
      return textResult(`No results found for "${input.query}".`, { title: 'WebSearch — 0 results' });
    }
    const body = hits
      .map((h, i) => `${i + 1}. ${h.title}\n   ${h.url}${h.snippet ? `\n   ${h.snippet}` : ''}`)
      .join('\n\n');
    return textResult(`Results for "${input.query}":\n\n${body}`, {
      title: `WebSearch — ${hits.length} results`,
    });
  },
};
