
import "dotenv/config";
import { tavily } from "@tavily/core";
import { retryAsync } from "../utils/retry.js";

// Validate Tavily API key
const apiKey = process.env.TAVILY_API_KEY;

if (!apiKey) {
  throw new Error("TAVILY_API_KEY is missing. Check your .env file.");
}

// Initialize Tavily client
const tavilyClient = tavily({ apiKey });

// Search the web using Tavily
export const searchWeb = async (query) => {
  if (!query || typeof query !== "string" || !query.trim()) {
    throw new Error("A valid search query is required");
  }

  const response = await retryAsync(() =>
    tavilyClient.search(query.trim(), {
      searchDepth: "basic",
      maxResults: 5,
      includeAnswer: true,
    })
  );

  return {
    answer: response.answer,
    results: response.results.map((item) => ({
      title: item.title,
      url: item.url,
      content: item.content,
      score: item.score,
    })),
  };
};
