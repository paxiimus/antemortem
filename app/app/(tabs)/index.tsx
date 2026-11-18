import { useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { api } from "@antemortem/core";
import { contactsAtom, userAtom, type User } from "@antemortem/core";
import { Button, Card, Err, H, P, Screen } from "@/ui";

const STATUS: Record<User["status"], string> = {
  alive: "Alive and well.", lapsed: "You've missed a check-in. Nothing has been released.",
  pending: "A release is pending. Checking in now cancels it.", released: "Released.",
};

export default function Home() {
  const [user, setUser] = useAtom(userAtom); const contacts = useAtomValue(contactsAtom);
  const [err, setErr] = useState<string | null>(null);
  if (!user) return null;
  const checkIn = async () => {
    setErr(null);
    try { setUser(await api<User>("/me/checkin", { method: "POST" })); }
    catch (e: any) { setErr(`Check-in failed, so the clock is still running. Try again. ${e.message ?? ""}`); }
  };
  const due = new Date(new Date(user.last_checkin).getTime() + user.checkin_interval_days * 86_400_000);
  const days = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
  return (
    <Screen>
      <H>{user.display_name || user.handle}</H>
      <Card>
        <P>{STATUS[user.status]}</P>
        <P dim>{days >= 0 ? `Next check-in due in ${days} day${days === 1 ? "" : "s"}.` : `${-days} days overdue.`}</P>
        <Button title="Still here" onPress={checkIn} />
        <Err e={err} />
      </Card>
      <Card>
        <P>{contacts.length} trusted contact{contacts.length === 1 ? "" : "s"}</P>
        <P dim>Release needs every one of them, or the timelock after {user.tlock_horizon_days} days without opening the app.</P>
      </Card>
    </Screen>
  );
}
