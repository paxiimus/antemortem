import { ReactNode, useRef, useState } from "react";
import {
  ActivityIndicator, Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, TextInputProps, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { C, F, R, tone, type Tone } from "./theme";

export { C, F, R } from "./theme";

export const haptic = {
  tap: () => Haptics.selectionAsync().catch(() => {}),
  ok: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  fail: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
};

// ── Layout ──────────────────────────────────────────────────────────────
export function Screen({ children, tabs }: { children: ReactNode; tabs?: boolean }) {
  const ins = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={s.fill}
        contentContainerStyle={[s.pad, { paddingTop: ins.top + 28, paddingBottom: tabs ? 32 : ins.bottom + 48 }]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export const Row = ({ children, gap = 10, between }: { children: ReactNode; gap?: number; between?: boolean }) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap, justifyContent: between ? "space-between" : "flex-start" }}>{children}</View>
);

export const Rule = () => <View style={s.rule} />;

// ── Type ────────────────────────────────────────────────────────────────
export const Eyebrow = ({ children, color = C.mute }: { children: ReactNode; color?: string }) => (
  <Text style={[s.eyebrow, { color }]}>{children}</Text>
);

/** Display heading. Wrap a word in <Em> for the ember italic. */
export const Title = ({ children, size = 40 }: { children: ReactNode; size?: number }) => (
  <Text style={[s.title, { fontSize: size, lineHeight: size * 1.08 }]} accessibilityRole="header">{children}</Text>
);
export const Em = ({ children }: { children: ReactNode }) => <Text style={s.em}>{children}</Text>;

export const P = ({ children, dim, small, center }: { children: ReactNode; dim?: boolean; small?: boolean; center?: boolean }) => (
  <Text style={[s.p, dim && { color: C.mute }, small && { fontSize: 14, lineHeight: 21 }, center && { textAlign: "center" }]}>{children}</Text>
);

export const Mono = ({ children, color = C.fg, size = 14 }: { children: ReactNode; color?: string; size?: number }) => (
  <Text style={{ fontFamily: F.mono, fontSize: size, lineHeight: size * 1.5, color }} selectable>{children}</Text>
);

// ── Surfaces ────────────────────────────────────────────────────────────
export function Card({ children, label, right, accent }: { children: ReactNode; label?: string; right?: ReactNode; accent?: Tone }) {
  return (
    <View style={[s.card, accent && { borderColor: tone(accent).fg + "55" }]}>
      {(label || right) && (
        <View style={s.cardHead}>
          {label ? <Eyebrow color={accent ? tone(accent).fg : C.mute}>{label}</Eyebrow> : <View />}
          {right}
        </View>
      )}
      <View style={s.cardBody}>{children}</View>
    </View>
  );
}

export const Chip = ({ children, t = "mute" }: { children: ReactNode; t?: Tone }) => {
  const c = tone(t);
  return (
    <View style={[s.chip, { borderColor: c.fg + "66", backgroundColor: c.bg }]}>
      <View style={[s.dot, { backgroundColor: c.fg }]} />
      <Text style={[s.chipT, { color: c.fg }]}>{children}</Text>
    </View>
  );
};

export const Stat = ({ value, label }: { value: ReactNode; label: string }) => (
  <View style={{ flex: 1, gap: 4 }}>
    <Text style={s.stat}>{value}</Text>
    <Eyebrow>{label}</Eyebrow>
  </View>
);

// ── Controls ────────────────────────────────────────────────────────────
export function Field({ label, hint, ...p }: TextInputProps & { label?: string; hint?: string }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      {label && <Eyebrow color={focus ? C.ember : C.mute}>{label}</Eyebrow>}
      <TextInput
        placeholderTextColor={C.faint}
        selectionColor={C.ember}
        cursorColor={C.ember}
        autoCapitalize="none"
        {...p}
        onFocus={e => { setFocus(true); p.onFocus?.(e); }}
        onBlur={e => { setFocus(false); p.onBlur?.(e); }}
        style={[s.input, focus && { borderColor: C.ember }, p.style]}
      />
      {hint && <Text style={s.hint}>{hint}</Text>}
    </View>
  );
}

type Kind = "primary" | "ghost" | "danger" | "quiet";
export function Button({ title, onPress, kind = "primary", disabled, small }: {
  title: string; onPress: () => void | Promise<void>; kind?: Kind; disabled?: boolean; small?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  const go = async () => { haptic.tap(); setBusy(true); try { await onPress(); } finally { setBusy(false); } };
  const off = disabled || busy;
  const k = btn[kind];
  return (
    <Animated.View style={{ transform: [{ scale }], opacity: disabled ? 0.4 : 1, alignSelf: small || kind === "quiet" ? "flex-start" : "stretch" }}>
      <Pressable
        onPress={go} disabled={off} onPressIn={() => to(0.97)} onPressOut={() => to(1)}
        accessibilityRole="button" accessibilityState={{ disabled: !!off, busy }}
        style={[s.btn, small && s.btnSmall, k.box]}
      >
        {busy ? <ActivityIndicator color={k.text.color} /> : <Text style={[s.btnT, small && { fontSize: 12 }, k.text]}>{title}</Text>}
      </Pressable>
    </Animated.View>
  );
}

export const Err = ({ e }: { e: string | null }) => e ? (
  <View style={s.err} accessibilityLiveRegion="polite"><Text style={s.errT}>{e}</Text></View>
) : null;

// ── Styles ──────────────────────────────────────────────────────────────
const btn: Record<Kind, { box: object; text: { color: string } }> = {
  primary: { box: { backgroundColor: C.ember }, text: { color: C.emberInk } },
  ghost: { box: { borderWidth: 1, borderColor: C.lineHi }, text: { color: C.fg } },
  danger: { box: { backgroundColor: C.dangerDim, borderWidth: 1, borderColor: C.danger + "66" }, text: { color: C.danger } },
  quiet: { box: { paddingHorizontal: 0, height: 36 }, text: { color: C.ember } },
};

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.bg },
  pad: { paddingHorizontal: 22, gap: 16 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginVertical: 4 },
  eyebrow: { fontFamily: F.monoMed, fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase" },
  title: { fontFamily: F.display, color: C.fg, letterSpacing: -0.3 },
  em: { fontFamily: F.displayItalic, color: C.ember },
  p: { color: C.fg, fontSize: 16, lineHeight: 24 },
  card: { backgroundColor: C.raised, borderColor: C.line, borderWidth: 1, borderRadius: R.lg, overflow: "hidden" },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  cardBody: { padding: 18, gap: 14 },
  chip: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipT: { fontFamily: F.monoMed, fontSize: 10.5, letterSpacing: 1.2, textTransform: "uppercase" },
  stat: { fontFamily: F.display, color: C.fg, fontSize: 30, lineHeight: 34 },
  input: { backgroundColor: C.sunken, color: C.fg, borderColor: C.line, borderWidth: 1, borderRadius: R.md, paddingHorizontal: 15, paddingVertical: 14, fontSize: 17 },
  hint: { color: C.faint, fontSize: 13, lineHeight: 18 },
  btn: { height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  btnSmall: { height: 38, borderRadius: 10, paddingHorizontal: 14 },
  btnT: { fontFamily: F.monoMed, fontSize: 13.5, letterSpacing: 1.3, textTransform: "uppercase" },
  err: { borderLeftWidth: 2, borderLeftColor: C.danger, paddingLeft: 12, paddingVertical: 2 },
  errT: { color: C.danger, fontSize: 14, lineHeight: 20 },
});
