import { useState } from "react";
import { Link } from "expo-router";
import { useSetAtom } from "jotai";
import { api, setToken } from "@antemortem/core";
import { tokenStore } from "@/platform";
import { tokenAtom, userAtom, type User } from "@antemortem/core";
import { Button, Err, H, Input, P, Screen } from "@/ui";

export default function Login() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [err, setErr] = useState<string | null>(null);
  const setTok = useSetAtom(tokenAtom); const setUser = useSetAtom(userAtom);
  const go = async () => {
    setErr(null);
    try {
      const r = await api<User & { token: string }>("/auth/login", { method: "POST", json: { email, password } });
      setToken(r.token); await tokenStore.set(r.token); setUser(r); setTok(r.token);
    } catch { setErr("Wrong email or password."); }
  };
  return (
    <Screen>
      <H>Ante Mortem</H>
      <P dim>Still here. Sign in; your vault passphrase comes next and never leaves this device.</P>
      <Input placeholder="email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
      <Input placeholder="password" value={password} onChangeText={setPassword} secureTextEntry />
      <Button title="Sign in" onPress={go} />
      <Err e={err} />
      <Link href="/(auth)/register" style={{ color: "#8a8a93", marginTop: 12 }}>No account? Create one.</Link>
    </Screen>
  );
}
