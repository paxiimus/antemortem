import { useState } from "react";
import { Link } from "expo-router";
import { useSetAtom } from "jotai";
import { api, setToken, tokenAtom, userAtom, type User } from "@antemortem/core";
import { tokenStore } from "@/platform";
import { Button, C, Em, Err, Eyebrow, Field, haptic, Mono, P, Screen, Title } from "@/ui";

export default function Register() {
  const [f, setF] = useState({ email: "", handle: "", password: "" }); const [err, setErr] = useState<string | null>(null);
  const setTok = useSetAtom(tokenAtom); const setUser = useSetAtom(userAtom);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: k === "handle" ? v.toLowerCase().replace(/[^a-z0-9-]/g, "") : v });
  const go = async () => {
    setErr(null);
    try {
      const r = await api<User & { token: string }>("/auth/register", { method: "POST", json: f });
      setToken(r.token); await tokenStore.set(r.token); setUser(r); setTok(r.token);
    } catch (e: any) { haptic.fail(); setErr(e.message); }
  };
  return (
    <Screen>
      <Eyebrow>New account</Eyebrow>
      <Title>Create your <Em>account</Em></Title>
      <P dim>Your handle becomes your public memorial address. Choose one you'd want on a headstone.</P>
      <Field label="Handle" value={f.handle} onChangeText={set("handle")} autoCorrect={false} returnKeyType="next" />
      <Mono color={C.faint} size={13}>/cemetery/{f.handle || "your-handle"}</Mono>
      <Field label="Email" value={f.email} onChangeText={set("email")} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
      <Field label="Password" value={f.password} onChangeText={set("password")} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint="For signing in. Your vault gets its own passphrase next." />
      <Err e={err} />
      <Button title="Create account" onPress={go} disabled={!f.handle || !f.email || !f.password} />
      <Link href="/(auth)/login" style={{ color: C.ember, fontSize: 15, paddingVertical: 8 }}>Have an account? Sign in.</Link>
    </Screen>
  );
}
