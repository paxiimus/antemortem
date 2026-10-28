import { Buffer } from "buffer";
globalThis.Buffer ??= Buffer;
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { Provider } from "jotai";
import { configure } from "@deathnote/core";
import App from "./App.tsx";

configure({ apiUrl: import.meta.env.VITE_API_URL ?? "" });   // "" → same-origin via Vite proxy in dev
createRoot(document.getElementById("root")!).render(
  <StrictMode><Provider><BrowserRouter><App /></BrowserRouter></Provider></StrictMode>
);
