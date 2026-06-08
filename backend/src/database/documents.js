/**
 * Chunk and source-document lookups for retrieval and agent tools.
 * Uses raw pg pool because these queries involve pgvector and relationships
 * that are easier to express in SQL.
 */

import { getPool } from './pool.js';

/**
 * Fetch chunks by an array of UUIDs, returning a Map<chunkId, chunk+document>.
 */
export async function getChunksByIds(chunkIds) {
  if (!chunkIds.length) return new Map();

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT dc.id, dc.document_id, dc.chunk_index, dc.text, dc.page, dc.section,
            dc.chunk_metadata, dc.token_count,
            sd.ticker, sd.company_name, sd.form, sd.filing_date, sd.fiscal_year,
            sd.accession_number, sd.source_url
     FROM document_chunks dc
     JOIN source_documents sd ON sd.id = dc.document_id
     WHERE dc.id = ANY($1)`,
    [chunkIds],
  );

  const map = new Map();
  for (const row of rows) {
    map.set(row.id, {
      id: row.id,
      documentId: row.document_id,
      chunkIndex: row.chunk_index,
      text: row.text,
      page: row.page,
      section: row.section,
      chunkMetadata: row.chunk_metadata,
      tokenCount: row.token_count,
      document: {
        ticker: row.ticker,
        companyName: row.company_name,
        form: row.form,
        filingDate: row.filing_date,
        fiscalYear: row.fiscal_year,
        accessionNumber: row.accession_number,
        sourceUrl: row.source_url,
      },
    });
  }
  return map;
}

/**
 * Fetch a single chunk with its document.
 */
export async function getChunkWithDocument(chunkId) {
  const map = await getChunksByIds([chunkId]);
  return map.get(chunkId) || null;
}

/**
 * Fetch surrounding chunks (by chunk_index ± radius) within the same document.
 */
export async function getSurroundingChunks(chunkId, radius) {
  if (radius < 1) return [];

  const pool = getPool();

  // First get the anchor to find its document_id and chunk_index
  const { rows: anchorRows } = await pool.query(
    'SELECT document_id, chunk_index FROM document_chunks WHERE id = $1',
    [chunkId],
  );
  if (!anchorRows.length) return [];

  const { document_id, chunk_index } = anchorRows[0];
  const minIndex = chunk_index - radius;
  const maxIndex = chunk_index + radius;

  const { rows } = await pool.query(
    `SELECT dc.id, dc.document_id, dc.chunk_index, dc.text, dc.page, dc.section,
            dc.chunk_metadata,
            sd.ticker, sd.company_name, sd.form, sd.filing_date, sd.fiscal_year,
            sd.accession_number, sd.source_url
     FROM document_chunks dc
     JOIN source_documents sd ON sd.id = dc.document_id
     WHERE dc.document_id = $1
       AND dc.chunk_index >= $2
       AND dc.chunk_index <= $3
       AND dc.id != $4
     ORDER BY dc.chunk_index`,
    [document_id, minIndex, maxIndex, chunkId],
  );

  return rows.map((row) => ({
    id: row.id,
    documentId: row.document_id,
    chunkIndex: row.chunk_index,
    text: row.text,
    page: row.page,
    section: row.section,
    chunkMetadata: row.chunk_metadata,
    document: {
      ticker: row.ticker,
      companyName: row.company_name,
      form: row.form,
      filingDate: row.filing_date,
      fiscalYear: row.fiscal_year,
      accessionNumber: row.accession_number,
      sourceUrl: row.source_url,
    },
  }));
}

/**
 * Get chunk context (anchor + surrounding) for citation viewer.
 */
export async function getChunkContext(chunkId, radius) {
  const pool = getPool();

  const { rows: anchorRows } = await pool.query(
    `SELECT dc.id, dc.document_id, dc.chunk_index, dc.text, dc.page, dc.section,
            dc.chunk_metadata,
            sd.ticker, sd.company_name, sd.form, sd.filing_date, sd.fiscal_year,
            sd.accession_number, sd.source_url
     FROM document_chunks dc
     JOIN source_documents sd ON sd.id = dc.document_id
     WHERE dc.id = $1`,
    [chunkId],
  );
  if (!anchorRows.length) return null;

  const anchor = anchorRows[0];
  const minIndex = anchor.chunk_index - radius;
  const maxIndex = anchor.chunk_index + radius;

  const { rows } = await pool.query(
    `SELECT dc.id, dc.document_id, dc.chunk_index, dc.text, dc.page, dc.section,
            dc.chunk_metadata,
            sd.ticker, sd.company_name, sd.form, sd.filing_date, sd.fiscal_year,
            sd.accession_number, sd.source_url
     FROM document_chunks dc
     JOIN source_documents sd ON sd.id = dc.document_id
     WHERE dc.document_id = $1
       AND dc.chunk_index >= $2
       AND dc.chunk_index <= $3
     ORDER BY dc.chunk_index`,
    [anchor.document_id, minIndex, maxIndex],
  );

  return {
    anchorChunkId: chunkId,
    documentId: anchor.document_id,
    ticker: anchor.ticker,
    companyName: anchor.company_name,
    form: anchor.form,
    filingDate: anchor.filing_date,
    sourceUrl: anchor.source_url,
    chunks: rows.map((row) => ({
      chunkId: row.id,
      chunkIndex: row.chunk_index,
      role: row.id === chunkId ? 'anchor' : row.chunk_index < anchor.chunk_index ? 'previous' : 'next',
      text: row.text,
      page: row.page,
      section: row.section,
    })),
    table: buildTableContext(anchor),
  };
}

function buildTableContext(chunk) {
  const metadata = chunk.chunk_metadata || {};
  if (metadata.chunk_kind !== 'table_row') return null;
  const table = metadata.table;
  if (!table || typeof table !== 'object') return null;
  return {
    tableIndex: table.table_index,
    title: table.title || null,
    units: table.units || null,
    markdown: table.markdown,
    tableData: table,
  };
}
