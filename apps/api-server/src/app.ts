import express, { type Express } from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import v1Router from "./routes/v1.js";
import { litellmProxy } from "./routes/proxy.js";
import { requireApiOrJwtAuth } from "./middlewares/requireAuth.js";
import { promptCacheMiddleware } from "./middlewares/promptCache.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

// Requests arrive through Replit's reverse proxy, so the first hop's
// X-Forwarded-For entry is the real client IP. Trusting exactly one hop lets
// express-rate-limit (auth.ts) and req.ip key off the actual caller instead
// of collapsing every user behind the proxy into a single bucket/IP.
app.set("trust proxy", 1);

// Don't advertise the framework in responses.
app.disable("x-powered-by");

// ── Security headers ─────────────────────────────────────────────────────────
// CSP is left to the frontend's own hosting (this app only serves JSON/streams),
// so it's disabled here to avoid breaking the streaming proxy responses.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

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
// Auth is Bearer-token based (Authorization header), never cookies, so
// `credentials: true` is unnecessary and is intentionally left off — it would
// otherwise let any origin read authenticated responses if it ever obtained a
// token (e.g. via XSS elsewhere). `origin: true` reflects the caller's origin
// so the API can be reached from any client app that already holds a token.
app.use(
  cors({
    origin: true,
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
//  2b. Prompt-cache middleware — parses the JSON body of POST chat
//     completions only, expanding the optional `cacheAtDepth` parameter into
//     a cache_control block. All other /v1 traffic passes through untouched.
//
//  3. Streaming proxy — pipes the raw body stream to LiteLLM. Must receive
//     the request BEFORE any body parser that would buffer/consume the stream
//     (the chat-completions exception above re-serializes via fixRequestBody).
//
app.use("/v1", requireApiOrJwtAuth);
app.use("/v1", v1Router);
app.use("/v1", promptCacheMiddleware);
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
