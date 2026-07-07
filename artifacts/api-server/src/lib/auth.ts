import jwt from "jsonwebtoken";
import { db } from "../db/index.js";

// Fail fast at module load — JWT_SECRET is required for the server to be secure.
const JWT_SECRET: string = (() => {
  const s = process.env.JWT_SECRET;
  if (!s) {
    throw new Error("JWT_SECRET environment variable is required but not set.");
  }
  return s;
})();

const JWT_EXPIRY = "7d";

export interface JwtPayload {
  userId: string;
  role: string;
  email: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as unknown as JwtPayload;
  } catch {
    return null;
  }
}

export function getUserFromToken(token: string) {
  const payload = verifyToken(token);
  if (!payload) return null;

  const user = db
    .prepare("SELECT id, email, name, role, qredits, is_active, allowed_models, litellm_user_id, created_at FROM users WHERE id = ? AND is_active = 1")
    .get(payload.userId) as any;

  return user ?? null;
}
