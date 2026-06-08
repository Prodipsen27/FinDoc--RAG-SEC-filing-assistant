/**
 * AI SDK-compatible SSE streaming for grounded assistant replies.
 */

import { v4 as uuidv4 } from 'uuid';
import { buildAssistantMessage } from './messages.js';
import { appendGroundedTurn } from '../database/chats.js';

const GROUNDING_FAILURE_MESSAGE =
  'I found relevant source passages, but I could not fully verify the answer ' +
  'against them. Try asking a narrower question or breaking it into smaller parts.';

function sseEvent(payload) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export function streamStatus(stage, message) {
  return sseEvent({ type: 'data-status', data: { stage, message } });
}

export function streamError(errorText) {
  return sseEvent({ type: 'error', errorText });
}

/**
 * Stream a grounded answer as SSE events and persist to the database.
 */
export async function* streamGroundedTurnAndPersist({
  client,
  threadId,
  userMessage,
  threadTitle,
  answer,
  registry,
  validation,
}) {
  if (!validation.ok) {
    yield streamError(GROUNDING_FAILURE_MESSAGE);
    return;
  }

  const messageId = uuidv4();
  const confidenceScores = validation.confidenceScores || null;
  const assistantMessage = buildAssistantMessage(answer, registry, {
    messageId,
    confidenceScores,
  });

  // Stream start
  yield sseEvent({ type: 'start', messageId });

  // Stream text deltas (word-by-word)
  yield sseEvent({ type: 'text-start', id: messageId });
  for (const word of answer.answer.split(' ')) {
    yield sseEvent({ type: 'text-delta', id: messageId, delta: `${word} ` });
  }
  yield sseEvent({ type: 'text-end', id: messageId });

  // Stream citation events
  const citationParts = assistantMessage.parts.filter((p) => p.type === 'data-citation');
  for (const part of citationParts) {
    yield sseEvent(part);
  }

  // Stream finish
  yield sseEvent({ type: 'finish' });

  // Persist after streaming completes
  await appendGroundedTurn(client, {
    threadId,
    userMessage,
    assistantMessage,
    threadTitle,
  });
}
