import { ReactNode, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { C } from "./theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** The check-in seal: a ring that drains toward the due date and refills on "Still here". */
export function SealRing({ fraction, color, size = 248, stroke = 9, children }: {
  fraction: number; color: string; size?: number; stroke?: number; children: ReactNode;
}) {
  const r = (size - stroke) / 2, circ = 2 * Math.PI * r, mid = size / 2;
  const f = Math.max(0, Math.min(1, fraction));
  const progress = useRef(new Animated.Value(f)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const [still, setStill] = useState(false);

  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {}); }, []);

  useEffect(() => {
    if (still) { progress.setValue(f); return; }
    Animated.timing(progress, { toValue: f, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [f, still]);

  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [still]);

  const offset = progress.interpolate({ inputRange: [0, 1], outputRange: [circ, 0] });
  const halo = size * 0.78;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
      accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(f * 100) }}>
      <Animated.View pointerEvents="none" style={[styles.halo, {
        width: halo, height: halo, borderRadius: halo / 2, backgroundColor: color,
        opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.13] }),
        transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] }) }],
      }]} />
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={mid} cy={mid} r={r} stroke={C.line} strokeWidth={stroke} fill="none" />
        <Circle cx={mid} cy={mid} r={r - stroke * 1.6} stroke={C.line} strokeWidth={1} fill="none" strokeDasharray="2 6" />
        <AnimatedCircle
          cx={mid} cy={mid} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`} strokeDashoffset={offset as unknown as number}
          transform={`rotate(-90 ${mid} ${mid})`}
        />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ halo: { position: "absolute" } });
