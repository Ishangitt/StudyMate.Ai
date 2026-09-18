// ---------------------------------------------------------------------------
// workflow.js — The LangGraph workflow (2 nodes + 1 conditional edge)
//
// This is a genuine graph, not a linear chain. The conditional edge after
// retrieveContext decides whether to spend money on an LLM call or bail
// early with a "not in document" response.
//
// Why branch *before* generating instead of *after*?
// If we always called the LLM and then validated, every unanswerable
// question would cost one LLM call for nothing. By checking retrieval
// quality first, we skip the LLM entirely when the document doesn't cover
// the topic. Cheaper, faster, and the conditional routing is the part that
// actually demonstrates graph-based control flow.
//
// Flow:
//   START → retrieveContext → hasContext? ─yes─→ generateAnswer → END
//                                         └─no──→ END (static message)
// ---------------------------------------------------------------------------

import { END, START, StateGraph, Annotation } from "@langchain/langgraph";
import { retrieveChunks } from "../services/ragService.js";
import { generateAnswer } from "../services/llmService.js";

// ---------------------------------------------------------------------------
// State schema
//
// Annotation.Root defines the shared state that flows through every node.
// Each node receives the full state and returns only the fields it updates.
// ---------------------------------------------------------------------------

const GraphState = Annotation.Root({
  // Inputs
  question: Annotation({ reducer: (_, b) => b, default: () => "" }),
  documentId: Annotation({ reducer: (_, b) => b, default: () => "" }),

  // Set by retrieveContext
  retrievedChunks: Annotation({ reducer: (_, b) => b, default: () => [] }),
  hasContext: Annotation({ reducer: (_, b) => b, default: () => false }),

  // Set by generateAnswer (or the conditional fallback)
  answer: Annotation({ reducer: (_, b) => b, default: () => "" }),
  sources: Annotation({ reducer: (_, b) => b, default: () => [] }),
});

// ---------------------------------------------------------------------------
// Node 1: retrieveContext
//
// Embeds the question and runs similarity search against the vector store.
// Sets hasContext = true if we got chunks back (the vector store always
// returns results if the store is non-empty, so checking length > 0 is
// effectively checking "does this document exist and have content?").
// ---------------------------------------------------------------------------

async function retrieveContext(state) {
  const { documentId, question } = state;

  const chunks = await retrieveChunks(documentId, question, 4);

  // We consider context "present" if we got at least one chunk back.
  // For a more sophisticated system you could check similarity scores
  // against a threshold, but for a demo this is clear and honest.
  const hasContext = chunks.length > 0;

  return {
    retrievedChunks: chunks,
    hasContext,
  };
}

// ---------------------------------------------------------------------------
// Node 2: generateAnswer
//
// Calls the LLM with the retrieved context. Extracts page numbers from
// chunk metadata to return as sources.
// ---------------------------------------------------------------------------

async function generateAnswerNode(state) {
  const { question, retrievedChunks } = state;

  const answer = await generateAnswer(question, retrievedChunks);

  // Extract unique page numbers from the chunks that were sent to the LLM.
  // This tells the user exactly where in the document the answer came from.
  const pageNumbers = [
    ...new Set(
      retrievedChunks
        .map((chunk) => chunk.metadata?.loc?.pageNumber)
        .filter((p) => p != null)
    ),
  ].sort((a, b) => a - b);

  const sources = pageNumbers.map((page) => ({ page }));

  return { answer, sources };
}

// ---------------------------------------------------------------------------
// Conditional edge: hasContext?
//
// This is the decision point that makes this a real graph instead of a
// linear chain. If the retrieval came back empty, we skip the LLM call
// entirely and return a static "not covered" message.
// ---------------------------------------------------------------------------

function routeAfterRetrieval(state) {
  if (state.hasContext) {
    return "generateAnswer";
  }

  // No context found — we'll set the answer directly and end.
  // This avoids wasting an LLM call on a question the document can't answer.
  return "noContext";
}

// ---------------------------------------------------------------------------
// Node: noContext (lightweight fallback — no LLM call)
// ---------------------------------------------------------------------------

async function noContextResponse(_state) {
  return {
    answer:
      "That question doesn't appear to be covered in the uploaded document. Try asking something related to the document's content.",
    sources: [],
  };
}

// ---------------------------------------------------------------------------
// Build the graph
// ---------------------------------------------------------------------------

const workflow = new StateGraph(GraphState)
  // Register nodes
  .addNode("retrieveContext", retrieveContext)
  .addNode("generateAnswer", generateAnswerNode)
  .addNode("noContext", noContextResponse)

  // Edges
  .addEdge(START, "retrieveContext")
  .addConditionalEdges("retrieveContext", routeAfterRetrieval, {
    generateAnswer: "generateAnswer",
    noContext: "noContext",
  })
  .addEdge("generateAnswer", END)
  .addEdge("noContext", END);

// Compile once — reuse for every request
const app = workflow.compile();

/**
 * Run the full RAG workflow for a question against a processed document.
 *
 * @param {string} documentId
 * @param {string} question
 * @returns {Promise<{ answer: string, sources: { page: number }[] }>}
 */
export async function askQuestion(documentId, question) {
  const result = await app.invoke({ documentId, question });
  return {
    answer: result.answer,
    sources: result.sources,
  };
}
