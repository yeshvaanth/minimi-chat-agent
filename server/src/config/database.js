
import { DatabaseSync } from "@photostructure/sqlite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SQLite database file location
const dbPath = path.resolve(__dirname, "../../../minimi.db");

// Create database connection
const db = new DatabaseSync(dbPath);

// Enable foreign key constraints
db.exec("PRAGMA foreign_keys = ON;");

export default db;
