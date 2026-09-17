import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Bot, ChevronLeft, Copy, Menu, Plus, Sparkles, User, X, LogOut, Crown, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";
import { dbFetch, getProfile, getSession, refreshSession, setSession, signOut } from "@/lib/supabase";

type Message = { role: "user" | "model"; text: string };
type Conversation = { id: string; title: string; updated_at: string };
type Profile = { plan: "free" | "pro"; premium_until: string | null };

const FREE_TOKENS = 5000;
const PRO_PRICE = 11;
const UPI_ID = "ashithb740@okicici";
function getInitialPrompt() { try { return new URLSearchParams(window.location.search).get("prompt")?.trim() || ""; } catch { return ""; } }
function getTimeZone() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"; } catch { return "Asia/Kolkata"; } }

export default function BlueChatFixed() {
  const [, navigate] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(getInitialPrompt);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>({ plan: "free", premium_until: null });
  const [remainingTokens, setRemainingTokens] = useState<number | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [error, setError] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentReference, setPaymentReference] = useState("");
  const [utr, setUtr] = useState("");
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let session = getSession();
      if (!session) { navigate("/auth"); return; }
      const refreshed = await refreshSession(); session = refreshed || session;
      if (!session || cancelled) { navigate("/auth"); return; }
      try {
        const [profileData, chats] = await Promise.all([getProfile(), dbFetch("/conversations?select=id,title,updated_at&order=updated_at.desc&limit=30")]);
        if (!cancelled) { setProfile(profileData); setConversations(chats || []); }
      } catch { if (!cancelled) navigate("/auth"); }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  const loadConversation = async (id: string) => {
    setError(""); setLoading(true); setSidebarOpen(false);
    try {
      const rows = await dbFetch(`/messages?select=role,content,created_at&conversation_id=eq.${encodeURIComponent(id)}&order=created_at.asc&limit=200`);
      setConversationId(id); setMessages((rows || []).map((m: any) => ({ role: m.role, text: m.content })));
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load this chat."); }
    finally { setLoading(false); }
  };

  const newChat = () => { setMessages([]); setInput(""); setConversationId(null); setError(""); setSidebarOpen(false); window.history.replaceState({}, "", "/chat"); };

  const sendMessage = async (text = input) => {
    const message = text.trim(); if (!message || loading) return;
    const session = getSession(); if (!session) { navigate("/auth"); return; }
    const previousMessages = messages;
    setMessages([...previousMessages, { role: "user", text: message }]); setInput(""); setLoading(true); setError("");
    try {
      const response = await fetch("/api/gemini", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ message, history: previousMessages.slice(-20), timeZone: getTimeZone(), conversationId }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) { setSession(null); navigate("/auth"); return; }
        if (response.status === 429) { setRemainingTokens(0); setError(data?.error || `You've used today's ${FREE_TOKENS.toLocaleString()} free BLUE tokens. Your free allowance resets at 12:00 AM IST.`); setMessages(previousMessages); return; }
        throw new Error(data?.error || `Request failed (${response.status})`);
      }
      setConversationId(data.conversationId || conversationId);
      setRemainingTokens(typeof data.remainingTokens === "number" ? data.remainingTokens : null);
      setProfile(p => ({ ...p, plan: data.plan === "pro" ? "pro" : p.plan }));
      setMessages([...previousMessages, { role: "user", text: message }, { role: "model", text: data.text || "I received an empty response." }]);
      if (data.conversationId && !conversationId) setConversations(prev => [{ id: data.conversationId, title: message.slice(0, 70), updated_at: new Date().toISOString() }, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setMessages(previousMessages);
    } finally { setLoading(false); }
  };

  const copyMessage = async (index: number, text: string) => { try { await navigator.clipboard.writeText(text); setCopied(index); window.setTimeout(() => setCopied(null), 1200); } catch {} };

  const openPayment = async () => {
    setUpgradeLoading(true); setError(""); setPaymentSubmitted(false); setUtr("");
    try {
      const session = getSession();
      if (!session) { navigate("/auth"); return; }
      const response = await fetch("/api/payment", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ action: "payment-info" }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to open payment.");
      setPaymentReference(data.reference || `BLUE-${Date.now()}`);
      setPaymentOpen(true);
      setAccountOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Payment could not be started."); }
    finally { setUpgradeLoading(false); }
  };

  const submitPayment = async () => {
    const value = utr.trim();
    if (!value) { setError("Enter the UTR / transaction reference number after completing the payment."); return; }
    setUpgradeLoading(true); setError("");
    try {
      const session = getSession(); if (!session) { navigate("/auth"); return; }
      const response = await fetch("/api/payment", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ action: "submit-utr", utr: value, reference: paymentReference }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to submit payment.");
      setPaymentSubmitted(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Payment submission failed."); }
    finally { setUpgradeLoading(false); }
  };

  const logout = async () => { await signOut(); navigate("/auth"); };
  const freeLabel = remainingTokens === null ? `${FREE_TOKENS.toLocaleString()} free tokens/day` : `${remainingTokens.toLocaleString()} free tokens remaining today`;
  const upiUri = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent("BLUE AI")}&am=${PRO_PRICE.toFixed(2)}&cu=INR&tn=${encodeURIComponent("BLUE Pro - 1 year")}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=${encodeURIComponent(upiUri)}`;

  return (
    <div className="flex h-screen overflow-hidden bg-[#08090d] text-white">
      <div className="pointer-events-none fixed inset-0 z-0 blue-grid opacity-25" />
      <div className="pointer-events-none fixed -left-48 top-[-20rem] z-0 h-[42rem] w-[42rem] rounded-full bg-blue-600/15 blur-[120px]" />
      {paymentOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"><div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#11131a] shadow-2xl"><div className="flex items-center justify-between border-b border-white/[.08] px-5 py-4"><div><h2 className="font-semibold">Upgrade to BLUE Pro</h2><p className="mt-0.5 text-xs text-white/40">₹11 · 1 year</p></div><button type="button" onClick={() => setPaymentOpen(false)} className="rounded-xl p-2 text-white/40 hover:bg-white/10 hover:text-white"><X className="size-4" /></button></div>{paymentSubmitted ? <div className="px-6 py-10 text-center"><div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-400/10"><CheckCircle2 className="size-7 text-emerald-300" /></div><h3 className="mt-5 text-lg font-semibold">Payment submitted</h3><p className="mt-2 text-sm leading-6 text-white/45">Your payment reference has been submitted for verification. Pro will be activated after the payment is verified.</p><Button type="button" onClick={() => setPaymentOpen(false)} className="mt-6 w-full rounded-xl bg-blue-500 hover:bg-blue-400">Done</Button></div> : <div className="px-5 py-5"><div className="rounded-2xl border border-white/10 bg-white p-4"><img src={qrUrl} alt="BLUE AI UPI payment QR code" className="mx-auto block aspect-square w-64 rounded-xl" /></div><div className="mt-4 rounded-2xl border border-white/[.08] bg-white/[.03] p-4"><div className="flex items-center justify-between"><span className="text-xs text-white/40">UPI ID</span><button type="button" onClick={() => navigator.clipboard?.writeText(UPI_ID)} className="text-sm font-semibold text-cyan-200 hover:text-cyan-100">{UPI_ID}</button></div><div className="mt-3 flex items-center justify-between"><span className="text-xs text-white/40">Amount</span><span className="text-sm font-semibold">₹{PRO_PRICE}</span></div></div><a href={upiUri} className="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-500 text-sm font-semibold hover:bg-blue-400">Pay ₹{PRO_PRICE} with UPI <ExternalLink className="size-4" /></a><p className="mt-4 text-center text-[11px] leading-5 text-white/35">Scan the QR or use the UPI button. After payment, enter the UTR shown in your UPI app.</p><div className="mt-4"><label className="text-xs font-medium text-white/60">UTR / Transaction ID</label><input value={utr} onChange={e => setUtr(e.target.value)} placeholder="Enter your UTR after payment" className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/[.04] px-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-blue-400/50" /></div><p className="mt-3 rounded-xl border border-amber-300/10 bg-amber-300/[.05] px-3 py-2 text-[10px] leading-4 text-amber-100/55">Reference: {paymentReference}</p><Button type="button" onClick={submitPayment} disabled={upgradeLoading || !utr.trim()} className="mt-4 h-11 w-full rounded-xl bg-blue-500 hover:bg-blue-400 disabled:opacity-40">{upgradeLoading ? <Loader2 className="size-4 animate-spin" /> : "I've Paid · Submit for Verification"}</Button></div>}</div></div>}
      <aside className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-30 flex w-[280px] flex-col border-r border-white/[.08] bg-[#0b0d12]/95 p-3 backdrop-blur-xl transition-transform md:relative md:translate-x-0`}>
        <div className="flex items-center justify-between px-2 py-2"><Link href="/" className="flex items-center gap-2.5"><span className="blue-mark"><Sparkles className="size-3.5" /></span><span className="font-semibold tracking-[-.04em]">BLUE <span className="text-white/35">AI</span></span></Link><button type="button" className="rounded-lg p-2 text-white/45 hover:bg-white/10 hover:text-white md:hidden" onClick={() => setSidebarOpen(false)}><X className="size-4" /></button></div>
        <Button type="button" onClick={newChat} variant="outline" className="mt-5 h-10 justify-start gap-2 rounded-xl border-white/10 bg-white/[.03] text-white hover:bg-white/[.08]"><Plus className="size-4" /> New chat</Button>
        <div className="mt-7 px-2 text-[10px] font-semibold uppercase tracking-[.18em] text-white/25">Saved chats</div>
        <div className="mt-2 flex-1 space-y-1 overflow-y-auto pr-1">{conversations.length > 0 ? conversations.map(chat => <button key={chat.id} type="button" onClick={() => loadConversation(chat.id)} className={`w-full rounded-xl px-3 py-2.5 text-left text-xs transition ${chat.id === conversationId ? "bg-blue-400/10 text-white" : "text-white/45 hover:bg-white/[.05] hover:text-white/75"}`}>{chat.title}</button>) : <p className="px-3 py-2 text-xs text-white/20">Your saved conversations will appear here.</p>}</div>
        <div className="rounded-2xl border border-white/[.08] bg-white/[.025] p-3"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-xs font-medium text-white/65"><Crown className={`size-3.5 ${profile.plan === "pro" ? "text-amber-300" : "text-cyan-300"}`} />{profile.plan === "pro" ? "BLUE Pro" : "BLUE Free"}</div>{profile.plan === "free" && <button type="button" onClick={openPayment} disabled={upgradeLoading} className="text-[10px] font-semibold text-cyan-300 hover:text-cyan-200">₹11/year</button>}</div>{profile.plan === "free" ? <p className="mt-2 text-[10px] leading-4 text-white/30">5,000 free tokens/day · resets at 12:00 AM IST</p> : <p className="mt-2 text-[10px] leading-4 text-amber-200/50">Pro active until {profile.premium_until ? new Date(profile.premium_until).toLocaleDateString() : "next year"}.</p>}</div>
      </aside>
      {sidebarOpen && <button type="button" className="fixed inset-0 z-20 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar" />}
      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/[.07] px-4 sm:px-6"><div className="flex items-center gap-3"><button type="button" className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white md:hidden" onClick={() => setSidebarOpen(true)}><Menu className="size-5" /></button><Link href="/" className="text-sm text-white/40 hover:text-white"><ChevronLeft className="mr-1 inline size-4" />Home</Link></div><div className="relative flex items-center gap-2"><span className="size-1.5 rounded-full bg-emerald-300" /><span className="text-xs text-white/45">AI online</span><button type="button" onClick={() => setAccountOpen(v => !v)} className="ml-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-2.5 py-1.5 text-xs text-white/60 hover:bg-white/[.08]"><User className="size-3.5" />Account</button>{accountOpen && <div className="absolute right-0 top-11 z-40 w-64 rounded-2xl border border-white/10 bg-[#11131a] p-3 shadow-2xl"><p className="truncate px-2 py-2 text-xs text-white/55">{getSession()?.user.email}</p>{profile.plan === "free" ? <button type="button" onClick={openPayment} disabled={upgradeLoading} className="mb-1 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-xs text-cyan-200 hover:bg-white/[.06]">{upgradeLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Crown className="size-3.5" />}Upgrade to Pro · ₹11/year</button> : <div className="px-2 py-2 text-[11px] text-amber-200/70">Pro membership active ✨</div>}<button type="button" onClick={logout} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-xs text-white/50 hover:bg-white/[.06] hover:text-white"><LogOut className="size-3.5" />Sign out</button></div>}</div></header>
        <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-8"><div className="mx-auto max-w-3xl">
          {error && <div className="mb-5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-xs leading-5 text-red-200">{error}</div>}
          {messages.length === 0 ? (
            <div className="flex min-h-[62vh] flex-col items-center justify-center text-center"><div className="blue-orb mb-7"><div className="blue-orb-core"><Sparkles className="size-8 text-white" /></div></div><h1 className="text-4xl font-semibold tracking-[-.055em] sm:text-5xl">What can I help you build?</h1><p className="mt-4 max-w-xl text-sm leading-6 text-white/40">Ask questions, write code, learn concepts, brainstorm ideas, or solve a real problem with BLUE.</p><div className="mt-8 grid w-full max-w-2xl gap-2 sm:grid-cols-2">{["Explain a difficult concept simply", "Build a React project with me", "Help debug my code", "Create a study plan"].map(item => <button type="button" key={item} onClick={() => sendMessage(item)} className="rounded-2xl border border-white/[.08] bg-white/[.025] p-4 text-left text-sm text-white/55 transition hover:-translate-y-0.5 hover:border-blue-300/20 hover:bg-white/[.06] hover:text-white">{item}</button>)}</div></div>
          ) : (
            <div className="space-y-8 pb-8">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  {message.role === "model" && <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl border border-blue-300/15 bg-blue-400/10"><Bot className="size-4 text-cyan-200" /></div>}
                  <div className={message.role === "user" ? "max-w-[85%] rounded-2xl rounded-br-md bg-blue-500 px-4 py-3 text-white" : "min-w-0 max-w-[92%]"}>
                    {message.role === "model" ? <div className="blue-response text-[15px] leading-7 text-white/85"><Streamdown mode="static">{message.text}</Streamdown></div> : <div className="whitespace-pre-wrap text-sm leading-6">{message.text}</div>}
                    {message.role === "model" && <button type="button" onClick={() => copyMessage(index, message.text)} className="mt-2 rounded-lg p-1.5 text-white/25 hover:bg-white/[.06] hover:text-white/60" aria-label="Copy response"><Copy className="size-3.5" />{copied === index ? <span className="ml-1 text-[10px]">Copied</span> : null}</button>}
                  </div>
                </div>
              ))}
              {loading && <div className="flex gap-3"><div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl border border-blue-300/15 bg-blue-400/10"><Bot className="size-4 text-cyan-200" /></div><div className="flex items-center gap-1 pt-2"><span className="size-1.5 animate-bounce rounded-full bg-cyan-200" /><span className="size-1.5 animate-bounce rounded-full bg-cyan-200 [animation-delay:-.15s]" /><span className="size-1.5 animate-bounce rounded-full bg-cyan-200 [animation-delay:-.3s]" /></div></div>}
              <div ref={bottomRef} />
            </div>
          )}
        </div></div>
        <div className="shrink-0 px-4 pb-5 sm:px-8"><div className="mx-auto max-w-3xl"><div className="rounded-2xl border border-white/10 bg-[#101218]/95 p-2 shadow-2xl shadow-black/20"><textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (canSend) sendMessage(); } }} placeholder="Message BLUE..." rows={1} className="max-h-40 min-h-12 w-full resize-none bg-transparent px-3 py-3 text-sm text-white outline-none placeholder:text-white/25" /><div className="flex items-center justify-between px-2 pb-1"><span className="text-[10px] text-white/20">Enter to send · Shift + Enter for a new line</span><Button type="button" onClick={() => sendMessage()} disabled={!canSend} className="size-9 rounded-xl bg-blue-500 p-0 hover:bg-blue-400 disabled:opacity-30"><ArrowUp className="size-4" /></Button></div></div><div className="mt-2 flex items-center justify-between px-1 text-[10px] text-white/20"><span>{profile.plan === "pro" ? "BLUE Pro · Unlimited daily access" : freeLabel}</span><span>BLUE can make mistakes. Check important information.</span></div></div></div>
      </main>
    </div>
  );
}
