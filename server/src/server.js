
import "dotenv/config";

import express from "express";
import cors from "cors";

import chatRoutes from "./routes/chat.routes.js";
import createTables from "./config/initDatabase.js";

// Validate required environment variables
if (!process.env.CLIENT_URL) {
  throw new Error("CLIENT_URL is missing from the .env file");
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL
}));

app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Minimi backend is running"
  });
});

// Chat API routes
app.use("/api/chat", chatRoutes);

// Initialize database and start server
const startServer = () => {
  try {
    createTables();

    app.listen(PORT, () => {
      console.log(`Minimi server running on port ${PORT}`);
    });

  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
