// Contact flow. Reached via antemortem://c/<token> or https://<domain>/c/<token>. No account needed.
import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { attestDeath, fetchContactView, openContactVault, ready, type ContactView } from "@antemortem/core";
import { Button, Card, Err, H, Input, P, Screen } from "@/ui";

export default function Contact() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [view, setView] = useState<ContactView | null>(null);
  const [pass, setPass] = useState(""); const [err, setErr] = useState<string | null>(null);
  const [entries, setEntries] = useState<{ title: string; body: string }[] | null>(null);

  const load = async () => { await ready; setView(await fetchContactView(token)); };
  useEffect(() => { load().catch(e => setErr(e.message)); }, [token]);
  if (!view) return <Screen><Err e={err} /></Screen>;

  const name = view.owner.display_name || view.owner.handle;
  const attest = async () => {
    setErr(null);
    try { await attestDeath(token, view, pass); setPass(""); await load(); }
    catch { setErr("That share passphrase doesn't match."); }
  };
  const open = () => { setErr(null); try { setEntries(openContactVault(view, pass)); } catch { setErr("Wrong vault passphrase."); } };

  return (
    <Screen>
      <H>{name}</H>
      <P dim>You're listed as a trusted contact ({view.contact.name}).</P>

      {view.owner.status === "released" ? (
        <Card>
          <P>Their vault has been released. Enter the vault passphrase they gave you. Nothing leaves this device.</P>
          <Input placeholder="vault passphrase" value={pass} onChangeText={setPass} secureTextEntry />
          <Button title="Open vault" onPress={open} disabled={!pass} />
          <Err e={err} />
          {entries?.map((e, i) => <Card key={i}><P>{e.title}</P><P dim>{e.body}</P></Card>)}
        </Card>
      ) : view.contact.attested_at ? (
        <Card><P>Your attestation is recorded. Release happens once every contact has confirmed and a cooling-off period passes, unless {name} logs in.</P></Card>
      ) : (
        <Card>
          <P>Only continue if {name} has died. Enter the share passphrase they gave you; your share is unlocked here and sent so their last words can be published.</P>
          <Input placeholder="share passphrase" value={pass} onChangeText={setPass} secureTextEntry />
          <Button title="I confirm they have died" kind="danger" onPress={attest} disabled={!pass} />
          <Err e={err} />
        </Card>
      )}
    </Screen>
  );
}
