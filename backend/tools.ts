import "dotenv/config";
import { tavily } from "@tavily/core";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";
import * as cheerio from "cheerio";

// Initialize Tavily search client with API key from environment variables
const tvly = tavily({
  apiKey: process.env.TAVILY_API_KEY,
});

/**
 * Web Search Tool
 * Searches the web for real-time information and returns formatted source results.
 */
export const webSearchTool = tool(
  async ({ query }) => {
    try {
      // Perform search with Tavily
      const response = await tvly.search(query, {
        maxResults: 5,
        searchDepth: "advanced",
        includeAnswer: true,
      });

      if (!response.results || response.results.length === 0) {
        return `No results found for query: "${query}".`;
      }

      // Format search results with titles, URLs, and snippet contents
      return response.results
        .map(
          (result, index) =>
            `[Source ${index + 1}]: ${result.title}\nURL: ${result.url}\nContent: ${result.content}`,
        )
        .join("\n\n");
    } catch (error: any) {
      return `Search failed: ${error?.message || String(error)}`;
    }
  },
  {
    name: "web_search",
    description: "Search the live web for current and relevant information.",
    schema: z.object({
      query: z.string().describe("Search query to look up on the web"),
    }),
  },
);

/**
 * Universal web page scraper:
 * 1. Fetches HTML content from any given URL.
 * 2. Removes universal noise elements (scripts, styles, navbars, footers, forms, ads).
 * 3. Extracts clean text paragraphs and headings from the main content.
 * 4. Falls back to reader proxy if the site uses JavaScript rendering or anti-bot protection.
 */
export async function scrapePage(
  url: string,
): Promise<{ title: string; content: string }> {
  const browserHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };

  try {
    // Step 1: Fetch raw HTML
    const response = await axios.get(url, {
      headers: browserHeaders,
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);

    // Step 2: Remove universal noise elements present in web pages
    $(
      [
        // Code and style tags
        "style",
        "script",
        "noscript",
        "template",
        // Navigation and layout noise
        "nav",
        "header",
        "footer",
        "aside",
        "menu",
        // Media, frames and interactive elements
        "svg",
        "canvas",
        "iframe",
        "form",
        "button",
        "input",
        "select",
        "textarea",
        "dialog",
        // Common layout metadata, ads, and popups across websites
        "[role='navigation']",
        "[role='banner']",
        "[role='contentinfo']",
        "[class*='cookie']",
        "[class*='ad-']",
        "[class*='advertisement']",
        "[class*='popup']",
        "[class*='modal']",
        "[class*='banner']",
        "[id*='cookie']",
        "[id*='footer']",
        "[id*='sidebar']",
      ].join(", "),
    ).remove();

    // Step 3: Extract page title
    const title =
      $("meta[property='og:title']").attr("content") ||
      $("title").text().trim() ||
      $("h1").first().text().trim() ||
      "Untitled Page";

    // Step 4: Extract core text from main article elements (paragraphs and headings)
    const contentBlocks: string[] = [];
    const mainContainer = $("article, main, [role='main'], #content, .content, body").first();

    mainContainer.find("h1, h2, h3, h4, p, li, blockquote").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      // Only keep readable sentences and paragraphs (ignore empty elements and single symbols)
      if (text.length > 25) {
        contentBlocks.push(text);
      }
    });

    let content = contentBlocks.join("\n\n");

    // Fallback if the site uses non-standard markup without <p> or headings
    if (!content || content.length < 100) {
      content = mainContainer.text().replace(/\s+/g, " ").trim();
    }

    if (content.length > 100) {
      return { title, content: content.slice(0, 2500) };
    }
  } catch (_err) {
    // Direct scrape failed or site blocked scrapers; fall back to reader proxy
  }

  // Step 5: Universal fallback for heavy JavaScript SPAs or protected sites
  try {
    const fallbackResponse = await axios.get(`https://r.jina.ai/${url}`, {
      timeout: 12000,
    });
    const markdown = String(fallbackResponse.data || "");
    const cleanedContent = markdown.replace(/\s+/g, " ").trim();

    return {
      title: "Scraped Page",
      content: cleanedContent.slice(0, 3000),
    };
  } catch (fallbackError: any) {
    return {
      title: "Unavailable",
      content: `Failed to retrieve content: ${fallbackError.message}`,
    };
  }
}

/**
 * Web Scrape Tool
 * Takes any webpage URL, extracts clean readable text, and returns the result.
 */
export const webScrapeTool = tool(
  async ({ url }) => {
    try {
      const { title, content } = await scrapePage(url);
      if (!content) {
        return `Could not extract text content from ${url}`;
      }

      return `Title: ${title}\nURL: ${url}\n\nContent:\n${content}`;
    } catch (error: any) {
      return `Scraping failed for ${url}: ${error?.message || String(error)}`;
    }
  },
  {
    name: "web_scrape",
    description:
      "Fetches a webpage URL and extracts clean readable text without headers, footers, or ads.",
    schema: z.object({
      url: z.string().url().describe("The webpage URL to scrape"),
    }),
  },
);
