import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from "react-router";
import { useAtom, useAtomValue } from "jotai";
import { api, ready, setToken, tokenAtom, userAtom, vaultKeyAtom, type User } from "@deathnote/core";
import { tokenStore } from "./platform.ts";
import Login from "./pages/Login.tsx";
import Register from "./pages/Register.tsx";
import Unlock from "./pages/Unlock.tsx";
import Home from "./pages/Home.tsx";
import Vault from "./pages/Vault.tsx";
import Note from "./pages/Note.tsx";
import Contacts from "./pages/Contacts.tsx";
import Settings from "./pages/Settings.tsx";

function Shell() {
  const tabs = [["/", "Home"], ["/vault", "Vault"], ["/note", "Last words"], ["/contacts", "Contacts"], ["/settings", "Settings"]];
  return <>
    <nav>{tabs.map(([to, t]) => <NavLink key={to} to={to} end={to === "/"}>{t}</NavLink>)}</nav>
    <main><Outlet /></main>
  </>;
}

export default function App() {
  const [token, setTok] = useAtom(tokenAtom); const [, setUser] = useAtom(userAtom);
  const key = useAtomValue(vaultKeyAtom); const [booted, setBooted] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => { (async () => {
    await ready;
    const t = tokenStore.get();
    if (t) { setToken(t); setTok(t); try { setUser(await api<User>("/me")); } catch { setToken(null); setTok(null); tokenStore.clear(); } }
    setBooted(true);
  })(); }, []);

  if (!booted) return null;
  const inAuth = pathname === "/login" || pathname === "/register";
  if (!token && !inAuth) return <Navigate to="/login" replace />;
  if (token && !key && pathname !== "/unlock") return <Navigate to="/unlock" replace />;
  if (token && key && (inAuth || pathname === "/unlock")) return <Navigate to="/" replace />;

  return (
    <Routes>
      <Route path="/login" element={<main><Login /></main>} />
      <Route path="/register" element={<main><Register /></main>} />
      <Route path="/unlock" element={<main><Unlock /></main>} />
      <Route element={<Shell />}>
        <Route index element={<Home />} />
        <Route path="vault" element={<Vault />} />
        <Route path="note" element={<Note />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
