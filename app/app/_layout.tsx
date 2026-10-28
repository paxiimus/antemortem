import "react-native-get-random-values";
import "@/platform";
import { Buffer } from "buffer";
globalThis.Buffer ??= Buffer;   // tlock-js expects Node's Buffer

import { useEffect, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { Provider, useAtom, useAtomValue } from "jotai";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { api, setToken } from "@antemortem/core";
import { tokenStore } from "@/platform";
import { ready } from "@antemortem/core";
import { tokenAtom, userAtom, vaultKeyAtom, type User } from "@antemortem/core";
import { C } from "@/ui";

function Gate() {
  const [token, setTok] = useAtom(tokenAtom);
  const [, setUser] = useAtom(userAtom);
  const key = useAtomValue(vaultKeyAtom);
  const [booted, setBooted] = useState(false);
  const segments = useSegments(); const router = useRouter();

  useEffect(() => { (async () => {
    await ready;
    const t = await tokenStore.get();
    if (t) { setToken(t); setTok(t); try { setUser(await api<User>("/me")); } catch { setToken(null); setTok(null); await tokenStore.clear(); } }
    setBooted(true);
  })(); }, []);

  useEffect(() => {
    if (!booted) return;
    const inAuth = segments[0] === "(auth)";
    if (segments[0] === "c") return;                       // contact flow needs no account
    if (!token && !inAuth) router.replace("/(auth)/login");
    else if (token && !key && segments[0] !== "unlock") router.replace("/unlock");
    else if (token && key && (inAuth || segments[0] === "unlock")) router.replace("/(tabs)");
  }, [booted, token, key, segments[0]]);

  if (!booted) return <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center" }}><ActivityIndicator color={C.accent} /></View>;
  return <Slot />;
}

export default function Root() {
  return <Provider><StatusBar style="light" /><Gate /></Provider>;
}
