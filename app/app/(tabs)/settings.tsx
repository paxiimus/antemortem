import { useState } from "react";
import { useAtom, useSetAtom } from "jotai";
import { api, setToken, tokenAtom, userAtom, vaultKeyAtom, type User } from "@antemortem/core";
import { tokenStore } from "@/platform";
import { Button, C, Card, Em, Err, Eyebrow, Field, haptic, Mono, P, Screen, Title } from "@/ui";

export default function Settings() {
  const [user, setUser] = useAtom(userAtom); const setTok = useSetAtom(tokenAtom); const setKey = useSetAtom(vaultKeyAtom);
  const [f, setF] = useState({ display_name: user!.display_name, checkin_interval_days: String(user!.checkin_interval_days), tlock_horizon_days: String(user!.tlock_horizon_days) });
  const [err, setErr] = useState<string | null>(null); const [saved, setSaved] = useState(false);
  const interval = +f.checkin_interval_days, horizon = +f.tlock_horizon_days;
  const problem =
    !(interval >= 30 && interval <= 365) ? "Check in every 30 to 365 days." :
    !(horizon >= 2 * interval) ? `The time lock must be at least twice the check-in interval (${2 * interval || 60} days or more).` : null;

  const save = async () => {
    setErr(null); setSaved(false);
    try {
      setUser(await api<User>("/me", { method: "PATCH", json: { display_name: f.display_name, checkin_interval_days: interval, tlock_horizon_days: horizon } }));
      setSaved(true); haptic.ok();
    } catch (e: any) { haptic.fail(); setErr(e.message); }
  };
  const signOut = async () => { setKey(null); setToken(null); await tokenStore.clear(); setTok(null); setUser(null); };
  const memorial = `${(process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "")}/cemetery/${user!.handle}`;
  const set = (k: keyof typeof f) => (v: string) => { setSaved(false); setF({ ...f, [k]: v }); };

  return (
    <Screen tabs>
      <Eyebrow>{user!.email}</Eyebrow>
      <Title><Em>Settings</Em></Title>

      <Card label="Profile">
        <Field label="Display name" value={f.display_name} onChangeText={set("display_name")} autoCapitalize="words" hint="Shown on your memorial page." />
      </Card>

      <Card label="Timing">
        <Field label="Check in every (days)" value={f.checkin_interval_days} onChangeText={set("checkin_interval_days")} keyboardType="number-pad" hint="30 to 365. Longer than your longest trip." />
        <Field label="Time lock (days)" value={f.tlock_horizon_days} onChangeText={set("tlock_horizon_days")} keyboardType="number-pad" hint="Opens your note if your contacts never act. Pushed back each time you open the app." />
        {problem && <P small dim>{problem}</P>}
        <Err e={err} />
        <Button title={saved ? "Saved" : "Save"} onPress={save} disabled={!!problem || saved} />
      </Card>

      <Card label="Memorial">
        <Mono color={C.mute} size={13}>{memorial}</Mono>
        <P small dim>Your last words appear here after release, and anyone can leave a condolence.</P>
      </Card>

      <Card label="This phone">
        <Button title="Lock vault" kind="ghost" onPress={() => setKey(null)} />
        <Button title="Sign out" kind="danger" onPress={signOut} />
      </Card>
    </Screen>
  );
}
