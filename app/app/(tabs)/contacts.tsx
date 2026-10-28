import { useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { api } from "@antemortem/core";
import { contactPassphrase, decryptOwnerCopy, publishNote } from "@antemortem/core";
import { contactsAtom, userAtom, vaultKeyAtom, type Contact } from "@antemortem/core";
import { Button, Card, H, Input, P, Screen } from "@/ui";

export default function Contacts() {
  const key = useAtomValue(vaultKeyAtom)!; const user = useAtomValue(userAtom)!;
  const [contacts, setContacts] = useAtom(contactsAtom);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [reveal, setReveal] = useState<number | null>(null);

  // Any change to the contact set changes the k-of-k split, so re-seal if a note exists.
  const resealIfNeeded = async (next: Contact[]) => {
    try { const n = await api<any>("/note"); await publishNote(key, user, next, decryptOwnerCopy(key, n)); } catch {}
  };
  const add = async () => {
    const c = await api<Contact>("/contacts/", { method: "POST", json: { name, email, share_ct: "", share_nonce: "" } });
    const next = [...contacts, c]; setContacts(next); setName(""); setEmail(""); setReveal(c.id);
    await resealIfNeeded(next);
  };
  const remove = async (id: number) => {
    await api(`/contacts/${id}/`, { method: "DELETE" });
    const next = contacts.filter(c => c.id !== id); setContacts(next); await resealIfNeeded(next);
  };

  return (
    <Screen>
      <H>Trusted contacts</H>
      <P dim>Each gets a share passphrase from you, offline. Release needs every one of them. They also need your vault recovery passphrase to read the vault — give it to them the same way.</P>
      <Card>
        <Input placeholder="name" value={name} onChangeText={setName} autoCapitalize="words" />
        <Input placeholder="email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <Button title="Add contact" onPress={add} disabled={!name || !email} />
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
