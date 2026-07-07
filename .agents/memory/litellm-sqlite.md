---
name: LiteLLM SQLite limitation
description: LiteLLM requires PostgreSQL for virtual keys and spend tracking; SQLite is not supported.
---

LiteLLM's proxy database features (virtual keys, store_model_in_db, spend tracking) require a `postgresql://` DATABASE_URL. Passing `sqlite:///` fails with "unsupported scheme 'sqlite'".

**Why:** LiteLLM uses Prisma ORM internally, which is configured only for PostgreSQL.

**How to apply:** Configure LiteLLM's `database_url` in config.yaml to use `os.environ/DATABASE_URL` (Replit's provisioned PostgreSQL). Keep Qillin-specific data (users, providers, models, sessions) in SQLite via better-sqlite3 in the Express layer. These are two separate databases serving different purposes.
