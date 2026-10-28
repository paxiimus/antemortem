import { useState } from "react";
import { Link } from "react-router";
import { useSetAtom } from "jotai";
import { api, setToken, tokenAtom, userAtom, type User } from "@deathnote/core";
import { tokenStore } from "../platform.ts";
import { Busy, Err } from "../ui.tsx";

export default function Login() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [err, setErr] = useState<string | null>(null);
  const setTok = useSetAtom(tokenAtom); const setUser = useSetAtom(userAtom);
  const go = async () => {
    setErr(null);
    try {
      const r = await api<User & { token: string }>("/auth/login", { method: "POST", json: { email, password } });
      setToken(r.token); tokenStore.set(r.token); setUser(r); setTok(r.token);
    } catch { setErr("Wrong email or password."); }
  };
  return <>
    <h1>Death Note</h1>
    <p className="dim">Sign in. Your vault passphrase comes next and never leaves this device.</p>
    <input placeholder="email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
    <input placeholder="password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
    <Busy title="Sign in" onClick={go} />
    <Err e={err} />
    <Link to="/register">No account? Create one.</Link>
  </>;
}
