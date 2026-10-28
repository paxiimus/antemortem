import { useState } from "react";
import { useAtom, useSetAtom } from "jotai";
import { api, setToken, tokenAtom, userAtom, vaultKeyAtom, type User } from "@deathnote/core";
import { tokenStore } from "../platform.ts";
import { Busy, Err } from "../ui.tsx";

export default function Settings() {
  const [user, setUser] = useAtom(userAtom); const setTok = useSetAtom(tokenAtom); const setKey = useSetAtom(vaultKeyAtom);
  const [f, setF] = useState({ display_name: user!.display_name, checkin_interval_days: user!.checkin_interval_days, tlock_horizon_days: user!.tlock_horizon_days });
  const [err, setErr] = useState<string | null>(null);
  const save = async () => { setErr(null); try { setUser(await api<User>("/me", { method: "PATCH", json: f })); } catch (e: any) { setErr(e.message); } };
  const signOut = () => { setKey(null); setToken(null); tokenStore.clear(); setTok(null); setUser(null); };
  return <>
    <h1>Settings</h1>
    <div className="card">
      <label className="dim">Display name<input value={f.display_name} onChange={e => setF({ ...f, display_name: e.target.value })} /></label>
      <label className="dim">Check-in every (days, 30–365)<input type="number" value={f.checkin_interval_days} onChange={e => setF({ ...f, checkin_interval_days: +e.target.value })} /></label>
      <label className="dim">Timelock horizon (days, ≥ 2× check-in)<input type="number" value={f.tlock_horizon_days} onChange={e => setF({ ...f, tlock_horizon_days: +e.target.value })} /></label>
      <Busy title="Save" onClick={save} />
      <Err e={err} />
    </div>
    <div className="card">
      <p className="dim">Memorial: /cemetery/{user!.handle}</p>
      <Busy title="Lock vault" kind="ghost" onClick={() => setKey(null)} />
      <Busy title="Sign out" kind="ghost" onClick={signOut} />
    </div>
  </>;
}
