/**
 * OpenAI query embedding for live retrieval.
 */

import OpenAI from 'openai';
import { settings } from '../config.js';

let _client = null;
function client() {
  if (!_client) {
    _client = new OpenAI({
      apiKey: settings.openaiApiKey,
      baseURL: settings.openaiBaseUrl || undefined,
    });
  }
  return _client;
}

export async function embedQuery(text) {
  if (settings.geminiApiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${settings.geminiApiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: {
          parts: [{ text }]
        },
        outputDimensionality: settings.openaiEmbeddingDimensions
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Gemini embedding API failed: ${JSON.stringify(data)}`);
    }

    const embedding = data.embedding?.values;
    if (!embedding || embedding.length !== settings.openaiEmbeddingDimensions) {
      throw new Error(
        `Expected Gemini embedding dimension ${settings.openaiEmbeddingDimensions}, got ${embedding?.length}`
      );
    }
    return embedding;
  }

  const response = await client().embeddings.create({
    input: [text],
    model: settings.openaiEmbeddingModel,
    dimensions: settings.openaiEmbeddingDimensions,
  });

  const embedding = response.data[0].embedding;
  if (embedding.length !== settings.openaiEmbeddingDimensions) {
    throw new Error(
      `Expected embedding dimension ${settings.openaiEmbeddingDimensions}, got ${embedding.length}`,
    );
  }
  return embedding;
}
