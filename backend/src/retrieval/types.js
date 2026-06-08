/**
 * Shared types and formatting for retrieval results.
 */

export const MAX_PASSAGE_EXCERPT_CHARS = 800;
export const MAX_AGENT_OUTPUT_CHARS = 12_000;

/**
 * Build a RetrievedPassage from a chunk+document row.
 */
export function passageFromChunk(chunk, document, { fusionScore = 0, neighbors = [] } = {}) {
  return {
    chunkId: chunk.id,
    documentId: chunk.documentId || chunk.document_id,
    chunkIndex: chunk.chunkIndex ?? chunk.chunk_index,
    text: chunk.text,
    page: chunk.page,
    section: chunk.section,
    fusionScore,
    ticker: document.ticker,
    companyName: document.companyName ?? document.company_name,
    form: document.form,
    filingDate: document.filingDate ?? document.filing_date,
    fiscalYear: document.fiscalYear ?? document.fiscal_year,
    accessionNumber: document.accessionNumber ?? document.accession_number,
    neighbors,
  };
}

function formatOnePassage(passage, includeNeighbors) {
  const year = passage.fiscalYear || new Date(passage.filingDate).getFullYear();
  const page = passage.page ? ` p.${passage.page}` : '';
  const section = passage.section ? ` (${passage.section})` : '';
  let excerpt = passage.text.trim();
  if (excerpt.length > MAX_PASSAGE_EXCERPT_CHARS) {
    excerpt = excerpt.slice(0, MAX_PASSAGE_EXCERPT_CHARS) + '...';
  }

  const lines = [
    `${passage.ticker} ${passage.form} FY${year}${page}${section} [${passage.chunkId}]: ${excerpt}`,
  ];

  if (includeNeighbors) {
    for (const neighbor of passage.neighbors) {
      let nExcerpt = neighbor.text.trim();
      if (nExcerpt.length > MAX_PASSAGE_EXCERPT_CHARS) {
        nExcerpt = nExcerpt.slice(0, MAX_PASSAGE_EXCERPT_CHARS) + '...';
      }
      lines.push(`  neighbor idx=${neighbor.chunkIndex} [${neighbor.chunkId}]: ${nExcerpt}`);
    }
  }
  return lines.join('\n');
}

/**
 * Bounded, grep-style text for agent tool responses.
 */
export function formatPassagesForAgent(passages) {
  if (!passages.length) return 'No matching passages found in the filing corpus.';

  const blocks = passages.map((p) => formatOnePassage(p, true));
  let output = blocks.join('\n\n');
  if (output.length > MAX_AGENT_OUTPUT_CHARS) {
    output = output.slice(0, MAX_AGENT_OUTPUT_CHARS) + `\n... truncated to ${passages.length} passages.`;
  }
  return output;
}
