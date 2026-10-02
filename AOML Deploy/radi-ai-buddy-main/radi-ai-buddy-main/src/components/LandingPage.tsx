import { motion, useReducedMotion } from "framer-motion";
import { ScanLine, MessageSquare, Globe, FileText, ArrowRight, Sparkles, Layers } from "lucide-react";
import { t, type Language } from "@/lib/i18n";
const features=[{icon:ScanLine,key:"imageAnalysis",desc:"imageAnalysisDesc"},{icon:MessageSquare,key:"aiChatbot",desc:"aiChatbotDesc"},{icon:Globe,key:"multilingualSupport",desc:"multilingualSupportDesc"},{icon:FileText,key:"realTimeResults",desc:"realTimeResultsDesc"}];
export function LandingPage({language,onStart,onChat}:{language:Language;onStart:()=>void;onChat:()=>void}) {
 const reduced=useReducedMotion();
 return <main className="gradient-hero min-h-[calc(100vh-4rem)]">
  <section className="container mx-auto grid items-center gap-14 px-5 py-16 lg:grid-cols-[1.15fr_1fr] lg:py-24">
   <motion.div initial={reduced?false:{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{duration:.5}}>
    <p className="mb-6 flex items-center gap-2 text-xs font-semibold tracking-[.18em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary"/>{t(language,"heroEyebrow")}</p>
    <h1 className="whitespace-pre-line font-heading text-4xl font-bold leading-[1.12] tracking-[-.04em] sm:text-5xl xl:text-6xl">{t(language,"heroHeadline")}</h1>
    <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">{t(language,"heroDescription")}</p>
    <div className="mt-9 flex flex-wrap gap-3"><button onClick={onStart} className="inline-flex items-center gap-3 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-card transition-transform hover:-translate-y-0.5">{t(language,"startDiagnosis")}<ArrowRight className="h-4 w-4"/></button>
    <button onClick={onChat} className="inline-flex items-center gap-2 rounded-xl border bg-card px-5 py-3.5 text-sm font-semibold transition-colors hover:bg-muted"><MessageSquare className="h-4 w-4"/>{t(language,"heroChat")}</button></div>
    <p className="mt-6 text-xs text-muted-foreground">{t(language,"heroTrust")}</p>
   </motion.div>
   <motion.div initial={reduced?false:{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:.6,delay:.1}} className="relative">
    <div className="absolute -inset-6 rounded-full bg-primary/5 blur-3xl"/>
    <div className="relative overflow-hidden rounded-[2rem] border bg-card shadow-elevated">
     <div className="flex items-center justify-between border-b px-6 py-5"><span className="flex items-center gap-2 text-sm font-semibold"><Layers className="h-4 w-4 text-primary"/>Radiant workspace</span><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] text-primary">{t(language,"screeningBadge")}</span></div>
     <div className="p-7"><div className="flex h-52 items-center justify-center rounded-2xl border bg-muted/40"><div className="relative flex h-32 w-32 items-center justify-center rounded-full border border-primary/20"><div className="absolute inset-3 rounded-full border border-dashed border-primary/25"/><ScanLine className="h-14 w-14 stroke-[1] text-primary"/></div></div>
      <div className="mt-6 flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10"><Sparkles className="h-4 w-4 text-primary"/></span><div><p className="text-sm font-semibold">{t(language,"assistantName")}</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(language,"heroSubtitle")}</p></div></div>
      <div className="mt-6 grid grid-cols-3 gap-2">{["screening","chat","report"].map(key=><div key={key} className="rounded-xl border px-2 py-3 text-center text-xs text-muted-foreground">{t(language,key)}</div>)}</div>
     </div>
    </div>
   </motion.div>
  </section>
  <section className="container mx-auto px-5 pb-16"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{features.map(({icon:Icon,key,desc})=><article key={key} className="rounded-2xl border bg-card/80 p-6"><Icon className="mb-5 h-5 w-5 text-primary"/><h2 className="font-heading text-sm font-semibold">{t(language,key)}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(language,desc)}</p></article>)}</div></section>
  <footer className="border-t px-5 py-6 text-center text-xs text-muted-foreground">{t(language,"poweredBy")}</footer>
 </main>;
}
