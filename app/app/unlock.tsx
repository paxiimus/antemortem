import { useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { api, ApiError } from "@antemortem/core";
import { decryptOwnerCopy, publishNote, readEntries, unlock } from "@antemortem/core";
import { contactsAtom, userAtom, vaultKeyAtom, type Contact, type Entry } from "@antemortem/core";
import { View } from "react-native";
import { Button, C, Em, Err, Eyebrow, Field, haptic, P, Row, Screen, Title } from "@/ui";

type Note = { owner_copy_ct: string; owner_nonce: string; tlock_round: number };
const QUICKNET_GENESIS = 1692803367, PERIOD = 3;
const roundAt = (ms: number) => Math.floor((ms / 1000 - QUICKNET_GENESIS) / PERIOD) + 1;
const NEW_MIN = 12;   // a new vault passphrase guards ciphertext an attacker can attack offline
// Rough guidance, not a guarantee: length matters most, and a few random words beat symbols.
const STRENGTH = ["Too short", "Weak", "Fair", "Strong", "Very strong"];
const strength = (p: string) => {
  if (p.length < NEW_MIN) return 0;
  let n = 1 + (p.length >= 16 ? 1 : 0) + (p.length >= 22 ? 1 : 0);
  if ((/[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p)) || (/\s/.test(p) && p.length >= 18)) n++;
  return Math.min(n, 4);
};
const BAR = [C.line, C.danger, C.warn, C.ok, C.ok];

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

    const t0 = Date.now();
    const key = unlock(pass, user);   // Argon2id, 256 MiB, synchronous on the JS thread
    if (__DEV__) console.log(`[perf] Argon2id unlock: ${Date.now() - t0} ms`);
    // Check the passphrase against something already encrypted under it. With nothing to check
    // against, a typo would silently become the vault key, so a new vault asks for it twice.
    let text: string | null = null;
    try {
      if (note) text = decryptOwnerCopy(key, note);
      else if (entries.length) readEntries(key, entries.slice(0, 1));
      else if (!fresh) { setFresh(true); return; }
    } catch { haptic.fail(); return setErr("That passphrase doesn't open this vault."); }

    // Re-seal when the lock is past half its horizon, so the round never arrives while we're alive.
    const halfway = roundAt(Date.now() + user.tlock_horizon_days * 43_200_000);
    if (note && text !== null && note.tlock_round < halfway) {
      try { await publishNote(key, user, contacts, text); }
      catch (e: any) { return setErr(`Couldn't re-seal your note, so the vault stays locked. Try again. ${e.message ?? ""}`); }
    }
    haptic.ok(); setContacts(contacts); setKey(key);
  };

  const score = strength(pass);
  return (
    <Screen>
      <Eyebrow>{fresh ? "New vault" : "Vault locked"}</Eyebrow>
      <Title>{fresh ? <>Choose a <Em>passphrase</Em></> : <>Unlock</>}</Title>
      <P dim>{fresh
        ? `Nothing is encrypted yet, so this becomes your vault key. At least ${NEW_MIN} characters. Nobody can reset it, including us.`
        : "Your passphrase is stretched with Argon2id here on the phone. The server only ever sees ciphertext."}</P>
      <Field label="Vault passphrase" value={pass} onChangeText={setPass} secureTextEntry autoComplete="off" onSubmitEditing={fresh ? undefined : go} returnKeyType={fresh ? "next" : "go"} />
      {fresh && (
        <View style={{ gap: 8 }}>
          <Row gap={6}>{[1, 2, 3, 4].map(i => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: score >= i ? BAR[score] : C.line }} />)}</Row>
          <Eyebrow color={score ? BAR[score] : C.faint}>{STRENGTH[score]}</Eyebrow>
          <P small dim>Four or five random words, like "harbour violin cobalt marrow", beat a short password full of symbols.</P>
        </View>
      )}
      {fresh && <Field label="Same passphrase again" value={again} onChangeText={setAgain} secureTextEntry autoComplete="off" onSubmitEditing={go} returnKeyType="go" />}
      <Err e={err} />
      <Button title={fresh ? "Create vault" : "Unlock"} onPress={go} disabled={pass.length < (fresh ? NEW_MIN : 8) || (fresh && !again)} />
    </Screen>
  );
}
