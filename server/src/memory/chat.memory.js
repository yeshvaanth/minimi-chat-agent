
import db from "../config/database.js";
import { randomUUID } from "crypto";

// 1. Create or retrieve a user
export const createUser = (userId) => {
  db.prepare(`
    INSERT OR IGNORE INTO users (user_id)
    VALUES (?)
  `).run(userId);

  return db.prepare(`
    SELECT id, user_id
    FROM users
    WHERE user_id = ?
  `).get(userId);
};

// 2. Create a conversation
export const createConversation = (
  userId,
  title = "New conversation"
) => {
  const user = createUser(userId);
  const conversationId = randomUUID();

  db.prepare(`
    INSERT INTO conversations (
      conversation_id,
      user_id,
      title
    )
    VALUES (?, ?, ?)
  `).run(conversationId, user.id, title);

  return conversationId;
};

// 3. Save a message
export const saveMessage = (
  conversationId,
  userId,
  role,
  content,
  clientMessageId = null,
  responseToClientMessageId = null
) => {
  const conversation = db.prepare(`
    SELECT c.id
    FROM conversations c
    JOIN users u ON c.user_id = u.id
    WHERE c.conversation_id = ?
      AND u.user_id = ?
  `).get(conversationId, userId);

  if (!conversation) {
    const error = new Error(
      "Conversation not found or access denied"
    );
    error.status = 404;
    throw error;
  }

  const messageId = randomUUID();

  db.prepare(`
    INSERT INTO messages (
      message_id,
      conversation_id,
      role,
      content,
      client_message_id,
      response_to_client_message_id
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    messageId,
    conversation.id,
    role,
    content,
    clientMessageId,
    responseToClientMessageId
  );

  db.prepare(`
    UPDATE conversations
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(conversation.id);

  return messageId;
};

// 4. Retrieve current conversation history
export const getConversationHistory = (
  conversationId,
  userId,
  limit = 20
) => {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new TypeError("History limit must be a positive integer");
  }

  const conversation = db.prepare(`
    SELECT c.id
    FROM conversations c
    JOIN users u ON c.user_id = u.id
    WHERE c.conversation_id = ?
      AND u.user_id = ?
  `).get(conversationId, userId);

  if (!conversation) {
    const error = new Error(
      "Conversation not found or access denied"
    );
    error.status = 404;
    throw error;
  }

  const messages = db.prepare(`
    SELECT role, content, created_at
    FROM messages
    WHERE conversation_id = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(conversation.id, limit);

  return messages.reverse();
};

// 5. Retrieve all conversations for a user
export const getUserConversations = (userId) => {
  return db.prepare(`
    SELECT
      c.conversation_id,
      c.title,
      c.created_at,
      c.updated_at,
      (
        SELECT content
        FROM messages
        WHERE conversation_id = c.id
        ORDER BY id DESC
        LIMIT 1
      ) AS last_message
    FROM conversations c
    JOIN users u ON u.id = c.user_id
    WHERE u.user_id = ?
    ORDER BY c.updated_at DESC
  `).all(userId);
};

// 6. Rename a conversation
export const renameConversation = (
  conversationId,
  userId,
  title
) => {
  const conversation = db.prepare(`
    SELECT c.id
    FROM conversations c
    JOIN users u ON u.id = c.user_id
    WHERE c.conversation_id = ?
      AND u.user_id = ?
  `).get(conversationId, userId);

  if (!conversation) {
    return false;
  }

  db.prepare(`
    UPDATE conversations
    SET title = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title, conversation.id);

  return true;
};

// 7. Delete a conversation
export const deleteConversation = (
  conversationId,
  userId
) => {
  const conversation = db.prepare(`
    SELECT c.id
    FROM conversations c
    JOIN users u ON c.user_id = u.id
    WHERE c.conversation_id = ?
      AND u.user_id = ?
  `).get(conversationId, userId);

  if (!conversation) {
    return false;
  }

  let transactionStarted = false;

  try {
    db.exec("BEGIN TRANSACTION");
    transactionStarted = true;

    // Delete messages first to activate FTS5 delete triggers
    db.prepare(`
      DELETE FROM messages
      WHERE conversation_id = ?
    `).run(conversation.id);

    // Delete the conversation
    db.prepare(`
      DELETE FROM conversations
      WHERE id = ?
    `).run(conversation.id);

    db.exec("COMMIT");
    transactionStarted = false;

    return true;
  } catch (error) {
    if (transactionStarted) {
      try {
        db.exec("ROLLBACK");
      } catch {
        // Preserve the original database error
      }
    }

    throw error;
  }
};

// 8. Find an existing message using its client ID
export const findMessageByClientId = (
  userId,
  clientMessageId
) => {
  return db.prepare(`
    SELECT
      c.conversation_id,
      user_message.message_id,
      user_message.content,
      assistant_message.content AS assistant_reply
    FROM conversations c
    JOIN users u ON c.user_id = u.id
    JOIN messages user_message
      ON user_message.conversation_id = c.id
    LEFT JOIN messages assistant_message
      ON assistant_message.response_to_client_message_id =
         user_message.client_message_id
    WHERE u.user_id = ?
      AND user_message.client_message_id = ?
      AND user_message.role = 'user'
  `).get(userId, clientMessageId);
};

// 9. Search historical messages across conversations

export const searchHistoricalMessages = (
  userId,
  query,
  limit = 3,
  excludeConversationId = null
) => {
  if (!Number.isInteger(limit) || limit < 1) {
    return [];
  }

  const stopWords = new Set([
    "what", "when", "where", "which", "who",
    "did", "does", "the", "and", "for",
    "are", "was", "were", "you", "your",
    "our", "about", "from", "with", "that",
    "this", "have", "has", "had", "previous",
    "earlier", "conversation", "conversations",
    "remember", "tell", "please"
  ]);

  const keywords = [
    ...new Set(
      (query.toLowerCase().match(/[a-z0-9]+/g) || [])
        .filter(
          (word) => word.length > 2 && !stopWords.has(word)
        )
    )
  ];

  if (!keywords.length) {
    return [];
  }

  // Build a safe FTS5 query from extracted keywords
  const ftsQuery = keywords
    .map((word) => `"${word}"`)
    .join(" OR ");

  // Calculate BM25 scores before grouping conversations
  const matchingConversations = db.prepare(`
    WITH matching_messages AS MATERIALIZED (
      SELECT
        m.conversation_id,
        bm25(messages_fts) AS relevance
      FROM messages_fts
      JOIN messages m ON m.id = messages_fts.rowid
      JOIN conversations c ON c.id = m.conversation_id
      JOIN users u ON u.id = c.user_id
      WHERE messages_fts MATCH ?
        AND u.user_id = ?
        AND (? IS NULL OR c.conversation_id != ?)
    )
    SELECT
      c.id,
      c.conversation_id,
      c.title AS conversation_title,
      MIN(mm.relevance) AS relevance,
      COUNT(*) AS matching_messages,
      c.updated_at AS last_activity
    FROM matching_messages mm
    JOIN conversations c ON c.id = mm.conversation_id
    GROUP BY c.id
    ORDER BY relevance ASC, last_activity DESC
    LIMIT ?
  `).all(
    ftsQuery,
    userId,
    excludeConversationId,
    excludeConversationId,
    limit
  );

  // Retrieve messages from the matching conversations
  const getMessages = db.prepare(`
    SELECT role, content, created_at
    FROM messages
    WHERE conversation_id = ?
    ORDER BY id ASC
  `);

  return matchingConversations.map((conversation) => ({
    conversation_id: conversation.conversation_id,
    conversation_title: conversation.conversation_title,
    relevance: conversation.relevance,
    matching_messages: conversation.matching_messages,
    last_activity: conversation.last_activity,
    messages: getMessages.all(conversation.id)
  }));
};

