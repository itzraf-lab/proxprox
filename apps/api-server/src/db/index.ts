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
    credit_limit REAL NOT NULL DEFAULT 0,
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

  CREATE TABLE IF NOT EXISTS provider_base_urls (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    url TEXT,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS provider_api_keys (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    base_url_id TEXT REFERENCES provider_base_urls(id) ON DELETE CASCADE,
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
    cache_read_tokens INTEGER,
    cache_write_tokens INTEGER,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migrate: add latency_ms to activity_log for existing databases.
try {
  db.exec("ALTER TABLE activity_log ADD COLUMN latency_ms INTEGER");
} catch {
  // Column already exists on fresh databases (added in CREATE TABLE above).
}

// Migrate: add prompt-caching token metrics to activity_log.
// cache_read_tokens  — tokens served from the provider's prompt cache
// cache_write_tokens — tokens written into the provider's prompt cache
try {
  db.exec("ALTER TABLE activity_log ADD COLUMN cache_read_tokens INTEGER");
} catch {
  // Column already exists.
}
try {
  db.exec("ALTER TABLE activity_log ADD COLUMN cache_write_tokens INTEGER");
} catch {
  // Column already exists.
}

// Migrate: add credit_limit to users for existing databases.
try {
  db.exec("ALTER TABLE users ADD COLUMN credit_limit REAL NOT NULL DEFAULT 0");
  db.exec(`
    UPDATE users SET credit_limit = qredits + COALESCE(
      (SELECT SUM(spend) FROM activity_log
       WHERE activity_log.user_id = users.id AND type = 'request'),
      0
    )
  `);
  console.info("[DB] Migrated users.credit_limit (back-filled from qredits + spend)");
} catch {
  // Column already exists on fresh databases.
}

// Migrate: add base_url_id to provider_api_keys and backfill provider_base_urls.
// This introduces the multi-base-URL (cluster) feature. Each existing provider
// gets a single provider_base_urls row mirroring its legacy base_url, and every
// existing key is linked to that row via base_url_id.
try {
  db.exec("ALTER TABLE provider_api_keys ADD COLUMN base_url_id TEXT REFERENCES provider_base_urls(id) ON DELETE CASCADE");

  // Backfill: create one provider_base_urls row per existing provider
  const existingProviders = db.prepare("SELECT id, base_url FROM providers").all() as any[];
  for (const p of existingProviders) {
    const buId = uuidv4();
    db.prepare(
      "INSERT OR IGNORE INTO provider_base_urls (id, provider_id, url, priority) VALUES (?, ?, ?, 0)"
    ).run(buId, p.id, p.base_url ?? null);
    db.prepare(
      "UPDATE provider_api_keys SET base_url_id = ? WHERE provider_id = ? AND base_url_id IS NULL"
    ).run(buId, p.id);
  }

  console.info("[DB] Migrated provider_base_urls and base_url_id");
} catch {
  // Column already exists — migration already ran on a previous startup.
}

/**
 * Seed (or update) the admin account on every startup.
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
      INSERT INTO users (id, email, name, password_hash, role, qredits, credit_limit)
      VALUES (?, ?, ?, ?, 'admin', 999999, 999999)
    `).run(id, adminEmail, adminUsername, hash);
    console.info(`[DB] Admin user created: ${adminEmail}`);
  } else {
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
