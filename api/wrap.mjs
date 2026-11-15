// Kite payout service: the official community wrapper kite-x402-hono (a SERV Hackathon priority repo)
// charges the brand on Kite's chain for every /v1/* request and forwards it to Aisle's check (/consider).
// The wrapper settles ONLY when the upstream answers below 400, so a fake agent, a manipulative ad
// or a sponsorship-influenced ranking is never charged.
import { createApp, loadConfig } from "kite-x402-hono";

let app;
export default {
  async fetch(request) {
    app ??= createApp(loadConfig());
    const url = new URL(request.url);
    const p = url.searchParams.get("__p") || "";
    url.searchParams.delete("__p");
    url.pathname = p === "__wk" ? "/.well-known/x402" : p === "__health" ? "/healthz" : "/v1/" + p;
    const req = new Request(url, request);
    return app.fetch(req, { clientIp: request.headers.get("x-real-ip") });
  },
};
