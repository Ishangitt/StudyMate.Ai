// ---------------------------------------------------------------------------
// chatRoutes.js — Question answering endpoint
// ---------------------------------------------------------------------------

import { Router } from "express";
import { askQuestion } from "../graph/workflow.js";
import { isDocumentReady } from "../services/ragService.js";

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/chat
//
// Request:  { documentId: "...", question: "What is virtual memory?" }
// Response: { answer: "...", sources: [{ page: 12 }, { page: 13 }] }
//
// The question flows through the LangGraph workflow:
//   retrieveContext → (conditional) → generateAnswer or noContext → END
// ---------------------------------------------------------------------------

router.post("/", async (req, res) => {
  try {
    const { documentId, question } = req.body;

    // Validate inputs
    if (!documentId || !question) {
      return res.status(400).json({
        error: "Both 'documentId' and 'question' are required.",
      });
    }

    if (typeof question !== "string" || question.trim().length === 0) {
      return res.status(400).json({
        error: "Question cannot be empty.",
      });
    }

    // Check that the document has been processed
    if (!isDocumentReady(documentId)) {
      return res.status(404).json({
        error:
          "Document not found. Please upload and process a document first.",
      });
    }

    console.log(`❓ Question for ${documentId}: "${question.slice(0, 80)}..."`);

    // Run the LangGraph workflow
    const result = await askQuestion(documentId, question.trim());

    console.log(`💬 Answer generated (${result.sources.length} sources)`);

    return res.json({
      answer: result.answer,
      sources: result.sources,
    });
  } catch (error) {
    console.error("❌ Chat error:", error.message);

    // Never expose raw internal errors — log them, return a generic message
    return res.status(500).json({
      error:
        "Failed to generate an answer. The AI service may be temporarily unavailable. Please try again.",
    });
  }
});

export default router;
