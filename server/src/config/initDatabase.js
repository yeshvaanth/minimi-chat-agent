
import db from "./database.js";

const createTables = () => {
  // 1. Create core database tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      title TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT UNIQUE NOT NULL,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    );
  `);

  // 2. Add missing idempotency columns
  const messageColumns = db.prepare(`
    PRAGMA table_info(messages)
  `).all();

  const columnNames = new Set(
    messageColumns.map((column) => column.name)
  );

  if (!columnNames.has("client_message_id")) {
    db.exec(`
      ALTER TABLE messages
      ADD COLUMN client_message_id TEXT
    `);
  }

  if (!columnNames.has("response_to_client_message_id")) {
    db.exec(`
      ALTER TABLE messages
      ADD COLUMN response_to_client_message_id TEXT
    `);
  }

  // 3. Prevent duplicate client messages
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS
    idx_messages_client_message_id
    ON messages(client_message_id)
    WHERE client_message_id IS NOT NULL
  `);

  // 4. Prevent duplicate assistant responses
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS
    idx_messages_response_to_client_message_id
    ON messages(response_to_client_message_id)
    WHERE response_to_client_message_id IS NOT NULL
  `);

  // 5. Improve conversation and message lookup performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS
    idx_conversations_user_updated
    ON conversations(user_id, updated_at);

    CREATE INDEX IF NOT EXISTS
    idx_messages_conversation_id
    ON messages(conversation_id);
  `);

  // 6. Create migration tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_id TEXT PRIMARY KEY,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 7. Initialize FTS5 migration
  const ftsMigration = "001_messages_fts5";

  const migrationExists = db.prepare(`
    SELECT migration_id
    FROM schema_migrations
    WHERE migration_id = ?
  `).get(ftsMigration);

  if (!migrationExists) {
    let transactionStarted = false;

    try {
      db.exec("BEGIN");
      transactionStarted = true;

      // Create FTS5 virtual table
      db.exec(`
        CREATE VIRTUAL TABLE messages_fts
        USING fts5(
          content,
          content='messages',
          content_rowid='id'
        )
      `);

      // Automatically index new messages
      db.exec(`
        CREATE TRIGGER messages_ai
        AFTER INSERT ON messages
        BEGIN
          INSERT INTO messages_fts(rowid, content)
          VALUES (new.id, new.content);
        END
      `);

      // Remove deleted messages from the index
      db.exec(`
        CREATE TRIGGER messages_ad
        AFTER DELETE ON messages
        BEGIN
          INSERT INTO messages_fts(messages_fts, rowid, content)
          VALUES ('delete', old.id, old.content);
        END
      `);

      // Update the index when a message changes
      db.exec(`
        CREATE TRIGGER messages_au
        AFTER UPDATE ON messages
        BEGIN
          INSERT INTO messages_fts(messages_fts, rowid, content)
          VALUES ('delete', old.id, old.content);

          INSERT INTO messages_fts(rowid, content)
          VALUES (new.id, new.content);
        END
      `);

      // Index existing messages
      db.exec(`
        INSERT INTO messages_fts(messages_fts)
        VALUES ('rebuild')
      `);

      // Record successful migration
      db.prepare(`
        INSERT INTO schema_migrations (migration_id)
        VALUES (?)
      `).run(ftsMigration);

      db.exec("COMMIT");
      transactionStarted = false;

    } catch (error) {
      if (transactionStarted) {
        try {
          db.exec("ROLLBACK");
        } catch {
          // Preserve the original migration error
        }
      }

      throw error;
    }
  }
};

export default createTables;
