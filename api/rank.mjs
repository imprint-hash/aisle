// Live demo for judges: one honest ranking with SERV (no money moves). Only preset tasks and sponsors are accepted,
// so the endpoint can't be used as a free general-purpose LLM proxy. Small per-instance rate limit.
import fs from "node:fs";
import path from "node:path";
import { honestRank } from "../lib/rank.mjs";

const root = process.cwd();
const camp = JSON.parse(fs.readFileSync(path.join(root, "data/campaign.json"), "utf8"));
const offers = JSON.parse(fs.readFileSync(path.join(root, "data/offers.json"), "utf8")).offers;
const hits = new Map();

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") return res.status(405).end(JSON.stringify({ error: "POST only" }));
  let body = req.body; if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const task = camp.tasks.find((t) => t.id === body?.task);
  const sponsor = offers.find((o) => o.id === body?.sponsor);
  if (!task || !sponsor) return res.status(400).end(JSON.stringify({ error: "Pick one of the listed tasks and sponsors." }));
  const ip = String(req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || "x").split(",")[0];
  const now = Date.now(); const h = (hits.get(ip) || []).filter((t) => now - t < 60000);
  if (h.length >= 6) return res.status(429).end(JSON.stringify({ error: "Too many runs. Try again in a minute." }));
  hits.set(ip, [...h, now]);
  try {
    const r = await honestRank(task, offers, [sponsor.id]);
    res.status(200).end(JSON.stringify({ task: task.id, sponsor: sponsor.id, ...r }));
  } catch (e) {
    res.status(502).end(JSON.stringify({ error: "SERV did not answer in time. Please try again." }));
  }
}
