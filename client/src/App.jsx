
import { useState, useEffect } from "react";
import "./App.css";

const API_URL = "http://localhost:5000/api/chat";
const USER_ID = "demo-user-001";

function App() {
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [error, setError] = useState("");

  // Three-dot menu and rename states
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingConversationId, setEditingConversationId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  // Fetch all conversations
  const fetchConversations = async () => {
    try {
      const response = await fetch(
        `${API_URL}/conversations/${USER_ID}`
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to load conversations"
        );
      }

      setConversations(result.data);
    } catch (err) {
      console.error("Conversation loading error:", err);
    }
  };

  // Load conversations when application starts
  useEffect(() => {
    fetchConversations();
  }, []);

  // Load messages from a selected conversation
  const openConversation = async (selectedId) => {
    if (loading || historyLoading) return;

    setOpenMenuId(null);
    setError("");
    setHistoryLoading(true);
    setConversationId(selectedId);
    setMessages([]);

    try {
      const response = await fetch(
        `${API_URL}/conversations/${USER_ID}/${selectedId}`
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to load messages"
        );
      }

      setMessages(result.data);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Unable to connect to Minimi. Please check whether the server is running."
          : err.message
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  // Send message
  const sendMessage = async (e) => {
    e.preventDefault();

    const message = input.trim();

    if (!message || loading || historyLoading) return;

    setInput("");
    setError("");

    // Optimistically display the user's message
    const userMessage = {
      role: "user",
      content: message,
    };

    setMessages((prev) => [...prev, userMessage]);

    setLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: USER_ID,
          conversationId,
          message,
          clientMessageId: crypto.randomUUID(),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Something went wrong"
        );
      }

      const data = result.data;

      setConversationId(data.conversationId);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          sources: data.sources || [],
        },
      ]);

      await fetchConversations();
    } catch (err) {
      // Remove the unsaved optimistic message
      setMessages((prev) =>
        prev.filter((msg) => msg !== userMessage)
      );

      // Restore the user's message
      setInput(message);

      setError(
        err.message === "Failed to fetch"
          ? "Unable to connect to Minimi. Please check whether the server is running and try again."
          : err.message || "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Start a new chat
  const newChat = () => {
    setMessages([]);
    setConversationId(null);
    setInput("");
    setError("");
    setOpenMenuId(null);
    setEditingConversationId(null);
    setEditingTitle("");
  };

  // Open or close three-dot menu
  const toggleMenu = (id) => {
    setOpenMenuId((prev) => (prev === id ? null : id));
  };

  // Rename conversation
  const renameConversation = async (id) => {
    const title = editingTitle.trim();

    if (!title) {
      setError("Conversation title cannot be empty.");
      return;
    }

    if (title.length > 100) {
      setError("Conversation title cannot exceed 100 characters.");
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/conversations/${USER_ID}/${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to rename conversation"
        );
      }

      setEditingConversationId(null);
      setEditingTitle("");
      setOpenMenuId(null);
      setError("");

      await fetchConversations();
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Unable to connect to Minimi. Please try again."
          : err.message
      );
    }
  };

  // Delete conversation
  const deleteConversation = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this conversation?"
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `${API_URL}/conversations/${USER_ID}/${id}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to delete conversation"
        );
      }

      if (conversationId === id) {
        newChat();
      }

      setOpenMenuId(null);
      setError("");

      await fetchConversations();
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Unable to connect to Minimi. Please try again."
          : err.message
      );
    }
  };

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          minimi<span>.</span>
        </div>

        <button className="new-chat" onClick={newChat}>
          + New chat
        </button>

        <div className="conversation-section">
          <h4>Recent conversations</h4>

          {conversations.length === 0 ? (
            <p className="empty-history">
              No conversations yet
            </p>
          ) : (
            <div className="conversation-list">
              {conversations.map((conversation) => {
                const id = conversation.conversation_id;

                return (
                  <div
                    key={id}
                    className="conversation-wrapper"
                  >
                    {/* Rename input */}
                    {editingConversationId === id ? (
                      <div className="rename-box">
                        <input
                          type="text"
                          value={editingTitle}
                          autoFocus
                          onChange={(e) =>
                            setEditingTitle(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              renameConversation(id);
                            }

                            if (e.key === "Escape") {
                              setEditingConversationId(null);
                              setEditingTitle("");
                            }
                          }}
                        />

                        <button
                          onClick={() => renameConversation(id)}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      /* Conversation item */
                      <div
                        className={`conversation-item ${
                          conversationId === id ? "active" : ""
                        }`}
                      >
                        <button
                          className="conversation-open"
                          onClick={() => openConversation(id)}
                          disabled={loading || historyLoading}
                          title={conversation.title}
                        >
                          <span className="conversation-title">
                            {conversation.title || "New conversation"}
                          </span>
                        </button>

                        {/* Three-dot button */}
                        <button
                          className="conversation-menu-button"
                          onClick={() => toggleMenu(id)}
                          title="Conversation options"
                          aria-label="Conversation options"
                        >
                          ⋮
                        </button>

                        {/* Dropdown menu */}
                        {openMenuId === id && (
                          <div className="conversation-menu">
                            <button
                              onClick={() => {
                                setEditingConversationId(id);
                                setEditingTitle(conversation.title || "");
                                setOpenMenuId(null);
                              }}
                            >
                              <span>✏️</span>
                              Rename
                            </button>

                            <button
                              className="delete-option"
                              onClick={() => deleteConversation(id)}
                            >
                              <span>🗑️</span>
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="sidebar-bottom">
          AI-powered web search
        </div>
      </aside>

      {/* Main Chat */}
      <main className="main">
        <header className="topbar">
          <h3>AI Assistant</h3>
          <span className="status">● Online</span>
        </header>

        <section className="chat-area">
          {historyLoading ? (
            <div className="welcome">
              <p>Loading conversation...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="welcome">
              <h1>How can I help you today?</h1>

              <p>
                Ask questions, search the web, or explore previous conversations.
              </p>

              <div className="suggestions">
                <button
                  onClick={() =>
                    setInput(
                      "What are the latest features of PostgreSQL 18?"
                    )
                  }
                >
                  Latest technology updates
                </button>

                <button
                  onClick={() =>
                    setInput("Compare Supabase and Neon databases")
                  }
                >
                  Compare technologies
                </button>

                <button
                  onClick={() =>
                    setInput("Explain how Node.js event loop works")
                  }
                >
                  Learn something new
                </button>
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`message ${msg.role}`}
                >
                  <div className="message-label">
                    {msg.role === "user" ? "You" : "Minimi"}
                  </div>

                  <div className="message-content">
                    {msg.content}
                  </div>

                  {/* Web search sources */}
                  {msg.sources?.length > 0 && (
                    <div className="sources">
                      <strong>Sources</strong>

                      {msg.sources.map((source, i) => {
                        const url =
                          typeof source === "string"
                            ? source
                            : source.url;

                        const title =
                          typeof source === "string"
                            ? source
                            : source.title || source.url;

                        if (!url) return null;

                        return (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {title}
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="message assistant">
                  <div className="message-label">
                    Minimi
                  </div>

                  <div className="typing">
                    Thinking and searching...
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        <form className="input-area" onSubmit={sendMessage}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message Minimi..."
            disabled={loading || historyLoading}
          />

          <button
            type="submit"
            disabled={loading || historyLoading || !input.trim()}
          >
            {loading ? "..." : "Send"}
          </button>
        </form>

        <p className="disclaimer">
          Minimi can make mistakes. Verify important information.
        </p>
      </main>
    </div>
  );
}

export default App;
