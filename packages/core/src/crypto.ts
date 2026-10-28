// Thin adapter over @antemortem/crypto for app flows. All plaintext stays here, in memory.
import { ready, sodium, deriveVaultKey, encryptEntry, decryptEntry, sealNote, unwrapShare } from "@antemortem/crypto";
import { api } from "./api.ts";
import type { Contact, Entry, User } from "./state.ts";

export { ready, deriveVaultKey, encryptEntry, decryptEntry };

const b64 = (u: Uint8Array) => sodium.to_base64(u, sodium.base64_variants.ORIGINAL);
const unb64 = (s: string) => sodium.from_base64(s, sodium.base64_variants.ORIGINAL);

export const unlock = (passphrase: string, user: User) => deriveVaultKey(passphrase, unb64(user.kdf_salt));

// Each contact's share passphrase is derived from the vault key, so re-sealing never changes
// what the owner handed them. Show it once per contact; it's theirs to keep offline.
export const contactPassphrase = (vaultKey: Uint8Array, contactId: number) =>
  b64(sodium.crypto_generichash(32, sodium.from_string(`contact:${contactId}`), vaultKey));

export function encryptOwnerCopy(vaultKey: Uint8Array, text: string) {
  const nonce = sodium.randombytes_buf(24);
  const ct = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(sodium.from_string(text), null, null, nonce, vaultKey);
  return { owner_copy_ct: b64(ct), owner_nonce: b64(nonce) };
}

export function decryptOwnerCopy(vaultKey: Uint8Array, n: { owner_copy_ct: string; owner_nonce: string }) {
  return sodium.to_string(sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, unb64(n.owner_copy_ct), null, unb64(n.owner_nonce), vaultKey));
}

/** Seal (or re-seal) the public note: fresh K, fresh tlock round, fresh k-of-k split; push note + contact shares. */
export async function publishNote(vaultKey: Uint8Array, user: User, contacts: Contact[], text: string) {
  const sealed = await sealNote({
    text, horizonDays: user.tlock_horizon_days,
    contactPassphrases: contacts.map(c => contactPassphrase(vaultKey, c.id)),
  });
  const { contactShares, ...note } = sealed;
  await api("/note", { method: "PUT", json: { ...note, ...encryptOwnerCopy(vaultKey, text) } });
  await Promise.all(contacts.map((c, i) => api(`/contacts/${c.id}/`, { method: "PATCH", json: contactShares[i] })));
}

export const readEntries = (vaultKey: Uint8Array, entries: Entry[]) =>
  entries.map(e => ({ id: e.id, updated_at: e.updated_at, ...decryptEntry(vaultKey, e) }));

// --- Contact side. The contact has: the access token (from the email link), the share passphrase
// (from the owner, offline), and after release the owner's vault passphrase (same channel).
export type ContactView = {
  owner: { handle: string; display_name: string; status: User["status"]; kdf_salt: string };
  contact: { name: string; attested_at: string | null; share_ct: string; share_nonce: string };
  vault?: Entry[];
};
export const fetchContactView = (token: string) => api<ContactView>(`/c/${token}`);

export async function attestDeath(token: string, view: ContactView, sharePassphrase: string) {
  const share = unwrapShare(view.contact.share_ct, view.contact.share_nonce, sharePassphrase); // throws on wrong passphrase
  return api<{ attested_at: string; owner_status: User["status"] }>(`/c/${token}/attest`, { method: "POST", json: { share } });
}

export function openContactVault(view: ContactView, vaultPassphrase: string) {
  const key = deriveVaultKey(vaultPassphrase, unb64(view.owner.kdf_salt));
  return readEntries(key, view.vault ?? []);
}
