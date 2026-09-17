import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { Link, useLocation } from "wouter";
import { getSession, setSession, signIn, signUp } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export default function Auth() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const prompt = (() => { try { return new URLSearchParams(window.location.search).get("prompt")?.trim() || ""; } catch { return ""; } })();
  const goChat = () => navigate(prompt ? `/chat?prompt=${encodeURIComponent(prompt)}` : "/chat");

  useEffect(() => {
    if (getSession()) return;
    try {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token"); const refreshToken = hash.get("refresh_token");
      if (accessToken && refreshToken) {
        const user = JSON.parse(atob(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        setSession({ access_token: accessToken, refresh_token: refreshToken, user: { id: user.sub, email: user.email || null } });
        window.history.replaceState({}, "", window.location.pathname + window.location.search);
        goChat();
      }
    } catch { /* normal sign-in page */ }
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setMessage(""); setLoading(true);
    try {
      if (mode === "signin") { await signIn(email.trim(), password); goChat(); }
      else { const result = await signUp(email.trim(), password); if (result.session) goChat(); else setMessage("Account created. Please check your email to confirm your account, then sign in."); }
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <main className="min-h-screen bg-[#08090d] text-white"><div className="pointer-events-none fixed inset-0 blue-grid opacity-25" /><div className="pointer-events-none fixed left-[-15rem] top-[-15rem] h-[38rem] w-[38rem] rounded-full bg-blue-600/20 blur-[120px]" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl items-center justify-center px-5 py-10"><div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.035] shadow-2xl shadow-blue-950/30 backdrop-blur-xl lg:grid-cols-[1fr_.85fr]">
        <section className="hidden border-r border-white/10 p-12 lg:flex lg:flex-col lg:justify-between"><Link href="/" className="flex items-center gap-3"><span className="blue-mark"><Sparkles className="size-4" /></span><span className="font-semibold tracking-[-.04em]">BLUE <span className="text-white/35">AI</span></span></Link><div><p className="mb-4 text-xs font-semibold uppercase tracking-[.22em] text-cyan-300/70">Your AI workspace</p><h1 className="text-5xl font-semibold leading-[1.02] tracking-[-.06em]">Keep your ideas.<br /><span className="blue-gradient-text">Keep the context.</span></h1><p className="mt-6 max-w-md text-sm leading-7 text-white/40">Sign in to save conversations, continue them later, and keep your BLUE workspace synced across sessions.</p></div><p className="text-xs text-white/25">Private conversations · Secure authentication</p></section>
        <section className="p-6 sm:p-10"><div className="mb-8 flex items-center justify-between"><Link href="/" className="text-white/35 hover:text-white"><ArrowLeft className="inline size-4" /> <span className="text-xs">Home</span></Link><span className="text-xs text-white/30">{mode === "signin" ? "Welcome back" : "Create account"}</span></div><div className="mb-8 lg:hidden"><div className="flex items-center gap-3"><span className="blue-mark"><Sparkles className="size-4" /></span><span className="font-semibold">BLUE AI</span></div></div><div className="mb-7"><h2 className="text-3xl font-semibold tracking-[-.05em]">{mode === "signin" ? "Sign in to BLUE" : "Create your BLUE account"}</h2><p className="mt-2 text-sm text-white/35">{mode === "signin" ? "Continue your conversations." : "Start saving your AI conversations."}</p></div>
          <form onSubmit={submit} className="space-y-4"><label className="block"><span className="mb-2 block text-xs font-medium text-white/50">Email</span><div className="relative"><Mail className="absolute left-3.5 top-3.5 size-4 text-white/25" /><input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="h-11 w-full rounded-xl border border-white/10 bg-white/[.04] pl-10 pr-3 text-sm outline-none transition focus:border-blue-400/50 focus:bg-white/[.06]" /></div></label><label className="block"><span className="mb-2 block text-xs font-medium text-white/50">Password</span><div className="relative"><LockKeyhole className="absolute left-3.5 top-3.5 size-4 text-white/25" /><input required minLength={6} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" className="h-11 w-full rounded-xl border border-white/10 bg-white/[.04] pl-10 pr-3 text-sm outline-none transition focus:border-blue-400/50 focus:bg-white/[.06]" /></div></label>{error && <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2.5 text-xs leading-5 text-red-200">{error}</div>}{message && <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2.5 text-xs leading-5 text-emerald-200">{message}</div>}<Button disabled={loading} className="h-11 w-full rounded-xl bg-white text-[#08090d] hover:bg-cyan-100">{loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}<ArrowRight className="size-4" /></Button></form>
          <div className="mt-7 text-center text-xs text-white/30">{mode === "signin" ? "New to BLUE?" : "Already have an account?"} <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setMessage(""); }} className="font-medium text-cyan-300 hover:text-cyan-200">{mode === "signin" ? "Create an account" : "Sign in"}</button></div><p className="mt-8 text-center text-[10px] leading-5 text-white/20">By continuing, you agree to use BLUE responsibly. Your chat history is tied to your account.</p>
        </section></div></div></main>
  );
}
