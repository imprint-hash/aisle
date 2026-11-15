// Thin wrapper over Kite's official CLI (kpass). Runs on the agent machine only; never on the website.
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import os from "node:os";

const KPASS = process.env.KPASS_BIN || `${os.homedir()}/.local/bin/kpass`;

export function kpass(args, { allowError = false } = {}) {
  let out;
  try { out = execFileSync(KPASS, [...args, "--output", "json", "--no-interactive"], { encoding: "utf8", timeout: 180000 }); }
  catch (e) { out = e.stdout?.toString() || ""; if (!out && !allowError) throw e; }
  let j; try { j = JSON.parse(out); } catch { j = { status: "error", error: out.slice(0, 300) }; }
  if (j.status === "error" && !allowError) { const err = new Error(`kpass ${args[0]} ${args[1] || ""}: ${j.error}`); err.kpass = j; throw err; }
  return j;
}

// Which agent identities does this Kite account own? (passkey-backed account, Kite-issued agent ids)
export function myAgents() {
  const s = kpass(["status"]);
  const ids = new Set();
  if (s.agent?.agent_id) ids.add(s.agent.agent_id);
  try { const u = kpass(["user", "agents"], { allowError: true }); for (const a of u.agents || u.items || []) ids.add(a.agent_id || a.id); } catch {}
  return [...ids].filter(Boolean);
}

// A shopper agent can earn only if it is a Kite-registered agent linked to an authorised account.
export function verifyAgent(agentId) {
  const owned = myAgents();
  if (owned.includes(agentId)) return { ok: true, how: "Kite-registered agent under a passkey-backed Kite account", agent_id: agentId };
  // Public directory lookup (works for listed agents; needs the owner's Kite onboarding to be verified)
  try {
    const out = execFileSync(`${os.homedir()}/.local/bin/ksearch`, ["agent", "get", agentId, "--output", "json"], { encoding: "utf8", timeout: 60000 });
    const j = JSON.parse(out);
    if (j.status !== "error" && (j.agent || j.did)) return { ok: true, how: "Listed in Kite's public agent directory", agent_id: agentId };
  } catch {}
  return { ok: false, how: "Not a Kite-registered agent: no identity found", agent_id: agentId };
}

export function walletBalance() {
  const b = kpass(["wallet", "balance"]);
  const out = {};
  for (const a of b.assets || []) for (const c of a.chains || []) if (Number(c.amount) > 0) out[`${a.asset}@${c.chain}`] = Number(c.amount);
  return out;
}

// Real paid call through the approved Passport session.
export function pay(url, method = "GET") {
  return kpass(["session", "execute", "--url", url, "--method", method, "--idempotency-key", crypto.randomUUID(), "--no-browser"], { allowError: true });
}

// Real USDC transfer through Kite (needs the owner's passkey in the browser).
export function send({ to, amount, chain = "base", asset = "USDC" }) {
  return kpass(["wallet", "send", "--to", to, "--amount", String(amount), "--chain", chain, "--asset", asset], { allowError: true });
}
export const sendStatus = (id) => kpass(["wallet", "send-status", "--request-id", id], { allowError: true });
