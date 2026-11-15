// Self-serve campaign draft for brands. A brand picks the listed offer it promotes, writes its ad, and sets a price
// per verified view and a budget. SERV screens the ad (Prompt Guard + classification) and Aisle returns the plan:
// how many verified views the budget buys, who gets what, and the Kite payment terms per view. The draft is signed
// by Aisle but not stored, and no money moves. Small per-instance rate limit.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { screenAd } from "../lib/rank.mjs";
import { canon } from "../lib/receipts.mjs";

const root = process.cwd();
const camp = JSON.parse(fs.readFileSync(path.join(root, "data/campaign.json"), "utf8"));
const offers = JSON.parse(fs.readFileSync(path.join(root, "data/offers.json"), "utf8")).offers;
const hits = new Map();
const cents = (n) => Math.round(n * 10000) / 10000;

function signed(b) {
  const key = process.env.AISLE_SIGNING_KEY;
  return key ? { ...b, sig: crypto.sign(null, Buffer.from(canon(b)), crypto.createPrivateKey(key.replace(/\\n/g, "\n"))).toString("base64") } : b;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") return res.status(405).end(JSON.stringify({ error: "POST only" }));
  const ip = String(req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || "x").split(",")[0];
  const now = Date.now(); const h = (hits.get(ip) || []).filter((t) => now - t < 60000);
  if (h.length >= 4) return res.status(429).end(JSON.stringify({ error: "Too many drafts. Try again in a minute." }));
  hits.set(ip, [...h, now]);

  let body = req.body; if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const brand = String(body?.brand || "").trim().slice(0, 60);
  const ad = String(body?.ad || "").trim();
  const offer = offers.find((o) => o.id === body?.offer);
  const price = Number(body?.price), budget = Number(body?.budget);
  const errors = [];
  if (!brand) errors.push("Add your brand name.");
  if (!offer) errors.push("Pick the listed offer you are promoting.");
  if (ad.length < 10 || ad.length > 280) errors.push("Write an ad between 10 and 280 characters.");
  if (!(price >= 0.01 && price <= 1)) errors.push("Set a price per verified view between $0.01 and $1.00.");
  if (!(budget >= 0.05 && budget <= 1000)) errors.push("Set a budget between $0.05 and $1,000.");
  if (budget < price) errors.push("The budget must cover at least one view.");
  if (errors.length) return res.status(400).end(JSON.stringify({ error: errors.join(" ") }));

  let screen;
  try { screen = await screenAd(ad); }
  catch { return res.status(502).end(JSON.stringify({ error: "SERV did not answer in time. Please try again." })); }

  const views = Math.floor(cents(budget / price) + 1e-9);
  const spend = cents(views * price);
  const s = camp.split;
  const draft = signed({
    type: "campaign_draft",
    id: "draft-" + crypto.createHash("sha256").update(brand + ad + offer.id + price + budget + now).digest("hex").slice(0, 10),
    brand, offer: offer.id, seller: offer.seller, ad,
    status: screen.blocked ? "refused_ad" : "ready_to_fund",
    screen: { blocked: screen.blocked, prompt_guard: screen.prompt_guard, label: screen.label, why: screen.why },
    price_per_view_usd: price, budget_usd: budget, max_verified_views: views, max_spend_usd: spend,
    per_view: { shopper: cents(price * s.shopper), aisle: cents(price * s.aisle), agent_developer: cents(price * s.agent_developer) },
    totals_if_fully_spent: { shoppers: cents(spend * s.shopper), aisle: cents(spend * s.aisle), agent_developers: cents(spend * s.agent_developer) },
    you_pay_only_when: camp.billable_view_rule,
    payment: screen.blocked ? null : { protocol: "x402 (kite-x402-hono)", endpoint: "/v1/consider", network: "Kite (eip155:2366 mainnet / eip155:2368 testnet)", per_view_usd: price },
    issued_at: new Date(now).toISOString(),
  });
  res.status(200).end(JSON.stringify(draft));
}
