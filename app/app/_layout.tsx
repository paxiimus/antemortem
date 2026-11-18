import "react-native-get-random-values";
import "@/platform";
import { Buffer } from "buffer";
globalThis.Buffer ??= Buffer;   // tlock-js expects Node's Buffer

import { useEffect, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { Provider, useAtom, useAtomValue } from "jotai";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { api, ApiError, setToken } from "@antemortem/core";
import { tokenStore } from "@/platform";
import { ready } from "@antemortem/core";
import { tokenAtom, userAtom, vaultKeyAtom, type User } from "@antemortem/core";
import { Button, C, P, Screen } from "@/ui";

function Gate() {
  const [token, setTok] = useAtom(tokenAtom);
  const [, setUser] = useAtom(userAtom);
  const key = useAtomValue(vaultKeyAtom);
  const [booted, setBooted] = useState(false); const [bootErr, setBootErr] = useState<string | null>(null);
  const segments = useSegments(); const router = useRouter();

  // Only a 401/403 means the token is bad. Anything else (no signal, server down) keeps it and offers a retry.
  const boot = async () => {
    setBootErr(null);
    try {
      await ready;
      const t = await tokenStore.get();
      if (t) {
        setToken(t);
        try { setUser(await api<User>("/me")); setTok(t); }
        catch (e) {
          if (!(e instanceof ApiError && (e.status === 401 || e.status === 403))) throw e;
          setToken(null); await tokenStore.clear();
        }
      }
      setBooted(true);
    } catch (e: any) { setBootErr(e?.message ?? String(e)); }
  };
  useEffect(() => { boot(); }, []);

  useEffect(() => {
    if (!booted) return;
    const inAuth = segments[0] === "(auth)";
    if (segments[0] === "c") return;                       // contact flow needs no account
    if (!token && !inAuth) router.replace("/(auth)/login");
    else if (token && !key && segments[0] !== "unlock") router.replace("/unlock");
    else if (token && key && (inAuth || segments[0] === "unlock")) router.replace("/(tabs)");
  }, [booted, token, key, segments[0]]);

  if (bootErr) return <Screen><P>Can't reach Ante Mortem right now.</P><P dim>{bootErr}</P><Button title="Retry" onPress={boot} /></Screen>;
  if (!booted) return <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center" }}><ActivityIndicator color={C.accent} /></View>;
  return <Slot />;
}

export default function Root() {
  return <Provider><StatusBar style="light" /><Gate /></Provider>;
}
