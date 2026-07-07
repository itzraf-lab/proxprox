import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";

// Ensure data directory exists
const dataDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.resolve(dataDir, "qillin.db");
export const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    qredits REAL NOT NULL DEFAULT 0,
    litellm_user_id TEXT,
    allowed_models TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    base_url TEXT,
    load_balancing TEXT NOT NULL DEFAULT 'round_robin',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS provider_api_keys (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    key_value TEXT NOT NULL,
    label TEXT,
    priority INTEGER NOT NULL DEFAULT 0,
    fail_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    litellm_model TEXT NOT NULL,
    provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    context_window INTEGER NOT NULL DEFAULT 4096,
    input_cost_per_mtok REAL NOT NULL DEFAULT 0,
    output_cost_per_mtok REAL NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    litellm_key TEXT,
    spend REAL NOT NULL DEFAULT 0,
    last_used TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    user_id TEXT,
    user_email TEXT,
    model TEXT,
    tokens_in INTEGER,
    tokens_out INTEGER,
    spend REAL,
    latency_ms INTEGER,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migrate: add latency_ms to activity_log for existing databases.
// Runs after CREATE TABLE so fresh DBs already have the column and the
// ALTER silently fails; existing DBs without the column get it added.
try {
  db.exec("ALTER TABLE activity_log ADD COLUMN latency_ms INTEGER");
} catch {
  // Column already exists on fresh databases (added in CREATE TABLE above).
}

/**
 * Seed (or update) the admin account on every startup.
 *
 * The environment is the source of truth for admin credentials:
 *   ADMIN_EMAIL    — admin email address  (required; default: <username>@qillin.local)
 *   ADMIN_USERNAME — admin display name   (optional; default: Eruu)
 *   ADMIN_PASSWORD — admin password       (required; skip seed if missing)
 *
 * If an admin already exists, their email, name, and password are updated to
 * match the current environment variables so you can rotate credentials by
 * changing the secrets without touching the database.
 */
function seedAdmin() {
  const adminUsername = process.env.ADMIN_USERNAME ?? "Eruu";
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminEmail =
    process.env.ADMIN_EMAIL ?? `${adminUsername.toLowerCase()}@qillin.local`;

  if (!adminPassword) {
    console.warn("[DB] ADMIN_PASSWORD not set, skipping admin seed");
    return;
  }

  const hash = bcrypt.hashSync(adminPassword, 10);

  const existing = db
    .prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
    .get() as { id: string } | undefined;

  if (!existing) {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO users (id, email, name, password_hash, role, qredits)
      VALUES (?, ?, ?, ?, 'admin', 999999)
    `).run(id, adminEmail, adminUsername, hash);
    console.info(`[DB] Admin user created: ${adminEmail}`);
  } else {
    // Update email, name, and password from environment on every startup.
    // This allows credential rotation without touching the database.
    //
    // Guard against UNIQUE email collision: if another (non-admin) user already
    // holds the target email, skip the update and log a warning so the operator
    // knows they need to resolve the conflict rather than crashing on startup.
    const collision = db
      .prepare("SELECT id FROM users WHERE email = ? AND id != ?")
      .get(adminEmail, existing.id);

    if (collision) {
      console.warn(
        `[DB] Skipping admin email update: "${adminEmail}" is already used by another account. ` +
          "Change ADMIN_EMAIL to a unique address.",
      );
      return;
    }

    db.prepare(`
      UPDATE users
      SET email = ?, name = ?, password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(adminEmail, adminUsername, hash, existing.id);
    console.info(`[DB] Admin user updated: ${adminEmail}`);
  }
}

seedAdmin();

export { uuidv4 };
