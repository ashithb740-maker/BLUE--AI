import { AnimatePresence, motion } from "framer-motion";
import { Archive, ArrowDown, Check, ChevronDown, Clipboard, Copy, FileText, Image as ImageIcon, LogOut, Menu, MessageSquare, Mic, MoreHorizontal, Moon, Paperclip, PanelLeftClose, PanelLeftOpen, Plus, Search, Send, Settings, Sparkles, Square, Sun, Trash2, UserRound, Volume2, X, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

type Mode = "chat" | "search" | "study" | "coding" | "analyze" | "creative";
type Attachment = { name: string; url: string; type: string; size: number };
type LocalMessage = { id?: number; role: "user" | "assistant" | "system"; content: string; attachments?: Attachment[]; createdAt?: Date | string; pending?: boolean };

const modes: { id: Mode; label: string; hint: string; icon: typeof Sparkles }[] = [
  { id: "chat", label: "Chat", hint: "Everyday questions", icon: Sparkles },
  { id: "search", label: "Search", hint: "Current information", icon: Search },
  { id: "study", label: "Study", hint: "Learn step by step", icon: Archive },
  { id: "coding", label: "Coding", hint: "Build and debug", icon: Zap },
  { id: "analyze", label: "Analyze", hint: "Work with files", icon: FileText },
  { id: "creative", label: "Creative", hint: "Write and explore", icon: Sparkles },
];

const suggestions = ["Explain a difficult concept", "Write some code", "Analyze a document", "Help me study", "Brainstorm an idea", "Search the latest information"];

function formatTime(value?: Date | string) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function BlueOrb({ small = false, active = false }: { small?: boolean; active?: boolean }) {
  return <div className={`blue-orb ${small ? "scale-[.58]" : ""} ${active ? "blue-orb-active" : ""}`}><div className="blue-orb-core"><Sparkles className="size-7 text-white" /></div></div>;
}

export default function Chat() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("chat");
  const [model, setModel] = useState("nova-balanced");
  const [showModes, setShowModes] = useState(false);
  const [showModels, setShowModels] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | undefined>();
  const [copiedId, setCopiedId] = useState<number | undefined>();
  const [openMenuId, setOpenMenuId] = useState<number | undefined>();
  const [draftTitle, setDraftTitle] = useState("");
  const [editingId, setEditingId] = useState<number | undefined>();
  const [initialPromptUsed, setInitialPromptUsed] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const revealTimer = useRef<number | undefined>(undefined);
  const recognitionRef = useRef<any>(null);

  const conversationsQuery = trpc.chat.list.useQuery(undefined, { enabled: isAuthenticated });
  const searchQueryInput = useMemo(() => ({ query: searchInput }), [searchInput]);
  const searchQuery = trpc.chat.search.useQuery(searchQueryInput, { enabled: isAuthenticated && searchOpen && searchInput.trim().length > 0 });
  const selectedQueryInput = useMemo(() => ({ id: selectedId ?? 0 }), [selectedId]);
  const selectedQuery = trpc.chat.get.useQuery(selectedQueryInput, { enabled: isAuthenticated && selectedId !== null });
  const utils = trpc.useUtils();
  const sendMutation = trpc.chat.send.useMutation();
  const uploadMutation = trpc.chat.upload.useMutation();
  const renameMutation = trpc.chat.rename.useMutation();
  const deleteMutation = trpc.chat.delete.useMutation();

  useEffect(() => {
    const initial = window.sessionStorage.getItem("nova-initial-prompt");
    if (initial && !initialPromptUsed) { setInput(initial); setInitialPromptUsed(true); window.sessionStorage.removeItem("nova-initial-prompt"); }
  }, [initialPromptUsed]);

  useEffect(() => {
    if (selectedQuery.data?.messages) {
      setMessages(selectedQuery.data.messages.map(message => ({ id: message.id, role: message.role, content: message.content, attachments: Array.isArray(message.attachments) ? message.attachments as Attachment[] : [], createdAt: message.createdAt })));
      if (selectedQuery.data.conversation) { setMode(selectedQuery.data.conversation.mode as Mode); setModel(selectedQuery.data.conversation.model); }
    }
  }, [selectedQuery.data]);

  useEffect(() => {
    if (!selectedId && conversationsQuery.data?.[0]) setSelectedId(conversationsQuery.data[0].id);
  }, [conversationsQuery.data, selectedId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); setTimeout(() => document.getElementById("conversation-search")?.focus(), 0); }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "o") { event.preventDefault(); newChat(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => () => { if (revealTimer.current) window.clearInterval(revealTimer.current); }, []);

  const rawConversations = searchOpen && searchInput.trim() ? searchQuery.data ?? [] : conversationsQuery.data ?? [];
  const visibleConversations = rawConversations.filter((item): item is NonNullable<typeof item> => Boolean(item));
  const activeConversation = visibleConversations.find(item => item.id === selectedId) ?? conversationsQuery.data?.find(item => item?.id === selectedId);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => { if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior }); };
  useEffect(() => { if (isNearBottom) scrollToBottom("smooth"); }, [messages, isNearBottom]);

  const newChat = () => { if (revealTimer.current) window.clearInterval(revealTimer.current); setSelectedId(null); setMessages([]); setInput(""); setAttachments([]); setMode("chat"); setSidebarOpen(false); textareaRef.current?.focus(); };

  const submit = (value?: string) => {
    const content = (value ?? input).trim();
    if ((!content && attachments.length === 0) || isGenerating) return;
    const optimistic: LocalMessage = { role: "user", content: content || "Please analyze the attached file.", attachments, createdAt: new Date() };
    setMessages(prev => [...prev, optimistic, { role: "assistant", content: "", pending: true, createdAt: new Date() }]); setInput(""); setIsGenerating(true); setIsNearBottom(true);
    sendMutation.mutate({ conversationId: selectedId ?? undefined, content: optimistic.content, mode, model, attachments }, {
      onSuccess: response => {
        setSelectedId(response.conversationId); setAttachments([]); utils.chat.list.invalidate();
        const answer = response.content;
        const assistant: LocalMessage = { id: response.assistantMessageId, role: "assistant", content: "", createdAt: new Date() };
        setMessages(prev => prev.map(message => message.pending ? assistant : message));
        let index = 0;
        revealTimer.current = window.setInterval(() => {
          index = Math.min(answer.length, index + Math.max(2, Math.ceil(answer.length / 90)));
          setMessages(prev => prev.map(message => message.id === response.assistantMessageId ? { ...message, content: answer.slice(0, index) } : message));
          if (index >= answer.length) { if (revealTimer.current) window.clearInterval(revealTimer.current); revealTimer.current = undefined; setIsGenerating(false); utils.chat.get.invalidate({ id: response.conversationId }); }
        }, 18);
      },
      onError: error => { setIsGenerating(false); setMessages(prev => prev.filter(message => !message.pending)); toast.error(error.message || "BLUE could not respond"); },
    });
  };

  const stopGeneration = () => { if (revealTimer.current) window.clearInterval(revealTimer.current); revealTimer.current = undefined; setIsGenerating(false); toast("Generation stopped"); };

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) { toast.error("Files must be smaller than 12 MB"); return; }
    const reader = new FileReader();
    reader.onload = () => { uploadMutation.mutate({ fileName: file.name, fileType: file.type || "application/octet-stream", fileSize: file.size, data: String(reader.result), conversationId: selectedId ?? undefined }, { onSuccess: uploaded => { setAttachments(prev => [...prev, uploaded]); toast.success("File attached"); }, onError: error => toast.error(error.message || "Upload failed") }); };
    reader.readAsDataURL(file); event.target.value = "";
  };

  const toggleVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { toast.error("Voice input is not supported in this browser"); return; }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const recognition = new SpeechRecognition(); recognition.lang = "en-US"; recognition.interimResults = true; recognition.continuous = false;
    recognition.onstart = () => setIsListening(true); recognition.onend = () => setIsListening(false); recognition.onerror = () => { setIsListening(false); toast.error("Voice input stopped"); }; recognition.onresult = (event: any) => { const transcript = Array.from(event.results).map((result: any) => result[0].transcript).join(""); setInput(transcript); };
    recognitionRef.current = recognition; recognition.start();
  };

  const speak = (message: LocalMessage) => { if (!window.speechSynthesis) { toast.error("Text to speech is not supported"); return; } if (speakingId === message.id) { window.speechSynthesis.cancel(); setSpeakingId(undefined); return; } window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(message.content); utterance.onend = () => setSpeakingId(undefined); setSpeakingId(message.id); window.speechSynthesis.speak(utterance); };
  const copy = async (message: LocalMessage) => { await navigator.clipboard.writeText(message.content); setCopiedId(message.id); toast.success("Copied to clipboard"); setTimeout(() => setCopiedId(undefined), 1400); };
  const saveRename = () => { if (!editingId || !draftTitle.trim()) return; renameMutation.mutate({ id: editingId, title: draftTitle }, { onSuccess: () => { setEditingId(undefined); setDraftTitle(""); utils.chat.list.invalidate(); toast.success("Conversation renamed"); }, onError: error => toast.error(error.message) }); };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#08090d] text-white"><BlueOrb active /></div>;
  if (!isAuthenticated) return <div className="flex min-h-screen items-center justify-center bg-[#08090d] px-5 text-white"><div className="text-center"><BlueOrb /><h1 className="mt-3 text-2xl font-semibold">Sign in to open BLUE</h1><p className="mt-2 text-sm text-white/45">Your conversations are private and saved to your account.</p><Button onClick={startLogin} className="mt-7 rounded-full bg-white px-6 text-[#0b0c10]">Continue with BLUE <ArrowDown className="size-4 rotate-[-45deg]" /></Button><Link href="/" className="mt-5 block text-sm text-white/40 hover:text-white">Back to home</Link></div></div>;

  return <div className="flex h-dvh overflow-hidden bg-[#08090d] text-white">
    <AnimatePresence>{sidebarOpen && <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-30 bg-black/60 lg:hidden" aria-label="Close navigation" />}</AnimatePresence>
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[286px] flex-col border-r border-white/[.08] bg-[#0c0e13] transition-transform duration-200 lg:relative lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "lg:w-[76px]" : ""}`}>
      <div className={`flex h-16 items-center ${collapsed ? "justify-center" : "justify-between px-4"}`}><Link href="/" className="flex items-center gap-2.5"><span className="blue-mark size-8"><Sparkles className="size-4" /></span>{!collapsed && <span className="text-sm font-semibold tracking-[-.03em]">BLUE <span className="text-white/35">AI</span></span>}</Link>{!collapsed && <button className="rounded-lg p-2 text-white/35 hover:bg-white/5 hover:text-white" onClick={() => setCollapsed(true)} aria-label="Collapse sidebar"><PanelLeftClose className="size-4" /></button>}</div>
      {collapsed && <button className="mx-auto mb-3 hidden rounded-lg p-2 text-white/35 hover:bg-white/5 hover:text-white lg:block" onClick={() => setCollapsed(false)} aria-label="Expand sidebar"><PanelLeftOpen className="size-4" /></button>}
      <div className={`${collapsed ? "px-3" : "px-3"}`}><button onClick={newChat} className={`flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.06] py-2.5 text-sm font-medium transition-colors hover:bg-white/10 ${collapsed ? "px-0" : "px-3"}`}><Plus className="size-4" />{!collapsed && "New chat"}<span className="sr-only">New chat</span></button></div>
      {!collapsed && <div className="mt-5 px-3"><button onClick={() => setSearchOpen(v => !v)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/42 transition-colors hover:bg-white/[.05] hover:text-white"><Search className="size-4" />Search chats<span className="ml-auto hidden rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-white/25 sm:block">⌘ K</span></button>{searchOpen && <div className="mt-2"><input id="conversation-search" value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search conversations" className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs outline-none placeholder:text-white/25 focus:border-blue-300/50" /></div>}</div>}
      <div className={`blue-scroll mt-5 flex-1 overflow-y-auto ${collapsed ? "px-2" : "px-3"}`}><div className="mb-3 flex items-center justify-between px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-white/25">{!collapsed && "Your chats"}{!collapsed && <span>{visibleConversations.length}</span>}</div>{visibleConversations.length === 0 && !collapsed ? <div className="px-3 py-8 text-center text-xs leading-5 text-white/28">Your conversations will appear here.<br />Start with a question.</div> : visibleConversations.map(conversation => <div key={conversation.id} className={`group mb-1 flex items-center gap-1 rounded-lg ${selectedId === conversation.id ? "bg-white/[.08]" : "hover:bg-white/[.045]"}`}><button onClick={() => { setSelectedId(conversation.id); setSidebarOpen(false); }} className={`min-w-0 flex-1 text-left ${collapsed ? "px-2 py-3" : "px-3 py-2.5"}`} title={conversation.title}><div className="flex items-center gap-2">{collapsed ? <MessageSquare className="mx-auto size-4 text-white/35" /> : <><MessageSquare className="size-3.5 shrink-0 text-white/30" /><span className="truncate text-xs text-white/65">{conversation.title}</span></>}</div></button>{!collapsed && <button onClick={() => setOpenMenuId(openMenuId === conversation.id ? undefined : conversation.id)} className="mr-1 rounded p-1.5 text-white/20 opacity-0 transition-opacity hover:bg-white/10 hover:text-white group-hover:opacity-100" aria-label="Conversation actions"><MoreHorizontal className="size-4" /></button>}{openMenuId === conversation.id && <div className="absolute ml-[210px] mt-20 z-50 w-36 rounded-xl border border-white/10 bg-[#171a22] p-1 shadow-2xl"><button onClick={() => { setEditingId(conversation.id); setDraftTitle(conversation.title); setOpenMenuId(undefined); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/65 hover:bg-white/10"><FileText className="size-3.5" />Rename</button><button onClick={() => deleteMutation.mutate({ id: conversation.id }, { onSuccess: () => { if (selectedId === conversation.id) newChat(); utils.chat.list.invalidate(); toast.success("Conversation deleted"); } })} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-red-300/80 hover:bg-red-400/10"><Trash2 className="size-3.5" />Delete</button></div>}</div>)}</div>
      {!collapsed && <div className="border-t border-white/[.07] p-3"><div className="mb-3 flex items-center gap-3 rounded-xl px-2 py-2"><span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-cyan-300 text-xs font-semibold text-[#0c0e13]">{(user?.name || "N").slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="truncate text-xs font-medium text-white/75">{user?.name || "BLUE user"}</p><p className="truncate text-[10px] text-white/30">{user?.email || "Personal workspace"}</p></div></div><div className="flex items-center justify-between"><button onClick={() => navigate("/")} className="rounded-lg p-2 text-white/35 hover:bg-white/5 hover:text-white" aria-label="Settings"><Settings className="size-4" /></button><div className="flex items-center gap-1 rounded-xl border border-white/[.08] bg-white/[.03] p-1" aria-label="Theme options"><button onClick={() => setTheme("light")} className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] transition-colors ${theme === "light" ? "bg-white text-[#11131a]" : "text-white/35 hover:text-white"}`} aria-label="Use light theme"><Sun className="size-3.5" />Light</button><button onClick={() => setTheme("dark")} className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] transition-colors ${theme === "dark" ? "bg-white/10 text-white" : "text-white/35 hover:text-white"}`} aria-label="Use dark theme"><Moon className="size-3.5" />Dark</button></div><button onClick={() => logout()} className="rounded-lg p-2 text-white/35 hover:bg-white/5 hover:text-white" aria-label="Log out"><LogOut className="size-4" /></button></div></div>}
    </aside>

    <section className="flex min-w-0 flex-1 flex-col bg-[radial-gradient(circle_at_60%_0%,rgba(111,70,210,.08),transparent_35%)]"><header className="flex h-16 shrink-0 items-center justify-between border-b border-white/[.07] px-4 sm:px-7"><div className="flex items-center gap-3"><button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-white/45 hover:bg-white/5 hover:text-white lg:hidden" aria-label="Open navigation"><Menu className="size-5" /></button><div className="flex items-center gap-2"><span className="text-sm font-medium text-white/75">{activeConversation?.title || "New conversation"}</span><span className="hidden rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/30 sm:inline">{modes.find(item => item.id === mode)?.label}</span></div></div><div className="flex items-center gap-1.5"><button onClick={() => setShowModels(v => !v)} className="hidden items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/55 hover:bg-white/[.06] sm:flex"><span className="size-1.5 rounded-full bg-cyan-300" />{model === "nova-fast" ? "BLUE Fast" : model === "nova-reasoning" ? "BLUE Reasoning" : "BLUE Balanced"}<ChevronDown className="size-3.5 text-white/30" /></button>{showModels && <div className="absolute right-5 top-14 z-30 w-44 rounded-xl border border-white/10 bg-[#171a22] p-1 shadow-2xl"><button onClick={() => { setModel("nova-fast"); setShowModels(false); }} className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-white/10">BLUE Fast <span className="block text-[10px] text-white/30">Quick responses</span></button><button onClick={() => { setModel("nova-balanced"); setShowModels(false); }} className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-white/10">BLUE Balanced <span className="block text-[10px] text-white/30">Everyday quality</span></button><button onClick={() => { setModel("nova-reasoning"); setShowModels(false); }} className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-white/10">BLUE Reasoning <span className="block text-[10px] text-white/30">Deep thinking</span></button></div>}<button onClick={newChat} className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-white" aria-label="New chat"><Plus className="size-5" /></button></div></header>
      <div ref={scrollRef} onScroll={e => { const target = e.currentTarget; setIsNearBottom(target.scrollHeight - target.scrollTop - target.clientHeight < 120); }} className="blue-scroll flex-1 overflow-y-auto"><div className="mx-auto min-h-full w-full max-w-4xl px-4 py-10 sm:px-7 sm:py-14">{messages.length === 0 ? <div className="flex min-h-[58vh] flex-col items-center justify-center text-center"><BlueOrb active /><h1 className="mt-6 text-3xl font-semibold tracking-[-.05em] sm:text-4xl">How can I help you today?</h1><p className="mt-3 max-w-md text-sm leading-6 text-white/38">Ask a question, upload a file, or pick a direction to get moving.</p><div className="mt-10 grid w-full max-w-2xl gap-2 sm:grid-cols-2">{suggestions.map((suggestion, i) => <button key={suggestion} onClick={() => submit(suggestion)} className="group flex items-center gap-3 rounded-2xl border border-white/[.08] bg-white/[.025] p-4 text-left text-sm text-white/55 transition-all hover:-translate-y-0.5 hover:border-blue-300/30 hover:bg-white/[.06] hover:text-white"><span className="flex size-7 items-center justify-center rounded-lg bg-white/[.06] text-xs text-white/35">0{i + 1}</span>{suggestion}<ArrowDown className="ml-auto size-3.5 -rotate-45 text-white/20 transition-transform group-hover:translate-x-0.5 group-hover:text-cyan-300" /></button>)}</div></div> : <div className="space-y-8">{messages.map((message, index) => <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} key={message.id ?? `${message.role}-${index}`} className={message.role === "user" ? "flex justify-end" : "flex gap-3 sm:gap-4"}>{message.role === "assistant" && <div className="mt-1 shrink-0"><BlueOrb small active={isGenerating && index === messages.length - 1} /></div>}<div className={message.role === "user" ? "max-w-[85%] rounded-2xl rounded-br-md bg-blue-500/90 px-4 py-3 text-sm leading-6 text-white sm:max-w-[75%]" : "min-w-0 max-w-[calc(100%-2rem)] flex-1 text-sm leading-7 text-white/78 sm:max-w-3xl"}>{message.role === "assistant" ? <><div className="prose prose-invert max-w-none prose-p:my-2 prose-headings:mb-3 prose-headings:mt-5 prose-a:text-cyan-300 prose-code:text-blue-200">{message.pending ? <div className="flex items-center gap-3 rounded-xl border border-blue-300/15 bg-blue-300/[.06] px-3.5 py-3 text-sm text-white/65"><span className="flex gap-1" aria-hidden="true"><span className="size-1.5 animate-bounce rounded-full bg-blue-300 [animation-delay:-.2s]" /><span className="size-1.5 animate-bounce rounded-full bg-cyan-300 [animation-delay:-.1s]" /><span className="size-1.5 animate-bounce rounded-full bg-blue-200" /></span><span>BLUE is thinking...</span><span className="text-xs text-white/30">Processing your request</span></div> : <Streamdown>{message.content}</Streamdown>}</div>{message.attachments?.length ? <AttachmentList attachments={message.attachments} /> : null}{!isGenerating || index !== messages.length - 1 ? <div className="mt-4 flex items-center gap-1 text-white/28"><button onClick={() => copy(message)} className="rounded-lg p-2 hover:bg-white/[.06] hover:text-white/80" aria-label="Copy response">{copiedId === message.id ? <Check className="size-3.5 text-emerald-300" /> : <Copy className="size-3.5" />}</button><button onClick={() => speak(message)} className="rounded-lg p-2 hover:bg-white/[.06] hover:text-white/80" aria-label="Read response aloud">{speakingId === message.id ? <Square className="size-3.5" /> : <Volume2 className="size-3.5" />}</button><button onClick={() => toast("Regeneration is ready for the next response") } className="rounded-lg p-2 hover:bg-white/[.06] hover:text-white/80" aria-label="Regenerate response"><Zap className="size-3.5" /></button><span className="ml-2 text-[10px]">{formatTime(message.createdAt)}</span></div> : null}</> : <>{message.content}{message.attachments?.length ? <AttachmentList attachments={message.attachments} /> : null}<span className="mt-1 block text-[10px] text-white/40">{formatTime(message.createdAt)}</span></>}</div></motion.div>)}</div>}{!isNearBottom && messages.length > 0 && <button onClick={() => scrollToBottom()} className="sticky bottom-4 left-1/2 mx-auto flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-[#181b24] px-3 py-2 text-xs text-white/60 shadow-xl"><ArrowDown className="size-3.5" />Jump to latest</button>}</div></div>
      <div className="relative mx-auto w-full max-w-4xl px-4 pb-4 pt-2 sm:px-7 sm:pb-7"><AnimatePresence>{showModes && <motion.div initial={{ opacity: 0, y: 8, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} className="absolute bottom-[calc(100%-4px)] left-4 right-4 z-20 rounded-2xl border border-white/10 bg-[#171a22] p-2 shadow-2xl sm:left-7 sm:right-7"><div className="grid gap-1 sm:grid-cols-3">{modes.map(item => <button key={item.id} onClick={() => { setMode(item.id); setShowModes(false); }} className={`flex items-start gap-3 rounded-xl p-3 text-left transition-colors ${mode === item.id ? "bg-blue-400/15" : "hover:bg-white/[.06]"}`}><item.icon className={`mt-0.5 size-4 ${mode === item.id ? "text-blue-200" : "text-white/40"}`} /><span><span className="block text-xs font-medium">{item.label}</span><span className="mt-1 block text-[10px] text-white/35">{item.hint}</span></span></button>)}</div></motion.div>}</AnimatePresence><div className="rounded-2xl border border-white/10 bg-[#11131a] p-2 shadow-2xl shadow-black/25 focus-within:border-blue-300/35"><div className="flex items-end gap-2"><button onClick={() => fileRef.current?.click()} className="mb-1 rounded-lg p-2 text-white/35 hover:bg-white/[.07] hover:text-white" aria-label="Attach file"><Paperclip className="size-4" /></button><input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.csv,.png,.jpg,.jpeg,.webp" className="hidden" onChange={handleFile} /><textarea ref={textareaRef} value={input} onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`; }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }} rows={1} placeholder="Message Blue..." className="max-h-44 min-h-10 flex-1 resize-none bg-transparent px-1 py-2.5 text-sm leading-6 text-white outline-none placeholder:text-white/25" aria-label="Message Blue" /><button onClick={toggleVoice} className={`mb-1 rounded-lg p-2 transition-colors ${isListening ? "bg-red-400/15 text-red-300" : "text-white/35 hover:bg-white/[.07] hover:text-white"}`} aria-label={isListening ? "Stop voice input" : "Voice input"}>{isListening ? <span className="flex size-4 items-center justify-center"><span className="size-2 animate-ping rounded-full bg-red-300" /></span> : <Mic className="size-4" />}</button><button onClick={isGenerating ? stopGeneration : () => submit()} disabled={!isGenerating && !input.trim() && attachments.length === 0} className={`mb-1 flex size-9 items-center justify-center rounded-xl transition-all ${isGenerating ? "bg-white/10 text-white hover:bg-red-400/15 hover:text-red-200" : "bg-white text-[#0b0c10] hover:bg-cyan-100 disabled:bg-white/10 disabled:text-white/20"}`} aria-label={isGenerating ? "Stop generation" : "Send message"}>{isGenerating ? <Square className="size-3.5 fill-current" /> : <Send className="size-4" />}</button></div>{attachments.length > 0 && <div className="flex flex-wrap gap-2 px-2 pb-1 pt-2"><AttachmentList attachments={attachments} removable onRemove={index => setAttachments(prev => prev.filter((_, itemIndex) => itemIndex !== index))} /></div>}<div className="flex items-center justify-between px-2 pb-0 pt-1"><button onClick={() => setShowModes(v => !v)} className="flex items-center gap-1.5 rounded-lg py-1 text-[10px] font-medium uppercase tracking-[.16em] text-white/35 hover:text-white/70"><Sparkles className="size-3" />{modes.find(item => item.id === mode)?.label}<ChevronDown className="size-3" /></button><span className="text-[10px] text-white/22">BLUE can make mistakes. Check important info.</span></div></div></div>
    </section>
    {editingId && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5"><div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#171a22] p-5 shadow-2xl"><h2 className="font-medium">Rename conversation</h2><input autoFocus value={draftTitle} onChange={e => setDraftTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && saveRename()} className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-blue-300/50" /><div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setEditingId(undefined)}>Cancel</Button><Button onClick={saveRename} className="bg-white text-[#0b0c10] hover:bg-cyan-100">Save</Button></div></div></div>}
  </div>;
}

function AttachmentList({ attachments, removable, onRemove }: { attachments: Attachment[]; removable?: boolean; onRemove?: (index: number) => void }) {
  return <div className="mt-3 flex flex-wrap gap-2">{attachments.map((file, index) => <div key={`${file.name}-${index}`} className="group relative flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.05] px-2.5 py-2 text-xs text-white/60">{file.type.startsWith("image/") ? <ImageIcon className="size-4 text-cyan-200" /> : <FileText className="size-4 text-blue-200" />}<span className="max-w-36 truncate">{file.name}</span>{file.type.startsWith("image/") && <img src={file.url} alt={file.name} className="ml-1 size-8 rounded object-cover" />}{removable && <button onClick={() => onRemove?.(index)} className="ml-1 rounded p-1 text-white/30 hover:bg-white/10 hover:text-white" aria-label={`Remove ${file.name}`}><X className="size-3" /></button>}</div>)}</div>;
}

declare global { interface Window { webkitSpeechRecognition: any; SpeechRecognition: any; } }
