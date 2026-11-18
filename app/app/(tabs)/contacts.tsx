import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { useAtom, useAtomValue } from "jotai";
import * as Clipboard from "expo-clipboard";
import { api, ApiError, contactPassphrase, contactsAtom, decryptOwnerCopy, publishNote, userAtom, vaultKeyAtom, type Contact } from "@antemortem/core";
import { Button, C, Card, Chip, Em, Err, Eyebrow, F, Field, haptic, Mono, P, R, Row, Screen, Title } from "@/ui";

const orNull = <T,>(p: Promise<T>) => p.catch(e => { if (e instanceof ApiError && e.status === 404) return null; throw e; });
const group = (s: string) => s.match(/.{1,4}/g)?.join(" ") ?? s;   // easier to read aloud; spaces are ignored on entry
const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");

export default function Contacts() {
  const key = useAtomValue(vaultKeyAtom)!; const user = useAtomValue(userAtom)!;
  const [contacts, setContacts] = useAtom(contactsAtom);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [reveal, setReveal] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null); const [copied, setCopied] = useState<number | null>(null);

  // Any change to the contact set changes the k-of-k split, so re-seal if a note exists.
  // A failed re-seal leaves contacts holding shares that no longer match: never swallow it.
  const reseal = async (next: Contact[]) => {
    const n = await orNull(api<any>("/note"));
    if (n) await publishNote(key, user, next, decryptOwnerCopy(key, n));
  };
  const resealOrWarn = async (next: Contact[], done: string) => {
    try { await reseal(next); }
    catch (e: any) { haptic.fail(); setErr(`${done}, but re-sealing your note failed. Open Last words and re-seal. ${e.message ?? ""}`); }
  };
  const add = async () => {
    setErr(null);
    const c = await api<Contact>("/contacts/", { method: "POST", json: { name, email, share_ct: "", share_nonce: "" } })
      .catch((e: any) => { haptic.fail(); setErr(`Couldn't add the contact. ${e?.message ?? ""}`); return null; });
    if (!c) return;
    const next = [...contacts, c]; setContacts(next); setName(""); setEmail(""); setReveal(c.id);
    await resealOrWarn(next, "Contact added");
    haptic.ok();
  };
  const remove = async (id: number) => {
    setErr(null);
    const next = contacts.filter(c => c.id !== id);
    try {
      if (next.length === 0 && await orNull(api("/note"))) {
        return setErr("Your sealed note needs at least one contact. Add another before removing this one.");
      }
      await api(`/contacts/${id}/`, { method: "DELETE" });
    } catch (e: any) { return setErr(`Couldn't remove the contact. ${e.message ?? ""}`); }
    setContacts(next);
    await resealOrWarn(next, "Contact removed");
  };
  const confirmRemove = (c: Contact) => Alert.alert(`Remove ${c.name}?`, "Your note is re-sealed for the contacts who remain.", [
    { text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => remove(c.id) },
  ]);
  const copy = async (c: Contact) => { await Clipboard.setStringAsync(contactPassphrase(key, c.id)); haptic.ok(); setCopied(c.id); };

  return (
    <Screen tabs>
      <Eyebrow>Every one of them must confirm</Eyebrow>
      <Title>Trusted <Em>contacts</Em></Title>
      <P dim>Each contact gets a share passphrase from you, in person or over a channel you trust. If you stop checking in, they're asked whether anyone has heard from you. All of them must confirm before your note is released.</P>

      <Card label="Add someone">
        <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" hint="Only used to ask them, if you go quiet." />
        <Button title="Add contact" onPress={add} disabled={!name || !email} />
        <Err e={err} />
      </Card>

      {contacts.map(c => (
        <Card key={c.id}>
          <Row gap={14}>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.emberDim, borderWidth: 1, borderColor: C.ember + "55", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: F.monoMed, fontSize: 15, color: C.ember }}>{initials(c.name)}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: C.fg, fontSize: 17, fontWeight: "600" }}>{c.name}</Text>
              <Text style={{ color: C.mute, fontSize: 14 }} numberOfLines={1}>{c.email}</Text>
            </View>
            <Chip t={c.attested_at ? "danger" : "mute"}>{c.attested_at ? "Confirmed" : "Standing by"}</Chip>
          </Row>

          {reveal === c.id ? (
            <View style={{ gap: 10 }}>
              <Eyebrow color={C.ember}>Share passphrase for {c.name.split(" ")[0]}</Eyebrow>
              <View style={{ backgroundColor: C.sunken, borderRadius: R.md, borderWidth: 1, borderColor: C.line, padding: 14 }}>
                <Mono size={16}>{group(contactPassphrase(key, c.id))}</Mono>
              </View>
              <P small dim>Give this to them yourself. Spaces don't matter when they type it. It stays the same if you re-seal.</P>
              <Row>
                <Button small kind="ghost" title={copied === c.id ? "Copied" : "Copy"} onPress={() => copy(c)} />
                <Button small kind="quiet" title="Hide" onPress={() => { setReveal(null); setCopied(null); }} />
              </Row>
            </View>
          ) : (
            <Row between>
              <Button small kind="ghost" title="Show passphrase" onPress={() => setReveal(c.id)} />
              <Button small kind="quiet" title="Remove" onPress={() => confirmRemove(c)} />
            </Row>
          )}
        </Card>
      ))}
    </Screen>
  );
}
