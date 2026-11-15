
import { processChatMessage } from "../services/chat.service.js";

import {
  getUserConversations,
  getConversationHistory,
  renameConversation,
  deleteConversation,
} from "../memory/chat.memory.js";

// 1. Send a chat message
export const sendMessage = async (req, res) => {
  try {
    const {
      userId,
      conversationId,
      message,
      clientMessageId,
    } = req.body;

    if (
      typeof userId !== "string" ||
      !userId.trim() ||
      typeof message !== "string" ||
      !message.trim() ||
      typeof clientMessageId !== "string" ||
      !clientMessageId.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid userId, message and clientMessageId are required",
      });
    }

    if (
      conversationId !== undefined &&
      conversationId !== null &&
      (typeof conversationId !== "string" || !conversationId.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversationId",
      });
    }

    const result = await processChatMessage({
      userId: userId.trim(),
      conversationId: conversationId?.trim() || undefined,
      message: message.trim(),
      clientMessageId: clientMessageId.trim(),
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Chat controller error:", error.message);

    const statusMessages = {
      409: error.message,
      404: "Conversation not found or access denied",
      429: "AI service quota exceeded. Please try again later.",
      503: "AI service is temporarily unavailable. Please try again.",
    };

    const status = [409, 404, 429, 503].includes(error.status)
      ? error.status
      : 500;

    return res.status(status).json({
      success: false,
      message:
        statusMessages[status] ||
        "Something went wrong while processing your message.",
    });
  }
};

// 2. Get all conversations
export const getConversations = (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId?.trim()) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    const conversations = getUserConversations(userId.trim());

    return res.status(200).json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    console.error("Get conversations error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve conversations",
    });
  }
};

// 3. Get messages from a conversation
export const getMessages = (req, res) => {
  try {
    const { userId, conversationId } = req.params;

    if (!userId?.trim() || !conversationId?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Valid userId and conversationId are required",
      });
    }

    const messages = getConversationHistory(
      conversationId.trim(),
      userId.trim(),
      100
    );

    return res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error("Get messages error:", error.message);

    const status = error.status === 404 ? 404 : 500;

    return res.status(status).json({
      success: false,
      message:
        status === 404
          ? "Conversation not found or access denied"
          : "Unable to retrieve messages",
    });
  }
};

// 4. Rename a conversation
export const renameChat = (req, res) => {
  try {
    const { userId, conversationId } = req.params;
    const { title } = req.body;

    if (!userId?.trim() || !conversationId?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Valid userId and conversationId are required",
      });
    }

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "A valid conversation title is required",
      });
    }

    if (title.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: "Conversation title cannot exceed 100 characters",
      });
    }

    const updated = renameConversation(
      conversationId.trim(),
      userId.trim(),
      title.trim()
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found or access denied",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Conversation renamed successfully",
    });
  } catch (error) {
    console.error("Rename conversation error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to rename conversation",
    });
  }
};

// 5. Delete a conversation
export const deleteChat = (req, res) => {
  try {
    const { userId, conversationId } = req.params;

    if (!userId?.trim() || !conversationId?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Valid userId and conversationId are required",
      });
    }

    const deleted = deleteConversation(
      conversationId.trim(),
      userId.trim()
    );

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found or access denied",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Conversation deleted successfully",
    });
  } catch (error) {
    console.error("Delete conversation error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to delete conversation",
    });
  }
};
