import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useAtomValue } from "jotai";
import { api, encryptEntry, readEntries, vaultKeyAtom, type Entry } from "@antemortem/core";
import { Button, C, Card, Em, Err, Eyebrow, F, Field, haptic, Mono, P, Row, Screen, Title } from "@/ui";

const fmt = (s: string) => new Date(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export default function Vault() {
  const key = useAtomValue(vaultKeyAtom)!;
  const [entries, setEntries] = useState<ReturnType<typeof readEntries>>([]);
  const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [err, setErr] = useState<string | null>(null);
  const [composing, setComposing] = useState(false); const [open, setOpen] = useState<number | null>(null);
  const run = (f: () => Promise<void>) => async () => { setErr(null); try { await f(); } catch (e: any) { haptic.fail(); setErr(e.message ?? String(e)); } };
  const load = async () => setEntries(readEntries(key, await api<Entry[]>("/vault/")));
  useEffect(() => { run(load)(); }, []);
  const add = run(async () => {
    const created = await api<Entry>("/vault/", { method: "POST", json: encryptEntry(key, title, body) });
    setEntries(es => [...es, { id: created.id, updated_at: created.updated_at, title, body }]);   // plaintext is already here
    setTitle(""); setBody(""); setComposing(false); haptic.ok();
  });
  const del = (id: number) => run(async () => {
    await api(`/vault/${id}/`, { method: "DELETE" });
    setEntries(es => es.filter(e => e.id !== id));
  })();
  const confirmDel = (id: number, t: string) => Alert.alert("Delete this entry?", `"${t}" will be gone for good.`, [
    { text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => del(id) },
  ]);

  return (
    <Screen tabs>
      <Eyebrow>Opens for your contacts after release</Eyebrow>
      <Title>The <Em>vault</Em></Title>

      {composing ? (
        <Card label="New entry" right={<Button small kind="quiet" title="Cancel" onPress={() => setComposing(false)} />}>
          <Field label="Title" value={title} onChangeText={setTitle} autoCapitalize="sentences" placeholder="Bank, will, the dog" />
          <Field label="Contents" value={body} onChangeText={setBody} multiline autoCapitalize="sentences" style={{ minHeight: 130, textAlignVertical: "top" }} />
          <Button title="Encrypt and save" onPress={add} disabled={!title || !body} />
        </Card>
      ) : <Button title="New entry" kind="ghost" onPress={() => setComposing(true)} />}
      <Err e={err} />

      {entries.length === 0 && !composing && (
        <View style={{ alignItems: "center", paddingVertical: 40, gap: 10 }}>
          <Title size={30}><Em>Nothing here yet.</Em></Title>
          <P dim center>Passwords, account details, where the will is kept, who gets the dog.</P>
        </View>
      )}

      {entries.map(e => (
        <Pressable key={e.id} onPress={() => setOpen(open === e.id ? null : e.id)} accessibilityRole="button" accessibilityHint="Shows the whole entry">
          <Card>
            <Text style={{ fontFamily: F.display, fontSize: 24, lineHeight: 28, color: C.fg }}>{e.title}</Text>
            <Text style={{ color: C.mute, fontSize: 15, lineHeight: 22 }} numberOfLines={open === e.id ? undefined : 2} selectable={open === e.id}>{e.body}</Text>
            <Row between>
              <Mono color={C.faint} size={12}>{fmt(e.updated_at)}</Mono>
              {open === e.id && <Button small kind="danger" title="Delete" onPress={() => confirmDel(e.id, e.title)} />}
            </Row>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
