// ---------------------------------------------------------------------------
// llmService.js — LLM wrapper for answer generation
//
// Uses OpenRouter via the dedicated @langchain/openrouter package.
// The system prompt constrains the model to only use provided context,
// which is the main defence against hallucination in a RAG system.
// ---------------------------------------------------------------------------

import { ChatOpenRouter } from "@langchain/openrouter";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// ---------------------------------------------------------------------------
// System prompt — the "only answer from context" instruction
//
// Why this matters:
// Without this constraint, the LLM might answer from its training data
// instead of the uploaded document. That defeats the purpose of RAG — the
// user uploaded a *specific* document and wants answers from *that* document.
// The system prompt makes the model refuse gracefully when the context
// doesn't contain the answer, rather than making something up.
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are StudyMate AI. Answer the user's question using only the provided document context. If the answer cannot be found in the provided context, clearly say that the information is not available in the uploaded document. Do not invent information.

When answering:
- Be clear and concise
- Use the exact information from the context
- If the context partially answers the question, share what you can and note what's missing`;

/**
 * Generate an answer from the LLM using the retrieved context chunks.
 *
 * @param {string} question  The user's question
 * @param {import("@langchain/core/documents").Document[]} contextChunks
 * @returns {Promise<string>}  The generated answer text
 */
export async function generateAnswer(question, contextChunks) {
  const model = new ChatOpenRouter({
    model: "openai/gpt-4o",
    temperature: 0.3, // Low temperature for factual, consistent answers
    maxTokens: 500, // Limit tokens so it doesn't exceed the user's OpenRouter credit balance
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  // Build the context string from retrieved chunks.
  // We include the page number so the model can reference it in its answer.
  const contextText = contextChunks
    .map((chunk, i) => {
      const page = chunk.metadata?.loc?.pageNumber ?? "unknown";
      return `[Chunk ${i + 1} | Page ${page}]\n${chunk.pageContent}`;
    })
    .join("\n\n---\n\n");

  const userMessage = `Context from the uploaded document:\n\n${contextText}\n\n---\n\nQuestion: ${question}`;

  const response = await model.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(userMessage),
  ]);

  return response.content;
}
