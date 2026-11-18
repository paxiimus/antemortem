import { useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { api, ApiError } from "@antemortem/core";
import { decryptOwnerCopy, publishNote, readEntries, unlock } from "@antemortem/core";
import { contactsAtom, userAtom, vaultKeyAtom, type Contact, type Entry } from "@antemortem/core";
import { Button, Err, H, Input, P, Screen } from "@/ui";

type Note = { owner_copy_ct: string; owner_nonce: string; tlock_round: number };
const QUICKNET_GENESIS = 1692803367, PERIOD = 3;
const roundAt = (ms: number) => Math.floor((ms / 1000 - QUICKNET_GENESIS) / PERIOD) + 1;
const NEW_MIN = 12;   // a new vault passphrase guards ciphertext an attacker can attack offline
const orNull = <T,>(p: Promise<T>) => p.catch(e => { if (e instanceof ApiError && e.status === 404) return null; throw e; });

export default function Unlock() {
  const user = useAtomValue(userAtom)!;
  const setKey = useSetAtom(vaultKeyAtom); const setContacts = useSetAtom(contactsAtom);
  const [pass, setPass] = useState(""); const [again, setAgain] = useState("");
  const [fresh, setFresh] = useState(false);   // nothing is encrypted yet, so this passphrase is being chosen
  const [err, setErr] = useState<string | null>(null);

  const go = async () => {
    setErr(null);
    if (fresh && pass !== again) return setErr("The two passphrases don't match.");
    const loaded = await Promise.all([
      api<Contact[]>("/contacts/"), orNull(api<Note>("/note")), api<Entry[]>("/vault/"),
    ]).catch((e: any) => { setErr(`Couldn't reach the server. ${e?.message ?? ""}`); return null; });
    if (!loaded) return;
    const [contacts, note, entries] = loaded;

    const key = unlock(pass, user);
    // Check the passphrase against something already encrypted under it. With nothing to check
    // against, a typo would silently become the vault key, so a new vault asks for it twice.
    let text: string | null = null;
    try {
      if (note) text = decryptOwnerCopy(key, note);
      else if (entries.length) readEntries(key, entries.slice(0, 1));
      else if (!fresh) { setFresh(true); return; }
    } catch { return setErr("That passphrase doesn't open this vault."); }

    // Re-seal when the lock is past half its horizon, so the round never arrives while we're alive.
    const halfway = roundAt(Date.now() + user.tlock_horizon_days * 43_200_000);
    if (note && text !== null && note.tlock_round < halfway) {
      try { await publishNote(key, user, contacts, text); }
      catch (e: any) { return setErr(`Couldn't re-seal your note, so the vault stays locked. Try again. ${e.message ?? ""}`); }
    }
    setContacts(contacts); setKey(key);
  };

  return (
    <Screen>
      <H>{fresh ? "Choose a vault passphrase" : "Unlock"}</H>
      <P dim>{fresh
        ? `Nothing is encrypted yet, so this passphrase becomes your vault key. At least ${NEW_MIN} characters. Nobody can reset it, including us.`
        : "Vault passphrase. Argon2id runs on this device; the server only ever sees ciphertext. Forget it and nothing recovers it."}</P>
      <Input placeholder="vault passphrase" value={pass} onChangeText={setPass} secureTextEntry onSubmitEditing={fresh ? undefined : go} />
      {fresh && <Input placeholder="same passphrase again" value={again} onChangeText={setAgain} secureTextEntry onSubmitEditing={go} />}
      <Button title={fresh ? "Create vault" : "Unlock"} onPress={go} disabled={pass.length < (fresh ? NEW_MIN : 8) || (fresh && !again)} />
      <Err e={err} />
    </Screen>
  );
}
