import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Bot, Check, Copy, Menu, Plus, Sparkles, User, X, LogOut, Crown } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";
import { dbFetch, getProfile, getSession, refreshSession, setSession, signOut } from "@/lib/supabase";

type Message = { role: "user" | "model"; text: string };
type Conversation = { id: string; title: string; updated_at: string };
type Profile = { plan: "free" | "pro"; premium_until: string | null };
const FREE_TOKENS = 5000;

function timezone() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"; } catch { return "Asia/Kolkata"; } }
function promptFromUrl() { try { return new URLSearchParams(location.search).get("prompt")?.trim() || ""; } catch { return ""; } }

export default function BlueChatV2() {
  const [, navigate] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(promptFromUrl);
  const [loading, setLoading] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [chats, setChats] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>({ plan: "free", premium_until: null });
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const [account, setAccount] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      let session = getSession();
      if (!session) { navigate("/auth"); return; }
      session = (await refreshSession()) || session;
      if (!session || dead) return;
      try {
        const [p, c] = await Promise.all([getProfile(), dbFetch("/conversations?select=id,title,updated_at&order=updated_at.desc&limit=50")]);
        if (!dead) { setProfile(p); setChats(c || []); }
      } catch (e) { if (!dead) setError(e instanceof Error ? e.message : "Unable to load your chats."); }
    })();
    return () => { dead = true; };
  }, [navigate]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const loadChat = async (chat: Conversation) => {
    setSidebar(false); setError(""); setLoading(true); setConversationId(chat.id);
    try {
      const rows = await dbFetch(`/messages?select=role,content,created_at&conversation_id=eq.${encodeURIComponent(chat.id)}&order=created_at.asc&limit=200`);
      const loaded = (rows || []).map((m: any) => ({ role: m.role, text: m.content })) as Message[];
      // Older BLUE conversations may contain only the conversation row because an earlier API version failed while saving messages.
      // Keep the original prompt visible so the user can immediately continue that chat.
      setMessages(loaded.length ? loaded : [{ role: "user", text: chat.title }]);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to open this chat."); }
    finally { setLoading(false); }
  };

  const newChat = () => { setMessages([]); setInput(""); setConversationId(null); setError(""); setSidebar(false); window.history.replaceState({}, "", "/chat"); };

  const send = async (value = input) => {
    const text = value.trim(); if (!text || loading) return;
    const session = getSession(); if (!session) { navigate("/auth"); return; }
    const before = messages;
    setMessages([...before, { role: "user", text }]); setInput(""); setLoading(true); setError("");
    try {
      const response = await fetch("/api/gemini", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ message: text, history: before.slice(-20), timeZone: timezone(), conversationId }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) { setSession(null); navigate("/auth"); return; }
        setMessages(before); setError(data?.error || "BLUE could not answer right now. Please try again."); return;
      }
      const id = data.conversationId ? String(data.conversationId) : conversationId;
      setConversationId(id);
      setProfile(p => ({ ...p, plan: data.plan === "pro" ? "pro" : p.plan }));
      setMessages([...before, { role: "user", text }, { role: "model", text: data.text || "I received an empty response." }]);
      if (id && !conversationId) setChats(prev => [{ id, title: text.slice(0, 70), updated_at: new Date().toISOString() }, ...prev.filter(x => x.id !== id)]);
      else if (id) setChats(prev => prev.map(x => x.id === id ? { ...x, updated_at: new Date().toISOString() } : x).sort((a,b) => +new Date(b.updated_at)-+new Date(a.updated_at)));
    } catch (e) { setMessages(before); setError(e instanceof Error ? e.message : "BLUE could not connect. Please try again."); }
    finally { setLoading(false); }
  };

  const copy = async (i: number, text: string) => { try { await navigator.clipboard.writeText(text); setCopied(i); setTimeout(() => setCopied(null), 1200); } catch {} };
  const logout = async () => { await signOut(); navigate("/auth"); };
  const canSend = useMemo(() => !!input.trim() && !loading, [input, loading]);

  return <div className="flex h-dvh overflow-hidden bg-[#08090d] text-white">
    <div className="pointer-events-none fixed inset-0 blue-grid opacity-20" />
    {sidebar && <button aria-label="Close sidebar" className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setSidebar(false)} />}

    <aside className={`${sidebar ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r border-white/[.08] bg-[#0b0d12]/95 p-3 backdrop-blur-xl transition-transform md:relative md:translate-x-0`}>
      <div className="flex h-11 items-center justify-between px-2"><Link href="/" className="flex items-center gap-2.5"><span className="blue-mark size-7"><Sparkles className="size-3.5" /></span><span className="font-semibold tracking-tight">BLUE <span className="text-white/35">AI</span></span></Link><button className="rounded-lg p-2 text-white/45 hover:bg-white/10 md:hidden" onClick={() => setSidebar(false)}><X className="size-4" /></button></div>
      <Button onClick={newChat} variant="outline" className="mt-5 h-10 justify-start gap-2 rounded-xl border-white/10 bg-white/[.03] text-white hover:bg-white/[.07]"><Plus className="size-4" /> New chat</Button>
      <div className="mt-7 px-2 text-[10px] font-semibold uppercase tracking-[.18em] text-white/30">Saved chats</div>
      <div className="mt-2 flex-1 overflow-y-auto space-y-1 pr-1 blue-scroll">
        {chats.length ? chats.map(chat => <button key={chat.id} onClick={() => loadChat(chat)} className={`w-full rounded-xl px-3 py-2.5 text-left text-[13px] transition ${chat.id === conversationId ? "bg-white/[.08] text-white" : "text-white/48 hover:bg-white/[.05] hover:text-white/80"}`}>{chat.title}</button>) : <p className="px-3 py-3 text-xs text-white/25">Your conversations will appear here.</p>}
      </div>
      <div className="rounded-2xl border border-white/[.08] bg-white/[.025] p-3"><div className="flex items-center gap-2 text-xs font-medium"><Crown className={`size-3.5 ${profile.plan === "pro" ? "text-amber-300" : "text-cyan-300"}`} />{profile.plan === "pro" ? "BLUE Pro" : "BLUE Free"}</div><p className="mt-2 text-[10px] text-white/30">{profile.plan === "pro" ? "Unlimited daily access" : `${FREE_TOKENS.toLocaleString()} free tokens/day`}</p></div>
    </aside>

    <main className="relative z-10 flex min-w-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[.07] px-3 sm:px-5"><div className="flex items-center gap-2"><button className="rounded-lg p-2 text-white/55 hover:bg-white/10 md:hidden" onClick={() => setSidebar(true)}><Menu className="size-5" /></button><Link href="/" className="text-xs text-white/35 hover:text-white">Home</Link></div><div className="relative"><button onClick={() => setAccount(v => !v)} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.035] px-3 py-2 text-xs text-white/60 hover:bg-white/[.07]"><User className="size-3.5" /> Account</button>{account && <div className="absolute right-0 top-11 z-50 w-64 rounded-2xl border border-white/10 bg-[#11131a] p-2 shadow-2xl"><div className="px-3 py-2 text-xs text-white/50">{getSession()?.user.email}</div><div className="border-t border-white/[.07] my-1" /><button onClick={logout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-white/60 hover:bg-white/[.06] hover:text-white"><LogOut className="size-3.5" /> Sign out</button></div>}</div></header>

      <div className="flex-1 overflow-y-auto blue-scroll">
        <div className="mx-auto w-full max-w-3xl px-4 pb-44 pt-8 sm:px-6 sm:pt-10">
          {error && <div className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-red-400/15 bg-red-400/[.06] px-4 py-3 text-xs text-red-200/80"><span>{error}</span><button onClick={() => setError("")}><X className="size-4" /></button></div>}
          {messages.length === 0 ? <div className="flex min-h-[60vh] flex-col items-center justify-center text-center"><div className="blue-orb mb-7 scale-90"><div className="blue-orb-core"><Sparkles className="size-7 text-white" /></div></div><h1 className="text-3xl font-semibold tracking-[-.045em] sm:text-4xl">What can I help you with?</h1><p className="mt-3 max-w-lg text-sm leading-6 text-white/38">Ask anything, write code, learn, brainstorm, or solve a problem.</p><div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">{["Explain a difficult concept simply","Build a React project with me","Help debug my code","Create a study plan"].map(x => <button key={x} onClick={() => send(x)} className="rounded-2xl border border-white/[.08] bg-white/[.025] px-4 py-3 text-left text-sm text-white/55 transition hover:border-white/15 hover:bg-white/[.055] hover:text-white">{x}</button>)}</div></div> : <div className="space-y-8">
            {messages.map((m,i) => <div key={`${i}-${m.role}`} className={m.role === "user" ? "flex justify-end" : "flex gap-3"}>
              {m.role === "model" && <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full border border-cyan-300/15 bg-cyan-300/[.06]"><Bot className="size-3.5 text-cyan-200" /></div>}
              <div className={m.role === "user" ? "max-w-[82%] rounded-3xl rounded-br-lg bg-blue-500 px-4 py-3 text-[15px] leading-6 shadow-lg shadow-blue-950/20" : "min-w-0 flex-1 pt-0.5"}>
                {m.role === "model" ? <div className="blue-response text-[15px] leading-7 text-white/85"><Streamdown mode="static">{m.text}</Streamdown></div> : <div className="whitespace-pre-wrap">{m.text}</div>}
                {m.role === "model" && <button onClick={() => copy(i,m.text)} className="mt-2 inline-flex items-center gap-1 rounded-lg p-1.5 text-white/25 hover:bg-white/[.06] hover:text-white/65" aria-label="Copy response">{copied === i ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied === i && <span className="text-[10px]">Copied</span>}</button>}
              </div>
            </div>)}
            {loading && <div className="flex gap-3"><div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full border border-cyan-300/15 bg-cyan-300/[.06]"><Bot className="size-3.5 text-cyan-200" /></div><div className="flex gap-1 pt-3"><i className="size-1.5 animate-bounce rounded-full bg-white/50" /><i className="size-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:-.15s]" /><i className="size-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:-.3s]" /></div></div>}
            <div ref={endRef} />
          </div>}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#08090d] via-[#08090d]/95 to-transparent px-3 pb-4 pt-12 sm:px-6"><div className="mx-auto max-w-3xl"><div className="rounded-3xl border border-white/10 bg-[#11131a]/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl"><textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if(e.key === "Enter" && !e.shiftKey){e.preventDefault(); if(canSend) send();} }} rows={1} placeholder="Message BLUE..." className="max-h-40 min-h-12 w-full resize-none bg-transparent px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/25"/><div className="flex items-center justify-between px-2 pb-1"><span className="text-[10px] text-white/20">Enter to send · Shift + Enter for new line</span><button disabled={!canSend} onClick={() => send()} className="flex size-9 items-center justify-center rounded-full bg-blue-500 text-white transition hover:bg-blue-400 disabled:opacity-25"><ArrowUp className="size-4"/></button></div></div><div className="mt-2 flex justify-center text-[10px] text-white/18">{profile.plan === "pro" ? "BLUE Pro · Unlimited daily access" : `${FREE_TOKENS.toLocaleString()} free tokens/day`}</div></div></div>
    </main>
  </div>;
}
