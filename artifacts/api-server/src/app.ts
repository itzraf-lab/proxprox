import express, { type Express } from "express";
import cors from "cors";
import compression from "compression";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import v1Router from "./routes/v1.js";
import { litellmProxy } from "./routes/proxy.js";
import { requireApiOrJwtAuth } from "./middlewares/requireAuth.js";
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

// ── /v1 route stack ───────────────────────────────────────────────────────────
//
// Order matters here:
//
//  1. Auth middleware — validates JWT or Qillin API key, sets req.user and
//     req.headers["x-qillin-litellm-key"] for the proxy.  Must run BEFORE
//     body parsing so we never consume the request body stream for streaming
//     endpoints like /v1/chat/completions.
//
//  2. Native handlers (v1Router) — intercepts GET /v1/models and any other
//     Qillin-native /v1 routes. No body parser needed (all are GET today).
//     Unmatched routes call next() and fall through to the proxy.
//
//  3. Streaming proxy — pipes the raw body stream to LiteLLM. Must receive
//     the request BEFORE any body parser that would buffer/consume the stream.
//
app.use("/v1", requireApiOrJwtAuth);
app.use("/v1", v1Router);
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
