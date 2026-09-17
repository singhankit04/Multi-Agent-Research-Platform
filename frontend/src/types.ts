export interface ResearchAgentResult {
  summary: string;
  links: string[];
  durationMs: number;
}

export interface ScrapeAgentResult {
  targetUrls: string[];
  scrapedSummary: string;
  durationMs: number;
}

export interface WriterChainResult {
  report: string;
  durationMs: number;
}

export interface CriticChainResult {
  critique: string;
  durationMs: number;
}

export interface PipelineStepsResult {
  researchAgent?: ResearchAgentResult;
  scrapeAgent?: ScrapeAgentResult;
  writerChain?: WriterChainResult;
  criticChain?: CriticChainResult;
}

export interface PipelineFinalOutput {
  topic: string;
  status: "completed" | "failed";
  startTime: string;
  endTime: string;
  totalDurationMs: number;
  steps: PipelineStepsResult;
  finalReport?: string;
  critique?: string;
  sources?: string[];
  error?: string;
}

export interface ApiResponse {
  success: boolean;
  data?: PipelineFinalOutput;
  error?: string;
}
