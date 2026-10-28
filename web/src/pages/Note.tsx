import { useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { api, contactsAtom, decryptOwnerCopy, publishNote, userAtom, vaultKeyAtom } from "@deathnote/core";
import { Busy, Err } from "../ui.tsx";

export default function Note() {
  const key = useAtomValue(vaultKeyAtom)!; const user = useAtomValue(userAtom)!; const contacts = useAtomValue(contactsAtom);
  const [text, setText] = useState(""); const [saved, setSaved] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api<any>("/note").then(n => { const t = decryptOwnerCopy(key, n); setText(t); setSaved(t); }).catch(() => {}); }, []);
  const save = async () => { setErr(null); try { await publishNote(key, user, contacts, text); setSaved(text); } catch (e: any) { setErr(e.message); } };
  return <>
    <h1>Last words</h1>
    <p className="dim">Published to your memorial page after your death. Until then it's locked to a future drand round and split across your contacts — nobody can read it, including us.</p>
    <div className="card">
      <textarea className="note" value={text} onChange={e => setText(e.target.value)} placeholder="Say it." />
      <Busy title={saved === null ? "Seal" : "Re-seal"} onClick={save} disabled={!text || text === saved || contacts.length === 0} />
      {contacts.length === 0 && <p className="dim">Add at least one contact first.</p>}
      <Err e={err} />
    </div>
  </>;
}
