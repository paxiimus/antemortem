import { useState } from "react";
import { useSetAtom } from "jotai";
import { api, setToken } from "@antemortem/core";
import { tokenStore } from "@/platform";
import { tokenAtom, userAtom, type User } from "@antemortem/core";
import { Button, Err, H, Input, P, Screen } from "@/ui";

export default function Register() {
  const [f, setF] = useState({ email: "", handle: "", password: "" }); const [err, setErr] = useState<string | null>(null);
  const setTok = useSetAtom(tokenAtom); const setUser = useSetAtom(userAtom);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const go = async () => {
    setErr(null);
    try {
      const r = await api<User & { token: string }>("/auth/register", { method: "POST", json: f });
      setToken(r.token); await tokenStore.set(r.token); setUser(r); setTok(r.token);
    } catch (e: any) { setErr(e.message); }
  };
  return (
    <Screen>
      <H>Create account</H>
      <P dim>Your handle is your public memorial URL: /cemetery/{f.handle || "handle"}</P>
      <Input placeholder="handle" value={f.handle} onChangeText={set("handle")} />
      <Input placeholder="email" value={f.email} onChangeText={set("email")} keyboardType="email-address" />
      <Input placeholder="password" value={f.password} onChangeText={set("password")} secureTextEntry />
      <Button title="Create" onPress={go} />
      <Err e={err} />
    </Screen>
  );
}
