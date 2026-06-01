import { describe, it, expect, vi, afterEach } from 'vitest';
import { htmlToText, parseDuckDuckGo, webFetchTool, webSearchTool } from '../../src/tools/web.js';
import { makeCtx, makeTmpDir } from '../helpers.js';

const signal = new AbortController().signal;

describe('htmlToText', () => {
  it('strips scripts/markup and decodes entities', () => {
    const html =
      '<html><head><style>x{}</style></head><body><script>bad()</script>' +
      '<h1>Title</h1><p>Hello &amp; welcome</p></body></html>';
    const text = htmlToText(html);
    expect(text).toContain('Title');
    expect(text).toContain('Hello & welcome');
    expect(text).not.toContain('bad()');
    expect(text).not.toContain('<');
  });
});

describe('parseDuckDuckGo', () => {
  it('extracts title, unwrapped url, and snippet', () => {
    const html = `
      <div class="result">
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage">Example Page</a>
        <a class="result__snippet" href="#">A great example snippet.</a>
      </div>`;
    const hits = parseDuckDuckGo(html);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.title).toBe('Example Page');
    expect(hits[0]?.url).toBe('https://example.com/page');
    expect(hits[0]?.snippet).toContain('great example');
  });
});

describe('WebFetch', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects non-http(s) protocols', async () => {
    const ctx = makeCtx(makeTmpDir());
    const res = await webFetchTool.run({ url: 'ftp://example.com/x' }, ctx, signal);
    expect(res.isError).toBe(true);
  });

  it('refuses to fetch a private/loopback address', async () => {
    const ctx = makeCtx(makeTmpDir());
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const res = await webFetchTool.run({ url: 'http://127.0.0.1/secret' }, ctx, signal);
    expect(res.isError).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches and sanitizes HTML for a public host', async () => {
    const ctx = makeCtx(makeTmpDir());
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('<html><body><p>Hi there</p></body></html>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          }),
      ),
    );
    const res = await webFetchTool.run({ url: 'http://8.8.8.8/' }, ctx, signal);
    expect(res.isError).toBeFalsy();
    expect(res.output).toContain('Hi there');
    expect(res.output).not.toContain('<p>');
  });
});

describe('WebSearch', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns parsed results and honors blocked_domains', async () => {
    const html = `
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fgood.com%2Fa">Good</a>
      <a class="result__snippet" href="#">good snippet</a>
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fbad.com%2Fb">Bad</a>
      <a class="result__snippet" href="#">bad snippet</a>`;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }),
      ),
    );
    const ctx = makeCtx(makeTmpDir());
    const res = await webSearchTool.run({ query: 'x', blocked_domains: ['bad.com'] }, ctx, signal);
    expect(res.output).toContain('good.com');
    expect(res.output).not.toContain('bad.com');
  });
});
