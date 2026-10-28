import { useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { api, ApiError } from "@antemortem/core";
import { decryptOwnerCopy, publishNote, unlock } from "@antemortem/core";
import { contactsAtom, userAtom, vaultKeyAtom, type Contact } from "@antemortem/core";
import { Button, Err, H, Input, P, Screen } from "@/ui";

type Note = { owner_copy_ct: string; owner_nonce: string; tlock_round: number };
const QUICKNET_GENESIS = 1692803367, PERIOD = 3;
const roundAt = (ms: number) => Math.floor((ms / 1000 - QUICKNET_GENESIS) / PERIOD) + 1;

export default function Unlock() {
  const user = useAtomValue(userAtom)!;
  const setKey = useSetAtom(vaultKeyAtom); const setContacts = useSetAtom(contactsAtom);
  const [pass, setPass] = useState(""); const [err, setErr] = useState<string | null>(null);

  const go = async () => {
    setErr(null);
    const key = unlock(pass, user);
    const contacts = await api<Contact[]>("/contacts/");
    setContacts(contacts);
    try {
      const note = await api<Note>("/note");
      const text = decryptOwnerCopy(key, note);                 // throws on wrong passphrase
      // Re-seal when the lock is past half its horizon, so the round never arrives while we're alive.
      const halfway = roundAt(Date.now() + user.tlock_horizon_days * 43_200_000);
      if (note.tlock_round < halfway) await publishNote(key, user, contacts, text);
    } catch (e: any) {
      if (!(e instanceof ApiError && e.status === 404)) { setErr("That passphrase doesn't open this vault."); return; }
    }
    setKey(key);
  };

  return (
    <Screen>
      <H>Unlock</H>
      <P dim>Vault passphrase. Argon2id runs on this device; the server only ever sees ciphertext. Forget it and nothing recovers it.</P>
      <Input placeholder="vault passphrase" value={pass} onChangeText={setPass} secureTextEntry onSubmitEditing={go} />
      <Button title="Unlock" onPress={go} disabled={pass.length < 8} />
      <Err e={err} />
    </Screen>
  );
}
