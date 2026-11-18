// Vault + note encryption. All plaintext handling happens here, on the client.
import _sodium from "libsodium-wrappers-sumo";
import { timelockEncrypt, timelockDecrypt, roundAt, mainnetClient, type ChainClient } from "tlock-js";
import { split, combine } from "./shamir.ts";

export let sodium: typeof _sodium;
export const ready = _sodium.ready.then(() => { sodium = _sodium; });

// Static import on purpose: a lazy import() of tlock-js fails in Expo dev builds, which serve lazy modules
// as separate bundles resolved from app/, and tlock-js lives in packages/crypto/node_modules.
// One client is reused so drand chain info is fetched once, not per seal.
let defaultClient: ChainClient | undefined;
const getClient = (c?: ChainClient) => c ?? (defaultClient ??= mainnetClient());

// Encoding helpers that don't go through libsodium: react-native-libsodium implements only part of the
// libsodium-wrappers API (no from_string, no base64_variants). Same bytes, and the standard padded base64
// the server decodes. Buffer is Node's built-in, and the app's polyfill on phones.
export const utf8 = (s: string) => new Uint8Array(Buffer.from(s, "utf8"));
export const unutf8 = (u: Uint8Array) => Buffer.from(u).toString("utf8");
export const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64");
export const unb64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));
// Additional data is "" rather than null everywhere: react-native-libsodium only accepts a string there.
// An empty string is zero bytes of additional data, so ciphertexts are byte-identical to passing null in
// libsodium-wrappers, Node and the server.
const NO_AD = "";
const enc = (pt: Uint8Array, key: Uint8Array) => {
  const nonce = sodium.randombytes_buf(24);
  return { ct: sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(pt, NO_AD, null, nonce, key), nonce };
};
const dec = (ct: Uint8Array, nonce: Uint8Array, key: Uint8Array) =>
  sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ct, NO_AD, nonce, key);

// --- Vault key: Argon2id(passphrase, salt). The same key is the "recovery key" given to contacts.
// Argon2id, opslimit 3, 256 MiB (libsodium's MODERATE). Written as numbers so it doesn't depend on
// the React Native binding exporting the named constants. Changing these breaks every existing vault.
const ARGON2ID13 = 2, OPS = 3, MEM = 256 * 1024 * 1024;
export function deriveVaultKey(passphrase: string, salt: Uint8Array): Uint8Array {
  return sodium.crypto_pwhash(32, passphrase, salt, OPS, MEM, ARGON2ID13);
}

// An entry has one stored nonce but up to three ciphertexts, so each field gets its own subkey:
// no (key, nonce) pair is ever used twice. Fields also can't be swapped for one another.
type Field = "title" | "body" | "blob";
const fieldKey = (key: Uint8Array, f: Field) => sodium.crypto_generichash(32, utf8(`antemortem/vault/${f}`), key);

export function encryptEntry(key: Uint8Array, title: string, body: string, blob?: Uint8Array) {
  const nonce = sodium.randombytes_buf(24);
  const e = (f: Field, pt: Uint8Array) => b64(sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(pt, NO_AD, null, nonce, fieldKey(key, f)));
  return { title_ct: e("title", utf8(title)), body_ct: e("body", utf8(body)),
           blob_ct: blob ? e("blob", blob) : null, nonce: b64(nonce) };
}

export function decryptEntry(key: Uint8Array, e: { title_ct: string; body_ct: string; nonce: string }) {
  const nonce = unb64(e.nonce);
  return { title: unutf8(dec(unb64(e.title_ct), nonce, fieldKey(key, "title"))),
           body: unutf8(dec(unb64(e.body_ct), nonce, fieldKey(key, "body"))) };
}

// --- Public note: random key K. Body under K. K is (a) tlocked to a drand round and
// (b) Shamir-split k-of-k across contacts only. The server holds no share and cannot recover K.
export async function sealNote(opts: {
  text: string; contactPassphrases: string[]; horizonDays: number; client?: ChainClient;
}) {
  const client = getClient(opts.client);
  const info = await client.chain().info();
  const key = sodium.randombytes_buf(32);
  const { ct, nonce } = enc(utf8(opts.text), key);
  const round = roundAt(Date.now() + opts.horizonDays * 86_400_000, info);
  const tlocked = await timelockEncrypt(round, Buffer.from(key), client);

  const n = opts.contactPassphrases.length;
  if (n < 1) throw new Error("at least one contact");
  const shares = n === 1 ? [key.slice()] : split(key, n, n, sodium.randombytes_buf);
  const contactShares = opts.contactPassphrases.map((pass, i) => wrapShare(shares[i], pass));
  key.fill(0);
  return {
    body_ct: b64(ct), nonce: b64(nonce),
    tlock_wrapped_key: b64(utf8(tlocked)), tlock_round: round,
    tlock_chain: info.hash,
    shamir_threshold: n, contactShares,
  };
}

// Contact's share is encrypted to a passphrase the owner hands them offline. That passphrase is
// 256 bits of key material (core/contactPassphrase), not something a person chose, so a fast keyed
// hash is enough. Argon2id here cost 256 MiB per contact on every seal. Never feed it a human passphrase.
const shareKey = (passphrase: string, salt: Uint8Array) => {
  const tag = utf8("antemortem/share"), pw = utf8(passphrase);
  const m = new Uint8Array(tag.length + salt.length + pw.length);
  m.set(tag); m.set(salt, tag.length); m.set(pw, tag.length + salt.length);
  return sodium.crypto_generichash(32, m);
};

export function wrapShare(share: Uint8Array, passphrase: string) {
  const salt = sodium.randombytes_buf(16);
  const k = shareKey(passphrase, salt);
  const { ct, nonce } = enc(share, k);
  const out = new Uint8Array(16 + ct.length); out.set(salt); out.set(ct, 16);
  return { share_ct: b64(out), share_nonce: b64(nonce) };
}

export function unwrapShare(share_ct: string, share_nonce: string, passphrase: string): string {
  const buf = unb64(share_ct);
  const k = shareKey(passphrase, buf.slice(0, 16));
  return b64(dec(buf.slice(16), unb64(share_nonce), k));
}

export async function openNoteByTlock(tlock_wrapped_key: string, body_ct: string, nonce: string, client?: ChainClient) {
  const key = await timelockDecrypt(unutf8(unb64(tlock_wrapped_key)), getClient(client));
  return unutf8(dec(unb64(body_ct), unb64(nonce), new Uint8Array(key)));
}

export function openNoteByShares(shares: string[], body_ct: string, nonce: string) {
  const key = shares.length === 1 ? unb64(shares[0]) : combine(shares.map(unb64));
  return unutf8(dec(unb64(body_ct), unb64(nonce), key));
}
