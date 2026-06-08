import fs from 'fs';

import { settings } from '../src/config.js';
import { chunkMarkdown, tableChunksFromFile } from '../src/ingest/chunking.js';
import {
  chunkIdForDocument,
  closePool,
  documentIdForAccession,
  getManifest,
  getOpenAIClient,
  getPoolClient,
  parseArgs,
  resolveManifestPath,
  vectorLiteral,
} from './_shared.js';

async function hasChunks(pool, documentId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM document_chunks WHERE document_id = $1 LIMIT 1',
    [documentId],
  );
  return rows.length > 0;
}

async function embedTexts(texts) {
  const BATCH_SIZE = 8;
  const embeddings = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    if (settings.geminiApiKey) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:batchEmbedContents?key=${settings.geminiApiKey}`;
      const requests = batch.map((text) => ({
        model: 'models/gemini-embedding-2',
        content: {
          parts: [{ text }],
        },
        outputDimensionality: settings.openaiEmbeddingDimensions,
      }));

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(`Gemini batch embedding failed: ${JSON.stringify(data)}`);
      }

      const batchEmbeddings = data.embeddings.map((e) => e.values);
      embeddings.push(...batchEmbeddings);
    } else {
      const response = await getOpenAIClient().embeddings.create({
        model: settings.openaiEmbeddingModel,
        input: batch,
        dimensions: settings.openaiEmbeddingDimensions,
      });

      const batchEmbeddings = response.data
        .sort((left, right) => left.index - right.index)
        .map((item) => item.embedding);

      embeddings.push(...batchEmbeddings);
    }
  }

  return embeddings;
}

function buildChunksForFiling(filing) {
  const markdownPath = resolveManifestPath(filing.local_path);
  const tablesPath = filing.tables_local_path
    ? resolveManifestPath(filing.tables_local_path)
    : null;

  const markdown = fs.readFileSync(markdownPath, 'utf-8');
  const textChunks = chunkMarkdown(markdown);
  const tableChunks = tablesPath ? tableChunksFromFile(tablesPath) : [];

  return [...textChunks, ...tableChunks].map((chunk, index) => ({
    ...chunk,
    chunkIndex: index,
  }));
}

async function upsertChunks(pool, documentId, chunks, embeddings) {
  await pool.query('DELETE FROM document_chunks WHERE document_id = $1', [documentId]);

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const embedding = embeddings[index];

    await pool.query(
      `INSERT INTO document_chunks (
         id,
         document_id,
         chunk_index,
         text,
         page,
         section,
         chunk_metadata,
         token_count,
         embedding,
         search_vector
       ) VALUES (
         $1,
         $2,
         $3,
         $4,
         $5,
         $6,
         $7::jsonb,
         $8,
         CAST($9 AS vector),
         to_tsvector(CAST($10 AS regconfig), $4)
       )`,
      [
        chunkIdForDocument(documentId, chunk.chunkIndex),
        documentId,
        chunk.chunkIndex,
        chunk.text,
        null,
        chunk.section,
        JSON.stringify(chunk.chunkMetadata),
        chunk.tokenCount,
        vectorLiteral(embedding),
        settings.retrievalFtsConfig,
      ],
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const accession = typeof args.accession === 'string' ? args.accession : null;
  const ingestAll = Boolean(args.all) || !accession;
  const force = Boolean(args.force);

  const manifest = getManifest();
  const filings = Array.isArray(manifest.filings) ? manifest.filings : [];
  const selectedFilings = filings.filter((filing) =>
    ingestAll ? true : filing.accession_number === accession,
  );

  if (!selectedFilings.length) {
    throw new Error(accession ? `No filing found for accession ${accession}.` : 'No filings found.');
  }

  const pool = getPoolClient();

  for (const filing of selectedFilings) {
    const documentId = documentIdForAccession(filing.accession_number);

    if (!force && (await hasChunks(pool, documentId))) {
      console.log(`Skipping ${filing.accession_number}; chunks already exist.`);
      continue;
    }

    const chunks = buildChunksForFiling(filing);
    const embeddings = await embedTexts(chunks.map((chunk) => chunk.text));
    await upsertChunks(pool, documentId, chunks, embeddings);
    console.log(`Ingested ${chunks.length} chunks for ${filing.accession_number}.`);
  }
}

main()
  .catch((error) => {
    console.error('Chunk/embed ingestion failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
