import type { SearchProviderId, SearchProviderSpec } from '../types/mayland';

export const SEARCH_PROVIDERS: ReadonlyArray<SearchProviderSpec> = [
  {
    id: 'tavily',
    name: 'Tavily',
    tagline: 'AI-ready web search with clean snippets & direct answers',
    freeMonthlyQuota: '1,000 credits / mo',
    noCardRequired: true,
    keyPlaceholder: 'tvly-...',
    apiKeyUrl: 'https://app.tavily.com',
    endpointHost: 'api.tavily.com',
    accentColor: '#79DEEB',
  },
  {
    id: 'exa',
    name: 'Exa',
    tagline: 'Neural & semantic search with monthly recurring credits',
    freeMonthlyQuota: '$10 credits / mo',
    noCardRequired: true,
    keyPlaceholder: 'exa-...',
    apiKeyUrl: 'https://dashboard.exa.ai/api-keys',
    endpointHost: 'api.exa.ai',
    accentColor: '#1F5EFF',
  },
  {
    id: 'brave',
    name: 'Brave Search',
    tagline: 'Independent privacy-first web index (~1,000 queries/mo)',
    freeMonthlyQuota: '$5 credits / mo',
    noCardRequired: false,
    keyPlaceholder: 'BSA...',
    apiKeyUrl: 'https://api-dashboard.search.brave.com',
    endpointHost: 'api.search.brave.com',
    accentColor: '#FB542B',
  },
  {
    id: 'firecrawl',
    name: 'Firecrawl',
    tagline: 'Live web search & clean LLM markdown extraction',
    freeMonthlyQuota: '1,000 credits / mo',
    noCardRequired: true,
    keyPlaceholder: 'fc-...',
    apiKeyUrl: 'https://www.firecrawl.dev/app/api-keys',
    endpointHost: 'api.firecrawl.dev',
    accentColor: '#FA5D19',
  },
  {
    id: 'linkup',
    name: 'Linkup',
    tagline: 'High-accuracy web search & sourcing for AI assistants',
    freeMonthlyQuota: '$20 credits / mo',
    noCardRequired: true,
    keyPlaceholder: 'lu_...',
    apiKeyUrl: 'https://app.linkup.so',
    endpointHost: 'api.linkup.so',
    accentColor: '#74D99F',
  },
  {
    id: 'serpapi',
    name: 'SerpApi',
    tagline: 'Structured live Google SERP results & answer boxes',
    freeMonthlyQuota: '250 searches / mo',
    noCardRequired: true,
    keyPlaceholder: 'serpapi key...',
    apiKeyUrl: 'https://serpapi.com/manage-api-key',
    endpointHost: 'serpapi.com',
    accentColor: '#377FEA',
  },
  {
    id: 'parallel',
    name: 'Parallel',
    tagline: 'Fast agentic web search with crisp multi-excerpt context',
    freeMonthlyQuota: '$5 credits / mo',
    noCardRequired: false,
    keyPlaceholder: 'par_...',
    apiKeyUrl: 'https://platform.parallel.ai',
    endpointHost: 'api.parallel.ai',
    accentColor: '#EED989',
  },
  {
    id: 'langsearch',
    name: 'LangSearch',
    tagline: 'Free web search & semantic summarization ($0/mo plan)',
    freeMonthlyQuota: '$0 / mo (Daily free)',
    noCardRequired: true,
    keyPlaceholder: 'sk-...',
    apiKeyUrl: 'https://langsearch.com/api-keys',
    endpointHost: 'api.langsearch.com',
    accentColor: '#7E5BF6',
  },
];

export const SEARCH_PROVIDER_MAP: Record<SearchProviderId, SearchProviderSpec> =
  Object.fromEntries(
    SEARCH_PROVIDERS.map((p) => [p.id, p])
  ) as Record<SearchProviderId, SearchProviderSpec>;

export function getSearchProviderSpec(id: SearchProviderId): SearchProviderSpec {
  return SEARCH_PROVIDER_MAP[id] ?? SEARCH_PROVIDERS[0];
}
