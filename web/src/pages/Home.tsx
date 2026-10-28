import { useAtom, useAtomValue } from "jotai";
import { api, contactsAtom, userAtom, type User } from "@deathnote/core";
import { Busy } from "../ui.tsx";

const STATUS: Record<User["status"], string> = {
  alive: "Alive and well.", lapsed: "You've missed a check-in. Nothing has been released.",
  pending: "A release is pending. Checking in now cancels it.", released: "Released.",
};

export default function Home() {
  const [user, setUser] = useAtom(userAtom); const contacts = useAtomValue(contactsAtom);
  if (!user) return null;
  const due = new Date(user.last_checkin).getTime() + user.checkin_interval_days * 86_400_000;
  const days = Math.ceil((due - Date.now()) / 86_400_000);
  return <>
    <h1>{user.display_name || user.handle}</h1>
    <div className="card">
      <p>{STATUS[user.status]}</p>
      <p className="dim">{days >= 0 ? `Next check-in due in ${days} day${days === 1 ? "" : "s"}.` : `${-days} days overdue.`}</p>
      <Busy title="I'm still here" onClick={async () => setUser(await api<User>("/me/checkin", { method: "POST" }))} />
    </div>
    <div className="card">
      <p>{contacts.length} trusted contact{contacts.length === 1 ? "" : "s"}</p>
      <p className="dim">Release needs all of them plus the server, or the timelock after {user.tlock_horizon_days} days of silence.</p>
    </div>
  </>;
}
