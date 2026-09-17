import "dotenv/config";
import {
  runResearchAgent,
  runScrapeAgent,
  runWriterChain,
  runCriticChain,
} from "./agents.js";

/**
 * -------------------------------------------------------------
 * Pipeline Output Types
 * -------------------------------------------------------------
 * Structure holding the final consolidated results from each agent
 * and chain in the research pipeline.
 */

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

/**
 * Runs the multi-agent research pipeline in a sequential flow and returns
 * a single consolidated JSON object containing the results of each stage.
 *
 * Sequence:
 * 1. Research Agent: Performs web search -> extracts facts summary & URLs
 * 2. Scrape Agent: Scrapes target URLs & synthesizes detailed page contents
 * 3. Writer Chain: Writes a comprehensive structured report
 * 4. Critic Chain: Critiques, evaluates, and scores the report
 *
 * @param topic The research query or topic
 * @returns A single consolidated PipelineFinalOutput object
 */
export async function runResearchPipeline(
  topic: string,
): Promise<PipelineFinalOutput> {
  const startTime = new Date().toISOString();
  const pipelineStart = Date.now();
  const steps: PipelineStepsResult = {};

  try {
    // ---------------------------------------------------------
    // 1. Research Agent (Web Search)
    // ---------------------------------------------------------
    const step1Start = Date.now();
    const researchResult = await runResearchAgent(topic);
    steps.researchAgent = {
      summary: researchResult.summary,
      links: researchResult.links,
      durationMs: Date.now() - step1Start,
    };
    // console.log("Research Agent:", researchResult.summary)

    // ---------------------------------------------------------
    // 2. Scrape Agent (Web Content Extraction & Analysis)
    // ---------------------------------------------------------
    const step2Start = Date.now();
    const targetUrls = researchResult.links.slice(0, 4);

    let scrapedSummary = "";
    if (targetUrls.length > 0) {
      scrapedSummary = await runScrapeAgent(researchResult.summary, targetUrls);
    } else {
      scrapedSummary =
        "No URLs were found to scrape. Used initial research summary.";
    }

    steps.scrapeAgent = {
      targetUrls,
      scrapedSummary,
      durationMs: Date.now() - step2Start,
    };

    // console.log("Scrape Agent:", scrapedSummary)
    // ---------------------------------------------------------
    // 3. Writer Chain (LCEL Comprehensive Report Synthesis)
    // ---------------------------------------------------------
    const step3Start = Date.now();
    const report = await runWriterChain(
      scrapedSummary,
      researchResult.summary,
      topic,
    );
    steps.writerChain = {
      report,
      durationMs: Date.now() - step3Start,
    };
    // console.log("Writer Chain:", report)

    // ---------------------------------------------------------
    // 4. Critic Chain (LCEL Editorial Review & Scoring)
    // ---------------------------------------------------------
    const step4Start = Date.now();
    const critique = await runCriticChain(report);
    steps.criticChain = {
      critique,
      durationMs: Date.now() - step4Start,
    };

    const endTime = new Date().toISOString();
    const totalDurationMs = Date.now() - pipelineStart;

    // Return the complete final object
    return {
      topic,
      status: "completed",
      startTime,
      endTime,
      totalDurationMs,
      steps,
      finalReport: report,
      critique,
      sources: researchResult.links,
    };
  } catch (error: any) {
    const endTime = new Date().toISOString();
    const totalDurationMs = Date.now() - pipelineStart;

    return {
      topic,
      status: "failed",
      startTime,
      endTime,
      totalDurationMs,
      steps,
      error: error?.message || String(error),
    };
  }
}
