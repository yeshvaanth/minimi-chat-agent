import ai from "../config/gemini.js";

export const generateAIResponse = async (history) => {
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL,

    contents: history.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }]
    }))
  });

  return response.text;
};