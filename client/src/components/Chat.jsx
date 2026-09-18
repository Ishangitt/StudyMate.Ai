import { useState, useRef, useEffect } from "react";
import axios from "axios";

export default function Chat({ documentId, documentName }) {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when document becomes ready
  useEffect(() => {
    if (documentId) {
      inputRef.current?.focus();
    }
  }, [documentId]);

  // Reset chat when a new document is uploaded
  useEffect(() => {
    if (documentId) {
      setMessages([]);
    }
  }, [documentId]);

  const handleAsk = async () => {
    const trimmed = question.trim();
    if (!trimmed || !documentId || isLoading) return;

    // Add the user's message to the chat
    const userMsg = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setIsLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || "";
      const response = await axios.post(`${apiUrl}/api/chat`, {
        documentId,
        question: trimmed,
      });

      const { answer, sources } = response.data;

      const assistantMsg = {
        role: "assistant",
        content: answer,
        sources: sources || [],
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg = {
        role: "assistant",
        content:
          err.response?.data?.error ||
          "Something went wrong. The AI service may be temporarily unavailable.",
        isError: true,
        sources: [],
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  // If no document is uploaded yet, show a placeholder
  if (!documentId) {
    return (
      <section id="chat-section" className="glass-card p-8 flex-1 flex items-center justify-center animate-fade-in">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
          </div>
          <p className="text-slate-400 text-sm">
            Upload and process a PDF document to start asking questions.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="chat-section" className="glass-card flex-1 flex flex-col animate-fade-in overflow-hidden" style={{ minHeight: "480px" }}>
      {/* Chat header */}
      <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-slow" />
        <span className="text-sm text-slate-300">
          Chatting about <span className="text-indigo-400 font-medium">{documentName}</span>
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-slate-500 text-center">
              Ask a question about your document to get started.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`animate-slide-up ${
              msg.role === "user" ? "flex justify-end" : "flex justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-5 py-3.5 ${
                msg.role === "user"
                  ? "bg-gradient-to-r from-indigo-500/20 to-violet-500/20 border border-indigo-500/20 text-slate-200"
                  : msg.isError
                  ? "bg-red-500/10 border border-red-500/20 text-red-300"
                  : "bg-white/[0.04] border border-white/[0.06] text-slate-300"
              }`}
            >
              {/* Role label */}
              <div className={`text-xs font-medium mb-1.5 ${
                msg.role === "user" ? "text-indigo-400" : msg.isError ? "text-red-400" : "text-violet-400"
              }`}>
                {msg.role === "user" ? "You" : "StudyMate AI"}
              </div>

              {/* Message content */}
              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {msg.content}
              </div>

              {/* Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/[0.06]">
                  <div className="text-xs font-medium text-slate-400 mb-1.5">Sources</div>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.sources.map((source, sIdx) => (
                      <span
                        key={sIdx}
                        className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-500/10 text-xs text-indigo-300 border border-indigo-500/15"
                      >
                        <svg className="w-3 h-3 mr-1 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        Page {source.page}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl px-5 py-4">
              <div className="text-xs font-medium text-violet-400 mb-2">StudyMate AI</div>
              <div className="loading-dots flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="px-6 py-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            id="question-input"
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Ask a question about your document..."
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all duration-300 disabled:opacity-50"
          />
          <button
            id="ask-btn"
            onClick={handleAsk}
            disabled={!question.trim() || isLoading}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            Ask
          </button>
        </div>
      </div>
    </section>
  );
}
