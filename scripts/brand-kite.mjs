// The brand's agent pays Aisle's Kite payout service (kite-x402-hono, Kite testnet, pieUSD) per verified view.
// For each case it calls /v1/consider, receives the x402 terms, signs an EIP-3009 authorization with Coinbase's
// official x402 client, and retries. The wrapper settles through Kite's facilitator ONLY if Aisle's check passes.
//   node scripts/brand-kite.mjs            real agent on 5 tasks + one fake agent
import fs from "node:fs";
import https from "node:https";
import { privateKeyToAccount } from "viem/accounts";
import { x402Client } from "@x402/core/client";
import { decodePaymentRequiredHeader, encodePaymentSignatureHeader, decodePaymentResponseHeader } from "@x402/core/http";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { sign } from "../lib/receipts.mjs";

const HOST = process.env.AISLE_HOST || "aisle-ads.vercel.app";
const PIN = process.env.AISLE_PIN_IP || "76.76.21.98"; // this network blocks some Vercel IPs; pin a working edge
const OUT = new URL("../data/kite-views.json", import.meta.url);
const key = fs.readFileSync(new URL("../.brand-testnet-key", import.meta.url), "utf8").trim();
const account = privateKeyToAccount(key);
// Opt in to exactly one non-default asset (pieUSD on Kite testnet) with a hard cap of 0.06 per payment.
const client = new x402Client();
client.setSpendControls({ allowedAssets: [{ network: "eip155:2368", asset: "0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A", maxAmountPerPayment: "60000000000000000" }] });
registerExactEvmScheme(client, { signer: account });

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request({ host: HOST, path, method: "GET", headers: { host: HOST, ...headers }, servername: HOST,
      lookup: (h, o, cb) => (o && o.all ? cb(null, [{ address: PIN, family: 4 }]) : cb(null, PIN, 4)), timeout: 120000 }, (res) => {
      let body = ""; res.on("data", (c) => (body += c)); res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on("error", reject); req.on("timeout", () => req.destroy(new Error("timeout"))); req.end();
  });
}

async function payView(agent, task) {
  const path = `/v1/consider?campaign=cmp-001&agent=${encodeURIComponent(agent)}&task=${task}`;
  const first = await get(path);
  if (first.status !== 402) return { agent, task, status: first.status, note: "expected 402", body: first.body.slice(0, 200) };
  const required = decodePaymentRequiredHeader(first.headers["payment-required"]);
  const payload = await client.createPaymentPayload(required);
  const paid = await get(path, { "PAYMENT-SIGNATURE": encodePaymentSignatureHeader(payload) });
  let settlement = null;
  const pr = paid.headers["payment-response"] || paid.headers["x-payment-response"];
  if (pr) { try { settlement = decodePaymentResponseHeader(pr); } catch { settlement = { raw: String(pr).slice(0, 120) }; } }
  let body; try { body = JSON.parse(paid.body); } catch { body = { raw: paid.body.slice(0, 200) }; }
  return { agent, task, status: paid.status, charged: Boolean(settlement?.success), tx: settlement?.transaction || null, network: settlement?.network || required.accepts?.[0]?.network,
    amount: required.accepts?.[0]?.amount, payTo: required.accepts?.[0]?.payTo, receipt: body };
}

const real = "agent_01a1decb-b40f-7989-b780-7c7a6eab9c26";
const cases = [...["t1", "t2", "t3", "t4", "t5"].map((t) => [real, t]), ["agent_01ffffff-0000-7000-8000-00000000b07", "t1"]];
const results = [];
console.log("brand wallet (Kite testnet):", account.address);
for (const [agent, task] of cases) {
  const r = await payView(agent, task);
  console.log(`${agent.slice(0, 14)}… ${task}: HTTP ${r.status} ${r.charged ? `CHARGED tx ${r.tx}` : "not charged"} ${r.receipt?.type || r.note || ""}`);
  results.push(r);
}
fs.writeFileSync(OUT, JSON.stringify(sign({ type: "kite_payout_run", service: `https://${HOST}/v1/consider`, wrapper: "kite-x402-hono 0.6.0", network: "eip155:2368 (Kite testnet, pieUSD)", brand: account.address, results }), null, 1));
console.log("wrote data/kite-views.json");
