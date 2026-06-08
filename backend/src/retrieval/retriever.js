/**
 * Hybrid retrieval orchestrator: embed → search → fuse → hydrate.
 */

import { settings } from '../config.js';
import { getChunksByIds, getSurroundingChunks } from '../database/documents.js';
import { embedQuery } from './embeddings.js';
import { reciprocalRankFusion } from './fusion.js';
import { extractFtsKeywords } from './keywords.js';
import { semanticSearch, fullTextSearch } from './queries.js';
import { passageFromChunk } from './types.js';

export class DocumentRetriever {
  async search(query, { filters, topK, candidateK, includeNeighbors = true } = {}) {
    const resolvedTopK = topK ?? settings.retrievalTopK;
    const resolvedCandidateK = candidateK ?? settings.retrievalCandidateK;

    // Run embedding and keyword extraction in parallel
    const [queryVec, ftsQuery] = await Promise.all([
      embedQuery(query),
      extractFtsKeywords(query, { filters }),
    ]);

    // Run semantic and full-text search in parallel
    const [semanticHits, ftsHits] = await Promise.all([
      semanticSearch(queryVec, { limit: resolvedCandidateK, filters }),
      fullTextSearch(ftsQuery, { limit: resolvedCandidateK, filters }),
    ]);

    // Fuse ranked lists
    const semanticIds = semanticHits.map((h) => h.chunkId);
    const ftsIds = ftsHits.map((h) => h.chunkId);
    const fused = reciprocalRankFusion([semanticIds, ftsIds], settings.retrievalRrfK).slice(
      0,
      resolvedTopK,
    );

    if (!fused.length) return [];

    const fusedIds = fused.map((f) => f.chunkId);
    const fusionScores = new Map(fused.map((f) => [f.chunkId, f.score]));

    // Hydrate chunks with document metadata
    const chunksById = await getChunksByIds(fusedIds);

    const passages = [];
    const seenNeighborIds = new Set(fusedIds);

    for (const chunkId of fusedIds) {
      const chunk = chunksById.get(chunkId);
      if (!chunk || !chunk.document) continue;

      let neighbors = [];
      if (includeNeighbors) {
        const neighborChunks = await getSurroundingChunks(
          chunkId,
          settings.retrievalNeighborRadius,
        );
        for (const nc of neighborChunks) {
          if (seenNeighborIds.has(nc.id) || !nc.document) continue;
          seenNeighborIds.add(nc.id);
          neighbors.push(passageFromChunk(nc, nc.document));
        }
      }

      passages.push(
        passageFromChunk(chunk, chunk.document, {
          fusionScore: fusionScores.get(chunkId) || 0,
          neighbors,
        }),
      );
    }

    return passages;
  }
}
