/**
 * Central settings module. All env access goes through here.
 * Fail-fast on startup if required config is missing.
 */

import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function optional(name, fallback) {
  return process.env[name] || fallback;
}

function optionalInt(name, fallback) {
  const raw = process.env[name];
  return raw ? parseInt(raw, 10) : fallback;
}

function optionalFloat(name, fallback) {
  const raw = process.env[name];
  return raw ? parseFloat(raw) : fallback;
}

const apiKey = process.env.GITHUB_TOKEN || process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error('Missing required env var: OPENAI_API_KEY or GITHUB_TOKEN');
}

const isGithubModels = apiKey.startsWith('github_pat_') || !!process.env.GITHUB_TOKEN;
const defaultBaseUrl = isGithubModels ? 'https://models.inference.ai.azure.com' : undefined;

export const settings = Object.freeze({
  supabaseUrl: required('SUPABASE_URL'),
  supabaseAnonKey: required('SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  databaseUrl: required('DATABASE_URL'),
  geminiApiKey: optional('GEMINI_API_KEY', ''),

  openaiApiKey: apiKey,
  openaiBaseUrl: optional('OPENAI_BASE_URL', defaultBaseUrl),
  openaiEmbeddingModel: optional('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small'),
  openaiEmbeddingDimensions: optionalInt('OPENAI_EMBEDDING_DIMENSIONS', 1536),
  openaiChatModel: optional('OPENAI_CHAT_MODEL', isGithubModels ? 'gpt-4o' : 'gpt-4o-mini'),
  openaiGroundingModel: optional('OPENAI_GROUNDING_MODEL', 'gpt-4o-mini'),
  openaiAgentRequestLimit: optionalInt('OPENAI_AGENT_REQUEST_LIMIT', 20),
  openaiAgentTemperature: optionalFloat('OPENAI_AGENT_TEMPERATURE', 0),

  retrievalCandidateK: optionalInt('RETRIEVAL_CANDIDATE_K', 50),
  retrievalTopK: optionalInt('RETRIEVAL_TOP_K', 10),
  retrievalRrfK: optionalInt('RETRIEVAL_RRF_K', 60),
  retrievalNeighborRadius: optionalInt('RETRIEVAL_NEIGHBOR_RADIUS', 1),
  retrievalFtsConfig: optional('RETRIEVAL_FTS_CONFIG', 'english'),
  retrievalFtsKeywordModel: optional('RETRIEVAL_FTS_KEYWORD_MODEL', 'gpt-4o-mini'),
  retrievalFtsKeywordMin: optionalInt('RETRIEVAL_FTS_KEYWORD_MIN', 3),
  retrievalFtsKeywordMax: optionalInt('RETRIEVAL_FTS_KEYWORD_MAX', 5),
  retrievalFtsKeywordFastPathTokens: optionalInt('RETRIEVAL_FTS_KEYWORD_FAST_PATH_TOKENS', 5),

  corsOrigins: optional('ALLOWED_ORIGINS', 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  port: optionalInt('PORT', 3000),
});
