import { useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useAtomValue } from "jotai";
import { api, contactsAtom, decryptOwnerCopy, publishNote, userAtom, vaultKeyAtom } from "@antemortem/core";
import type { Tone } from "@/theme";
import { Button, C, Card, Chip, Em, Err, Eyebrow, F, haptic, Mono, P, R, Row, Screen, Title } from "@/ui";

const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

export default function Note() {
  const key = useAtomValue(vaultKeyAtom)!; const user = useAtomValue(userAtom)!; const contacts = useAtomValue(contactsAtom);
  const [text, setText] = useState(""); const [saved, setSaved] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  useEffect(() => { api<any>("/note").then(n => { const t = decryptOwnerCopy(key, n); setText(t); setSaved(t); }).catch(() => {}); }, []);
  const save = async () => {
    setErr(null);
    try { await publishNote(key, user, contacts, text); setSaved(text); haptic.ok(); }
    catch (e: any) { haptic.fail(); setErr(e.message); }
  };
  const state: { t: Tone; label: string } =
    saved === null ? { t: "warn", label: "Not sealed yet" } : text === saved ? { t: "ok", label: "Sealed" } : { t: "ember", label: "Unsealed changes" };

  return (
    <Screen tabs>
      <Row between><Eyebrow>Published after you're gone</Eyebrow><Chip t={state.t}>{state.label}</Chip></Row>
      <Title>Last <Em>words</Em></Title>

      <View style={{ backgroundColor: C.raised, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, borderLeftWidth: 2, borderLeftColor: C.ember, padding: 20, gap: 14 }}>
        <TextInput
          value={text} onChangeText={setText} multiline placeholder="Say what you couldn't." placeholderTextColor={C.faint}
          selectionColor={C.ember} cursorColor={C.ember} autoCapitalize="sentences"
          style={{ fontFamily: F.display, fontSize: 23, lineHeight: 32, color: C.fg, minHeight: 300, textAlignVertical: "top", padding: 0 }}
        />
        <Row between>
          <Mono color={C.faint} size={12}>{words(text)} {words(text) === 1 ? "word" : "words"}</Mono>
          <Mono color={C.faint} size={12}>encrypted on this phone</Mono>
        </Row>
      </View>

      {contacts.length === 0 ? (
        <Card accent="warn" label="Needs a contact">
          <P dim>Sealing splits the key between your trusted contacts, so add at least one first.</P>
          <Button title="Add a contact" kind="ghost" onPress={() => router.navigate("/contacts")} />
        </Card>
      ) : (
        <Button title={saved === null ? "Seal" : "Re-seal"} onPress={save} disabled={!text || text === saved} />
      )}
      <Err e={err} />
      <P small dim>Until then it's locked to a future round of the drand network and split across your contacts. Nobody can read it, including us.</P>
    </Screen>
  );
}
