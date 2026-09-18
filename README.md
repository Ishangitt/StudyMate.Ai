# StudyMate AI

An AI-powered **PDF Question Answering Assistant** using **RAG** (Retrieval-Augmented Generation), **LangChain**, **LangGraph**, and **OpenRouter**.

Upload a PDF study document → ask questions → get accurate, source-cited answers drawn only from the document's content.

![StudyMate AI](https://img.shields.io/badge/RAG-LangChain-indigo) ![LangGraph](https://img.shields.io/badge/LangGraph-StateGraph-violet) ![OpenRouter](https://img.shields.io/badge/LLM-OpenRouter-blue)

---

## Features

- **PDF Upload & Processing** — Upload any PDF and process it into searchable chunks
- **Local Embeddings** — No external embedding API needed; runs `Xenova/all-MiniLM-L6-v2` directly in Node.js
- **RAG Pipeline** — Retrieves only the most relevant chunks for each question (never sends the whole PDF to the LLM)
- **LangGraph Workflow** — 2-node StateGraph with conditional routing; skips the LLM entirely for unanswerable questions
- **Source Citations** — Every answer includes the page numbers it was sourced from
- **Clean UI** — Dark-themed, glassmorphism-styled React frontend

---

## Architecture

```
PDF → PDFLoader → RecursiveCharacterTextSplitter → Chunks
                                                      │
                                     Local Embeddings (HuggingFace
                                       Xenova/all-MiniLM-L6-v2)
                                                      │
                                        MemoryVectorStore
                                                      │
User Question ────────────────────────────────────────┤
                                                      ▼
                              LangGraph: retrieveContext
                                                      │
                                        hasContext? (conditional)
                                       ╱                          ╲
                                     no                           yes
                                      │                             │
                           "Not in document"               generateAnswer (LLM)
                            (no LLM call)                  via ChatOpenRouter
                                      ╲                             ╱
                                       ▼                           ▼
                                  Answer + Source Pages → Frontend
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Tailwind CSS, Axios |
| Backend | Node.js, Express.js |
| LLM | OpenRouter (Google Gemini Flash) |
| RAG Framework | LangChain.js |
| Workflow | LangGraph (StateGraph) |
| Embeddings | `@huggingface/transformers` — local, free, no API key |
| Vector Store | MemoryVectorStore (in-memory, resets on restart) |
| PDF Parsing | LangChain PDFLoader |

---

## How the RAG + LangGraph Workflow Works

### RAG Pipeline (what happens when you upload a PDF)

1. **PDF Loading** — `PDFLoader` extracts text from each page, preserving page number metadata
2. **Chunking** — `RecursiveCharacterTextSplitter` breaks pages into ~1000-character chunks with 200-char overlap
3. **Embedding** — Each chunk is embedded locally using the MiniLM model (384-dimensional vectors)
4. **Storage** — Embeddings are stored in an in-memory vector store keyed by document ID

### LangGraph Workflow (what happens when you ask a question)

The workflow is a **StateGraph** with 2 nodes and a conditional edge:

1. **Node: `retrieveContext`** — Embeds the question with the same model and runs similarity search against the vector store. Returns the top 4 most relevant chunks.
2. **Conditional Edge: `hasContext?`** — If chunks were retrieved, go to `generateAnswer`. If not, skip the LLM and return "not covered in the document."
3. **Node: `generateAnswer`** — Sends the question + retrieved chunks to the LLM with a system prompt that constrains it to only use the provided context. Extracts page numbers from chunk metadata.

**Why branch before generating?** If we always called the LLM and then checked, every unanswerable question would cost one LLM call for nothing. Checking retrieval quality first is cheaper and demonstrates real conditional graph routing.

---

## API Endpoints

### `POST /api/documents/upload`

Upload and process a PDF.

**Request:** `multipart/form-data` with field `pdf`

**Response:**
```json
{
  "documentId": "abc-123",
  "chunkCount": 42,
  "filename": "operating-systems.pdf",
  "status": "ready"
}
```

### `POST /api/chat`

Ask a question about a processed document.

**Request:**
```json
{
  "documentId": "abc-123",
  "question": "What is virtual memory?"
}
```

**Response:**
```json
{
  "answer": "Virtual memory is a memory management technique that...",
  "sources": [{ "page": 12 }, { "page": 13 }]
}
```

---

## Setup

### Prerequisites

- **Node.js 18+** (required for local embeddings)
- **OpenRouter API key** — sign up at [openrouter.ai](https://openrouter.ai) (free tier available)

### 1. Clone & Install

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure Environment

```bash
cd server
cp .env.example .env
# Edit .env and add your OpenRouter API key
```

### 3. Run

```bash
# Terminal 1 — start the backend
cd server
npm run dev

# Terminal 2 — start the frontend
cd client
npm run dev
```

The frontend runs at `http://localhost:5173` and proxies API calls to the backend at `http://localhost:3001`.

> **First-time startup note:** The embedding model (~30 MB) downloads automatically on first use. Subsequent starts are instant.

---

## Example Usage

1. Open `http://localhost:5173` in your browser
2. Click "Choose a PDF file" and select a study document
3. Click "Process Document" — wait for "Document ready"
4. Type a question like "What are the key concepts in chapter 1?" and press Enter
5. The answer appears with page number citations

---

## Project Structure

```
server/
├── routes/
│   ├── documentRoutes.js   # PDF upload endpoint
│   └── chatRoutes.js       # Chat/question endpoint
├── services/
│   ├── ragService.js       # PDF → chunks → embeddings → vector store → retrieval
│   └── llmService.js       # OpenRouter LLM wrapper
├── graph/
│   └── workflow.js         # 2-node LangGraph StateGraph + conditional edge
├── uploads/                # Uploaded PDFs (gitignored)
├── .env.example
├── app.js                  # Express app config
└── server.js               # Entry point

client/
├── src/
│   ├── components/
│   │   ├── FileUpload.jsx  # PDF upload UI
│   │   └── Chat.jsx        # Chat messages + sources
│   ├── App.jsx             # Root layout
│   ├── main.jsx            # React entry
│   └── index.css           # Tailwind + global styles
├── tailwind.config.js
├── vite.config.js
└── index.html
```

---

## Deployment to Render

This project can be easily deployed for free on [Render.com](https://render.com) using two separate services.

### 1. Deploy the Backend (Web Service)
1. In Render, create a new **Web Service** linked to your GitHub repository.
2. **Root Directory:** `server`
3. **Environment:** `Node`
4. **Build Command:** `npm install`
5. **Start Command:** `npm start` (or `node server.js`)
6. **Environment Variables:**
   - Add `OPENROUTER_API_KEY` with your key.
7. Click **Create Web Service**. Render will automatically assign a URL (e.g., `https://studymate-api.onrender.com`).

### 2. Deploy the Frontend (Static Site)
1. In Render, create a new **Static Site** linked to the same repository.
2. **Root Directory:** `client`
3. **Build Command:** `npm install && npm run build`
4. **Publish Directory:** `client/dist`
5. **Environment Variables:**
   - Add `VITE_API_URL` set to your backend's Render URL (e.g., `https://studymate-api.onrender.com`).
6. Click **Create Static Site**.

*(Note: If you use the separate URL for the backend, you will need to update the frontend `axios.post` calls to use `import.meta.env.VITE_API_URL` instead of the relative `/api/...` path).*

---

## Future Improvements

- **Persistent vector store** — swap MemoryVectorStore for FAISS or Chroma to survive server restarts
- **Multi-document support** — allow multiple PDFs and cross-document queries
- **Streaming responses** — stream LLM output token-by-token for a better UX
- **Authentication** — add user accounts to persist chat history
- **Better PDF parsing** — use Docling or LlamaParse for complex layouts with tables/images
- **Similarity score threshold** — filter out low-relevance chunks instead of using all results

---

## License

MIT
