import { useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { api, ApiError, contactsAtom, decryptOwnerCopy, publishNote, unlock, userAtom, vaultKeyAtom, type Contact } from "@deathnote/core";
import { Busy, Err } from "../ui.tsx";

type Note = { owner_copy_ct: string; owner_nonce: string; tlock_round: number };
const roundAt = (ms: number) => Math.floor((ms / 1000 - 1692803367) / 3) + 1;   // drand quicknet

export default function Unlock() {
  const user = useAtomValue(userAtom)!;
  const setKey = useSetAtom(vaultKeyAtom); const setContacts = useSetAtom(contactsAtom);
  const [pass, setPass] = useState(""); const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    setErr(null);
    const key = unlock(pass, user);
    const contacts = await api<Contact[]>("/contacts/"); setContacts(contacts);
    try {
      const note = await api<Note>("/note");
      const text = decryptOwnerCopy(key, note);
      if (note.tlock_round < roundAt(Date.now() + user.tlock_horizon_days * 43_200_000)) await publishNote(key, user, contacts, text);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 404)) { setErr("That passphrase doesn't open this vault."); return; }
    }
    setKey(key);
  };
  return <>
    <h1>Unlock</h1>
    <p className="dim">Vault passphrase. Argon2id runs in this tab; the server only ever sees ciphertext. Forget it and nothing recovers it.</p>
    <input placeholder="vault passphrase" type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} autoFocus />
    <Busy title="Unlock" onClick={go} disabled={pass.length < 8} />
    <Err e={err} />
  </>;
}
