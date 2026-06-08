/**
 * pgvector semantic search and Postgres full-text search over document_chunks.
 */

import { getPool } from '../database/pool.js';
import { settings } from '../config.js';

function vectorLiteral(values) {
  return '[' + values.join(',') + ']';
}

function buildFilters(filters) {
  if (!filters) return { sql: '', params: [], offset: 0 };

  const clauses = [];
  const params = [];
  let idx = 0;

  if (filters.ticker) {
    idx++;
    clauses.push(`sd.ticker = $OFFSET${idx}`);
    params.push(filters.ticker);
  }
  if (filters.fiscalYears?.length) {
    idx++;
    clauses.push(`sd.fiscal_year = ANY($OFFSET${idx})`);
    params.push(filters.fiscalYears);
  }
  if (filters.form) {
    idx++;
    clauses.push(`sd.form = $OFFSET${idx}`);
    params.push(filters.form);
  }

  if (!clauses.length) return { sql: '', params: [], offset: 0 };
  return { sql: ' AND ' + clauses.join(' AND '), params, offset: idx };
}

function resolveParams(filterResult, baseParams) {
  // Replace $OFFSET1, $OFFSET2, etc. with actual positional params
  const baseCount = baseParams.length;
  let sql = filterResult.sql;
  for (let i = filterResult.params.length; i >= 1; i--) {
    sql = sql.replace(`$OFFSET${i}`, `$${baseCount + i}`);
  }
  return { sql, allParams: [...baseParams, ...filterResult.params] };
}

export async function semanticSearch(queryVec, { limit, filters } = {}) {
  const pool = getPool();
  const filterResult = buildFilters(filters);
  const vecLiteral = vectorLiteral(queryVec);

  const baseParams = [vecLiteral, limit];
  const { sql: filterSql, allParams } = resolveParams(filterResult, baseParams);

  const query = `
    SELECT dc.id,
           1 - (dc.embedding <=> CAST($1 AS vector)) AS score
    FROM document_chunks dc
    JOIN source_documents sd ON sd.id = dc.document_id
    WHERE dc.embedding IS NOT NULL
    ${filterSql}
    ORDER BY dc.embedding <=> CAST($1 AS vector)
    LIMIT $2
  `;

  const { rows } = await pool.query(query, allParams);
  return rows.map((row, index) => ({
    chunkId: row.id,
    rank: index + 1,
    score: row.score != null ? parseFloat(row.score) : null,
  }));
}

export async function fullTextSearch(queryText, { limit, filters } = {}) {
  const pool = getPool();
  const ftsConfig = settings.retrievalFtsConfig;
  const filterResult = buildFilters(filters);

  const baseParams = [queryText, limit];
  const { sql: filterSql, allParams } = resolveParams(filterResult, baseParams);

  const query = `
    SELECT dc.id,
           ts_rank_cd(dc.search_vector, query) AS score
    FROM document_chunks dc
    JOIN source_documents sd ON sd.id = dc.document_id,
         plainto_tsquery('${ftsConfig}', $1) query
    WHERE dc.search_vector @@ query
    ${filterSql}
    ORDER BY score DESC
    LIMIT $2
  `;

  const { rows } = await pool.query(query, allParams);
  return rows.map((row, index) => ({
    chunkId: row.id,
    rank: index + 1,
    score: row.score != null ? parseFloat(row.score) : null,
  }));
}
