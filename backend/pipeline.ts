import "dotenv/config";
import {
  runResearchAgent,
  runScrapeAgent,
  runWriterChain,
  runCriticChain,
} from "./agents.js";

/**
 * Type definitions for each step's state in the pipeline.
 * This structure will be sent to the frontend to visualize progress and results.
 */

export interface StepState<T = any> {
  name: string;
  status: "idle" | "running" | "completed" | "failed";
  data?: T;
  error?: string;
  timestamp?: string;
}

export interface SearchAgentData {
  summary: string;
  links: string[];
}

export interface ScrapeAgentData {
  targetUrls: string[];
  content: string;
}

export interface WriterChainData {
  report: string;
}

export interface CriticChainData {
  critique: string;
}

export interface PipelineState {
  topic: string;
  status: "idle" | "in_progress" | "completed" | "failed";
  startTime: string;
  endTime?: string;
  error?: string;
  steps: {
    "search agent": StepState<SearchAgentData>;
    "scrape agent": StepState<ScrapeAgentData>;
    "writer chain": StepState<WriterChainData>;
    "critic chain": StepState<CriticChainData>;
  };
}

/**
 * Initializes a clean pipeline state object
 */
function createInitialState(topic: string): PipelineState {
  return {
    topic,
    status: "idle",
    startTime: new Date().toISOString(),
    steps: {
      "search agent": {
        name: "search agent",
        status: "idle",
      },
      "scrape agent": {
        name: "scrape agent",
        status: "idle",
      },
      "writer chain": {
        name: "writer chain",
        status: "idle",
      },
      "critic chain": {
        name: "critic chain",
        status: "idle",
      },
    },
  };
}

/**
 * Main Pipeline Runner
 * Executes the 4 stages sequentially:
 * 1. Web Search Agent: Gathers initial facts and discovers relevant URLs
 * 2. Scrape Agent: Scrapes and cleans detailed contents from discovered URLs
 * 3. Writer Chain: Writes a structured research report from scraped data
 * 4. Critic Chain: Evaluates and grades the report with constructive feedback
 *
 * @param topic The research topic/query
 * @param onProgress Optional callback fired whenever any step starts or updates
 */
export async function runResearchPipeline(
  topic: string,
  onProgress?: (state: PipelineState) => void,
): Promise<PipelineState> {
  const state = createInitialState(topic);
  state.status = "in_progress";

  const notify = () => {
    if (onProgress) {
      onProgress(JSON.parse(JSON.stringify(state)));
    }
  };

  notify();

  try {
    // ---------------------------------------------------------
    // STEP 1: Web Search Agent
    // ---------------------------------------------------------
    state.steps["search agent"].status = "running";
    state.steps["search agent"].timestamp = new Date().toISOString();
    notify();

    const searchResult = await runResearchAgent(topic);

    state.steps["search agent"].status = "completed";
    state.steps["search agent"].data = {
      summary: searchResult.summary,
      links: searchResult.links,
    };
    state.steps["search agent"].timestamp = new Date().toISOString();
    notify();

    // ---------------------------------------------------------
    // STEP 2: Scrape Agent
    // ---------------------------------------------------------
    state.steps["scrape agent"].status = "running";
    state.steps["scrape agent"].timestamp = new Date().toISOString();

    // Select top URLs found by the search agent (limit to top 3 for optimal speed & token limits)
    const targetUrls = searchResult.links.slice(0, 3);
    state.steps["scrape agent"].data = {
      targetUrls,
      content: "",
    };
    notify();

    let scrapedContent = "";
    if (targetUrls.length > 0) {
      scrapedContent = await runScrapeAgent(targetUrls);
    } else {
      // Fallback if no specific URLs were extracted: use search summary
      scrapedContent = searchResult.summary;
    }

    state.steps["scrape agent"].status = "completed";
    state.steps["scrape agent"].data = {
      targetUrls,
      content: scrapedContent,
    };
    state.steps["scrape agent"].timestamp = new Date().toISOString();
    notify();

    // ---------------------------------------------------------
    // STEP 3: Writer Chain (LCEL)
    // ---------------------------------------------------------
    state.steps["writer chain"].status = "running";
    state.steps["writer chain"].timestamp = new Date().toISOString();
    notify();

    const report = await runWriterChain(scrapedContent, topic);

    state.steps["writer chain"].status = "completed";
    state.steps["writer chain"].data = {
      report,
    };
    state.steps["writer chain"].timestamp = new Date().toISOString();
    notify();

    // ---------------------------------------------------------
    // STEP 4: Critic Chain (LCEL)
    // ---------------------------------------------------------
    state.steps["critic chain"].status = "running";
    state.steps["critic chain"].timestamp = new Date().toISOString();
    notify();

    const critique = await runCriticChain(report);

    state.steps["critic chain"].status = "completed";
    state.steps["critic chain"].data = {
      critique,
    };
    state.steps["critic chain"].timestamp = new Date().toISOString();
    notify();

    // Complete overall pipeline
    state.status = "completed";
    state.endTime = new Date().toISOString();
    notify();

    return state;
  } catch (error: any) {
    state.status = "failed";
    state.error = error?.message || String(error);
    state.endTime = new Date().toISOString();
    notify();
    throw error;
  }
}
