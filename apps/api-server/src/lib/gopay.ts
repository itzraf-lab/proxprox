/**
 * Client for the self-hosted GoPay Merchant Gateway
 * (https://github.com/ahmadzakiyox/gopay-api-gateaway).
 *
 * The gateway runs as a separate Node process (default :3000) and holds the
 * GoPay merchant session. This app only talks to it server-to-server with the
 * shared API key — the key must never reach the browser.
 */

const GOPAY_GATEWAY_URL = (process.env.GOPAY_GATEWAY_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  "",
);
const GOPAY_API_KEY = process.env.GOPAY_API_KEY ?? "";

const REQUEST_TIMEOUT_MS = 20_000;

export function isGopayConfigured(): boolean {
  return Boolean(GOPAY_API_KEY);
}

export interface CreateQrisResult {
  qrisId: string;
  trxId: string;
  qrisUrl: string;
  qrisCode: string;
  amount: number;
  expiresAt: string;
}

export async function createQris(amountIdr: number): Promise<CreateQrisResult> {
  const url = `${GOPAY_GATEWAY_URL}/create-qris?amount=${amountIdr}&api_key=${encodeURIComponent(GOPAY_API_KEY)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const body = (await res.json().catch(() => null)) as any;

  if (!res.ok || !body?.success || !body?.data) {
    throw new Error(body?.message ?? `GoPay gateway error (HTTP ${res.status})`);
  }

  return {
    qrisId: body.data.qris_id,
    trxId: body.data.trx_id,
    qrisUrl: body.data.qris_url,
    qrisCode: body.data.qris_code,
    amount: body.data.amount,
    expiresAt: body.data.expires_at,
  };
}

export interface CheckPaymentResult {
  paid: boolean;
  transaction?: {
    transaction_id: string;
    order_id?: string;
    amount: number;
    payer_issuer?: string;
    payment_type?: string;
    transaction_time?: string;
  };
}

export async function checkPayment(
  amountIdr: number,
  trxId: string | null,
  startTimeIso: string | null,
): Promise<CheckPaymentResult> {
  const params = new URLSearchParams({
    amount: String(amountIdr),
    api_key: GOPAY_API_KEY,
  });
  if (trxId) params.set("trx_id", trxId);
  // Scope the search to transactions after the top-up was created so an older,
  // unrelated payment with the same amount can never be claimed.
  if (startTimeIso) params.set("startTime", startTimeIso);

  const res = await fetch(`${GOPAY_GATEWAY_URL}/check-payment?${params}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => null)) as any;

  if (!res.ok || !body?.success) {
    throw new Error(body?.message ?? `GoPay gateway error (HTTP ${res.status})`);
  }

  return { paid: Boolean(body.paid), transaction: body.transaction };
}

/**
 * Fetch the raw QRIS image for a QR code. The gateway's /qr/:id?format=raw
 * endpoint 302-redirects to a rendered PNG; fetch follows it automatically.
 */
export async function fetchQrisImage(qrisId: string): Promise<Response> {
  return fetch(`${GOPAY_GATEWAY_URL}/qr/${encodeURIComponent(qrisId)}?format=raw`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    redirect: "follow",
  });
}
