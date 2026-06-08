/**
 * LangChain.js document agent definition.
 * Replaces PydanticAI with LangGraph's createReactAgent.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

import { settings } from '../config.js';
import { createAgentTools } from './tools.js';
import { GroundedAnswerSchema } from './outputs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INSTRUCTIONS = readFileSync(join(__dirname, 'instructions.md'), 'utf-8');

/**
 * TurnRegistry — tracks every chunk retrieved during a turn (citation allowlist).
 */
export class TurnRegistry {
  constructor() {
    this.passagesByChunkId = new Map();
  }

  register(passage) {
    this.passagesByChunkId.set(passage.chunkId, passage);
    for (const neighbor of passage.neighbors || []) {
      this.passagesByChunkId.set(neighbor.chunkId, neighbor);
    }
  }

  registerMany(passages) {
    for (const p of passages) this.register(p);
  }
}

/**
 * Run one agent turn: search → reason → produce GroundedAnswer.
 */
export async function runDocumentAgent(query, deps) {
  deps.onStatus?.('analyzing', 'Analyzing your question…');

  const model = new ChatOpenAI({
    modelName: settings.openaiChatModel,
    openAIApiKey: settings.openaiApiKey,
    temperature: settings.openaiAgentTemperature,
    configuration: {
      baseURL: settings.openaiBaseUrl || undefined,
    },
  });

  const tools = createAgentTools(deps);

  // Create a LangGraph ReAct agent with tool calling
  const agent = createReactAgent({
    llm: model,
    tools,
  });

  // Build the final structured-output extraction prompt
  const structuredOutputPrompt = `

After you have gathered enough evidence from the tools, you MUST respond with a JSON object matching this exact schema:
{
  "answer": "your answer text with [1], [2] citation markers",
  "citations": [
    {
      "citation_index": 1,
      "chunk_id": "uuid-of-cited-chunk",
      "excerpt": "verbatim excerpt from the chunk"
    }
  ],
  "insufficient_evidence": false
}

Respond ONLY with this JSON object. No other text outside the JSON.`;

  const result = await agent.invoke({
    messages: [
      new SystemMessage(INSTRUCTIONS + structuredOutputPrompt),
      new HumanMessage(query),
    ],
  });

  deps.onStatus?.('verifying', 'Verifying citations…');

  // Extract the final message content from the agent
  const lastMessage = result.messages[result.messages.length - 1];
  const content =
    typeof lastMessage.content === 'string'
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);

  // Parse the structured output
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Agent did not produce a valid JSON response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const validated = GroundedAnswerSchema.parse(parsed);

  return validated;
}
