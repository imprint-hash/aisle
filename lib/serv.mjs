// SERV Reasoning client (OpenAI chat-completions format). The key is read from the environment, never logged.
const BASE = "https://inference-api.openserv.ai/v1/chat/completions";
export const MODEL = process.env.SERV_MODEL || "gpt-6-luna";

const tool = (name, params) => ({ type: "function", function: params ? { name, parameters: params } : { name } });
export const PROMPT_GUARD = tool("serv_prompt_guard");
export const shadow = (hint, max = 2) => tool("serv_shadow_agent", {
  type: "object", properties: { hint: { type: "string", default: hint }, max_iterations: { type: "integer", default: max } },
});

export async function serv({ system, user, schema, name = "result", multipath = false, tools = [], temperature }) {
  const key = process.env.OPENSERV_API_KEY;
  if (!key) throw new Error("OPENSERV_API_KEY is not set");
  const body = {
    model: MODEL + (multipath ? "-serv-multipath" : ""),
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
  };
  if (temperature !== undefined) body.temperature = temperature;
  if (schema) body.response_format = { type: "json_schema", json_schema: { name, strict: true, schema } };
  if (tools.length) body.tools = tools;
  const t0 = Date.now();
  const r = await fetch(BASE, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) {
    const msg = j.error?.message || `HTTP ${r.status}`;
    const err = new Error(`SERV: ${msg}`); err.status = r.status; err.body = j; throw err;
  }
  const msg = j.choices?.[0]?.message || {};
  const text = msg.content || "";
  const meta = { id: j.id, model: j.model, ms: Date.now() - t0, tokens: j.usage?.total_tokens, features: [multipath && "multipath", ...tools.map((t) => t.function.name)].filter(Boolean) };
  if (!schema) return { text, meta };
  try { return { data: JSON.parse(text), meta }; }
  catch { const err = new Error("SERV returned non-JSON"); err.text = text.slice(0, 300); throw err; }
}
