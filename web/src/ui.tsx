import { FormEvent, useState } from "react";

export function Busy({ title, onClick, kind, disabled }: { title: string; onClick: () => void | Promise<void>; kind?: "ghost" | "danger"; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const go = async (e: FormEvent) => { e.preventDefault(); setBusy(true); try { await onClick(); } finally { setBusy(false); } };
  return <button className={kind} onClick={go} disabled={disabled || busy}>{busy ? "…" : title}</button>;
}
export const Err = ({ e }: { e: string | null }) => e ? <p className="err">{e}</p> : null;
