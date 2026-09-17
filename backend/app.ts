import express, { type Request, type Response } from "express";
import cors from "cors";
import { runResearchPipeline } from "./llmWork/pipeline.js";

const app = express();

// Standard middleware
app.use(cors());
app.use(express.json());

// Health check endpoints
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({ message: "Multi-Agent AI Research Backend is running" });
});


app.post("/api/research", async (req: Request, res: Response) => {
  try {
    const { topic } = req.body;

    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return res.status(400).json({
        success: false,
        error: "A valid 'topic' string is required in the request body.",
      });
    }

    const result = await runResearchPipeline(topic.trim());

    if (result.status === "failed") {
      return res.status(500).json({
        success: false,
        error: result.error || "Research pipeline failed during execution.",
        data: result,
      });
    }

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Internal server error occurred while processing research request.",
    });
  }
});

export default app;
