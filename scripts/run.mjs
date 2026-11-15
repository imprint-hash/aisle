// Aisle end-to-end run on real Kite + SERV. Phases:
//   node scripts/run.mjs views    screen the ad, verify agents (and a fake one), rank honestly, record billable views
//   node scripts/run.mjs buy      the shopper agent buys each task's winner through its Kite Passport session (real USDC)
//   node scripts/run.mjs settle   the brand settles verified views through Kite wallet send (passkey) to the shopper and Aisle
// Everything is written to data/run.json (signed receipts) for the website.
import fs from "node:fs";
import { honestRank, screenAd } from "../lib/rank.mjs";
import { verifyAgent, myAgents, pay, send, sendStatus, walletBalance } from "../lib/kite.mjs";
import { sign, publicKeyPem } from "../lib/receipts.mjs";

const RUN = new URL("../data/run.json", import.meta.url);
const camp = JSON.parse(fs.readFileSync(new URL("../data/campaign.json", import.meta.url)));
const offers = JSON.parse(fs.readFileSync(new URL("../data/offers.json", import.meta.url))).offers;
const load = () => (fs.existsSync(RUN) ? JSON.parse(fs.readFileSync(RUN)) : { campaign: camp.id, views: [], refusals: [], purchases: [], settlements: [], ad_screen: null });
const save = (r) => { r.public_key = publicKeyPem(); r.updated_at = new Date().toISOString(); fs.writeFileSync(RUN, JSON.stringify(r, null, 1)); };
const usd = (n) => Math.round(n * 1e6) / 1e6;
const say = (...a) => console.log(...a);

async function views() {
  const r = load();
  say("1. Screening the ad copy (untrusted input)…");
  r.ad_screen = await screenAd(camp.ad_copy);
  say("   ", r.ad_screen.blocked ? "BLOCKED" : "ok", "-", r.ad_screen.why);
  if (r.ad_screen.blocked) { save(r); return say("Campaign refused: ad copy is manipulative."); }

  const agent = myAgents()[0];
  say("2. Verifying shopper agents with Kite…");
  const real = verifyAgent(agent);
  const fake = verifyAgent("agent_01ffffff-0000-7000-8000-00000000b07");
  say("    real:", real.ok, real.how); say("    fake:", fake.ok, fake.how);
  if (!r.refusals.find((x) => x.agent_id === fake.agent_id)) r.refusals.push(sign({ type: "refused_unverified_agent", campaign: camp.id, agent_id: fake.agent_id, reason: fake.how, paid_usd: 0 }));
  if (!real.ok) { save(r); return say("Shopper agent not verified. Nothing billed."); }

  say("3. Honest ranking per shopping task…");
  let spent = r.views.reduce((s, v) => s + v.price_usd, 0);
  for (const task of camp.tasks) {
    if (r.views.find((v) => v.task === task.id && v.agent_id === agent)) { say(`    ${task.id}: already billed (dedupe)`); continue; }
    const res = await honestRank(task, offers, [camp.sponsored_offer]);
    const winner = offers.find((o) => o.id === (res.choice || res.shown_choice));
    say(`    ${task.id} ${task.location}: blind=${res.blind_choice} shown=${res.shown_choice} influenced=${res.influenced} sponsored_won=${res.sponsored_won}`);
    const base = { campaign: camp.id, task: task.id, location: task.location, need: task.need, agent_id: agent, agent_check: real.how,
      sponsored_offer: camp.sponsored_offer, blind_choice: res.blind_choice, shown_choice: res.shown_choice, influenced: res.influenced,
      sponsored_won: res.sponsored_won, ranking: res.ranking, serv_features: res.serv.shown.features, serv_ids: [res.serv.blind.id, res.serv.shown.id], winner: winner?.id };
    if (res.influenced) { r.refusals.push(sign({ type: "refused_influenced_ranking", ...base, paid_usd: 0 })); say("      → sponsorship changed the choice: not billed, nothing bought"); continue; }
    if (spent + camp.price_per_view_usd > camp.budget_usd + 1e-9) { r.refusals.push(sign({ type: "refused_budget_exhausted", ...base, paid_usd: 0 })); continue; }
    spent += camp.price_per_view_usd;
    r.views.push(sign({ type: "billable_view", ...base, price_usd: camp.price_per_view_usd,
      split_usd: Object.fromEntries(Object.entries(camp.split).map(([k, v]) => [k, usd(camp.price_per_view_usd * v)])) }));
    save(r);
  }
  save(r);
  say(`Billable views: ${r.views.length}, owed by the brand: $${usd(spent)}`);
}

function params(o, t) {
  const q = { vibesprings: { location: t.city, days: t.min_days }, tbs: { city: t.city }, hugen: { city: t.city, days: Math.min(7, t.min_days) },
    otto: { location: t.city }, agent402: { lat: t.lat, lon: t.lon }, sitecheck: { lat: t.lat, lon: t.lon } }[o.id] || {};
  return o.url + "?" + new URLSearchParams(q).toString();
}

async function buy() {
  const r = load();
  for (const v of r.views) {
    if (r.purchases.find((p) => p.task === v.task && p.ok)) continue;
    const t = camp.tasks.find((x) => x.id === v.task);
    // Try the chosen offer first, then the other qualified offers in the agent's own ranking order.
    const order = [v.winner, ...v.ranking.filter((x) => x.verdict === "qualified").map((x) => x.id)];
    const attempts = [];
    for (const id of order) {
      const o = offers.find((x) => x.id === id);
      if (o.price_usd > 0.01) { attempts.push({ seller: o.seller, skipped: "above the session's per-payment cap" }); continue; }
      say(`Buying ${o.seller} for ${t.location} ($${o.price_usd}) through Kite Passport…`);
      const res = pay(params(o, t), o.method);
      const p = res.payment || {};
      const ok = res.status === "success";
      attempts.push({ seller: o.seller, ok, error: ok ? null : (res.error || "").slice(0, 160) });
      say("   ", ok ? `paid ${Number(p.amount) / 1e6} USDC on ${p.network}, tx ${p.transaction_hash}` : `checkout failed: ${(res.error || "").slice(0, 120)}`);
      if (!ok) continue;
      r.purchases.push(sign({ type: "purchase", task: v.task, seller: o.seller, chosen: id === v.winner, url: params(o, t), ok, http: p.status_code,
        network: p.network, tx: p.transaction_hash, amount_usd: Number(p.amount) / 1e6, session_id: res.session_id, attempts }));
      break;
    }
    if (!r.purchases.find((p) => p.task === v.task && p.ok)) r.purchases.push(sign({ type: "purchase", task: v.task, ok: false, attempts }));
    save(r);
  }
}

async function settle() {
  // One payout per call so the owner can approve each within Kite's ~1 minute window: node scripts/run.mjs settle shopper|aisle
  const role = process.argv[3];
  const r = load();
  const to = { shopper: process.env.SHOPPER_PAYOUT, aisle: process.env.AISLE_TREASURY }[role];
  if (!to) throw new Error("usage: settle shopper|aisle (needs SHOPPER_PAYOUT / AISLE_TREASURY)");
  if (r.settlements.find((s) => s.role === role && s.status === "success")) return say(`${role} already settled.`);
  r.settlements = r.settlements.filter((s) => !(s.role === role && s.status !== "success"));
  const total = usd(r.views.reduce((s, v) => s + v.price_usd, 0));
  const toShopper = usd(total * camp.split.shopper);
  const amount = role === "shopper" ? toShopper : usd(total - toShopper);
  const req = send({ to, amount });
  const id = req.request_id || req.id;
  say(`APPROVE NOW (about 1 minute): ${req.approval_url}`);
  say(`  ${amount} USDC on Base to ${to} (${role}), for ${r.views.length} verified views`);
  const { kpass } = await import("../lib/kite.mjs");
  const st = kpass(["wallet", "send-status", "--request-id", id, "--wait", "--timeout", "300"], { allowError: true });
  const tx = st.transaction_hash || st.tx_hash || st.result?.transaction_hash || st.send?.transaction_hash || st.transfer?.transaction_hash;
  say(`  result: ${st.status} ${tx || ""} ${st.error || ""}`);
  if (st.status === "success") say("  details:", JSON.stringify(Object.fromEntries(Object.entries(st).filter(([k]) => k !== "_version"))).slice(0, 600));
  r.settlements.push(sign({ type: "settlement", role, to, amount_usd: amount, chain: "base", views: r.views.map((v) => v.task), request_id: id, status: st.status, tx }));
  save(r);
}

const phase = process.argv[2];
await ({ views, buy, settle }[phase] || (() => say("usage: node scripts/run.mjs views|buy|settle")))();
