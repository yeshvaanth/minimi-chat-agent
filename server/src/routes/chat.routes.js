
import express from "express";

import {
  sendMessage,
  getConversations,
  getMessages,
  renameChat,
  deleteChat,
} from "../controllers/chat.controller.js";

const router = express.Router();

// Send a chat message
router.post("/", sendMessage);

// Get all conversations for a user
router.get("/conversations/:userId", getConversations);

// Get messages from a conversation
router.get("/conversations/:userId/:conversationId", getMessages);

// Rename a conversation
router.patch("/conversations/:userId/:conversationId", renameChat);

// Delete a conversation
router.delete("/conversations/:userId/:conversationId", deleteChat);

export default router;
