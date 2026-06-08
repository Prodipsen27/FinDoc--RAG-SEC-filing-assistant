/**
 * Bounded agent tools over the retrieval layer.
 * Defined as LangChain DynamicStructuredTool instances.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  getChunkWithDocument,
  getChunksByIds,
  getSurroundingChunks,
} from '../database/documents.js';
import { settings } from '../config.js';
import { passageFromChunk, formatPassagesForAgent } from '../retrieval/types.js';

/**
 * Creates the 4 agent tools, each capturing the shared `deps` context.
 * deps: { retriever, registry, threadId, userId, onStatus }
 */
export function createAgentTools(deps) {
  const searchFilings = new DynamicStructuredTool({
    name: 'search_filings',
    description:
      'Search SEC filings with hybrid retrieval. Optional filters: ticker, form, fiscal_years (comma-separated).',
    schema: z.object({
      query: z.string().describe('The search query'),
      ticker: z.string().optional().describe('Filter by ticker symbol'),
      form: z.string().optional().describe('Filter by form type (e.g. 10-K)'),
      fiscal_years: z
        .string()
        .optional()
        .describe('Comma-separated fiscal years to filter by'),
    }),
    func: async ({ query, ticker, form, fiscal_years }) => {
      emitToolStart(deps, 'search_filings', ticker, form, fiscal_years);

      const fiscalYears = fiscal_years
        ? fiscal_years.split(',').map((y) => parseInt(y.trim(), 10)).filter(Boolean)
        : undefined;

      const filters = {};
      if (ticker) filters.ticker = ticker;
      if (form) filters.form = form;
      if (fiscalYears?.length) filters.fiscalYears = fiscalYears;

      const passages = await deps.retriever.search(query, {
        filters: Object.keys(filters).length ? filters : undefined,
      });
      deps.registry.registerMany(passages);
      return formatPassagesForAgent(passages);
    },
  });

  const readChunk = new DynamicStructuredTool({
    name: 'read_chunk',
    description: 'Read the full text of a specific document chunk by UUID.',
    schema: z.object({
      chunk_id: z.string().describe('UUID of the chunk to read'),
    }),
    func: async ({ chunk_id }) => {
      emitToolStart(deps, 'read_chunk');
      const result = await getChunkWithDocument(chunk_id);
      if (!result) return `Error: chunk ${chunk_id} not found.`;

      const passage = passageFromChunk(result, result.document);
      deps.registry.register(passage);
      return formatPassagesForAgent([passage]);
    },
  });

  const readChunks = new DynamicStructuredTool({
    name: 'read_chunks',
    description: 'Read the full text of multiple document chunks in one call.',
    schema: z.object({
      chunk_ids: z.array(z.string()).describe('Array of chunk UUIDs to read'),
    }),
    func: async ({ chunk_ids }) => {
      if (!chunk_ids.length) return 'Error: chunk_ids must include at least one UUID.';
      emitToolStart(deps, 'read_chunks');

      const chunksById = await getChunksByIds(chunk_ids);
      const passages = [];
      for (const id of chunk_ids) {
        const chunk = chunksById.get(id);
        if (!chunk?.document) continue;
        passages.push(passageFromChunk(chunk, chunk.document));
      }
      if (!passages.length) return 'Error: none of the requested chunks were found.';

      deps.registry.registerMany(passages);
      return formatPassagesForAgent(passages);
    },
  });

  const readSurroundingChunks = new DynamicStructuredTool({
    name: 'read_surrounding_chunks',
    description: 'Read chunks before and after a given chunk within the same filing.',
    schema: z.object({
      chunk_id: z.string().describe('UUID of the anchor chunk'),
      radius: z
        .number()
        .optional()
        .describe('Number of chunks before/after to include (default 1)'),
    }),
    func: async ({ chunk_id, radius }) => {
      const resolvedRadius = radius ?? settings.retrievalNeighborRadius;
      if (resolvedRadius < 1) return 'Error: radius must be 1 or greater.';
      emitToolStart(deps, 'read_surrounding_chunks');

      const anchor = await getChunkWithDocument(chunk_id);
      if (!anchor) return `Error: chunk ${chunk_id} not found.`;

      const neighborChunks = await getSurroundingChunks(chunk_id, resolvedRadius);
      const passages = [];

      // Anchor first
      if (anchor.document) {
        passages.push(passageFromChunk(anchor, anchor.document));
      }
      for (const nc of neighborChunks) {
        if (!nc.document) continue;
        passages.push(passageFromChunk(nc, nc.document));
      }
      if (!passages.length) return `Error: chunk ${chunk_id} not found.`;

      deps.registry.registerMany(passages);
      return formatPassagesForAgent(passages);
    },
  });

  return [searchFilings, readChunks, readChunk, readSurroundingChunks];
}

function emitToolStart(deps, name, ticker, form, fiscalYears) {
  if (!deps.onStatus) return;
  const statusMap = {
    search_filings: () => {
      const bits = [
        ticker ? `ticker=${ticker}` : null,
        form ? `form=${form}` : null,
        fiscalYears ? `fiscal_years=${fiscalYears}` : null,
      ].filter(Boolean);
      const detail = bits.length ? bits.join(', ') : '';
      const suffix = detail ? ` (${detail})` : '';
      return ['searching', `Searching SEC filings…${suffix}`];
    },
    read_surrounding_chunks: () => ['reading', 'Reading surrounding context…'],
    read_chunk: () => ['reading', 'Reading source passages…'],
    read_chunks: () => ['reading', 'Reading source passages…'],
  };
  const [stage, message] = (statusMap[name] || (() => ['reading', 'Reading source documents…']))();
  deps.onStatus(stage, message);
}
