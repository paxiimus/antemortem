import { useState } from "react";
import { useSetAtom } from "jotai";
import { api, setToken, tokenAtom, userAtom, type User } from "@deathnote/core";
import { tokenStore } from "../platform.ts";
import { Busy, Err } from "../ui.tsx";

export default function Register() {
  const [f, setF] = useState({ email: "", handle: "", password: "" }); const [err, setErr] = useState<string | null>(null);
  const setTok = useSetAtom(tokenAtom); const setUser = useSetAtom(userAtom);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const go = async () => {
    setErr(null);
    try {
      const r = await api<User & { token: string }>("/auth/register", { method: "POST", json: f });
      setToken(r.token); tokenStore.set(r.token); setUser(r); setTok(r.token);
    } catch (e: any) { setErr(e.message); }
  };
  return <>
    <h1>Create account</h1>
    <p className="dim">Your handle is your public memorial URL: /cemetery/{f.handle || "handle"}</p>
    <input placeholder="handle" value={f.handle} onChange={set("handle")} />
    <input placeholder="email" type="email" value={f.email} onChange={set("email")} />
    <input placeholder="password" type="password" value={f.password} onChange={set("password")} />
    <Busy title="Create" onClick={go} />
    <Err e={err} />
  </>;
}
