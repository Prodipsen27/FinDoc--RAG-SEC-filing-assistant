/**
 * Chat API routes — threads, messages, streaming, citations.
 */

import { Router } from 'express';
import { requireAuth } from '../auth/dependencies.js';
import { ensureUser } from '../database/users.js';
import { createUserClient } from '../database/supabase.js';
import {
  requireThreadAccess,
  listThreads,
  createThread,
  deleteThread,
  loadMessages,
} from '../database/chats.js';
import { getChunkContext } from '../database/documents.js';
import { extractLastUserMessage } from '../chat/messages.js';
import { runTurn } from '../chat/orchestrator.js';

export const chatRouter = Router();

// All chat routes require authentication
chatRouter.use('/chat', requireAuth);

/**
 * GET /chat/threads — list user's threads
 */
chatRouter.get('/chat/threads', async (req, res) => {
  try {
    await ensureUser(req.user);
    const client = createUserClient(req.accessToken);
    const threads = await listThreads(client, req.user);
    res.json({ threads });
  } catch (err) {
    console.error('Error in GET /chat/threads:', err);
    res.status(err.status || 500).json({ detail: err.message });
  }
});

/**
 * POST /chat/threads — create a new thread
 */
chatRouter.post('/chat/threads', async (req, res) => {
  try {
    await ensureUser(req.user);
    const client = createUserClient(req.accessToken);
    const thread = await createThread(client, req.user, req.body.title);
    res.json(thread);
  } catch (err) {
    console.error('Error in POST /chat/threads:', err);
    res.status(err.status || 500).json({ detail: err.message });
  }
});

/**
 * GET /chat/threads/:threadId/messages — load message history
 */
chatRouter.get('/chat/threads/:threadId/messages', async (req, res) => {
  try {
    await requireThreadAccess(req.params.threadId, req.user);
    const client = createUserClient(req.accessToken);
    const messages = await loadMessages(client, req.params.threadId);
    res.json({ messages });
  } catch (err) {
    console.error('Error in GET /chat/threads/:threadId/messages:', err);
    res.status(err.status || 500).json({ detail: err.message });
  }
});

/**
 * DELETE /chat/threads/:threadId — delete a thread
 */
chatRouter.delete('/chat/threads/:threadId', async (req, res) => {
  try {
    await requireThreadAccess(req.params.threadId, req.user);
    const client = createUserClient(req.accessToken);
    await deleteThread(client, req.params.threadId);
    res.status(204).end();
  } catch (err) {
    console.error('Error in DELETE /chat/threads/:threadId:', err);
    res.status(err.status || 500).json({ detail: err.message });
  }
});

/**
 * GET /chat/citations/:chunkId/context — citation context viewer
 */
chatRouter.get('/chat/citations/:chunkId/context', async (req, res) => {
  try {
    const radius = Math.min(Math.max(parseInt(req.query.radius, 10) || 1, 0), 3);
    const context = await getChunkContext(req.params.chunkId, radius);
    if (!context) {
      return res.status(404).json({ detail: 'Citation chunk not found' });
    }
    res.json(context);
  } catch (err) {
    res.status(err.status || 500).json({ detail: err.message });
  }
});

/**
 * POST /chat/stream — SSE streaming chat endpoint
 */
chatRouter.post('/chat/stream', async (req, res) => {
  try {
    await ensureUser(req.user);

    const { threadId, messages } = req.body;
    if (!threadId || !messages) {
      return res.status(422).json({ detail: 'threadId and messages are required' });
    }

    const thread = await requireThreadAccess(threadId, req.user);
    const userMessage = extractLastUserMessage(messages);
    const client = createUserClient(req.accessToken);

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const turnGenerator = runTurn({
      client,
      threadId,
      user: req.user,
      userMessage,
      threadTitle: thread.title,
    });

    for await (const event of turnGenerator) {
      res.write(event);
    }

    res.end();
  } catch (err) {
    // If headers already sent, write an SSE error event
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', errorText: err.message })}\n\n`);
      res.end();
    } else {
      res.status(err.status || 500).json({ detail: err.message });
    }
  }
});
