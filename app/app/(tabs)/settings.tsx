import { useState } from "react";
import { useAtom, useSetAtom } from "jotai";
import { api, setToken } from "@antemortem/core";
import { tokenStore } from "@/platform";
import { tokenAtom, userAtom, vaultKeyAtom, type User } from "@antemortem/core";
import { Button, Card, Err, H, Input, P, Screen } from "@/ui";

export default function Settings() {
  const [user, setUser] = useAtom(userAtom); const setTok = useSetAtom(tokenAtom); const setKey = useSetAtom(vaultKeyAtom);
  const [f, setF] = useState({ display_name: user!.display_name, checkin_interval_days: String(user!.checkin_interval_days), tlock_horizon_days: String(user!.tlock_horizon_days) });
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setErr(null);
    try { setUser(await api<User>("/me", { method: "PATCH", json: { display_name: f.display_name, checkin_interval_days: +f.checkin_interval_days, tlock_horizon_days: +f.tlock_horizon_days } })); }
    catch (e: any) { setErr(e.message); }
  };
  const lock = () => setKey(null);
  const signOut = async () => { setKey(null); setToken(null); await tokenStore.clear(); setTok(null); setUser(null); };
  return (
    <Screen>
      <H>Settings</H>
      <Card>
        <P dim>Display name</P><Input value={f.display_name} onChangeText={v => setF({ ...f, display_name: v })} />
        <P dim>Check-in every (days, 30–365)</P><Input value={f.checkin_interval_days} onChangeText={v => setF({ ...f, checkin_interval_days: v })} keyboardType="number-pad" />
        <P dim>Timelock horizon (days, ≥ 2× check-in)</P><Input value={f.tlock_horizon_days} onChangeText={v => setF({ ...f, tlock_horizon_days: v })} keyboardType="number-pad" />
        <Button title="Save" onPress={save} />
        <Err e={err} />
      </Card>
      <Card>
        <P dim>Memorial: /cemetery/{user!.handle}</P>
        <Button title="Lock vault" kind="ghost" onPress={lock} />
        <Button title="Sign out" kind="ghost" onPress={signOut} />
      </Card>
    </Screen>
  );
}
