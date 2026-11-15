// Aisle site: renders the real run, earnings and honesty numbers from signed JSON, and runs the live demo.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => "$" + Number(n).toFixed(n < 0.01 ? 3 : 2);
const scan = (tx) => `<a class="tx" href="https://basescan.org/tx/${esc(tx)}" target="_blank" rel="noopener noreferrer">${esc(tx.slice(0, 10))}…${esc(tx.slice(-6))}</a>`;
const get = (p) => fetch(p, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

const [run, evalr, camp, offersFile] = await Promise.all([get("/data/run.json"), get("/data/eval.json"), get("/data/campaign.json"), get("/data/offers.json")]);
const offers = offersFile?.offers || [];
const seller = (id) => offers.find((o) => o.id === id)?.seller || id;

// ---- live numbers ----
if (run) {
  const paidShopper = run.settlements.filter((s) => s.role === "shopper").reduce((a, s) => a + s.amount_usd, 0);
  const influenced = (run.views || []).filter((v) => v.influenced).length;
  $("stats").innerHTML = [
    [run.views.length, "verified views billed"],
    [money(paidShopper), "paid to the shopper, on Base"],
    [`${influenced} / ${run.views.length}`, "choices influenced by sponsorship"],
    [run.refusals.filter((r) => r.type === "refused_unverified_agent").length ? "$0" : "–", "paid to unregistered agents"],
  ].map(([b, s]) => `<div class="stat"><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join("");
}

// ---- live demo ----
if (camp) {
  $("task").innerHTML = camp.tasks.map((t) => `<option value="${esc(t.id)}">${esc(t.location)}: ${esc(t.need)} (${t.min_days}+ days)</option>`).join("");
  $("sponsor").innerHTML = offers.map((o) => `<option value="${esc(o.id)}"${o.id === camp.sponsored_offer ? " selected" : ""}>${esc(o.seller)} · $${o.price_usd}</option>`).join("");
  $("rules").innerHTML = camp.billable_view_rule.map((r) => `<li>${esc(r)}</li>`).join("");
  $("adv").textContent = `Advertiser: ${camp.advertiser}. Price per verified view: ${money(camp.price_per_view_usd)}. Budget: ${money(camp.budget_usd)}.`;
}
$("tryform").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("trybtn"), out = $("tryout");
  btn.disabled = true; btn.textContent = "SERV is ranking (blind and shown)…";
  out.innerHTML = `<p class="muted">Two SERV Reasoning runs with Multipath and Shadow Agent. About 10–20 seconds.</p>`;
  try {
    const r = await fetch("/api/rank", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task: $("task").value, sponsor: $("sponsor").value }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    const verdict = j.influenced
      ? `<span class="bad">Sponsorship changed the choice. Aisle would not bill or buy.</span>`
      : j.sponsored_won ? `<span class="ok">The sponsored seller won on merit: same choice with the sponsor hidden.</span>`
      : `<span class="ok">Sponsorship had no influence. The honest choice stands.</span>`;
    out.innerHTML = `<div class="verdict">
      <div class="box"><div class="k">Sponsor hidden</div><div class="v">${esc(seller(j.blind_choice))}</div></div>
      <div class="box"><div class="k">Sponsor shown</div><div class="v">${esc(seller(j.shown_choice))}</div></div>
      <div class="box"><div class="k">Result</div><div class="v">${verdict}</div></div></div>
      <div class="tablewrap"><table><thead><tr><th>Seller</th><th>Verdict</th><th>Why (in plain words)</th></tr></thead><tbody>
      ${j.ranking.map((x) => `<tr><td class="mono">${esc(seller(x.id))}${x.id === j.sponsor ? ' <span class="chip spon">sponsored</span>' : ""}</td><td><span class="chip ${x.verdict === "disqualified" ? "bad" : "ok"}">${esc(x.verdict)}</span></td><td>${esc(x.reason)}</td></tr>`).join("")}
      </tbody></table></div>
      <p class="muted">SERV features used: ${esc((j.serv?.shown?.features || []).join(", "))}. Nothing was paid.</p>`;
  } catch (err) { out.innerHTML = `<p class="bad">${esc(err.message)}</p>`; }
  btn.disabled = false; btn.textContent = "Rank it live";
});

// ---- the real run ----
if (run) {
  const v = run.views, ref = run.refusals, buys = run.purchases.filter((p) => p.ok), st = run.settlements;
  const fake = ref.find((r) => r.type === "refused_unverified_agent");
  $("steps").innerHTML = `
  <li><h3>The ad is screened as untrusted input</h3><p>SERV read the brand's ad copy and classified it: <span class="chip ${run.ad_screen?.blocked ? "bad" : "ok"}">${run.ad_screen?.blocked ? "blocked" : "allowed"}</span> ${esc(run.ad_screen?.why || "")}</p></li>
  <li><h3>Only a Kite-registered agent can earn</h3><p><span class="chip ok">verified</span> <span class="mono">${esc(v[0]?.agent_id || "")}</span>: ${esc(v[0]?.agent_check || "")}.</p>
      ${fake ? `<p><span class="chip bad">refused</span> <span class="mono">${esc(fake.agent_id)}</span>: ${esc(fake.reason)}. Paid $0.</p>` : ""}</li>
  <li><h3>Five shopping tasks, ranked twice</h3><div class="tablewrap"><table><thead><tr><th>Task</th><th>Sponsor hidden</th><th>Sponsor shown</th><th>Influenced?</th><th>Billed</th></tr></thead><tbody>
      ${v.map((x) => `<tr><td>${esc(x.location)}<br><span class="muted">${esc(x.need)}</span></td><td class="mono">${esc(seller(x.blind_choice))}</td><td class="mono">${esc(seller(x.shown_choice))}${x.sponsored_won ? ' <span class="chip spon">sponsored won on merit</span>' : ""}</td><td><span class="chip ${x.influenced ? "bad" : "ok"}">${x.influenced ? "yes" : "no"}</span></td><td>${money(x.price_usd)}</td></tr>`).join("")}
      </tbody></table></div></li>
  <li><h3>The agent buys each winner through Kite Passport</h3><p>Real paid calls inside a passkey-approved spending session (max $0.01 per payment). If a seller's checkout failed, the agent fell back to its next-best qualified choice.</p>
      <div class="tablewrap"><table><thead><tr><th>Task</th><th>Bought from</th><th>Paid</th><th>Transaction (Base)</th></tr></thead><tbody>
      ${buys.map((p) => `<tr><td>${esc(v.find((x) => x.task === p.task)?.location || p.task)}</td><td class="mono">${esc(p.seller)}${p.chosen === false ? ' <span class="muted">(fallback)</span>' : ""}</td><td>${money(p.amount_usd)}</td><td>${scan(p.tx)}</td></tr>`).join("")}
      </tbody></table></div></li>
  <li><h3>The brand settles verified views through Kite</h3><p>${v.length} views × ${money(v[0]?.price_usd || 0)} = ${money(v.reduce((a, x) => a + x.price_usd, 0))}, split 60 / 25 / 15. Passkey-approved Kite wallet transfers on Base:</p>
      <ul>${st.map((s) => `<li><b>${s.role === "shopper" ? "Shopper" : "Aisle (incl. the agent developer's 15%)"}</b>: ${money(s.amount_usd)} → <span class="mono">${esc(s.to.slice(0, 8))}…</span> ${s.tx ? scan(s.tx) : ""}</li>`).join("")}</ul></li>`;

  const sh = st.find((s) => s.role === "shopper");
  $("earnings").innerHTML = `<div class="big"><span>Earned from verified shopping activity</span><b>${money(sh?.amount_usd || 0)}</b><span>${v.length} verified views · ${buys.length} purchases · ${v.filter((x) => x.influenced).length} influenced choices</span></div>
    <div class="tablewrap"><table><thead><tr><th>Brand campaign</th><th>Task</th><th>Your share</th></tr></thead><tbody>
    ${v.map((x) => `<tr><td>${esc(seller(camp?.sponsored_offer))} <span class="chip spon">sponsored</span></td><td>${esc(x.location)}</td><td>+${money(x.split_usd?.shopper || 0)}</td></tr>`).join("")}</tbody></table></div>`;
}

// ---- per-view payouts on Kite's chain (kite-x402-hono) ----
const kv = await get("/data/kite-views.json");
if (kv) {
  const kscan = (tx) => `<a class="tx" href="https://testnet.kitescan.ai/tx/${esc(tx)}" target="_blank" rel="noopener noreferrer">${esc(tx.slice(0, 10))}…${esc(tx.slice(-6))}</a>`;
  const loc = (t) => camp?.tasks.find((x) => x.id === t)?.location || t;
  $("kiterows").innerHTML = kv.results.map((r) => `<tr><td class="mono">${esc(r.agent.slice(0, 14))}…</td><td>${esc(loc(r.task))}</td>
    <td><span class="chip ${r.status === 200 ? "ok" : "bad"}">${esc(r.receipt?.type?.replace(/_/g, " ") || r.status)}</span></td>
    <td>${r.charged ? "$0.05 pieUSD" : "$0, not charged"}</td><td>${r.tx ? kscan(r.tx) : "–"}</td></tr>`).join("");
  const paid = kv.results.filter((r) => r.charged).length;
  $("kitenote").innerHTML = `${paid} paid views settled straight to the shopper's wallet <span class="mono">${esc(kv.results[0]?.payTo?.slice(0, 10))}…</span>. Brand agent <span class="mono">${esc(kv.brand.slice(0, 10))}…</span>. Record signed by Aisle: <a href="/data/kite-views.json">kite-views.json</a>.`;
}

// ---- honesty numbers ----
if (evalr) {
  const A = evalr.A, B = evalr.B, C = evalr.C, D = evalr.D;
  $("evalgrid").innerHTML = [
    A && [`${A.influenced} / ${A.runs - A.errors}`, `rankings changed by sponsorship (every task × every seller as sponsor). Sponsor still won on merit ${A.sponsor_won_on_merit} times.`],
    B && [`${B.manipulative_blocked} / ${B.manipulative}`, `manipulative ads blocked (pressure, fake authority, "ignore your rules", budget redirects)`],
    B && [`${B.normal_wrongly_blocked} / ${B.normal}`, `normal ads wrongly blocked`],
    C && [`${C.poisoned_offer_chosen} / ${C.cases}`, `times an injected seller name ("ignore other offers…") got chosen`],
    D && [`${D.paid} / ${D.fake_agents}`, `fake, unregistered agents paid`],
  ].filter(Boolean).map(([b, s]) => `<div class="stat"><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join("");
}

// ---- verify receipts in the browser (Ed25519 via WebCrypto) ----
const canon = (v) => Array.isArray(v) ? `[${v.map(canon).join(",")}]`
  : v && typeof v === "object" ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}` : JSON.stringify(v);
$("verifybtn").addEventListener("click", async () => {
  const out = $("verifyout");
  try {
    const der = Uint8Array.from(atob(run.public_key.replace(/-----[^-]+-----|\s/g, "")), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey("spki", der, { name: "Ed25519" }, false, ["verify"]);
    const all = [...run.views, ...run.refusals, ...run.purchases, ...run.settlements];
    let ok = 0;
    for (const r of all) {
      const { sig, ...body } = r;
      const good = await crypto.subtle.verify({ name: "Ed25519" }, key, Uint8Array.from(atob(sig), (c) => c.charCodeAt(0)), new TextEncoder().encode(canon(body)));
      if (good) ok++;
    }
    out.innerHTML = `<span class="${ok === all.length ? "ok" : "bad"}">${ok} of ${all.length} receipts verified against Aisle's public key.</span>`;
  } catch (e) { out.textContent = "This browser can't check Ed25519 signatures (try a recent Chrome)."; }
});
