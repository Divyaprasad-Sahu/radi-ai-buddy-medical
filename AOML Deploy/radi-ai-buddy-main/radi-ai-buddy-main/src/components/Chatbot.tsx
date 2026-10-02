import { useState, useRef, useEffect, type ReactNode } from "react";
import { ArrowUp, Sparkles, Plus, Copy, Check, Square, ArrowUpRight, ShieldCheck, ScanLine, MessageCircle, RotateCcw } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { t, type Language } from "@/lib/i18n";
import { sendChatMessage, errorMessage, type ChatMessagePayload, type PredictionResult } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

interface Message { id: string; role: "user" | "assistant"; content: string; error?: boolean; question?: string }
interface Props { language: Language; diagnosis?: PredictionResult | null; symptoms?: string; screeningId?:string }

const urgentWarning = /🚨|urgent medical help|seek urgent|emergency (?:medical )?(?:help|care|services)|call (?:911|112|999)|तुरंत आपातकालीन|आपातकालीन चिकित्सा|तातडीने आपत्कालीन|तात्काळ वैद्यकीय मदत/i;
function markdownText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(markdownText).join("");
  if (node && typeof node === "object" && "props" in node) return markdownText((node as {props?: {children?: ReactNode}}).props?.children);
  return "";
}

export function Chatbot({ language, diagnosis, symptoms, screeningId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [copied, setCopied] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const generation = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const reducedMotion = useReducedMotion();
  const contextKey = diagnosis ? [screeningId, diagnosis.disease, diagnosis.confidence, diagnosis.model_version, symptoms].join("|") : "";
  const stop = () => {
    generation.current += 1; pending.current?.abort(); pending.current = null; setTyping(false);
  };
  useEffect(() => {
    generation.current += 1; pending.current?.abort(); pending.current = null;
    setMessages([]); setInput(""); setTyping(false);
    return () => { generation.current += 1; pending.current?.abort(); };
  }, [language, contextKey]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: reducedMotion ? "instant" : "smooth" });
  }, [messages, typing, reducedMotion]);
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 140) + "px";
    }
  }, [input]);

  const send = async (question = input.trim()) => {
    if (!question || typing) return;
    setInput("");
    const history: ChatMessagePayload[] = messages.filter(message => !message.error)
      .map(message => ({role:message.role,content:message.content.slice(0,2000)})).slice(-20);
    setMessages(previous => [...previous,{id:crypto.randomUUID(),role:"user",content:question}]);
    setTyping(true);
    const current = ++generation.current;
    const controller = new AbortController(); pending.current = controller;
    try {
      const response = await sendChatMessage(question, language, diagnosis, symptoms, history, controller.signal);
      if (generation.current !== current) return;
      setMessages(previous => [...previous,{id:crypto.randomUUID(),role:"assistant",content:response}]);
    } catch (error) {
      if (generation.current !== current) return;
      setMessages(previous => [...previous,{id:crypto.randomUUID(),role:"assistant",content:errorMessage(error,language),error:true,question}]);
    } finally {
      if (generation.current === current) { setTyping(false); pending.current = null; inputRef.current?.focus(); }
    }
  };
  const copy = async (message: Message) => {
    try { await navigator.clipboard.writeText(message.content); setCopied(message.id); }
    catch { toast.error(t(language,"copyFailed")); }
  };
  const prompts = diagnosis ? ["promptResult","promptConfidence","promptDoctor","promptLimits"] : ["promptHealth","promptXray","promptDoctor","promptLimits"];
  return <div className="assistant-shell flex h-full min-h-[560px] flex-col overflow-hidden rounded-3xl border bg-card shadow-card">
    <header className="flex items-center justify-between gap-3 border-b px-5 py-4 sm:px-7">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="h-5 w-5"/></div>
        <div><h2 className="font-heading text-base font-bold">{t(language,"assistantName")}</h2>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-primary"/>{t(language,"assistantSubtitle")}</p></div>
      </div>
      <button onClick={() => {stop();setMessages([]);setInput("");inputRef.current?.focus();}}
        className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted" aria-label={t(language,"newChat")}>
        <Plus className="h-4 w-4"/><span className="hidden sm:inline">{t(language,"newChat")}</span>
      </button>
    </header>
    {diagnosis && <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl bg-primary/5 px-3 py-2 text-xs text-primary">
      <ScanLine className="h-4 w-4"/><span>{t(language,"contextAttached")}</span>
      <span className="ml-auto font-semibold">{t(language,diagnosis.disease==="Pneumonia"?"pneumonia":diagnosis.disease==="Uncertain"?"uncertain":"normal")}</span>
    </div>}
    <div ref={scrollRef} className="chat-scroll flex-1 overflow-y-auto px-5 py-6 sm:px-7" role="log" aria-live="polite" aria-busy={typing}>
      {messages.length === 0 ? <motion.div initial={reducedMotion ? false : {opacity:0,y:10}} animate={{opacity:1,y:0}} className="mx-auto flex max-w-xl flex-col items-center pt-7 text-center sm:pt-12">
        <div className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
          <MessageCircle className="h-7 w-7"/><span className="absolute -right-1 -top-1 rounded-full border-4 border-card bg-primary p-1.5"/>
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-primary">{t(language,"chatEyebrow")}</p>
        <h3 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{t(language,"chatWelcomeTitle")}</h3>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{t(language,"chatWelcomeDescription")}</p>
        <div className="mt-7 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
          {prompts.map((prompt,index) => <button key={prompt} onClick={() => void send(t(language,prompt))}
            className="group flex items-center gap-3 rounded-2xl border bg-background/60 p-4 text-left text-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">{index%2 ? <ScanLine className="h-4 w-4"/>:<Sparkles className="h-4 w-4"/>}</span>
            <span className="flex-1">{t(language,prompt)}</span><ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary"/>
          </button>)}
        </div>
      </motion.div> : <div className="mx-auto max-w-2xl space-y-6">
        <AnimatePresence initial={false}>{messages.map(message => <motion.div key={message.id}
          initial={reducedMotion ? false : {opacity:0,y:8}} animate={{opacity:1,y:0}} className={message.role==="user" ? "flex justify-end":"flex items-start gap-3"}>
          {message.role==="assistant" && <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Sparkles className="h-3.5 w-3.5"/></div>}
          <div className={message.role==="user" ? "max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground":"min-w-0 flex-1"}>
            {message.role==="user" ? <p className="whitespace-pre-wrap">{message.content}</p> :
              <><div className={"prose prose-sm max-w-none dark:prose-invert prose-headings:font-heading prose-p:leading-relaxed " + (message.error?"rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-destructive":"")}>
                <ReactMarkdown components={{
                  a:({children,...props})=><a {...props} target="_blank" rel="noopener noreferrer">{children}</a>,
                  p:({children,...props})=>urgentWarning.test(markdownText(children))
                    ? <p {...props} className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 font-bold text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{children}</p>
                    : <p {...props}>{children}</p>,
                  strong:({children,...props})=>urgentWarning.test(markdownText(children))
                    ? <strong {...props} className="font-extrabold text-red-700 dark:text-red-300">{children}</strong>
                    : <strong {...props}>{children}</strong>,
                }}>{message.content}</ReactMarkdown>
              </div>
              <div className="mt-2 flex gap-3">{message.error ? <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
                onClick={() => {setInput(message.question || "");inputRef.current?.focus();}}><RotateCcw className="h-3 w-3"/>{t(language,"retry")}</button>:
                <button onClick={() => void copy(message)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
                  {copied===message.id ? <Check className="h-3 w-3"/>:<Copy className="h-3 w-3"/>}{t(language,copied===message.id?"copied":"copyReply")}
                </button>}</div></>}
          </div>
        </motion.div>)}</AnimatePresence>
      </div>}
      {typing && <div className="mx-auto mt-6 flex max-w-2xl items-center gap-3 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 text-primary"/><span>{t(language,"thinking")}</span>
        <span className="flex gap-1" aria-hidden="true">{[0,1,2].map(i=><span key={i} className="h-1 w-1 animate-pulse rounded-full bg-primary" style={{animationDelay:i*180+"ms"}}/>)}</span>
      </div>}
    </div>
    <footer className="px-4 pb-4 pt-2 sm:px-6">
      <div className="rounded-2xl border bg-background p-2 shadow-sm transition-shadow focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/5">
        <div className="flex items-end gap-2">
          <textarea ref={inputRef} rows={1} maxLength={2000} value={input} onChange={event=>setInput(event.target.value)}
            onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void send();}}}
            aria-label={t(language,"chatPlaceholder")} placeholder={t(language,"chatPlaceholder")}
            className="min-h-11 max-h-36 flex-1 resize-none bg-transparent px-3 py-3 text-sm outline-none placeholder:text-muted-foreground"/>
          {typing ? <button onClick={stop} aria-label={t(language,"stopReply")} className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Square className="h-4 w-4"/></button>:
          <button onClick={()=>void send()} disabled={!input.trim()} aria-label={t(language,"send")}
            className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:opacity-85 disabled:opacity-30"><ArrowUp className="h-5 w-5"/></button>}
        </div>
        <div className="flex justify-between px-3 pb-1 text-[10px] text-muted-foreground"><span>{t(language,"composerHint")}</span><span>{input.length}/2000</span></div>
      </div>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[10px] text-muted-foreground"><ShieldCheck className="h-3 w-3 shrink-0"/>{t(language,"chatFootnote")}</p>
    </footer>
  </div>;
}

