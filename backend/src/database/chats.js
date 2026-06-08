/**
 * Chat thread and message persistence via Supabase.
 */

import { v4 as uuidv4 } from 'uuid';
import { getServiceRoleClient } from './supabase.js';
import {
  rowToUiMessage,
  titleFromUserMessage,
  uiMessageToInsert,
  DEFAULT_THREAD_TITLE,
} from '../chat/messages.js';

/**
 * Verify the user owns the thread; return { id, userId, title } or throw.
 */
export async function requireThreadAccess(threadId, user) {
  const client = getServiceRoleClient();
  const { data, error } = await client
    .from('chat_threads')
    .select('id,user_id,title')
    .eq('id', threadId)
    .maybeSingle();

  if (error || !data) {
    const err = new Error('Thread not found');
    err.status = 404;
    throw err;
  }

  if (data.user_id !== user.id) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }

  return { id: data.id, userId: data.user_id, title: data.title };
}

export async function listThreads(client, user) {
  const { data, error } = await client
    .from('chat_threads')
    .select('id,title,created_at,updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Supabase error in listThreads:', error);
    throw error;
  }
  return (data || []).map(threadRowToResponse);
}

export async function createThread(client, user, title) {
  const threadId = uuidv4();
  const { data, error } = await client
    .from('chat_threads')
    .insert({ id: threadId, user_id: user.id, title: title || DEFAULT_THREAD_TITLE })
    .select('id,title,created_at,updated_at');

  if (error) {
    console.error('Supabase error in createThread:', error);
    throw error;
  }
  return threadRowToResponse(data[0]);
}

export async function deleteThread(client, threadId) {
  await client.from('chat_threads').delete().eq('id', threadId);
}

export async function loadMessages(client, threadId) {
  const { data } = await client
    .from('chat_messages')
    .select('id,role,content,parts,sequence')
    .eq('thread_id', threadId)
    .order('sequence');

  const messages = (data || []).map(rowToUiMessage);
  const assistantIds = messages
    .filter((m) => m.role === 'assistant' && m.id)
    .map((m) => m.id);

  if (!assistantIds.length) return messages;

  const { data: citationRows } = await client
    .from('message_citations')
    .select(
      'message_id,citation_index,excerpt,chunk_id,ticker,company_name,form,filing_date,page,section',
    )
    .in('message_id', assistantIds)
    .order('citation_index');

  const citationsByMessage = {};
  for (const row of citationRows || []) {
    const mid = String(row.message_id);
    if (!citationsByMessage[mid]) citationsByMessage[mid] = [];
    citationsByMessage[mid].push(row);
  }

  return messages.map((message) => {
    if (message.role !== 'assistant' || !message.id) return message;
    const rows = citationsByMessage[message.id] || [];
    if (!rows.length) return message;

    const existingChunkIds = new Set(
      message.parts.filter((p) => p.type === 'data-citation').map((p) => p.data.chunkId),
    );

    const newParts = [...message.parts];
    for (const row of rows) {
      if (existingChunkIds.has(row.chunk_id)) continue;
      newParts.push({
        type: 'data-citation',
        id: row.chunk_id,
        data: {
          citationIndex: row.citation_index,
          chunkId: row.chunk_id,
          excerpt: row.excerpt,
          ticker: row.ticker,
          companyName: row.company_name,
          form: row.form,
          filingDate: row.filing_date,
          page: row.page,
          section: row.section,
        },
      });
    }
    return { ...message, parts: newParts };
  });
}

async function getNextSequence(client, threadId) {
  const { data } = await client
    .from('chat_messages')
    .select('sequence')
    .eq('thread_id', threadId)
    .order('sequence', { ascending: false })
    .limit(1);

  if (!data || !data.length) return 0;
  return data[0].sequence + 1;
}

function citationRowsFromMessage(assistantMessage) {
  const rows = [];
  if (!assistantMessage.id) return rows;

  for (const part of assistantMessage.parts) {
    if (part.type !== 'data-citation') continue;
    const d = part.data;
    rows.push({
      id: uuidv4(),
      message_id: assistantMessage.id,
      chunk_id: d.chunkId,
      citation_index: d.citationIndex,
      excerpt: d.excerpt,
      ticker: d.ticker,
      company_name: d.companyName,
      form: d.form,
      filing_date: d.filingDate,
      page: d.page,
      section: d.section,
    });
  }
  return rows;
}

export async function appendGroundedTurn(
  client,
  { threadId, userMessage, assistantMessage, threadTitle },
) {
  const nextSequence = await getNextSequence(client, threadId);
  const rows = [
    uiMessageToInsert(userMessage, { threadId, sequence: nextSequence }),
    uiMessageToInsert(assistantMessage, {
      threadId,
      sequence: nextSequence + 1,
      messageId: assistantMessage.id,
    }),
  ];

  await client.from('chat_messages').insert(rows);

  const citationRows = citationRowsFromMessage(assistantMessage);
  if (citationRows.length) {
    await client.from('message_citations').insert(citationRows);
  }

  const updates = { updated_at: new Date().toISOString() };
  if (threadTitle === DEFAULT_THREAD_TITLE) {
    updates.title = titleFromUserMessage(userMessage);
  }
  await client.from('chat_threads').update(updates).eq('id', threadId);
}

function threadRowToResponse(row) {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
