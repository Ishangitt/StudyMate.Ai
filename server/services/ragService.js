// ---------------------------------------------------------------------------
// ragService.js — The core RAG pipeline
//
// PDF → Chunks → Embeddings → Vector Store → Retrieval
//
// This is where the "Retrieval" in RAG lives. We never send the whole PDF to
// the LLM — we embed small chunks, find the ones closest to the user's
// question, and pass only those to the model. This keeps costs down and
// answers precise.
// ---------------------------------------------------------------------------

import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { Embeddings } from "@langchain/core/embeddings";
import { pipeline } from "@huggingface/transformers";

// ---------------------------------------------------------------------------
// 1. Local Embeddings — no API key, no cost
//
// We wrap the HuggingFace Transformers.js pipeline in a class that implements
// LangChain's Embeddings interface. This lets us plug it directly into
// MemoryVectorStore without any adapter code.
//
// Why embeddings instead of keyword search?
// Keyword search fails when the user asks "What is virtual memory?" but the
// PDF says "virtual address space". Embeddings capture *meaning*, so
// semantically similar phrases end up near each other in vector space.
// ---------------------------------------------------------------------------

let _pipe = null;

/** Lazily load the model once — subsequent calls reuse it. */
async function getEmbeddingPipeline() {
  if (!_pipe) {
    console.log("⏳ Loading embedding model (first time only)...");
    _pipe = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    console.log("✅ Embedding model loaded.");
  }
  return _pipe;
}

/**
 * Custom embeddings class that wraps @huggingface/transformers so it
 * conforms to LangChain's Embeddings interface.
 */
class LocalHuggingFaceEmbeddings extends Embeddings {
  constructor() {
    super({});
  }

  /** Embed a single query string → number[] */
  async embedQuery(text) {
    const pipe = await getEmbeddingPipeline();
    const output = await pipe(text, { pooling: "mean", normalize: true });
    return Array.from(output.data);
  }

  /** Embed an array of document strings → number[][] */
  async embedDocuments(documents) {
    const results = [];
    for (const doc of documents) {
      results.push(await this.embedQuery(doc));
    }
    return results;
  }
}

// ---------------------------------------------------------------------------
// 2. In-memory document store
//
// Map<documentId, { vectorStore, chunkCount }>
//
// Each uploaded PDF gets its own vector store keyed by a unique ID. The store
// resets when the server restarts — fine for a demo. Swap MemoryVectorStore
// for FAISS or Chroma if you need persistence.
// ---------------------------------------------------------------------------

const documentStores = new Map();

// Shared embeddings instance — reuses the same model for all documents
const embeddings = new LocalHuggingFaceEmbeddings();

// ---------------------------------------------------------------------------
// 3. processDocument — PDF → chunks → embeddings → vector store
//
// Why chunking?
// LLMs have a context window limit, and even if they didn't, dumping an
// entire textbook into the prompt would dilute the signal. Chunks let us
// retrieve only the 3–4 most relevant paragraphs for a given question.
//
// How does page metadata survive?
// PDFLoader assigns each page a metadata object with `loc.pageNumber`.
// RecursiveCharacterTextSplitter preserves the metadata of the parent
// document on each chunk. So when we retrieve a chunk later, we still know
// which page it came from.
// ---------------------------------------------------------------------------

/**
 * Process a PDF file: load → split → embed → store.
 * @param {string} filePath  Absolute path to the uploaded PDF
 * @param {string} documentId  Unique ID for this document
 * @returns {{ documentId: string, chunkCount: number }}
 */
export async function processDocument(filePath, documentId) {
  // Step 1: Load the PDF — each page becomes a Document with page metadata
  const loader = new PDFLoader(filePath, { splitPages: true });
  const pages = await loader.load();

  if (pages.length === 0) {
    throw new Error("The PDF appears to be empty or unreadable.");
  }

  // Step 2: Split pages into smaller chunks for precise retrieval
  // chunkSize 1000 ≈ a long paragraph. chunkOverlap 200 ensures context
  // isn't lost at chunk boundaries.
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const chunks = await splitter.splitDocuments(pages);

  // Step 3 & 4: Embed chunks and store them in the in-memory vector store.
  // MemoryVectorStore.fromDocuments handles both embedding and storage.
  const vectorStore = await MemoryVectorStore.fromDocuments(chunks, embeddings);

  documentStores.set(documentId, { vectorStore, chunkCount: chunks.length });

  return { documentId, chunkCount: chunks.length };
}

// ---------------------------------------------------------------------------
// 4. retrieveChunks — find the most relevant chunks for a question
//
// Why retrieval happens *before* generation:
// Without retrieval the LLM has no context — it would either hallucinate or
// refuse. By retrieving first, we give the model exactly the information it
// needs and nothing more. The conditional edge in the graph then decides
// whether the retrieved chunks are actually relevant before spending money
// on an LLM call.
// ---------------------------------------------------------------------------

/**
 * Retrieve the top-k most relevant chunks for a question.
 * @param {string} documentId
 * @param {string} question
 * @param {number} [k=4]  Number of chunks to retrieve
 * @returns {import("@langchain/core/documents").Document[]}
 */
export async function retrieveChunks(documentId, question, k = 4) {
  const store = documentStores.get(documentId);
  if (!store) {
    throw new Error(`No document found with ID: ${documentId}`);
  }

  // similaritySearch embeds the question using the same model, then finds
  // the k nearest vectors in the store. Same embedding space = meaningful
  // cosine similarity.
  const results = await store.vectorStore.similaritySearch(question, k);
  return results;
}

/**
 * Check whether a document has been processed and is ready for questions.
 * @param {string} documentId
 * @returns {boolean}
 */
export function isDocumentReady(documentId) {
  return documentStores.has(documentId);
}
