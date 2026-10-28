import { useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { api } from "@antemortem/core";
import { decryptOwnerCopy, publishNote } from "@antemortem/core";
import { contactsAtom, userAtom, vaultKeyAtom } from "@antemortem/core";
import { Button, Card, Err, H, Input, P, Screen } from "@/ui";

export default function Note() {
  const key = useAtomValue(vaultKeyAtom)!; const user = useAtomValue(userAtom)!; const contacts = useAtomValue(contactsAtom);
  const [text, setText] = useState(""); const [saved, setSaved] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api<any>("/note").then(n => { const t = decryptOwnerCopy(key, n); setText(t); setSaved(t); }).catch(() => {}); }, []);
  const save = async () => {
    setErr(null);
    try { await publishNote(key, user, contacts, text); setSaved(text); } catch (e: any) { setErr(e.message); }
  };
  return (
    <Screen>
      <H>Last words</H>
      <P dim>Published to your memorial page after your death. Until then it's locked to a future drand round and split across your contacts — nobody can read it, including us.</P>
      <Card>
        <Input value={text} onChangeText={setText} multiline style={{ minHeight: 220, fontFamily: "Georgia", fontSize: 17, lineHeight: 26 }} placeholder="Say it." />
        <Button title={saved === null ? "Seal" : "Re-seal"} onPress={save} disabled={!text || text === saved || contacts.length === 0} />
        {contacts.length === 0 && <P dim>Add at least one contact first.</P>}
        <Err e={err} />
      </Card>
    </Screen>
  );
}
