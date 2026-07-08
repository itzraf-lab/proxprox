---
name: express-rate-limit needs trust proxy behind Replit's proxy
description: Rate limiting by IP on api-server requires app.set("trust proxy", 1) or it collapses all users into one bucket.
---

`artifacts/api-server` runs behind Replit's reverse proxy (all traffic arrives via one hop with an
`X-Forwarded-For` header). Any `express-rate-limit` (or other req.ip-based) middleware needs
`app.set("trust proxy", 1)` set on the Express app, otherwise every external caller is seen as the
same IP (the proxy's), so a 20-req/15min auth limiter would lock out ALL users after ~20 total
login/register attempts anywhere, not just abusive ones.

**Why:** found during a security audit adding auth rate limiting — a code-review subagent flagged
that the limiter was misconfigured for the proxied deployment before it shipped.

**How to apply:** whenever adding IP-based rate limiting or anything reading `req.ip` on an
Express app in this project, confirm `trust proxy` is set (currently in `src/app.ts`, set once at
app creation) and trust exactly one hop — not `true`/unbounded, which would let a client spoof
`X-Forwarded-For` to bypass limits.
