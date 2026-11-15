// Aisle's check behind the Kite wrapper. Called only by the wrapper (shared header secret).
//   GET /consider?campaign=cmp-002&agent=<kite agent id>&task=t1
// 200 = billable view (wrapper settles the brand's payment to the shopper on Kite)
// 403 = agent not a Kite-registered agent in Aisle's signed registry (no charge)
// 409 = sponsorship changed the ranking (no charge)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { honestRank } from "../lib/rank.mjs";
import { canon } from "../lib/receipts.mjs";

const root = process.cwd();
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));
const camp = read("data/campaign.json"), offers = read("data/offers.json").offers, registry = read("data/agents.json");

function signed(body) {
  const key = process.env.AISLE_SIGNING_KEY;
  const b = { ...body, issued_at: new Date().toISOString() };
  return key ? { ...b, sig: crypto.sign(null, Buffer.from(canon(b)), crypto.createPrivateKey(key.replace(/\\n/g, "\n"))).toString("base64") } : b;
}
const send = (res, code, body) => { res.setHeader("Content-Type", "application/json"); res.status(code).end(JSON.stringify(body)); };

export default async function handler(req, res) {
  if (req.headers["x-aisle-wrapper"] !== process.env.AISLE_WRAPPER_SECRET) return send(res, 401, { error: "Call this through the Kite payout service at /v1/consider" });
  const { agent = "", task: taskId = "", campaign = "" } = req.query || {};
  if (campaign !== camp.id) return send(res, 404, { error: "unknown campaign" });
  const task = camp.tasks.find((t) => t.id === taskId);
  if (!task) return send(res, 404, { error: "unknown task" });
  const reg = registry.agents.find((a) => a.agent_id === agent);
  if (!reg) return send(res, 403, signed({ type: "refused_unverified_agent", campaign, agent, reason: "not a Kite-registered agent in Aisle's signed registry", charged: false }));
  try {
    const r = await honestRank(task, offers, [camp.sponsored_offer]);
    if (r.influenced) return send(res, 409, signed({ type: "refused_influenced_ranking", campaign, agent, task: taskId, blind: r.blind_choice, shown: r.shown_choice, charged: false }));
    return send(res, 200, signed({ type: "billable_view", campaign, agent, task: taskId, location: task.location, choice: r.choice, sponsored_won: r.sponsored_won,
      blind: r.blind_choice, shown: r.shown_choice, serv_ids: [r.serv.blind.id, r.serv.shown.id], serv_features: r.serv.shown.features, ranking: r.ranking }));
  } catch (e) {
    return send(res, 502, { error: "SERV unavailable; not charged" });
  }
}
