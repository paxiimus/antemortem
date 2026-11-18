// Contact flow. Reached via antemortem://c/<token> or https://<domain>/c/<token>. No account needed.
import { useEffect, useState } from "react";
import { Alert, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ApiError, attestDeath, fetchContactView, openContactVault, ready, type ContactView } from "@antemortem/core";
import { Button, C, Card, Chip, Em, Err, Eyebrow, F, Field, haptic, P, Screen, Title } from "@/ui";

export default function Contact() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [view, setView] = useState<ContactView | null>(null);
  const [pass, setPass] = useState(""); const [err, setErr] = useState<string | null>(null);
  const [entries, setEntries] = useState<{ title: string; body: string }[] | null>(null);

  const load = async () => { await ready; setView(await fetchContactView(token)); };
  useEffect(() => { load().catch(e => setErr(e.message)); }, [token]);
  if (!view) return <Screen><Eyebrow>Trusted contact</Eyebrow><Err e={err} /></Screen>;

  const name = view.owner.display_name || view.owner.handle;
  const attest = async () => {
    setErr(null);
    try { await attestDeath(token, view, pass); setPass(""); haptic.ok(); await load(); }
    catch (e) { haptic.fail(); setErr(e instanceof ApiError ? `The server refused that (${e.status}). Try again later.` : "That share passphrase doesn't match."); }
  };
  const confirmAttest = () => Alert.alert(`Confirm ${name} has died?`, "This starts the release of their last words. They can still cancel it if they're alive.", [
    { text: "Cancel", style: "cancel" }, { text: "Confirm", style: "destructive", onPress: attest },
  ]);
  const open = () => { setErr(null); try { setEntries(openContactVault(view, pass)); haptic.ok(); } catch { haptic.fail(); setErr("Wrong vault passphrase."); } };

  return (
    <Screen>
      <Eyebrow>Trusted contact · {view.contact.name}</Eyebrow>
      <Title>{name}</Title>

      {view.owner.status === "released" ? (
        <Card label="Released" accent="ember">
          <P>Their vault has been released to you. Enter the vault passphrase they gave you. It's decrypted here on this phone, and nothing is sent anywhere.</P>
          <Field label="Vault passphrase" value={pass} onChangeText={setPass} secureTextEntry />
          <Button title="Open vault" onPress={open} disabled={!pass} />
          <Err e={err} />
        </Card>
      ) : view.contact.attested_at ? (
        <Card label="Your confirmation" right={<Chip t="danger">Recorded</Chip>}>
          <P dim>Thank you. Release happens once every contact has confirmed and a 14-day cooling-off period has passed, unless {name} checks in first.</P>
        </Card>
      ) : (
        <Card label="Only if they have died" accent="danger">
          <P>You're listed as one of {name}'s trusted contacts. If they have died, enter the share passphrase they gave you. Your share is unlocked on this phone and sent so their last words can be published.</P>
          <Field label="Share passphrase" value={pass} onChangeText={setPass} secureTextEntry autoCorrect={false} hint="Spaces don't matter." />
          <Button title="I confirm they have died" kind="danger" onPress={confirmAttest} disabled={!pass} />
          <Err e={err} />
        </Card>
      )}

      {entries?.map((e, i) => (
        <Card key={i}>
          <Text style={{ fontFamily: F.display, fontSize: 24, lineHeight: 28, color: C.fg }}>{e.title}</Text>
          <Text style={{ color: C.mute, fontSize: 15, lineHeight: 22 }} selectable>{e.body}</Text>
        </Card>
      ))}
      {entries?.length === 0 && <P dim><Em>The vault is empty.</Em></P>}
    </Screen>
  );
}
