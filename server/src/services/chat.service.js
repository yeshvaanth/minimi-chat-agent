
import {
  createUser,
  createConversation,
  saveMessage,
  getConversationHistory,
  findMessageByClientId,
  searchHistoricalMessages
} from "../memory/chat.memory.js";

import { runAgent } from "../agent/agent.service.js";

// Process a user chat message
export const processChatMessage = async ({
  userId,
  conversationId,
  message,
  clientMessageId
}) => {
  // 1. Validate service inputs
  if (
    typeof userId !== "string" ||
    !userId.trim() ||
    typeof message !== "string" ||
    !message.trim() ||
    typeof clientMessageId !== "string" ||
    !clientMessageId.trim()
  ) {
    const error = new Error("Invalid chat request");
    error.status = 400;
    throw error;
  }

  // Normalize input
  userId = userId.trim();
  message = message.trim();
  clientMessageId = clientMessageId.trim();

  if (conversationId !== undefined &&
      conversationId !== null &&
      (typeof conversationId !== "string" || !conversationId.trim())) {
    const error = new Error("Invalid conversationId");
    error.status = 400;
    throw error;
  }

  conversationId = conversationId?.trim() || undefined;

  // 2. Create or retrieve user
  createUser(userId);

  // 3. Check for an existing request
  const existingMessage = findMessageByClientId(
    userId,
    clientMessageId
  );

  let activeConversationId = conversationId;

  if (existingMessage) {
    // Prevent reusing an ID with different content
    if (existingMessage.content !== message) {
      const error = new Error(
        "clientMessageId was reused with different content"
      );
      error.status = 409;
      throw error;
    }

    // Prevent using the ID in another conversation
    if (
      activeConversationId &&
      activeConversationId !== existingMessage.conversation_id
    ) {
      const error = new Error(
        "clientMessageId belongs to another conversation"
      );
      error.status = 409;
      throw error;
    }

    activeConversationId = existingMessage.conversation_id;

    // Return the previous response if already completed
    if (existingMessage.assistant_reply) {
      return {
        conversationId: activeConversationId,
        reply: existingMessage.assistant_reply,
        sources: [],
        duplicate: true
      };
    }

  } else {
    // 4. Create a conversation if necessary
    if (!activeConversationId) {
      activeConversationId = createConversation(
        userId,
        message.slice(0, 50)
      );
    }

    // 5. Save the user message
    saveMessage(
      activeConversationId,
      userId,
      "user",
      message,
      clientMessageId
    );
  }

  // 6. Retrieve current conversation history
  const history = getConversationHistory(
    activeConversationId,
    userId,
    20
  );

  // 7. Retrieve relevant historical context
  const historicalContext = searchHistoricalMessages(
    userId,
    message,
    5,
    activeConversationId
  );

  // 8. Execute AI agent
  let agentResult;

  try {
    agentResult = await runAgent(
      history,
      historicalContext
    );

  } catch (error) {
    console.error("Agent execution failed:", error.message);

    // Preserve existing error status
    if (!error.status) {
      error.status = 503;
    }

    throw error;
  }

  // 9. Validate agent response
  if (
    !agentResult ||
    typeof agentResult.reply !== "string" ||
    !agentResult.reply.trim()
  ) {
    const error = new Error("AI agent returned an invalid response");
    error.status = 502;
    throw error;
  }

  // 10. Save assistant response
  saveMessage(
    activeConversationId,
    userId,
    "assistant",
    agentResult.reply,
    null,
    clientMessageId
  );

  // 11. Return final response
  return {
    conversationId: activeConversationId,
    reply: agentResult.reply,
    sources: Array.isArray(agentResult.sources)
      ? agentResult.sources
      : [],
    duplicate: false
  };
};
