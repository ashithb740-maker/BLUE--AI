const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export type AuthUser = { id: string; email?: string | null };
export type Session = { access_token: string; refresh_token: string; user: AuthUser };

const SESSION_KEY = "blue-auth-session";

function headers(accessToken?: string) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${accessToken || SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function request(path: string, options: RequestInit = {}, accessToken?: string) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: { ...headers(accessToken), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.msg || data?.message || data?.error_description || data?.error || `Request failed (${response.status})`);
  return data;
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setSession(session: Session | null) {
  if (!session) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function signUp(email: string, password: string) {
  const data = await request("/auth/v1/signup", { method: "POST", body: JSON.stringify({ email, password }) });
  if (data?.access_token && data?.refresh_token) {
    const session = { access_token: data.access_token, refresh_token: data.refresh_token, user: data.user } as Session;
    setSession(session);
    return { session, needsConfirmation: false };
  }
  return { session: null, needsConfirmation: true };
}

export async function signIn(email: string, password: string) {
  const data = await request("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
  const session = { access_token: data.access_token, refresh_token: data.refresh_token, user: data.user } as Session;
  setSession(session);
  return session;
}

export async function refreshSession() {
  const current = getSession();
  if (!current?.refresh_token) return null;
  try {
    const data = await request("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: current.refresh_token }) });
    const session = { access_token: data.access_token, refresh_token: data.refresh_token || current.refresh_token, user: data.user || current.user } as Session;
    setSession(session);
    return session;
  } catch { setSession(null); return null; }
}

export async function signOut() {
  const session = getSession();
  if (session) await request("/auth/v1/logout", { method: "POST" }, session.access_token).catch(() => undefined);
  setSession(null);
}

export async function dbFetch(path: string, options: RequestInit = {}) {
  const session = getSession();
  if (!session) throw new Error("Please sign in first.");
  return request(`/rest/v1${path}`, options, session.access_token);
}

export async function rpc<T = any>(name: string, body: Record<string, unknown>) {
  const session = getSession();
  if (!session) throw new Error("Please sign in first.");
  return request(`/rest/v1/rpc/${name}`, { method: "POST", body: JSON.stringify(body) }, session.access_token) as Promise<T>;
}

export async function getProfile() {
  const rows = await dbFetch(`/profiles?select=id,email,plan,premium_until&id=eq.${encodeURIComponent(getSession()!.user.id)}&limit=1`);
  return rows?.[0] || { plan: "free", premium_until: null };
}

export { SUPABASE_URL };
