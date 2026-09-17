import "dotenv/config";
import { ChatGroq } from "@langchain/groq";
import { ChatMistralAI } from "@langchain/mistralai";
import { createAgent } from "langchain";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { webSearchTool, webScrapeTool } from "./tools.js";

// 1. Research Model: Groq Compound
const researchModel = new ChatGroq({
  model: "openai/gpt-oss-20b",
  apiKey: process.env.GROQ_API_KEY,
  temperature: 0,
});

// 2. Scrape Model: Groq Compound Mini
const scrapeModel = new ChatGroq({
  model: "qwen/qwen3.8-27b",
  apiKey: process.env.GROQ_API_KEY,
  temperature: 0,
});

// 3. Writer Model: GPT-OSS 120B on Groq
const writerModel = new ChatGroq({
  model: "openai/gpt-oss-120b",
  apiKey: process.env.GROQ_API_KEY,
  temperature: 0,
});

// 4. Critic Model: Qwen 3.8 27B on Groq
const criticModel = new ChatGroq({
  model: "openai/gpt-oss-120b",
  apiKey: process.env.GROQ_API_KEY,
  temperature: 0,
});

/**
 * Helper function to extract URLs from text and tool outputs
 */
function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s"',)]+/g) || [];
  const uniqueUrls: string[] = [];
  for (const url of matches) {
    if (!uniqueUrls.includes(url)) {
      uniqueUrls.push(url);
    }
  }
  return uniqueUrls;
}

/**
 * -------------------------------------------------------------
 * 1. RESEARCH AGENT (Web Search)
 * -------------------------------------------------------------
 * Searches the web for the given topic, synthesizes key information,
 * and extracts relevant source URLs to pass to downstream scrapers.
 */
export const researchAgent = createAgent({
  model: researchModel,
  tools: [webSearchTool],
  systemPrompt: `You are a real-time web research agent.
Your responsibilities:
1. Always use the 'web_search' tool to find the most current and relevant information. If the dedicated year is not mentioned, then search for the current year information only.
2. Synthesize key trends, facts, and developments clearly.
3. Always include the source URLs and citations in your response.
4. Keep the summary in 400-500 words`,
});

export async function runResearchAgent(
  query: string,
): Promise<{ summary: string; links: string[] }> {
  const result = await researchAgent.invoke({
    messages: [{ role: "user", content: query }],
  });

  // Extract the final response message
  const lastMessage = result.messages[result.messages.length - 1];
  const summary =
    typeof lastMessage.content === "string"
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);

  // Collect all URLs from message history and tool outputs
  const links: string[] = [];
  for (const msg of result.messages) {
    const contentStr =
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content);
    const foundUrls = extractUrls(contentStr);
    for (const u of foundUrls) {
      if (!links.includes(u)) {
        links.push(u);
      }
    }
  }

  return { summary, links };
}

/**
 * -------------------------------------------------------------
 * 2. SCRAPE AGENT (Web Content Scraper & Analyst)
 * -------------------------------------------------------------
 * Scrapes target web pages and extracts detailed takeaways, core data,
 * and key arguments from each page.
 */
export const scrapeAgent = createAgent({
  model: scrapeModel,
  tools: [webScrapeTool],
  systemPrompt: `You are a web scraping and content extraction agent.
Your responsibilities:
1. Use the 'web_scrape' tool to fetch and extract readable text from provided URLs.
2. Extract detailed insights, technical information, key arguments, and statistics.
3. Organize findings clearly by source URL.
4. Keep the summary around 200 words`,
});

export async function runScrapeAgent(
  researchSummary: string,
  urls: string | string[],
): Promise<string> {
  const urlList = Array.isArray(urls) ? urls : [urls];
  if (urlList.length === 0) {
    return "No URLs provided for scraping.";
  }

  const prompt = `based on the following research summary pick thme most relavent urls and extract the full content from the them, then make a summary of the content:\n\nResearch Summary:${researchSummary}\n\n URLs:\n\n${urlList
    .map((url, i) => `${i + 1}. ${url}`)
    .join("\n")}`;

  const result = await scrapeAgent.invoke({
    messages: [{ role: "user", content: prompt }],
  });

  const lastMessage = result.messages[result.messages.length - 1];
  return typeof lastMessage.content === "string"
    ? lastMessage.content
    : JSON.stringify(lastMessage.content);
}

/**
 * -------------------------------------------------------------
 * 3. WRITER CHAIN (LCEL Pipeline)
 * -------------------------------------------------------------
 * Takes the raw scraped content and synthesizes it into a comprehensive,
 * structured, and professional research report.
 */
const writerPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a professional research report writer.
Your goal is to write a comprehensive, clear, and well-structured report based on the provided scraped content and research data.

Structure of the report:
1. Executive Summary: High-level overview of the findings.
2. Key Findings & Detailed Analysis: Detailed breakdown with core points and evidence.
3. Emerging Trends & Implications: What this means moving forward.
4. Sources & References: Mention cited URLs and references.

Maintain an objective, analytical tone and format clearly with markdown headings. You have to use all the information provided by the research agent and the scrape agent to generate the final comprehensive research report.`,
  ],
  [
    "user",
    `Topic: {topic}

Web Research Content:
{researchContent}

Scraped Content:
{scrapedContent}

Please generate the final comprehensive research report around 200 words.`,
  ],
]);

export const writerChain = writerPrompt
  .pipe(writerModel)
  .pipe(new StringOutputParser());

export async function runWriterChain(
  scrapedContent: string,
  researchContent: string,
  topic: string = "Research Report",
): Promise<string> {
  return writerChain.invoke({
    topic,
    researchContent,
    scrapedContent,
  });
}

/**
 * -------------------------------------------------------------
 * 4. CRITIC CHAIN (LCEL Pipeline)
 * -------------------------------------------------------------
 * Reviews the report generated by the writer chain, evaluates quality,
 * assigns a score out of 100, identifies faults/gaps, and provides actionable suggestions.
 */
const criticPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are an expert editorial critic and peer reviewer.
Evaluate the provided research report rigorously based on:
- Accuracy & Depth: Are claims substantiated with evidence from sources?
- Structure & Clarity: Is the report well-organized, readable, and cohesive?
- Objectivity & Balance: Does it cover various viewpoints without unjustified bias?
- Missing Information: Are there obvious gaps or omitted details?

Format your critique as follows:
1. Overall Rating: Score out of 100 (e.g., Score: 85/100)
2. Strengths: What was done well.
3. Identified Faults & Weaknesses: Specific flaws, logical gaps, or unsupported claims.
4. Suggestions for Improvement: Clear, actionable recommendations to improve the report.
5. One line verdict about the report`,
  ],
  [
    "user",
    `Report to critique:

{report}`,
  ],
]);

export const criticChain = criticPrompt
  .pipe(criticModel)
  .pipe(new StringOutputParser());

export async function runCriticChain(report: string): Promise<string> {
  return criticChain.invoke({
    report,
  });
}
