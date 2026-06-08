/**
 * LLM keyword extraction for Postgres full-text search.
 */

import OpenAI from 'openai';
import { settings } from '../config.js';

const FILLER_WORDS = new Set([
  'a', 'an', 'and', 'across', 'are', 'as', 'at', 'be', 'between', 'by',
  'change', 'changed', 'describe', 'describes', 'described', 'did', 'do',
  'for', 'from', 'how', 'in', 'into', 'is', 'its', 'of', 'on', 'or',
  'the', 'their', 'they', 'this', 'to', 'was', 'way', 'what', 'when',
  'where', 'which', 'who', 'with',
]);

const LOW_VALUE_FTS = new Set([
  'driver', 'drivers', 'describe', 'described', 'describes',
  'change', 'changed', 'across', 'way', 'ks', 'k',
]);

const KNOWN_PHRASES = [
  'customer concentration', 'data center', 'revenue mix',
  'cloud capacity', 'ai infrastructure',
];

const TICKER_COMPANY = {
  AAPL: 'apple', AMZN: 'amazon', GOOGL: 'google',
  MSFT: 'microsoft', NVDA: 'nvidia',
};

const SYSTEM_PROMPT = `You extract search keywords for PostgreSQL full-text search over SEC filing chunks.

Rules:
- Return 3 to 5 terms. When joined with spaces, the total word count must be 5 or fewer \
(PostgreSQL ANDs every word — extra words cause zero matches).
- Prefer domain nouns and standard two-word SEC phrases (e.g. "data center", "revenue mix", \
"customer concentration"). Each phrase counts as two words toward the limit.
- Omit question filler and generic verbs (how, what, describe, change, drivers, across).
- Preserve product-name casing from the query (iPhone, Mac, iPad, Azure).
- When a ticker filter is provided, omit the company name from terms.`;

let _client = null;
function client() {
  if (!_client) {
    _client = new OpenAI({
      apiKey: settings.openaiApiKey,
      baseURL: settings.openaiBaseUrl || undefined,
    });
  }
  return _client;
}

function tokenCount(query) {
  return query.split(/\s+/).length;
}

function isCompanyToken(token, filters) {
  if (!filters?.ticker) return false;
  const prefix = TICKER_COMPANY[filters.ticker];
  return prefix ? token.toLowerCase().startsWith(prefix) : false;
}

function phrasesInQuery(query) {
  const lowered = query.toLowerCase();
  const found = [];
  for (const phrase of KNOWN_PHRASES) {
    const idx = lowered.indexOf(phrase);
    if (idx !== -1) found.push(query.slice(idx, idx + phrase.length));
  }
  return found;
}

function capitalizedTokens(query, filters) {
  const matches = query.match(/[A-Za-z][A-Za-z0-9]*(?:'s)?/g) || [];
  const caps = [];
  for (const token of matches) {
    const bare = token.replace(/'s$/, '');
    if (FILLER_WORDS.has(bare.toLowerCase())) continue;
    if (LOW_VALUE_FTS.has(bare.toLowerCase())) continue;
    if (isCompanyToken(token, filters)) continue;
    if (bare.length <= 2) continue;
    if (bare[0] === bare[0].toUpperCase() || /^i[A-Z]/.test(bare)) {
      caps.push(bare);
    }
  }
  return caps;
}

function applyWordBudget(words) {
  const max = settings.retrievalFtsKeywordMax;
  const seen = new Set();
  const kept = [];
  for (const word of words) {
    for (const part of word.split(/\s+/)) {
      const key = part.toLowerCase();
      if (seen.has(key) || FILLER_WORDS.has(key) || LOW_VALUE_FTS.has(key)) continue;
      seen.add(key);
      kept.push(part);
      if (kept.length >= max) return kept;
    }
  }
  return kept;
}

function flattenTerms(terms) {
  const words = [];
  for (const term of terms) words.push(...term.split(/\s+/));
  return words;
}

function mergeFtsWords(query, llmTerms, filters) {
  const caps = capitalizedTokens(query, filters);
  const phrases = phrasesInQuery(query);
  const llmWords = applyWordBudget(flattenTerms(llmTerms));

  const candidates = [];
  if (caps.length >= 3) {
    candidates.push(...caps);
  } else {
    candidates.push(...phrases);
    candidates.push(...caps);
  }
  candidates.push(...llmWords);
  return applyWordBudget(candidates);
}

function deterministicFallback(query, filters) {
  const tokens = query.match(/[A-Za-z0-9][A-Za-z0-9\-/]*/g) || [];
  const kept = tokens.filter(
    (t) => !FILLER_WORDS.has(t.toLowerCase()) && !isCompanyToken(t, filters),
  );
  const words = mergeFtsWords(query, kept, filters);
  return words.length ? words.join(' ') : query.trim();
}

function buildUserMessage(query, filters) {
  const parts = [`Query: ${query}`];
  if (filters?.ticker) parts.push(`Ticker filter: ${filters.ticker} (omit company name from terms)`);
  if (filters?.form) parts.push(`Form filter: ${filters.form}`);
  return parts.join('\n');
}

/**
 * Return a space-joined keyword string for plainto_tsquery.
 */
export async function extractFtsKeywords(query, { filters } = {}) {
  const stripped = query.trim();
  if (!stripped) return stripped;

  if (tokenCount(stripped) <= settings.retrievalFtsKeywordFastPathTokens) {
    return stripped;
  }

  try {
    const response = await client().chat.completions.create({
      model: settings.retrievalFtsKeywordModel,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserMessage(stripped, filters) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'FtsKeywordExtraction',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              terms: {
                type: 'array',
                items: { type: 'string' },
                description: '3-5 search terms for full-text search',
              },
            },
            required: ['terms'],
            additionalProperties: false,
          },
        },
      },
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    if (!parsed?.terms?.length) return deterministicFallback(stripped, filters);

    const normalized = [...new Set(parsed.terms.map((t) => t.trim()).filter(Boolean))];
    const words = mergeFtsWords(stripped, normalized, filters);
    if (words.length < settings.retrievalFtsKeywordMin) {
      return deterministicFallback(stripped, filters);
    }
    return words.join(' ');
  } catch {
    return deterministicFallback(stripped, filters);
  }
}
