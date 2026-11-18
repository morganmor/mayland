import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  executeWebSearchWithKey,
  formatSearchResultsForPrompt,
  normalizeProviderResponse,
} from './webSearchTool';
import { SEARCH_PROVIDERS } from './searchProviders';

describe('webSearchTool (Monthly Free Search Engine Providers)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers 8 providers with free monthly quotas', () => {
    const ids = SEARCH_PROVIDERS.map((p) => p.id);
    expect(ids).toEqual([
      'tavily',
      'exa',
      'brave',
      'firecrawl',
      'linkup',
      'serpapi',
      'parallel',
      'langsearch',
    ]);
    for (const p of SEARCH_PROVIDERS) {
      expect(p.freeMonthlyQuota.toLowerCase()).toContain('mo');
    }
  });

  it('executes Tavily search with Bearer header and normalizes answer + results', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          answer: 'Tavily synthesized summary.',
          results: [
            {
              title: 'Tavily Docs',
              url: 'https://docs.tavily.com',
              content: 'Search API for AI agents.',
              score: 0.96,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const res = await executeWebSearchWithKey({
      providerId: 'tavily',
      apiKey: 'tvly-test-key',
      query: 'Tavily AI',
      maxResults: 5,
    });

    expect(res.ok).toBe(true);
    expect(res.answer).toBe('Tavily synthesized summary.');
    expect(res.results).toEqual([
      {
        title: 'Tavily Docs',
        url: 'https://docs.tavily.com',
        snippet: 'Search API for AI agents.',
        score: 0.96,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.tavily.com/search',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer tvly-test-key',
        }),
      })
    );
  });

  it('executes Brave Search GET with X-Subscription-Token header', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          web: {
            results: [
              {
                title: 'Brave Search API',
                url: 'https://brave.com/search/api/',
                description: 'Independent privacy-focused web search index.',
                page_age: '2026-05-01T00:00:00',
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const res = await executeWebSearchWithKey({
      providerId: 'brave',
      apiKey: 'BSA-test-123',
      query: 'brave api',
      maxResults: 4,
    });

    expect(res.ok).toBe(true);
    expect(res.results[0]).toMatchObject({
      title: 'Brave Search API',
      url: 'https://brave.com/search/api/',
      snippet: 'Independent privacy-focused web search index.',
      publishedAt: '2026-05-01T00:00:00',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.search.brave.com/res/v1/web/search?q=brave+api&count=4',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'X-Subscription-Token': 'BSA-test-123',
        }),
      })
    );
  });

  it('executes Exa, SerpApi, Linkup, Firecrawl, Parallel, and LangSearch requests accurately', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [
              {
                title: 'Exa Neural Search',
                url: 'https://exa.ai',
                highlights: ['Semantic search engine'],
                publishedDate: '2026-03-10',
              },
            ],
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            answer_box: { snippet: '42 is the answer' },
            organic_results: [
              {
                title: 'SerpApi Google',
                link: 'https://serpapi.com',
                snippet: 'Real-time Google SERP JSON.',
              },
            ],
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [
              {
                name: 'Linkup Search',
                url: 'https://linkup.so',
                content: 'Sourced web search for AI.',
              },
            ],
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              web: [
                {
                  title: 'Firecrawl Docs',
                  url: 'https://docs.firecrawl.dev',
                  description: 'Turn websites into LLM markdown.',
                },
              ],
            },
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [
              {
                title: 'Parallel Search',
                url: 'https://parallel.ai',
                excerpts: ['Agentic search excerpts'],
                publish_date: '2026-04-02',
              },
            ],
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 200,
            data: {
              webPages: {
                value: [
                  {
                    name: 'LangSearch API',
                    url: 'https://langsearch.com',
                    snippet: 'Free web search for AI agents.',
                  },
                ],
              },
            },
          }),
          { status: 200 }
        )
      );

    const exaRes = await executeWebSearchWithKey({
      providerId: 'exa',
      apiKey: 'exa-k',
      query: 'neural',
      maxResults: 3,
    });
    expect(exaRes.ok).toBe(true);
    expect(exaRes.results[0].snippet).toBe('Semantic search engine');
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.exa.ai/search',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-api-key': 'exa-k' }),
      })
    );

    const serpRes = await executeWebSearchWithKey({
      providerId: 'serpapi',
      apiKey: 'serp-k',
      query: 'coffee',
      maxResults: 5,
    });
    expect(serpRes.ok).toBe(true);
    expect(serpRes.answer).toBe('42 is the answer');
    expect(serpRes.results[0].url).toBe('https://serpapi.com');
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://serpapi.com/search.json?engine=google&q=coffee&num=5&api_key=serp-k',
      expect.objectContaining({ method: 'GET' })
    );

    const linkupRes = await executeWebSearchWithKey({
      providerId: 'linkup',
      apiKey: 'lu-k',
      query: 'news',
    });
    expect(linkupRes.ok).toBe(true);
    expect(linkupRes.results[0].title).toBe('Linkup Search');

    const fireRes = await executeWebSearchWithKey({
      providerId: 'firecrawl',
      apiKey: 'fc-k',
      query: 'crawl',
    });
    expect(fireRes.ok).toBe(true);
    expect(fireRes.results[0].url).toBe('https://docs.firecrawl.dev');

    const parRes = await executeWebSearchWithKey({
      providerId: 'parallel',
      apiKey: 'par-k',
      query: 'parallel',
      maxResults: 4,
    });
    expect(parRes.ok).toBe(true);
    expect(parRes.results[0].snippet).toBe('Agentic search excerpts');
    const parInit = fetchMock.mock.calls[4]?.[1] as RequestInit;
    expect(JSON.parse(String(parInit.body))).toMatchObject({
      objective: 'parallel',
      search_queries: ['parallel'],
      mode: 'fast',
      advanced_settings: { max_results: 4 },
    });

    const lsRes = await executeWebSearchWithKey({
      providerId: 'langsearch',
      apiKey: 'ls-k',
      query: 'langsearch',
    });
    expect(lsRes.ok).toBe(true);
    expect(lsRes.results[0].title).toBe('LangSearch API');
  });

  it('surfaces clear error messages on 401 unauthorized and 429 quota limits', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Bad token' }), { status: 401 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Monthly limit hit' } }), {
          status: 429,
        })
      );

    const err401 = await executeWebSearchWithKey({
      providerId: 'tavily',
      apiKey: 'bad',
      query: 'test',
    });
    expect(err401.ok).toBe(false);
    expect(err401.error).toContain('Invalid or unauthorized API key');

    const err429 = await executeWebSearchWithKey({
      providerId: 'exa',
      apiKey: 'k',
      query: 'test',
    });
    expect(err429.ok).toBe(false);
    expect(err429.error).toContain('Monthly free quota or rate limit reached');
  });

  it('formats normalized search results cleanly for AI prompts', () => {
    const normalized = normalizeProviderResponse(
      'tavily',
      {
        answer: 'Short answer',
        results: [
          { title: 'One', url: 'https://one.test', content: 'First snippet' },
        ],
      },
      5
    );
    const formatted = formatSearchResultsForPrompt({
      ok: true,
      providerId: 'tavily',
      providerName: 'Tavily',
      query: 'test query',
      answer: normalized.answer,
      results: normalized.results,
      elapsedMs: 120,
    });
    expect(formatted).toContain('Web Search Results (Tavily)');
    expect(formatted).toContain('Summary: Short answer');
    expect(formatted).toContain('1. One');
    expect(formatted).toContain('URL: https://one.test');
  });
});
