// ---------------------------------------------------------------------------
// documentRoutes.js — PDF upload and processing endpoint
// ---------------------------------------------------------------------------

import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { processDocument } from "../services/ragService.js";

const router = Router();

// ESM equivalent of __dirname (works correctly on Windows)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Multer config — store uploads in server/uploads/ with unique filenames
// ---------------------------------------------------------------------------

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, "..", "uploads"));
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    // Only accept PDF files
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed."), false);
    }
  },
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB max
  },
});

// ---------------------------------------------------------------------------
// POST /api/documents/upload
//
// 1. Receive the PDF via multipart form data
// 2. Generate a unique document ID
// 3. Run the RAG pipeline: load → chunk → embed → store
// 4. Return the document ID and chunk count
// ---------------------------------------------------------------------------

router.post("/upload", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file provided." });
    }

    const documentId = uuidv4();
    const filePath = req.file.path;

    console.log(`📄 Processing document: ${req.file.originalname} (${documentId})`);

    const result = await processDocument(filePath, documentId);

    console.log(`✅ Document ready: ${result.chunkCount} chunks created`);

    return res.json({
      documentId: result.documentId,
      chunkCount: result.chunkCount,
      filename: req.file.originalname,
      status: "ready",
    });
  } catch (error) {
    console.error("❌ Document processing failed:", error.message);

    // Never expose internal errors to the client
    return res.status(500).json({
      error:
        error.message === "The PDF appears to be empty or unreadable."
          ? error.message
          : "Failed to process the document. Please try again.",
    });
  }
});

// Multer error handling (file too large, wrong type, etc.)
router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File is too large. Maximum size is 20 MB." });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err.message === "Only PDF files are allowed.") {
    return res.status(400).json({ error: err.message });
  }
  return res.status(500).json({ error: "An unexpected error occurred." });
});

export default router;
