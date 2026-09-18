import express from "express";
import cors from "cors";
import documentRoutes from "./routes/documentRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";

const app = express();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

// Parse JSON bodies (for the /api/chat endpoint)
app.json = express.json;
app.use(express.json());

// Allow cross-origin requests from any domain (useful for Render deployment)
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
  })
);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use("/api/documents", documentRoutes);
app.use("/api/chat", chatRoutes);

// Simple health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

export default app;
