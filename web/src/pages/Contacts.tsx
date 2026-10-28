import { useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { api, contactPassphrase, contactsAtom, decryptOwnerCopy, publishNote, userAtom, vaultKeyAtom, type Contact } from "@deathnote/core";
import { Busy } from "../ui.tsx";

export default function Contacts() {
  const key = useAtomValue(vaultKeyAtom)!; const user = useAtomValue(userAtom)!;
  const [contacts, setContacts] = useAtom(contactsAtom);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [reveal, setReveal] = useState<number | null>(null);
  const resealIfNeeded = async (next: Contact[]) => { try { const n = await api<any>("/note"); await publishNote(key, user, next, decryptOwnerCopy(key, n)); } catch {} };
  const add = async () => {
    const c = await api<Contact>("/contacts/", { method: "POST", json: { name, email, share_ct: "", share_nonce: "" } });
    const next = [...contacts, c]; setContacts(next); setName(""); setEmail(""); setReveal(c.id); await resealIfNeeded(next);
  };
  const remove = async (id: number) => { await api(`/contacts/${id}/`, { method: "DELETE" }); const next = contacts.filter(c => c.id !== id); setContacts(next); await resealIfNeeded(next); };
  return <>
    <h1>Trusted contacts</h1>
    <p className="dim">Each gets a share passphrase from you, offline. Release needs every one of them. They also need your vault passphrase to read the vault — give it to them the same way.</p>
    <div className="card">
      <input placeholder="name" value={name} onChange={e => setName(e.target.value)} />
      <input placeholder="email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
      <Busy title="Add contact" onClick={add} disabled={!name || !email} />
    </div>
    {contacts.map(c => <div className="card" key={c.id}>
      <p>{c.name}</p><p className="dim">{c.email}{c.attested_at ? " · has attested" : ""}</p>
      {reveal === c.id
        ? <><p className="dim">Share passphrase — write it down for them, then hide it:</p><code>{contactPassphrase(key, c.id)}</code><Busy title="Hide" kind="ghost" onClick={() => setReveal(null)} /></>
        : <Busy title="Show share passphrase" kind="ghost" onClick={() => setReveal(c.id)} />}
      <Busy title="Remove" kind="danger" onClick={() => remove(c.id)} />
    </div>)}
  </>;
}
