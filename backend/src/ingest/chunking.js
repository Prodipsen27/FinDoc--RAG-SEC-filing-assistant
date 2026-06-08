import fs from 'fs';

const MAX_CHUNK_CHARS = 1_800;
const MIN_CHUNK_CHARS = 700;

function normalizeText(text) {
  return text.replace(/\r\n/g, '\n').replace(/\u0000/g, '').trim();
}

function tokenCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function isHeading(block) {
  return /^#{1,6}\s+/.test(block) || /^[A-Z][A-Z\s,&/-]{6,}$/.test(block.trim());
}

function headingText(block) {
  return block.replace(/^#{1,6}\s+/, '').trim();
}

function splitBlocks(markdown) {
  return normalizeText(markdown)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .filter((block) => block !== '<!-- image -->');
}

function pushChunk(chunks, section, parts) {
  const text = parts.join('\n\n').trim();
  if (!text) return;

  chunks.push({
    text,
    section: section || null,
    tokenCount: tokenCount(text),
    chunkMetadata: {
      chunk_kind: 'text',
    },
  });
}

export function chunkMarkdown(markdown) {
  const blocks = splitBlocks(markdown);
  const chunks = [];
  let currentSection = null;
  let currentParts = [];
  let currentLength = 0;

  for (const block of blocks) {
    if (isHeading(block)) {
      if (currentParts.length) {
        pushChunk(chunks, currentSection, currentParts);
        currentParts = [];
        currentLength = 0;
      }
      currentSection = headingText(block);
      currentParts.push(block);
      currentLength = block.length;
      continue;
    }

    const nextLength = currentLength + block.length + 2;
    if (currentParts.length && nextLength > MAX_CHUNK_CHARS && currentLength >= MIN_CHUNK_CHARS) {
      pushChunk(chunks, currentSection, currentParts);
      currentParts = [];
      currentLength = 0;
    }

    currentParts.push(block);
    currentLength += block.length + 2;
  }

  if (currentParts.length) {
    pushChunk(chunks, currentSection, currentParts);
  }

  return chunks;
}

export function tableChunksFromFile(tablesPath) {
  if (!fs.existsSync(tablesPath)) return [];

  const raw = fs.readFileSync(tablesPath, 'utf-8');
  const tables = JSON.parse(raw);
  if (!Array.isArray(tables)) return [];

  return tables
    .filter((table) => table && typeof table.markdown === 'string' && table.markdown.trim())
    .map((table) => {
      const title = typeof table.title === 'string' && table.title.trim() ? table.title.trim() : null;
      const text = title ? `${title}\n\n${table.markdown}` : table.markdown;

      return {
        text,
        section: title,
        tokenCount: tokenCount(text),
        chunkMetadata: {
          chunk_kind: 'table_row',
          table,
        },
      };
    });
}
