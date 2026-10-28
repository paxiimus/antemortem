import { ReactNode, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ScrollView } from "react-native";

export const C = { bg: "#0b0b0d", card: "#141418", line: "#26262c", fg: "#e8e6e1", dim: "#8a8a93", accent: "#c9a96e", danger: "#c45c5c" };

export const Screen = ({ children }: { children: ReactNode }) => (
  <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">{children}</ScrollView>
);
export const H = ({ children }: { children: ReactNode }) => <Text style={s.h}>{children}</Text>;
export const P = ({ children, dim }: { children: ReactNode; dim?: boolean }) => <Text style={[s.p, dim && { color: C.dim }]}>{children}</Text>;
export const Card = ({ children }: { children: ReactNode }) => <View style={s.card}>{children}</View>;
export const Input = (p: TextInputProps) => <TextInput placeholderTextColor={C.dim} autoCapitalize="none" {...p} style={[s.input, p.style]} />;

export function Button({ title, onPress, kind = "primary", disabled }: { title: string; onPress: () => void | Promise<void>; kind?: "primary" | "ghost" | "danger"; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); try { await onPress(); } finally { setBusy(false); } };
  return (
    <Pressable onPress={go} disabled={disabled || busy} style={({ pressed }) => [s.btn, kind === "ghost" && s.ghost, kind === "danger" && s.danger, (pressed || disabled) && { opacity: 0.6 }]}>
      {busy ? <ActivityIndicator color={kind === "primary" ? C.bg : C.fg} /> : <Text style={[s.btnT, kind !== "primary" && { color: C.fg }]}>{title}</Text>}
    </Pressable>
  );
}

export const Err = ({ e }: { e: string | null }) => e ? <Text style={{ color: C.danger, marginTop: 8 }}>{e}</Text> : null;

const s = StyleSheet.create({
  pad: { padding: 20, gap: 12, paddingBottom: 60 },
  h: { color: C.fg, fontSize: 26, fontWeight: "600", marginBottom: 6, fontFamily: "Georgia" },
  p: { color: C.fg, fontSize: 16, lineHeight: 24 },
  card: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 10, padding: 16, gap: 8 },
  input: { backgroundColor: C.card, color: C.fg, borderColor: C.line, borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  btn: { backgroundColor: C.accent, padding: 14, borderRadius: 8, alignItems: "center" },
  ghost: { backgroundColor: "transparent", borderColor: C.line, borderWidth: 1 },
  danger: { backgroundColor: C.danger },
  btnT: { color: C.bg, fontWeight: "600", fontSize: 16 },
});
