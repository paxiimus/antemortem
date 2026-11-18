// One visual world, shared with the landing page: ink dark, warm white type, a single ember accent.
// Display type is Instrument Serif, labels are IBM Plex Mono, running text is the platform's own sans.
export const C = {
  bg: "#0e1014",
  raised: "#161920",
  sunken: "#0a0c0f",
  line: "#262a33",
  lineHi: "#3a404c",
  fg: "#ece9e3",
  mute: "#9aa0ab",
  faint: "#646a75",
  ember: "#ff7c48",
  emberDim: "rgba(255,124,72,0.13)",
  emberInk: "#1a0d06",
  ok: "#8fc9a3",
  okDim: "rgba(143,201,163,0.12)",
  warn: "#e8b45a",
  warnDim: "rgba(232,180,90,0.12)",
  danger: "#ff6b6b",
  dangerDim: "rgba(255,107,107,0.11)",
};

// Family names registered by useFonts in app/_layout.tsx. If a font fails to load,
// React Native falls back to the system face instead of crashing.
export const F = {
  display: "AM-Display",
  displayItalic: "AM-DisplayItalic",
  mono: "AM-Mono",
  monoMed: "AM-MonoMedium",
};

export const R = { sm: 8, md: 12, lg: 18, pill: 999 };

export type Tone = "ember" | "ok" | "warn" | "danger" | "mute";
export const tone = (t: Tone) => ({
  ember: { fg: C.ember, bg: C.emberDim },
  ok: { fg: C.ok, bg: C.okDim },
  warn: { fg: C.warn, bg: C.warnDim },
  danger: { fg: C.danger, bg: C.dangerDim },
  mute: { fg: C.mute, bg: "transparent" },
}[t]);
