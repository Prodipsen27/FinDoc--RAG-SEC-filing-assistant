import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import OpenAI from 'openai';
import { v5 as uuidv5 } from 'uuid';
import { settings } from '../src/config.js';
import { getPool } from '../src/database/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const dataRoot = path.join(repoRoot, 'data');
const markdownRoot = path.join(dataRoot, 'markdown');
const schemaPath = path.join(repoRoot, 'schema.sql');
const manifestPath = path.join(markdownRoot, 'manifest.json');
const UUID_NAMESPACE = 'd5f5d9dc-a7a1-49d3-a2ca-c3bc21d4656d';

const COMPANY_NAMES = {
  AAPL: 'Apple Inc.',
  AMZN: 'Amazon.com, Inc.',
  GOOGL: 'Alphabet Inc.',
  MSFT: 'Microsoft Corporation',
  NVDA: 'NVIDIA Corporation',
};

let openaiClient = null;

export function getSchemaPath() {
  return schemaPath;
}

export function getPoolClient() {
  return getPool();
}

export function getManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
}

export function resolveManifestPath(relativePath) {
  return path.join(markdownRoot, relativePath.replaceAll('\\', path.sep));
}

export function companyNameForTicker(ticker) {
  return COMPANY_NAMES[ticker] || ticker;
}

export function documentIdForAccession(accessionNumber) {
  return uuidv5(`document:${accessionNumber}`, UUID_NAMESPACE);
}

export function chunkIdForDocument(documentId, chunkIndex) {
  return uuidv5(`chunk:${documentId}:${chunkIndex}`, UUID_NAMESPACE);
}

export function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;

    const name = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[name] = true;
      continue;
    }

    args[name] = next;
    index += 1;
  }

  return args;
}

export function vectorLiteral(values) {
  return `[${values.join(',')}]`;
}

export function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: settings.openaiApiKey,
      baseURL: settings.openaiBaseUrl || undefined,
    });
  }
  return openaiClient;
}

export async function closePool() {
  await getPool().end();
}
