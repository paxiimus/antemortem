import "@/polyfills";   // first, before anything that loads @antemortem/core

import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from "@expo-google-fonts/instrument-serif";
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono";
import { Provider, useAtom, useAtomValue, useSetAtom } from "jotai";
import { StatusBar } from "expo-status-bar";
import { api, ApiError, ready, setToken, tokenAtom, userAtom, vaultKeyAtom, type User } from "@antemortem/core";
import { tokenStore } from "@/platform";
import { Button, C, F, P, Screen, Title } from "@/ui";

SplashScreen.preventAutoHideAsync().catch(() => {});

// Access control is declarative (Stack.Protected). Redirecting with router.replace() from an effect
// can fire before the navigator mounts, which drops the redirect and leaves an empty screen.
function RootNavigator() {
  const [token, setTok] = useAtom(tokenAtom);
  const setUser = useSetAtom(userAtom);
  const key = useAtomValue(vaultKeyAtom);
  const [booted, setBooted] = useState(false); const [bootErr, setBootErr] = useState<string | null>(null);
  const [fontsLoaded, fontErr] = useFonts({
    [F.display]: InstrumentSerif_400Regular, [F.displayItalic]: InstrumentSerif_400Regular_Italic,
    [F.mono]: IBMPlexMono_400Regular, [F.monoMed]: IBMPlexMono_500Medium,
  });
  const fontsDone = fontsLoaded || !!fontErr;   // a failed font falls back to the system face

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
  useEffect(() => { if ((booted || bootErr) && fontsDone) SplashScreen.hideAsync().catch(() => {}); }, [booted, bootErr, fontsDone]);

  if (!fontsDone) return null;   // the splash screen is still showing
  if (bootErr) return (
    <Screen>
      <Title>Can't reach the server.</Title>
      <P dim>Your vault is safe on this phone; nothing was lost. Check your connection and try again.</P>
      <P small dim>{bootErr}</P>
      <Button title="Retry" onPress={boot} />
    </Screen>
  );
  if (!booted) return null;

  const signedIn = !!token, unlocked = signedIn && !!key;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: "fade" }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(auth)/register" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !unlocked}>
        <Stack.Screen name="unlock" />
      </Stack.Protected>
      <Stack.Protected guard={unlocked}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Screen name="c/[token]" />{/* contact flow: no account needed */}
    </Stack>
  );
}

export default function Root() {
  return <Provider><StatusBar style="light" /><RootNavigator /></Provider>;
}
