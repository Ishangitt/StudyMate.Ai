import { useState } from "react";
import FileUpload from "./components/FileUpload";
import Chat from "./components/Chat";

// ---------------------------------------------------------------------------
// App — root layout
//
// Manages the documentId state. Once a PDF is processed, the documentId
// is passed to Chat so it can send questions against the right document.
// ---------------------------------------------------------------------------

export default function App() {
  const [documentId, setDocumentId] = useState(null);
  const [documentName, setDocumentName] = useState("");

  return (
    <div className="min-h-screen flex flex-col">
      {/* ----------------------------------------------------------------- */}
      {/* Header                                                            */}
      {/* ----------------------------------------------------------------- */}
      <header className="relative border-b border-white/[0.06]">
        {/* Subtle gradient glow behind the header */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-violet-500/5 to-indigo-500/5" />

        <div className="relative max-w-5xl mx-auto px-6 py-6 flex items-center gap-4">
          {/* Logo icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>

          <div>
            <h1 className="text-xl font-bold gradient-text">StudyMate AI</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Ask questions from your study material
            </p>
          </div>
        </div>
      </header>

      {/* ----------------------------------------------------------------- */}
      {/* Main content                                                      */}
      {/* ----------------------------------------------------------------- */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Upload section — always visible so user can upload a new doc */}
        <FileUpload
          onDocumentReady={(id, name) => {
            setDocumentId(id);
            setDocumentName(name);
          }}
        />

        {/* Chat section — appears once a document is processed */}
        <Chat documentId={documentId} documentName={documentName} />
      </main>

      {/* ----------------------------------------------------------------- */}
      {/* Footer                                                            */}
      {/* ----------------------------------------------------------------- */}
      <footer className="border-t border-white/[0.06] py-4">
        <p className="text-center text-xs text-slate-500">
          Built with RAG, LangChain, LangGraph &amp; OpenRouter
        </p>
      </footer>
    </div>
  );
}
