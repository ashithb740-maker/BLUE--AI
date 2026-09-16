import { motion } from "framer-motion";
import { ArrowRight, BrainCircuit, Code2, FileSearch, Image, Menu, Mic, Search, ShieldCheck, Sparkles, Wand2, X } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";

const capabilities = [
  { icon: Sparkles, label: "Chat", copy: "Natural conversations that keep your context in view." },
  { icon: Search, label: "Search", copy: "Turn complex questions into clear, sourced next steps." },
  { icon: Code2, label: "Coding", copy: "Ship better software with a patient pair programmer." },
  { icon: BrainCircuit, label: "Study", copy: "Learn hard ideas with examples made for you." },
  { icon: FileSearch, label: "Documents", copy: "Find the signal in reports, notes, and PDFs." },
  { icon: Image, label: "Vision", copy: "Understand charts, diagrams, screenshots, and more." },
  { icon: Wand2, label: "Creative", copy: "Shape rough ideas into writing worth sharing." },
];

const examples = ["Explain quantum computing simply", "Write a React hook for debouncing", "Summarize this document", "Help me plan a study week"];

export default function Home() {
  const { user } = useAuth();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [prompt, setPrompt] = useState("");

  const goToChat = (value?: string) => {
    const text = (value ?? prompt).trim();
    if (text) {
      window.sessionStorage.setItem("nova-initial-prompt", text);
    }
    if (user) window.location.href = "/chat";
    else startLogin();
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#08090d] text-white">
      <div className="pointer-events-none fixed inset-0 nova-grid opacity-40" />
      <div className="pointer-events-none fixed -left-48 top-[-16rem] h-[42rem] w-[42rem] rounded-full bg-violet-600/20 blur-[120px]" />
      <div className="pointer-events-none fixed right-[-14rem] top-[12rem] h-[34rem] w-[34rem] rounded-full bg-cyan-400/10 blur-[120px]" />

      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link href="/" className="flex items-center gap-3" aria-label="BLUE AI home">
          <span className="nova-mark"><Sparkles className="size-4" /></span>
          <span className="tracking-[-0.04em] text-lg font-semibold">BLUE <span className="text-white/45">AI</span></span>
        </Link>
        <div className="hidden items-center gap-8 text-sm text-white/55 md:flex">
          <a href="#capabilities" className="transition-colors hover:text-white">Capabilities</a>
          <a href="#how-it-works" className="transition-colors hover:text-white">How it works</a>
          <a href="#privacy" className="transition-colors hover:text-white">Privacy</a>
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          {user ? <Link href="/chat"><Button className="rounded-full bg-white px-5 text-[#0b0c10] hover:bg-white/90">Open BLUE <ArrowRight className="size-4" /></Button></Link> : <Button variant="ghost" className="rounded-full text-white/70 hover:bg-white/10 hover:text-white" onClick={startLogin}>Sign in</Button>}
          {!user && <Button className="rounded-full bg-violet-500 px-5 hover:bg-violet-400" onClick={() => goToChat()}>Start chatting <ArrowRight className="size-4" /></Button>}
        </div>
        <button className="rounded-xl p-2 text-white/70 sm:hidden" onClick={() => setMobileMenu(v => !v)} aria-label="Open navigation">{mobileMenu ? <X className="size-5" /> : <Menu className="size-5" />}</button>
      </nav>
      {mobileMenu && <div className="relative z-20 mx-5 rounded-2xl border border-white/10 bg-[#11131a]/95 p-4 shadow-2xl sm:hidden"><div className="flex flex-col gap-4 text-sm text-white/70"><a href="#capabilities" onClick={() => setMobileMenu(false)}>Capabilities</a><a href="#how-it-works" onClick={() => setMobileMenu(false)}>How it works</a><button className="text-left" onClick={user ? () => window.location.href = "/chat" : startLogin}>{user ? "Open BLUE" : "Sign in"}</button></div></div>}

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-16 px-5 pb-24 pt-16 sm:px-8 md:pt-24 lg:grid-cols-[1.08fr_.92fr] lg:px-12 lg:pb-36 lg:pt-28">
        <div>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5 }} className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-3.5 py-2 text-xs font-medium text-white/65"><span className="size-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_#67e8f9]" /> Your thinking partner, upgraded</motion.div>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65, delay: .05 }} className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.065em] text-white sm:text-7xl">Ask anything.<br /><span className="nova-gradient-text">Build anything.</span></motion.h1>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55, delay: .12 }} className="mt-7 max-w-xl text-lg leading-8 text-white/55">Your intelligent AI assistant for learning, coding, research, creativity, and everyday problem solving.</motion.p>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55, delay: .18 }} className="mt-9 max-w-2xl rounded-[1.5rem] border border-white/10 bg-white/[.055] p-2 shadow-2xl shadow-violet-950/20 backdrop-blur-xl">
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); goToChat(); } }} rows={2} placeholder="Ask Blue anything..." className="w-full resize-none bg-transparent px-4 py-3 text-base text-white outline-none placeholder:text-white/28" aria-label="Ask Blue anything" />
            <div className="flex items-center justify-between px-2 pb-1"><div className="flex items-center gap-1.5 text-xs text-white/35"><button className="rounded-lg p-2 transition-colors hover:bg-white/10 hover:text-white/70" aria-label="Add attachment"><FileSearch className="size-4" /></button><button className="rounded-lg p-2 transition-colors hover:bg-white/10 hover:text-white/70" aria-label="Voice input"><Mic className="size-4" /></button><span className="ml-1 hidden sm:inline">Press Enter to start</span></div><Button onClick={() => goToChat()} disabled={!prompt.trim()} className="rounded-xl bg-white px-4 text-[#0b0c10] hover:bg-cyan-100 disabled:bg-white/10 disabled:text-white/30">Begin <ArrowRight className="size-4" /></Button></div>
          </motion.div>
          <div className="mt-5 flex flex-wrap gap-2">{examples.map(item => <button key={item} onClick={() => goToChat(item)} className="rounded-full border border-white/10 bg-white/[.025] px-3.5 py-2 text-xs text-white/48 transition-all hover:border-white/25 hover:bg-white/[.07] hover:text-white/80">{item}</button>)}</div>
        </div>
        <motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .8, delay: .12 }} className="relative mx-auto w-full max-w-[29rem] lg:ml-auto">
          <div className="absolute inset-10 rounded-full bg-violet-500/25 blur-[90px]" />
          <div className="relative rounded-[2rem] border border-white/10 bg-white/[.045] p-3 shadow-[0_30px_100px_rgba(53,26,112,.35)] backdrop-blur-xl">
            <div className="rounded-[1.4rem] border border-white/10 bg-[#0d0f15] p-5 sm:p-7"><div className="mb-10 flex items-center justify-between"><div className="flex items-center gap-2 text-sm text-white/70"><span className="nova-mark size-7"><Sparkles className="size-3.5" /></span> BLUE <span className="text-white/30">/</span> New chat</div><span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] text-emerald-300">ONLINE</span></div><div className="flex flex-col items-center text-center"><div className="nova-orb mb-7"><div className="nova-orb-core"><Sparkles className="size-9 text-white" /></div></div><p className="text-2xl font-medium tracking-[-.04em]">What will we make?</p><p className="mt-2 max-w-xs text-sm leading-6 text-white/40">A calm, capable space for your best questions and ideas.</p></div><div className="mt-12 space-y-2.5">{["Summarize the latest research", "Help me think through a decision", "Turn an idea into a prototype"].map((item, i) => <div key={item} className="flex items-center gap-3 rounded-xl border border-white/[.07] bg-white/[.025] px-3.5 py-3 text-xs text-white/48"><span className="text-white/20">0{i + 1}</span>{item}<ArrowRight className="ml-auto size-3.5 text-white/20" /></div>)}</div></div>
          </div>
        </motion.div>
      </section>

      <section id="capabilities" className="relative z-10 border-y border-white/[.07] bg-white/[.018] px-5 py-24 sm:px-8 lg:px-12"><div className="mx-auto max-w-7xl"><div className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="mb-3 text-xs font-semibold uppercase tracking-[.22em] text-cyan-300/80">One assistant. Many directions.</p><h2 className="max-w-xl text-3xl font-semibold tracking-[-.05em] sm:text-5xl">Made for the way<br />your mind moves.</h2></div><p className="max-w-sm text-sm leading-6 text-white/42">BLUE adapts to the task without making you adapt to the tool.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{capabilities.map((item, i) => <motion.div key={item.label} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ delay: i * .04 }} className="group rounded-2xl border border-white/[.08] bg-[#0d0f15]/70 p-5 transition-all hover:-translate-y-1 hover:border-violet-300/25 hover:bg-white/[.06]"><item.icon className="mb-10 size-5 text-violet-300/80 transition-colors group-hover:text-cyan-300" /><h3 className="font-medium">{item.label}</h3><p className="mt-2 text-sm leading-6 text-white/40">{item.copy}</p></motion.div>)}</div></div></section>

      <section id="how-it-works" className="relative z-10 mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-12 lg:py-36"><div className="grid gap-16 lg:grid-cols-[.7fr_1.3fr] lg:items-center"><div><p className="mb-3 text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80">The BLUE loop</p><h2 className="text-4xl font-semibold tracking-[-.055em] sm:text-5xl">Less prompting.<br />More progress.</h2><p className="mt-6 max-w-md text-base leading-7 text-white/45">Bring the rough thought, the half-finished code, or the impossible question. BLUE helps you find the next clear move.</p><Button onClick={() => goToChat()} className="mt-8 rounded-full bg-white px-5 text-[#0b0c10] hover:bg-cyan-100">Try BLUE free <ArrowRight className="size-4" /></Button></div><div className="grid gap-2 sm:grid-cols-4">{[["01", "Ask", "Start with the question, not the perfect prompt."], ["02", "Understand", "BLUE keeps context and intent in view."], ["03", "Generate", "Get a clear answer, draft, plan, or prototype."], ["04", "Solve", "Leave with momentum and a useful next step."]].map(([number, title, copy], i) => <div key={title} className="relative rounded-2xl border border-white/[.08] bg-white/[.025] p-5 sm:min-h-[16rem]"><span className="text-xs text-white/25">{number}</span><div className="mt-16"><h3 className="text-lg font-medium">{title}</h3><p className="mt-2 text-sm leading-6 text-white/38">{copy}</p></div>{i < 3 && <ArrowRight className="absolute -right-4 top-1/2 z-10 hidden size-5 -translate-y-1/2 text-violet-300 sm:block" />}</div>)}</div></div></section>

      <section id="privacy" className="relative z-10 mx-5 mb-16 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-500/20 via-white/[.04] to-cyan-300/[.08] p-8 sm:mx-8 sm:p-14 lg:mx-auto lg:max-w-7xl"><div className="relative grid gap-10 md:grid-cols-[1fr_auto] md:items-center"><div><ShieldCheck className="mb-6 size-7 text-cyan-200" /><h2 className="max-w-xl text-3xl font-semibold tracking-[-.05em] sm:text-4xl">Your ideas stay yours.</h2><p className="mt-4 max-w-lg text-sm leading-6 text-white/50">Private conversations, secure sessions, and honest boundaries. BLUE is designed to be useful without being mysterious.</p></div><Button onClick={() => goToChat()} className="w-fit rounded-full bg-white px-5 text-[#0b0c10] hover:bg-cyan-100">Start a conversation <ArrowRight className="size-4" /></Button></div></section>

      <footer className="relative z-10 mx-auto flex max-w-7xl flex-col gap-5 border-t border-white/[.07] px-5 py-8 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12"><div className="flex items-center gap-2"><span className="nova-mark size-6"><Sparkles className="size-3" /></span><span>BLUE AI</span></div><div className="flex gap-5"><a href="#privacy" className="hover:text-white">Privacy</a><a href="#privacy" className="hover:text-white">Terms</a><a href="mailto:hello@nova.example" className="hover:text-white">Contact</a></div><span>© 2026 BLUE AI</span></footer>
    </main>
  );
}
