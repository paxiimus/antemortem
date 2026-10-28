// Vault + note encryption. All plaintext handling happens here, on the client.
import _sodium from "libsodium-wrappers-sumo";
import { timelockEncrypt, timelockDecrypt, roundAt, mainnetClient, type ChainClient } from "tlock-js";
import { split, combine } from "./shamir.ts";

export let sodium: typeof _sodium;
export const ready = _sodium.ready.then(() => { sodium = _sodium; });

const b64 = (u: Uint8Array) => sodium.to_base64(u, sodium.base64_variants.ORIGINAL);
const unb64 = (s: string) => sodium.from_base64(s, sodium.base64_variants.ORIGINAL);
const enc = (pt: Uint8Array, key: Uint8Array) => {
  const nonce = sodium.randombytes_buf(24);
  return { ct: sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(pt, null, null, nonce, key), nonce };
};
const dec = (ct: Uint8Array, nonce: Uint8Array, key: Uint8Array) =>
  sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ct, null, nonce, key);

// --- Vault key: Argon2id(passphrase, salt). The same key is the "recovery key" given to contacts.
export function deriveVaultKey(passphrase: string, salt: Uint8Array): Uint8Array {
  return sodium.crypto_pwhash(32, passphrase, salt,
    sodium.crypto_pwhash_OPSLIMIT_MODERATE, sodium.crypto_pwhash_MEMLIMIT_MODERATE,
    sodium.crypto_pwhash_ALG_ARGON2ID13);
}

export function encryptEntry(key: Uint8Array, title: string, body: string, blob?: Uint8Array) {
  const nonce = sodium.randombytes_buf(24);
  const e = (pt: Uint8Array) => b64(sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(pt, null, null, nonce, key));
  return { title_ct: e(sodium.from_string(title)), body_ct: e(sodium.from_string(body)),
           blob_ct: blob ? e(blob) : null, nonce: b64(nonce) };
}

export function decryptEntry(key: Uint8Array, e: { title_ct: string; body_ct: string; nonce: string }) {
  const nonce = unb64(e.nonce);
  return { title: sodium.to_string(dec(unb64(e.title_ct), nonce, key)),
           body: sodium.to_string(dec(unb64(e.body_ct), nonce, key)) };
}

// --- Public note: random key K. Body under K. K is (a) tlocked to a drand round and
// (b) Shamir-split k-of-k across contacts only. The server holds no share and cannot recover K.
export async function sealNote(opts: {
  text: string; contactPassphrases: string[]; horizonDays: number; client?: ChainClient;
}) {
  const client = opts.client ?? mainnetClient();
  const key = sodium.randombytes_buf(32);
  const { ct, nonce } = enc(sodium.from_string(opts.text), key);
  const round = roundAt(Date.now() + opts.horizonDays * 86_400_000, await client.chain().info());
  const tlocked = await timelockEncrypt(round, Buffer.from(key), client);

  const n = opts.contactPassphrases.length;
  if (n < 1) throw new Error("at least one contact");
  const shares = n === 1 ? [key.slice()] : split(key, n, n, sodium.randombytes_buf);
  const contactShares = opts.contactPassphrases.map((pass, i) => wrapShare(shares[i], pass));
  sodium.memzero(key);
  return {
    body_ct: b64(ct), nonce: b64(nonce),
    tlock_wrapped_key: b64(sodium.from_string(tlocked)), tlock_round: round,
    tlock_chain: (await client.chain().info()).hash,
    shamir_threshold: n, contactShares,
  };
}

// Contact's share is encrypted to a passphrase the owner hands them offline.
export function wrapShare(share: Uint8Array, passphrase: string) {
  const salt = sodium.randombytes_buf(16);
  const k = deriveVaultKey(passphrase, salt);
  const { ct, nonce } = enc(share, k);
  const out = new Uint8Array(16 + ct.length); out.set(salt); out.set(ct, 16);
  return { share_ct: b64(out), share_nonce: b64(nonce) };
}

export function unwrapShare(share_ct: string, share_nonce: string, passphrase: string): string {
  const buf = unb64(share_ct);
  const k = deriveVaultKey(passphrase, buf.slice(0, 16));
  return b64(dec(buf.slice(16), unb64(share_nonce), k));
}

export async function openNoteByTlock(tlock_wrapped_key: string, body_ct: string, nonce: string, client = mainnetClient()) {
  const key = await timelockDecrypt(sodium.to_string(unb64(tlock_wrapped_key)), client);
  return sodium.to_string(dec(unb64(body_ct), unb64(nonce), new Uint8Array(key)));
}

export function openNoteByShares(shares: string[], body_ct: string, nonce: string) {
  const key = shares.length === 1 ? unb64(shares[0]) : combine(shares.map(unb64));
  return sodium.to_string(dec(unb64(body_ct), unb64(nonce), key));
}
