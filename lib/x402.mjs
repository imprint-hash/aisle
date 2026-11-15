// Minimal x402 seller on Base mainnet USDC, settled by Kite's recommended facilitator (Pieverse).
// Speaks x402 v2 (PAYMENT-REQUIRED / PAYMENT-SIGNATURE headers) and accepts a v1 X-PAYMENT header too.
export const NETWORK = "eip155:8453";                                    // Base mainnet
export const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";        // native USDC on Base (6 decimals)
export const FACILITATOR = process.env.X402_FACILITATOR || "https://facilitator.pieverse.io";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
const unb64 = (s) => JSON.parse(Buffer.from(String(s), "base64").toString("utf8"));
export const usd = (atomic) => (Number(atomic) / 1e6).toFixed(6).replace(/0+$/, "").replace(/\.$/, ".00");

export function requirements({ amount, payTo, url, description }) {
  return {
    scheme: "exact", network: NETWORK, amount: String(amount), maxAmountRequired: String(amount),
    asset: USDC, payTo, maxTimeoutSeconds: 300, resource: url, description, mimeType: "application/json",
    extra: { name: "USD Coin", version: "2" },
  };
}

// 402 with both the v2 header and a v1-style JSON body, so any client can read the terms.
export function paymentRequired(res, req402) {
  const body = { x402Version: 2, error: "payment required", resource: { url: req402.resource, description: req402.description, mimeType: req402.mimeType }, accepts: [req402] };
  res.setHeader("PAYMENT-REQUIRED", b64(body));
  res.setHeader("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE");
  res.statusCode = 402;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ...body, x402Version: 1, accepts: [{ ...req402, network: "base" }] }));
}

export function readPayment(req) {
  const h = req.headers || {};
  const raw = h["payment-signature"] || h["x-payment"];
  if (!raw) return null;
  try { return unb64(raw); } catch { return { invalid: true }; }
}

async function post(path, body) {
  const r = await fetch(FACILITATOR + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = { raw: t.slice(0, 300) }; }
  return { ok: r.ok, status: r.status, body: j };
}

// Verify then settle. Returns { ok, tx, payer, reason }.
export async function verifyAndSettle(payment, req402) {
  const paymentRequirements = req402;
  const body = { x402Version: payment.x402Version || 2, paymentPayload: payment, paymentRequirements };
  const v = await post("/v2/verify", body);
  if (!v.ok || v.body?.isValid === false) return { ok: false, stage: "verify", reason: v.body?.invalidReason || v.body?.error || `HTTP ${v.status}`, detail: v.body };
  const s = await post("/v2/settle", body);
  if (!s.ok || s.body?.success === false) return { ok: false, stage: "settle", reason: s.body?.errorReason || s.body?.error || `HTTP ${s.status}`, detail: s.body };
  return { ok: true, tx: s.body?.transaction || s.body?.txHash, payer: s.body?.payer || v.body?.payer, network: s.body?.network || NETWORK };
}

export function paymentResponse(res, settled) {
  const v = b64({ success: true, transaction: settled.tx, network: settled.network, payer: settled.payer });
  res.setHeader("PAYMENT-RESPONSE", v);
  res.setHeader("X-PAYMENT-RESPONSE", v);
}
