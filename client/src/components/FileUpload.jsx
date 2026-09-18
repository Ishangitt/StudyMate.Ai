import { useState, useRef } from "react";
import axios from "axios";

// ---------------------------------------------------------------------------
// Status progression shown to the user during processing
// ---------------------------------------------------------------------------

const STATUS_MESSAGES = {
  idle: null,
  uploading: "Uploading PDF...",
  processing: "Processing document & creating embeddings...",
  ready: "Document ready — ask your questions below!",
  error: null, // error message is dynamic
};

export default function FileUpload({ onDocumentReady }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | uploading | processing | ready | error
  const [errorMsg, setErrorMsg] = useState("");
  const [chunkCount, setChunkCount] = useState(0);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      // Reset state for a new file
      setFile(selected);
      setStatus("idle");
      setErrorMsg("");
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    // Validate file type client-side (server also validates)
    if (file.type !== "application/pdf") {
      setStatus("error");
      setErrorMsg("Please select a PDF file.");
      return;
    }

    try {
      setStatus("uploading");

      const formData = new FormData();
      formData.append("pdf", file);

      // Short delay so the "uploading" state is visible
      setStatus("processing");

      const apiUrl = import.meta.env.VITE_API_URL || "";
      const response = await axios.post(`${apiUrl}/api/documents/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const { documentId, chunkCount: chunks, filename } = response.data;

      setChunkCount(chunks);
      setStatus("ready");
      onDocumentReady(documentId, filename);
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err.response?.data?.error || "Failed to process the document. Please try again."
      );
    }
  };

  const handleReset = () => {
    setFile(null);
    setStatus("idle");
    setErrorMsg("");
    setChunkCount(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isProcessing = status === "uploading" || status === "processing";

  return (
    <section id="upload-section" className="glass-card p-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
          <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-slate-200">Upload Document</h2>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* File picker */}
        <label
          htmlFor="pdf-input"
          className={`
            flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed
            transition-all duration-300 cursor-pointer
            ${file
              ? "border-indigo-500/30 bg-indigo-500/5"
              : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
            }
            ${isProcessing ? "opacity-50 pointer-events-none" : ""}
          `}
        >
          <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <span className="text-sm text-slate-300 truncate">
            {file ? file.name : "Choose a PDF file..."}
          </span>
          <input
            ref={fileInputRef}
            id="pdf-input"
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            disabled={isProcessing}
            className="hidden"
          />
        </label>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            id="process-btn"
            onClick={handleUpload}
            disabled={!file || isProcessing}
            className="btn-primary whitespace-nowrap"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing...
              </span>
            ) : (
              "Process Document"
            )}
          </button>

          {status === "ready" && (
            <button onClick={handleReset} className="btn-secondary whitespace-nowrap">
              New File
            </button>
          )}
        </div>
      </div>

      {/* Status messages */}
      {status !== "idle" && (
        <div className={`mt-4 flex items-center gap-2 text-sm animate-fade-in ${
          status === "error"
            ? "text-red-400"
            : status === "ready"
            ? "text-emerald-400"
            : "text-indigo-300"
        }`}>
          {status === "ready" && (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {status === "error" && (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span>
            {status === "error" ? errorMsg : STATUS_MESSAGES[status]}
            {status === "ready" && (
              <span className="text-slate-500 ml-2">({chunkCount} chunks created)</span>
            )}
          </span>
        </div>
      )}
    </section>
  );
}
