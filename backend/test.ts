// import { webSearchTool, scrapePage } from "./tools.ts";

// const testUrls = [
//   // 1. Wikipedia (standard HTML with headings and references)
//   "https://en.wikipedia.org/wiki/Artificial_intelligence",

//   // 2. Official Documentation page (clean content structure)
//   "https://nodejs.org/en/about",

//   // 3. Technical Blog / Tutorial (articles with code/paragraphs)
//   "https://www.freecodecamp.org/news/what-is-machine-learning-definition-and-examples/",

//   // 4. MDN Web Docs (rich content with sidebars to test noise stripping)
//   "https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview",

//   // 5. Short Policy / Text page (simple minimal markup)
//   "https://news.ycombinator.com/newsguidelines.html",
// ];

// async function testScrapeTool() {
//   for (const url of testUrls) {
//     console.log(`\n--- Scraping: ${url} ---`);
//     const result = await scrapePage(url);
//     console.log(`Title: ${result.title}`);
//     console.log(`Content Preview: ${result.content}`);
//   }
// }
// testScrapeTool()
// async function testTavilySearch() {
//   const query = "latest developments in artificial intelligence";
//   console.log(`\n================ Testing Tavily Search Tool ================\nQuery: "${query}"\n`);

//   const result = await webSearchTool.invoke({ query });
//   console.log(result);
// }
// testTavilySearch()
