/**
 * Structured output types for the document agent.
 * Uses Zod schemas for LangChain structured output.
 */

import { z } from 'zod';

export const CitationSchema = z.object({
  citation_index: z.number().describe('1-based index referenced as [n] in the answer text'),
  chunk_id: z.string().uuid().describe('UUID of the cited document chunk'),
  excerpt: z.string().describe('Verbatim substring from the chunk text supporting the claim'),
  confidence: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe('Confidence score 0-100 for how well this citation supports the claim'),
});

export const GroundedAnswerSchema = z.object({
  answer: z.string().describe('Plain-English answer with [n] citation markers'),
  citations: z
    .array(CitationSchema)
    .default([])
    .describe('Citations backing factual claims in the answer'),
  insufficient_evidence: z
    .boolean()
    .default(false)
    .describe('True when the corpus does not contain enough evidence to answer'),
});
