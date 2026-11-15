
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

// Validate Gemini API key
if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing from the .env file");
}

// Initialize Gemini client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  apiVersion: "v1beta"
});

export default ai;
