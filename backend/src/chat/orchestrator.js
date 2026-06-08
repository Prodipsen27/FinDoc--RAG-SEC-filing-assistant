/**
 * Coordinates one chat turn: agent → validate → stream → persist.
 */

import { runDocumentAgent, TurnRegistry } from '../assistant/agent.js';
import { pruneUnreferencedCitations, validateGrounding } from '../grounding/validator.js';
import { DocumentRetriever } from '../retrieval/retriever.js';
import { textFromParts } from './messages.js';
import { streamStatus, streamError, streamGroundedTurnAndPersist } from './streaming.js';

const MAX_VALIDATION_ATTEMPTS = 2;

/**
 * Run one chat turn. Returns an async generator of SSE strings.
 */
export async function* runTurn({ client, threadId, user, userMessage, threadTitle }) {
  const query = textFromParts(userMessage.parts).trim();
  if (!query) {
    yield streamError('User message is empty.');
    return;
  }

  yield streamStatus('analyzing', 'Analyzing your question…');

  const retriever = new DocumentRetriever();
  let grounded = null;
  let validation = null;

  for (let attempt = 1; attempt <= MAX_VALIDATION_ATTEMPTS; attempt++) {
    const registry = new TurnRegistry();

    const statusEvents = [];
    const onStatus = (stage, message) => {
      statusEvents.push(streamStatus(stage, message));
    };

    const deps = {
      retriever,
      registry,
      threadId,
      userId: user.id,
      onStatus,
    };

    try {
      grounded = await runDocumentAgent(query, deps);
    } catch (err) {
      yield streamError(`Assistant run failed: ${err.message}`);
      return;
    }

    // Yield any status events that accumulated during the agent run
    for (const event of statusEvents) {
      yield event;
    }

    yield streamStatus('verifying', 'Verifying citations…');

    grounded = pruneUnreferencedCitations(grounded);
    validation = await validateGrounding(grounded, registry);

    if (validation.ok || attempt === MAX_VALIDATION_ATTEMPTS) {
      // Pass registry through for streaming
      validation._registry = registry;
      break;
    }

    yield streamStatus('retrying', 'Could not fully verify citations; retrying with stricter grounding…');
  }

  if (!grounded || !validation) {
    yield streamError('Assistant run failed before producing an answer.');
    return;
  }

  if (validation.ok) {
    yield streamStatus('streaming', 'Preparing answer…');
  }

  yield* streamGroundedTurnAndPersist({
    client,
    threadId,
    userMessage,
    threadTitle,
    answer: grounded,
    registry: validation._registry,
    validation,
  });
}
