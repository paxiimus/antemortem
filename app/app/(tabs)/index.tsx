import { useState } from "react";
import { Text, View } from "react-native";
import { useAtom, useAtomValue } from "jotai";
import { api, contactsAtom, userAtom, type User } from "@antemortem/core";
import { SealRing } from "@/seal";
import type { Tone } from "@/theme";
import { Button, C, Card, Chip, Em, Err, Eyebrow, F, haptic, P, Row, Screen, Stat, Title } from "@/ui";

const STATUS: Record<User["status"], { label: string; t: Tone; line: string }> = {
  alive: { label: "Alive", t: "ok", line: "All quiet. Nothing is released while you keep checking in." },
  lapsed: { label: "Overdue", t: "warn", line: "You've missed a check-in. Nothing has been released, and one tap fixes it." },
  pending: { label: "Release pending", t: "danger", line: "Your contacts have confirmed your death. Checking in now cancels the release." },
  released: { label: "Released", t: "mute", line: "Your last words have been published." },
};
const DAY = 86_400_000;
const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export default function Home() {
  const [user, setUser] = useAtom(userAtom); const contacts = useAtomValue(contactsAtom);
  const [err, setErr] = useState<string | null>(null);
  if (!user) return null;

  const st = STATUS[user.status];
  const last = new Date(user.last_checkin);
  const due = new Date(last.getTime() + user.checkin_interval_days * DAY);
  const days = Math.ceil((due.getTime() - Date.now()) / DAY);
  const overdue = days < 0;
  const ring = overdue ? C.danger : days <= 7 ? C.warn : C.ember;
  const unit = overdue ? (days === -1 ? "day overdue" : "days overdue") : (days === 1 ? "day left" : "days left");

  const checkIn = async () => {
    setErr(null);
    try { setUser(await api<User>("/me/checkin", { method: "POST" })); haptic.ok(); }
    catch (e: any) { haptic.fail(); setErr(`Check-in failed, so the clock is still running. Try again. ${e.message ?? ""}`); }
  };

  return (
    <Screen tabs>
      <Row between><Eyebrow>Ante Mortem</Eyebrow><Chip t={st.t}>{st.label}</Chip></Row>
      <Title>{user.display_name || user.handle}<Em>.</Em></Title>

      <View style={{ alignItems: "center", paddingVertical: 6 }}>
        <SealRing fraction={overdue ? 1 : days / user.checkin_interval_days} color={ring}>
          <Text style={{ fontFamily: F.display, fontSize: 80, lineHeight: 84, color: C.fg }}>{Math.abs(days)}</Text>
          <Eyebrow color={overdue ? C.danger : C.mute}>{unit}</Eyebrow>
        </SealRing>
      </View>

      <Button title="Still here" onPress={checkIn} disabled={user.status === "released"} />
      <Err e={err} />
      <P small dim center>Last check-in {fmt(last)} · next due {fmt(due)}</P>

      <Card label="Status"><P dim>{st.line}</P></Card>
      <Card label="Your switch">
        <Row gap={12}>
          <Stat value={contacts.length} label={contacts.length === 1 ? "Contact" : "Contacts"} />
          <Stat value={`${user.checkin_interval_days}d`} label="Check-in" />
          <Stat value={`${user.tlock_horizon_days}d`} label="Time lock" />
        </Row>
        <P small dim>Release needs every contact to confirm, or the time lock after {user.tlock_horizon_days} days without opening the app.</P>
      </Card>
    </Screen>
  );
}
