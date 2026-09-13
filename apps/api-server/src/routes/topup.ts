import { Router } from "express";
import { db, uuidv4 } from "../db/index.js";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth.js";
import { isGopayConfigured, createQris, checkPayment, fetchQrisImage } from "../lib/gopay.js";
import { litellmUpdateUser, isLiteLLMAvailable } from "../lib/litellm.js";

const router = Router();

router.use(requireAuth);

// Pricing: Rp 16.000 = $1 top-up = 2 Qr (see the pricing page), so one Qredit
// costs 8.000 IDR. Override with TOPUP_IDR_PER_QREDIT if the rate changes.
const IDR_PER_QREDIT = Number(process.env.TOPUP_IDR_PER_QREDIT ?? 8000);
const MIN_TOPUP_IDR = Number(process.env.TOPUP_MIN_IDR ?? 8000);
const MAX_TOPUP_IDR = Number(process.env.TOPUP_MAX_IDR ?? 5_000_000);
// Cap simultaneous open QR codes per user so nobody can flood the merchant
// account with unpaid dynamic QRIS entries.
const MAX_PENDING_TOPUPS = 3;

interface TopupRow {
  id: string;
  user_id: string;
  amount_idr: number;
  qredits: number;
  qris_id: string | null;
  trx_id: string | null;
  qris_code: string | null;
  status: "pending" | "paid" | "expired" | "failed";
  payer_issuer: string | null;
  gateway_tx_id: string | null;
  created_at: string;
  expires_at: string | null;
  paid_at: string | null;
}

function formatTopup(t: TopupRow) {
  return {
    id: t.id,
    amountIdr: t.amount_idr,
    qredits: t.qredits,
    status: t.status,
    qrImageUrl: t.status === "pending" ? `/api/topup/${t.id}/qr.png` : null,
    createdAt: t.created_at,
    expiresAt: t.expires_at,
    paidAt: t.paid_at,
    payerIssuer: t.payer_issuer,
  };
}

// POST /api/topup — create a QRIS payment for the given amount in Rupiah.
router.post("/", async (req: AuthRequest, res) => {
  if (!isGopayConfigured()) {
    res.status(503).json({ error: "Top-up via GoPay is not configured on this server" });
    return;
  }

  const amountIdr = Number(req.body?.amountIdr);
  if (!Number.isInteger(amountIdr) || amountIdr < MIN_TOPUP_IDR || amountIdr > MAX_TOPUP_IDR) {
    res.status(400).json({
      error: `amountIdr must be an integer between ${MIN_TOPUP_IDR} and ${MAX_TOPUP_IDR}`,
    });
    return;
  }

  const userId = req.user!.id;

  const pending = db
    .prepare("SELECT COUNT(*) as c FROM topups WHERE user_id = ? AND status = 'pending'")
    .get(userId) as { c: number };
  if (pending.c >= MAX_PENDING_TOPUPS) {
    res.status(429).json({
      error: "You have too many unpaid top-ups. Finish or let them expire before creating a new one.",
    });
    return;
  }

  let qris;
  try {
    qris = await createQris(amountIdr);
  } catch (err: any) {
    req.log.error({ err }, "GoPay create-qris failed");
    res.status(502).json({ error: "Failed to create QRIS payment. Please try again later." });
    return;
  }

  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const qredits = amountIdr / IDR_PER_QREDIT;

  db.prepare(`
    INSERT INTO topups (id, user_id, amount_idr, qredits, qris_id, trx_id, qris_code, status, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(id, userId, amountIdr, qredits, qris.qrisId, qris.trxId, qris.qrisCode, createdAt, qris.expiresAt);

  const row = db.prepare("SELECT * FROM topups WHERE id = ?").get(id) as TopupRow;
  res.status(201).json(formatTopup(row));
});

// GET /api/topup — the current user's top-up history, newest first.
router.get("/", (req: AuthRequest, res) => {
  const rows = db
    .prepare("SELECT * FROM topups WHERE user_id = ? ORDER BY created_at DESC LIMIT 50")
    .all(req.user!.id) as TopupRow[];
  res.json(rows.map(formatTopup));
});

// GET /api/topup/:id — poll the payment status; credits the balance on first
// confirmation. Safe to call repeatedly — crediting happens exactly once.
router.get("/:id", async (req: AuthRequest, res) => {
  const topup = db
    .prepare("SELECT * FROM topups WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.user!.id) as TopupRow | undefined;

  if (!topup) {
    res.status(404).json({ error: "Top-up not found" });
    return;
  }

  if (topup.status === "pending" && topup.expires_at && Date.now() > Date.parse(topup.expires_at)) {
    db.prepare("UPDATE topups SET status = 'expired' WHERE id = ? AND status = 'pending'").run(topup.id);
    topup.status = "expired";
  }

  if (topup.status === "pending") {
    let result;
    try {
      result = await checkPayment(topup.amount_idr, topup.trx_id, topup.created_at);
    } catch (err: any) {
      // The gateway being briefly unreachable must not fail the poll — the
      // client will retry on its next interval.
      req.log.warn({ err }, "GoPay check-payment failed");
      res.json(formatTopup(topup));
      return;
    }

    if (result.paid) {
      const credited = creditTopup(topup, result.transaction);
      if (credited && isLiteLLMAvailable()) {
        const newLimit = db
          .prepare("SELECT credit_limit FROM users WHERE id = ?")
          .get(topup.user_id) as { credit_limit: number } | undefined;
        if (newLimit) {
          litellmUpdateUser({ userId: topup.user_id, maxBudget: newLimit.credit_limit }).catch(
            (err: any) => req.log.warn({ err }, "LiteLLM budget update failed"),
          );
        }
      }
      const fresh = db.prepare("SELECT * FROM topups WHERE id = ?").get(topup.id) as TopupRow;
      res.json(formatTopup(fresh));
      return;
    }
  }

  res.json(formatTopup(topup));
});

// GET /api/topup/:id/qr.png — proxies the QRIS image from the gateway so the
// API key and the gateway's internal address stay hidden from the browser.
router.get("/:id/qr.png", async (req: AuthRequest, res) => {
  const topup = db
    .prepare("SELECT * FROM topups WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.user!.id) as TopupRow | undefined;

  if (!topup || topup.status !== "pending" || !topup.qris_id) {
    res.status(404).json({ error: "QR not found" });
    return;
  }

  try {
    const upstream = await fetchQrisImage(topup.qris_id);
    if (!upstream.ok || !upstream.body) {
      res.status(502).json({ error: "QR image unavailable" });
      return;
    }
    res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "image/png");
    res.setHeader("Cache-Control", "no-store");
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (err: any) {
    req.log.warn({ err }, "Failed to proxy QR image");
    res.status(502).json({ error: "QR image unavailable" });
  }
});

/**
 * Credits the user's balance for a paid top-up. The whole transition is a
 * single SQLite transaction guarded by `status = 'pending'`, so concurrent
 * polls can never double-credit. Returns true if this call did the credit.
 */
function creditTopup(
  topup: TopupRow,
  transaction: { transaction_id?: string; payer_issuer?: string } | undefined,
): boolean {
  const credit = db.transaction(() => {
    const claimed = db
      .prepare(
        `UPDATE topups
         SET status = 'paid', paid_at = ?, gateway_tx_id = ?, payer_issuer = ?
         WHERE id = ? AND status = 'pending'`,
      )
      .run(
        new Date().toISOString(),
        transaction?.transaction_id ?? null,
        transaction?.payer_issuer ?? null,
        topup.id,
      );
    if (claimed.changes === 0) return false;

    const user = db.prepare("SELECT email, qredits FROM users WHERE id = ?").get(topup.user_id) as
      | { email: string; qredits: number }
      | undefined;
    if (!user) return false;

    const newQredits = user.qredits + topup.qredits;
    const totalSpend = (
      db
        .prepare(
          "SELECT COALESCE(SUM(spend), 0) as s FROM activity_log WHERE user_id = ? AND type = 'request'",
        )
        .get(topup.user_id) as { s: number }
    ).s;

    db.prepare(
      "UPDATE users SET qredits = ?, credit_limit = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(newQredits, totalSpend + newQredits, topup.user_id);

    db.prepare(`
      INSERT INTO activity_log (id, type, user_id, user_email, timestamp)
      VALUES (?, 'credit_update', ?, ?, datetime('now'))
    `).run(uuidv4(), topup.user_id, user.email);

    return true;
  });

  return credit();
}

export default router;
