import express, { type Express } from "express";
import cors from "cors";
import compression from "compression";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import v1Router from "./routes/v1.js";
import { litellmProxy } from "./routes/proxy.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

// ── Logging ──────────────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    // Skip verbose logging for the streaming proxy path to avoid noise
    autoLogging: {
      ignore: (req) => req.url?.startsWith("/v1/") ?? false,
    },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ── Native /v1 handlers (before the proxy) ───────────────────────────────────
// These intercept specific /v1/* paths (e.g. GET /v1/models) with Qillin's own
// auth and DB-sourced data. express.json() is applied here so these handlers
// can parse bodies; the proxy below must remain before the global body-parser.
app.use("/v1", express.json({ limit: "1mb" }), v1Router);

// ── Streaming AI proxy (/v1/*) ────────────────────────────────────────────────
// Mounted BEFORE the global body-parser so the raw request stream is piped
// directly to LiteLLM — no buffering, full SSE streaming support.
// The proxy internally allowlists only OpenAI-compatible endpoints.
app.use("/v1", litellmProxy);

// ── Body parsing (management API only) ───────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Compression for management API responses ─────────────────────────────────
// Skips streaming / SSE responses (Content-Type: text/event-stream) automatically.
app.use(compression({ threshold: 1024 }));

// ── Management routes ─────────────────────────────────────────────────────────
app.use("/api", router);

export default app;
