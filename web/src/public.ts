// Built by `npm run build:public` into backend/core/static/crypto.js for the server-rendered
// attest/ and vault/ pages. Contacts use these after the owner's death.
import { Buffer } from "buffer"; globalThis.Buffer ??= Buffer;
import { ready, sodium, unwrapShare as _unwrap, deriveVaultKey, decryptEntry } from "@deathnote/crypto";

export async function unwrapShare(share_ct: string, share_nonce: string, passphrase: string) {
  await ready; return _unwrap(share_ct, share_nonce, passphrase);
}
export async function openVault(entries: { title_ct: string; body_ct: string; nonce: string }[], salt_b64: string, passphrase: string) {
  await ready;
  const key = deriveVaultKey(passphrase, sodium.from_base64(salt_b64, sodium.base64_variants.ORIGINAL));
  return entries.map(e => decryptEntry(key, e));
}
