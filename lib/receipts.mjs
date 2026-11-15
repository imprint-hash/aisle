// Signed receipts. Aisle signs every billable-view and settlement record with an Ed25519 key kept on the agent machine;
// the public key is published on the site so anyone can check a receipt was issued by Aisle and not edited.
import crypto from "node:crypto";
import fs from "node:fs";

const KEY_FILE = new URL("../.aisle-signing-key.pem", import.meta.url);

export function signingKey() {
  if (!fs.existsSync(KEY_FILE)) {
    const { privateKey } = crypto.generateKeyPairSync("ed25519");
    fs.writeFileSync(KEY_FILE, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
  }
  return crypto.createPrivateKey(fs.readFileSync(KEY_FILE));
}
export const publicKeyPem = () => crypto.createPublicKey(signingKey()).export({ type: "spki", format: "pem" });

const canon = (o) => JSON.stringify(o, Object.keys(o).sort());
export function sign(record) {
  const body = { ...record, issued_at: record.issued_at || new Date().toISOString() };
  const sig = crypto.sign(null, Buffer.from(canon(body)), signingKey()).toString("base64");
  return { ...body, sig };
}
export function verify(receipt, pubPem) {
  const { sig, ...body } = receipt;
  return crypto.verify(null, Buffer.from(canon(body)), crypto.createPublicKey(pubPem), Buffer.from(sig, "base64"));
}
