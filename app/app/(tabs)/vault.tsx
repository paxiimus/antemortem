import { useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { api } from "@antemortem/core";
import { encryptEntry, readEntries } from "@antemortem/core";
import { vaultKeyAtom, type Entry } from "@antemortem/core";
import { Button, Card, H, Input, P, Screen } from "@/ui";

export default function Vault() {
  const key = useAtomValue(vaultKeyAtom)!;
  const [entries, setEntries] = useState<ReturnType<typeof readEntries>>([]);
  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const load = async () => setEntries(readEntries(key, await api<Entry[]>("/vault/")));
  useEffect(() => { load(); }, []);
  const add = async () => {
    await api("/vault/", { method: "POST", json: encryptEntry(key, title, body) });
    setTitle(""); setBody(""); await load();
  };
  const del = async (id: number) => { await api(`/vault/${id}/`, { method: "DELETE" }); await load(); };
  return (
    <Screen>
      <H>Vault</H>
      <P dim>Encrypted here before it leaves. Contacts open it after release with the recovery key you gave them.</P>
      <Card>
        <Input placeholder="title" value={title} onChangeText={setTitle} />
        <Input placeholder="passwords, account details, where things are…" value={body} onChangeText={setBody} multiline style={{ minHeight: 90 }} />
        <Button title="Add" onPress={add} disabled={!title || !body} />
      </Card>
      {entries.map(e => (
        <Card key={e.id}>
          <P>{e.title}</P><P dim>{e.body}</P>
          <Button title="Delete" kind="ghost" onPress={() => del(e.id)} />
        </Card>
      ))}
    </Screen>
  );
}
