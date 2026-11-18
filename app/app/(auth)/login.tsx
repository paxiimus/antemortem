import { useState } from "react";
import { Link } from "expo-router";
import { useSetAtom } from "jotai";
import { api, setToken, tokenAtom, userAtom, type User } from "@antemortem/core";
import { tokenStore } from "@/platform";
import { Button, C, Em, Err, Eyebrow, Field, haptic, P, Screen, Title } from "@/ui";

export default function Login() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [err, setErr] = useState<string | null>(null);
  const setTok = useSetAtom(tokenAtom); const setUser = useSetAtom(userAtom);
  const go = async () => {
    setErr(null);
    try {
      const r = await api<User & { token: string }>("/auth/login", { method: "POST", json: { email, password } });
      setToken(r.token); await tokenStore.set(r.token); setUser(r); setTok(r.token);
    } catch { haptic.fail(); setErr("Wrong email or password."); }
  };
  return (
    <Screen>
      <Eyebrow color={C.faint}>ante mortem, adj. · made before death</Eyebrow>
      <Title size={52}>Ante Mortem<Em>.</Em></Title>
      <P dim>Last words, sealed until you're gone. Sign in, then your vault passphrase unlocks everything on this phone.</P>
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" returnKeyType="next" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={go} returnKeyType="go" />
      <Err e={err} />
      <Button title="Sign in" onPress={go} disabled={!email || !password} />
      <Link href="/(auth)/register" style={{ color: C.ember, fontSize: 15, paddingVertical: 8 }}>No account? Create one.</Link>
    </Screen>
  );
}
