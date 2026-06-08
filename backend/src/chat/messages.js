/**
 * Convert between AI SDK UI messages and chat_messages rows.
 */

import { v4 as uuidv4 } from 'uuid';

export const DEFAULT_THREAD_TITLE = 'New chat';
const MAX_TITLE_LENGTH = 255;

export function textFromParts(parts) {
  return parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

export function extractLastUserMessage(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i];
  }
  const err = new Error('Request must include at least one user message');
  err.status = 422;
  throw err;
}

export function uiMessageToInsert(message, { threadId, sequence, messageId }) {
  return {
    id: messageId || uuidv4(),
    thread_id: threadId,
    role: message.role,
    content: textFromParts(message.parts) || null,
    parts: message.parts,
    sequence,
  };
}

export function rowToUiMessage(row) {
  const rawParts = row.parts || [];
  let parts = rawParts.map(parsePart).filter(Boolean);
  if (!parts.length && row.content) {
    parts = [{ type: 'text', text: row.content }];
  }
  return { id: String(row.id), role: row.role, parts };
}

function parsePart(raw) {
  if (raw.type === 'text') return raw;
  if (raw.type === 'data-citation') return raw;
  return null;
}

export function citationPartsFromGroundedAnswer(answer, registry, confidenceScores) {
  const parts = [];
  for (const citation of answer.citations) {
    const passage = registry.passagesByChunkId.get(citation.chunk_id);
    if (!passage) continue;

    parts.push({
      type: 'data-citation',
      id: citation.chunk_id,
      data: {
        citationIndex: citation.citation_index,
        chunkId: citation.chunk_id,
        excerpt: citation.excerpt,
        ticker: passage.ticker,
        companyName: passage.companyName,
        form: passage.form,
        filingDate: passage.filingDate,
        page: passage.page,
        section: passage.section,
        confidence: confidenceScores?.get(citation.citation_index) ?? null,
      },
    });
  }
  return parts;
}

export function buildAssistantMessage(answer, registry, { messageId, confidenceScores } = {}) {
  const parts = [{ type: 'text', text: answer.answer }];
  parts.push(...citationPartsFromGroundedAnswer(answer, registry, confidenceScores));
  return { id: messageId || uuidv4(), role: 'assistant', parts };
}

export function titleFromUserMessage(message) {
  const text = textFromParts(message.parts).trim();
  if (!text) return DEFAULT_THREAD_TITLE;
  return text.length <= MAX_TITLE_LENGTH ? text : text.slice(0, MAX_TITLE_LENGTH - 3) + '...';
}
