import { useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { api, encryptEntry, readEntries, vaultKeyAtom, type Entry } from "@deathnote/core";
import { Busy } from "../ui.tsx";

export default function Vault() {
  const key = useAtomValue(vaultKeyAtom)!;
  const [entries, setEntries] = useState<ReturnType<typeof readEntries>>([]);
  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const load = async () => setEntries(readEntries(key, await api<Entry[]>("/vault/")));
  useEffect(() => { load(); }, []);
  const add = async () => { await api("/vault/", { method: "POST", json: encryptEntry(key, title, body) }); setTitle(""); setBody(""); await load(); };
  const del = async (id: number) => { await api(`/vault/${id}/`, { method: "DELETE" }); await load(); };
  return <>
    <h1>Vault</h1>
    <p className="dim">Encrypted here before it leaves. Contacts open it after release with the recovery passphrase you gave them.</p>
    <div className="card">
      <input placeholder="title" value={title} onChange={e => setTitle(e.target.value)} />
      <textarea placeholder="passwords, account details, where things are…" value={body} onChange={e => setBody(e.target.value)} rows={4} />
      <Busy title="Add" onClick={add} disabled={!title || !body} />
    </div>
    {entries.map(e => <div className="card" key={e.id}>
      <p>{e.title}</p><p className="dim" style={{ whiteSpace: "pre-wrap" }}>{e.body}</p>
      <Busy title="Delete" kind="ghost" onClick={() => del(e.id)} />
    </div>)}
  </>;
}
