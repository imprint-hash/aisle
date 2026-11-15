// Temporary probe: returns a tiny x402 price on Arc and Base, and records what a paying client sends back.
// Logs header NAMES and decoded payment JSON shape only (no secrets exist in a payment authorization).
const ARC_USDC = "0x3600000000000000000000000000000000000000";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PAYTO = process.env.PROBE_PAYTO || "0x007C857D9e9ffeB59dE125aCB73474Ea4a893E5a";
export default async function handler(req, res) {
  const url = `https://${req.headers.host}/api/probe`;
  const pay = req.headers["payment-signature"] || req.headers["x-payment"];
  if (pay) {
    let decoded; try { decoded = JSON.parse(Buffer.from(String(pay), "base64").toString("utf8")); } catch { decoded = { raw: String(pay).slice(0, 200) }; }
    console.log("PROBE headers", Object.keys(req.headers).join(","));
    console.log("PROBE payment", JSON.stringify(decoded).slice(0, 3000));
    res.setHeader("Content-Type", "application/json");
    return res.status(200).end(JSON.stringify({ ok: true, note: "probe received payment (not settled)", keys: Object.keys(decoded) }));
  }
  const accepts = [
    { scheme: "exact", network: "eip155:5042", amount: "1000", maxAmountRequired: "1000", asset: ARC_USDC, payTo: PAYTO, maxTimeoutSeconds: 300, resource: url, description: "Aisle probe", mimeType: "application/json", extra: { name: "USDC", version: "2" } },
    { scheme: "exact", network: "eip155:8453", amount: "1000", maxAmountRequired: "1000", asset: BASE_USDC, payTo: PAYTO, maxTimeoutSeconds: 300, resource: url, description: "Aisle probe", mimeType: "application/json", extra: { name: "USD Coin", version: "2" } },
  ];
  const body = { x402Version: 2, error: "payment required", resource: { url, description: "Aisle probe", mimeType: "application/json" }, accepts };
  res.setHeader("PAYMENT-REQUIRED", Buffer.from(JSON.stringify(body)).toString("base64"));
  res.setHeader("Content-Type", "application/json");
  res.status(402).end(JSON.stringify(body));
}
