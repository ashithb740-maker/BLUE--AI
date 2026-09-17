import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Bot, ChevronLeft, Copy, Menu, Plus, Sparkles, User, X } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

type Message = { role: "user" | "model"; text: string };

function getInitialPrompt() {
  try {
    const params = new URLSearchParams(window.location.search);
    const queryPrompt = params.get("prompt")?.trim();
    if (queryPrompt) return queryPrompt;
    return sessionStorage.getItem("nova-initial-prompt") || "";
  } catch { return ""; }
}

function getTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
}

export default function BlueChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(getInitialPrompt);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { try { sessionStorage.removeItem("nova-initial-prompt"); } catch {} }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  const sendMessage = async (text = input) => {
    const message = text.trim();
    if (!message || loading) return;
    const nextMessages = [...messages, { role: "user" as const, text: message }];
    setMessages(nextMessages); setInput(""); setLoading(true);
    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: messages.slice(-20), timeZone: getTimeZone() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
      setMessages([...nextMessages, { role: "model", text: data.text || "I received an empty response." }]);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Something went wrong. Please try again.";
      setMessages([...nextMessages, { role: "model", text: `I couldn't complete that request. ${text}` }]);
    } finally { setLoading(false); }
  };

  const newChat = () => { setMessages([]); setInput(""); setSidebarOpen(false); window.history.replaceState({}, "", "/chat"); };
  const copyMessage = async (index: number, text: string) => { try { await navigator.clipboard.writeText(text); setCopied(index); window.setTimeout(() => setCopied(null), 1200); } catch {} };

  return (
    <div className="flex h-screen overflow-hidden bg-[#08090d] text-white">
      <div className="pointer-events-none fixed inset-0 z-0 blue-grid opacity-25" />
      <div className="pointer-events-none fixed -left-48 top-[-20rem] z-0 h-[42rem] w-[42rem] rounded-full bg-blue-600/15 blur-[120px]" />
      <aside className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-30 flex w-[280px] flex-col border-r border-white/[.08] bg-[#0b0d12]/95 p-3 backdrop-blur-xl transition-transform md:relative md:translate-x-0`}>
        <div className="flex items-center justify-between px-2 py-2"><Link href="/" className="flex items-center gap-2.5"><span className="blue-mark"><Sparkles className="size-3.5" /></span><span className="font-semibold tracking-[-.04em]">BLUE <span className="text-white/35">AI</span></span></Link><button type="button" className="rounded-lg p-2 text-white/45 hover:bg-white/10 hover:text-white md:hidden" onClick={() => setSidebarOpen(false)}><X className="size-4" /></button></div>
        <Button type="button" onClick={newChat} variant="outline" className="mt-5 h-10 justify-start gap-2 rounded-xl border-white/10 bg-white/[.03] text-white hover:bg-white/[.08]"><Plus className="size-4" /> New chat</Button>
        <div className="mt-7 px-2 text-[10px] font-semibold uppercase tracking-[.18em] text-white/25">Today</div><div className="mt-2 rounded-xl border border-blue-300/10 bg-blue-400/[.06] px-3 py-2.5 text-sm text-white/70">New conversation</div>
        <div className="mt-auto rounded-2xl border border-white/[.08] bg-white/[.025] p-4"><div className="flex items-center gap-2 text-xs font-medium text-white/65"><Sparkles className="size-3.5 text-cyan-300" /> BLUE AI</div><p className="mt-2 text-[11px] leading-5 text-white/30">Your AI service is securely connected.</p></div>
      </aside>
      {sidebarOpen && <button type="button" className="fixed inset-0 z-20 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar" />}
      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/[.07] px-4 sm:px-6"><div className="flex items-center gap-3"><button type="button" className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white md:hidden" onClick={() => setSidebarOpen(true)}><Menu className="size-5" /></button><Link href="/" className="text-sm text-white/40 hover:text-white"><ChevronLeft className="mr-1 inline size-4" />Home</Link></div><div className="flex items-center gap-2 text-xs text-white/45"><span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_#6ee7b7]" /> AI online</div></header>
        <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-8"><div className="mx-auto max-w-3xl">
          {messages.length === 0 ? <div className="flex min-h-[62vh] flex-col items-center justify-center text-center"><div className="blue-orb mb-7"><div className="blue-orb-core"><Sparkles className="size-8 text-white" /></div></div><h1 className="text-4xl font-semibold tracking-[-.055em] sm:text-5xl">What can I help you build?</h1><p className="mt-4 max-w-xl text-sm leading-6 text-white/40">Ask questions, write code, learn concepts, brainstorm ideas, or solve a real problem with BLUE.</p><div className="mt-8 grid w-full max-w-2xl gap-2 sm:grid-cols-2">{["Explain a difficult concept simply", "Build a React project with me", "Help debug my code", "Create a study plan"].map(item => <button type="button" key={item} onClick={() => sendMessage(item)} className="rounded-2xl border border-white/[.08] bg-white/[.025] p-4 text-left text-sm text-white/55 transition hover:-translate-y-0.5 hover:border-blue-300/20 hover:bg-white/[.06] hover:text-white">{item}</button>)}</div></div> : <div className="space-y-8 pb-8">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>{message.role === "model" && <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl border border-blue-300/15 bg-blue-400/10"><Bot className="size-4 text-cyan-200" /></div>}<div className={message.role === "user" ? "max-w-[85%] rounded-2xl rounded-br-md bg-blue-500 px-4 py-3 text-white" : "max-w-[90%]"}><div className="whitespace-pre-wrap text-[15px] leading-7 text-white/85">{message.text}</div>{message.role === "model" && <button type="button" onClick={() => copyMessage(index, message.text)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-white/25 hover:bg-white/[.06] hover:text-white/60"><Copy className="size-3" />{copied === index ? "Copied" : "Copy"}</button>}</div>{message.role === "user" && <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[.05]"><User className="size-4 text-white/50" /></div>}</div>)}{loading && <div className="flex gap-3"><div className="mt-1 flex size-8 items-center justify-center rounded-xl border border-blue-300/15 bg-blue-400/10"><Bot className="size-4 text-cyan-200" /></div><div className="flex items-center gap-1 py-3"><span className="size-2 animate-bounce rounded-full bg-cyan-300" /><span className="size-2 animate-bounce rounded-full bg-blue-300" /><span className="size-2 animate-bounce rounded-full bg-blue-400" /></div></div>}<div ref={bottomRef} /></div>}
        </div></div>
        <div className="shrink-0 px-4 pb-5 sm:px-8"><div className="mx-auto max-w-3xl rounded-[1.4rem] border border-white/10 bg-white/[.055] p-2 shadow-2xl shadow-blue-950/20 backdrop-blur-xl"><textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} rows={1} placeholder="Message BLUE..." className="max-h-40 min-h-12 w-full resize-none bg-transparent px-3 py-3 text-[15px] text-white outline-none placeholder:text-white/25" /><div className="flex items-center justify-between px-1 pb-1"><span className="px-2 text-[10px] text-white/20">Enter to send · Shift + Enter for a new line</span><button type="button" onClick={() => sendMessage()} disabled={!canSend} className="flex size-9 items-center justify-center rounded-xl bg-white text-[#08090d] transition hover:bg-cyan-100 disabled:bg-white/10 disabled:text-white/20"><ArrowUp className="size-4" /></button></div></div><p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-white/20">BLUE can make mistakes. Check important information.</p></div>
      </main>
    </div>
  );
}
