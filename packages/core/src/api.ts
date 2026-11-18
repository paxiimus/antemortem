// Platform-agnostic API client. Each app sets the base URL and the token.
let API = "http://localhost:8000";
let token: string | null = null;
export const configure = (o: { apiUrl?: string; token?: string | null }) => {
  if (o.apiUrl) API = o.apiUrl;
  if (o.token !== undefined) token = o.token;
};
export const setToken = (t: string | null) => { token = t; };

const TIMEOUT_MS = 20_000;   // mobile networks stall rather than fail; a stalled request must not hang a screen

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (token) headers.Authorization = `Token ${token}`;
  if (init.json !== undefined) { headers["Content-Type"] = "application/json"; init.body = JSON.stringify(init.json); }
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const r = await fetch(`${API}/api${path}`, { ...init, headers, signal: init.signal ?? ctl.signal })
    .catch(e => { throw ctl.signal.aborted ? new ApiError(0, "The server took too long to answer.") : e; })
    .finally(() => clearTimeout(timer));
  if (r.status === 204) return undefined as T;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, typeof data === "object" ? JSON.stringify(data) : r.statusText);
  return data as T;
}

export class ApiError extends Error { constructor(public status: number, msg: string) { super(msg); } }
