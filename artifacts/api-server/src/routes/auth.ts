import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";
import { signToken } from "../lib/auth.js";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth.js";
import { litellmCreateUser, isLiteLLMAvailable } from "../lib/litellm.js";

const router = Router();

// Brute-force / credential-stuffing protection. Keyed by IP; both routes
// share a counter since they're both credential entry points.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

function formatUser(u: any) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    qredits: u.qredits,
    isActive: u.is_active === 1,
    createdAt: u.created_at,
  };
}

// POST /api/auth/register
router.post("/register", authLimiter, async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    res.status(400).json({ error: "email, password, and name are required" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const existing = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(email.toLowerCase());

  if (existing) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);

  db.prepare(`
    INSERT INTO users (id, email, name, password_hash, role, qredits)
    VALUES (?, ?, ?, ?, 'user', 0)
  `).run(id, email.toLowerCase(), name, passwordHash);

  // Try to create LiteLLM user (non-blocking)
  if (isLiteLLMAvailable()) {
    litellmCreateUser({ userId: id, email: email.toLowerCase(), maxBudget: 0 }).catch(
      (err) => req.log.warn({ err }, "Failed to create LiteLLM user"),
    );
  }

  const user = db
    .prepare("SELECT id, email, name, role, qredits, is_active, created_at FROM users WHERE id = ?")
    .get(id) as any;

  const token = signToken({ userId: id, role: "user", email: email.toLowerCase() });
  res.status(201).json({ token, user: formatUser(user) });
});

// POST /api/auth/login
router.post("/login", authLimiter, (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  const user = db
    .prepare("SELECT * FROM users WHERE email = ? AND is_active = 1")
    .get(email.toLowerCase()) as any;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = signToken({ userId: user.id, role: user.role, email: user.email });
  res.json({ token, user: formatUser(user) });
});

// POST /api/auth/logout
router.post("/logout", (_req, res) => {
  res.json({ message: "Logged out successfully" });
});

// GET /api/auth/me
router.get("/me", requireAuth, (req: AuthRequest, res) => {
  const u = req.user!;
  res.json({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    qredits: u.qredits,
    isActive: u.is_active === 1,
    createdAt: u.created_at,
  });
});

export default router;
