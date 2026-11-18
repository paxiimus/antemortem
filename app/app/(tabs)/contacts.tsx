import { useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { api, ApiError } from "@antemortem/core";
import { contactPassphrase, decryptOwnerCopy, publishNote } from "@antemortem/core";
import { contactsAtom, userAtom, vaultKeyAtom, type Contact } from "@antemortem/core";
import { Button, Card, Err, H, Input, P, Screen } from "@/ui";

const orNull = <T,>(p: Promise<T>) => p.catch(e => { if (e instanceof ApiError && e.status === 404) return null; throw e; });

export default function Contacts() {
  const key = useAtomValue(vaultKeyAtom)!; const user = useAtomValue(userAtom)!;
  const [contacts, setContacts] = useAtom(contactsAtom);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [reveal, setReveal] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Any change to the contact set changes the k-of-k split, so re-seal if a note exists.
  // A failed re-seal leaves contacts holding shares that no longer match: never swallow it.
  const reseal = async (next: Contact[]) => {
    const n = await orNull(api<any>("/note"));
    if (n) await publishNote(key, user, next, decryptOwnerCopy(key, n));
  };
  const resealOrWarn = async (next: Contact[], done: string) => {
    try { await reseal(next); }
    catch (e: any) { setErr(`${done}, but re-sealing your note failed. Open Last words and re-seal. ${e.message ?? ""}`); }
  };
  const add = async () => {
    setErr(null);
    const c = await api<Contact>("/contacts/", { method: "POST", json: { name, email, share_ct: "", share_nonce: "" } })
      .catch((e: any) => { setErr(`Couldn't add the contact. ${e?.message ?? ""}`); return null; });
    if (!c) return;
    const next = [...contacts, c]; setContacts(next); setName(""); setEmail(""); setReveal(c.id);
    await resealOrWarn(next, "Contact added");
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

  return (
    <Screen>
      <H>Trusted contacts</H>
      <P dim>Each gets a share passphrase from you, offline. Release needs every one of them. They also need your vault recovery passphrase to read the vault — give it to them the same way.</P>
      <Card>
        <Input placeholder="name" value={name} onChangeText={setName} autoCapitalize="words" />
        <Input placeholder="email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <Button title="Add contact" onPress={add} disabled={!name || !email} />
        <Err e={err} />
      </Card>
      {contacts.map(c => (
        <Card key={c.id}>
          <P>{c.name}</P><P dim>{c.email}{c.attested_at ? " · has attested" : ""}</P>
          {reveal === c.id
            ? <><P dim>Share passphrase — write it down for them, then hide it:</P><P>{contactPassphrase(key, c.id)}</P><Button title="Hide" kind="ghost" onPress={() => setReveal(null)} /></>
            : <Button title="Show share passphrase" kind="ghost" onPress={() => setReveal(c.id)} />}
          <Button title="Remove" kind="danger" onPress={() => remove(c.id)} />
        </Card>
      ))}
    </Screen>
  );
}
