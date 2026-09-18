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
// System prompt
//
// By default, RAG systems are constrained to ONLY answer from context.
// However, per your request, we are modifying this to allow the LLM to
// fallback to its external general knowledge if the PDF doesn't contain the answer!
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are StudyMate AI. First, try to answer the user's question using ONLY the provided document context. 
If the answer cannot be found in the provided context, you may use your external general knowledge to answer the question. 
However, if you do use external knowledge, you MUST clearly state: "This information is not in the uploaded document, but based on general knowledge..."

When answering:
- Be clear and concise
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
