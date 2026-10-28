import { atom } from "jotai";

export type User = {
  id: number; email: string; handle: string; display_name: string; kdf_salt: string;
  status: "alive" | "lapsed" | "pending" | "released";
  checkin_interval_days: number; tlock_horizon_days: number; last_checkin: string;
};
export type Contact = { id: number; name: string; email: string; share_ct: string; share_nonce: string; attested_at: string | null };
export type Entry = { id: number; title_ct: string; body_ct: string; nonce: string; updated_at: string };

export const tokenAtom = atom<string | null>(null);
export const userAtom = atom<User | null>(null);
export const vaultKeyAtom = atom<Uint8Array | null>(null);   // memory only, never persisted
export const contactsAtom = atom<Contact[]>([]);
