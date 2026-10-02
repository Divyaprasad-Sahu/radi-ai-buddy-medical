import { useState, useCallback, useEffect, useMemo, lazy, Suspense } from "react";
import { ArrowLeft, LayoutDashboard, MessageSquare, Clock, FlaskConical, ScanLine, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { t, type Language } from "@/lib/i18n";
import { predictImage, explainResult, errorMessage, type PredictionResult } from "@/lib/api";
import { UploadComponent } from "./UploadComponent";
const ReportBuilder = lazy(()=>import("./ReportBuilder").then(module=>({default:module.ReportBuilder})));
const ResearchPanel = lazy(()=>import("./ResearchPanel").then(module=>({default:module.ResearchPanel})));
import { ResultCard } from "./ResultCard";
const Chatbot = lazy(() => import("./Chatbot").then(module => ({ default: module.Chatbot })));
import { HistoryPanel } from "./HistoryPanel";
import { Loader } from "./Loader";
import type { HistoryItem } from "@/lib/store";
import { toast } from "sonner";

type Tab = "dashboard" | "chat" | "history" | "research";

interface Props {
  initialTab?: "dashboard" | "chat";
  language: Language;
  history: HistoryItem[];
  onAddHistory: (item: Omit<HistoryItem, "id" | "timestamp">) => void;
  onBack: () => void;
  onClearHistory: () => void;
}

export function Dashboard({ language, history, onAddHistory, onBack, onClearHistory, initialTab = "dashboard" }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [screeningId,setScreeningId]=useState("");
  const [reportOpen,setReportOpen]=useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [symptoms, setSymptoms] = useState<string>("");
  const [explanation, setExplanation] = useState("");
  useEffect(() => {
    let active = true;
    setExplanation("");
    if (result) explainResult(result, language, symptoms)
      .then(text => { if (active) setExplanation(text); }).catch(error => { if (active) setExplanation(errorMessage(error, language)); });
    return () => { active = false; };
  }, [language, result, symptoms]);
  const displayResult = useMemo(() => result ? { ...result, chat_response: explanation } : null, [result, explanation]);

  const handleSubmit = useCallback(
    async (file: File, symptoms: string) => {
      setScreeningId(crypto.randomUUID());
      setLoading(true);
      setResult(null);
      setSymptoms(symptoms);

      // Create preview URL
      const url = URL.createObjectURL(file);

      try {
        const res = await predictImage(file, language, symptoms || undefined);
        setResult(res);
        onAddHistory({ imageUrl: url, result: res, symptoms });
        toast.success(t(language, "resultTitle"));
      } catch (error) {
        URL.revokeObjectURL(url);
        toast.error(errorMessage(error, language));
      } finally {
        setLoading(false);
      }
    },
    [language, onAddHistory]
  );

  const handleHistorySelect = (item: HistoryItem) => {
    setScreeningId(item.id);
    setResult(item.result);
    setSymptoms(item.symptoms || "");
    setTab("dashboard");
  };

  const handleDownload = () => setReportOpen(true);

  const tabs: { key: Tab; icon: typeof LayoutDashboard; labelKey: string }[] = [
    { key: "dashboard", icon: LayoutDashboard, labelKey: "screening" },
    { key: "chat", icon: MessageSquare, labelKey: "chat" },
    { key: "history", icon: Clock, labelKey: "history" },
    { key: "research", icon: FlaskConical, labelKey: "research" },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Tab bar */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center gap-1 overflow-x-auto px-4">
          <button
            aria-label={t(language, "back")}
            onClick={onBack}
            className="mr-2 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          {tabs.map((tb) => {
            const Icon = tb.icon;
            return (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key)}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  tab === tb.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t(language, tb.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="container mx-auto px-5 py-8">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3"><div><h1 className="font-heading text-2xl font-bold tracking-tight">{t(language,"workspace")}</h1><p className="mt-1 text-sm text-muted-foreground">{t(language,"workspaceSubtitle")}</p></div><button onClick={()=>setReportOpen(true)} title={t(language,"createReport")} className="ml-auto rounded-xl border bg-card px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed">{t(language,"createReport")}</button><span className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 text-primary"/>{t(language,"sessionPrivate")}</span></div>
        <AnimatePresence mode="wait">
          {tab === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid items-start gap-6 lg:grid-cols-2"
            >
              <div className="rounded-3xl border bg-card p-6 shadow-card">
                <UploadComponent
                  language={language}
                  onSubmit={handleSubmit}
                  loading={loading}
                />
              </div>
              <div>
                {loading && <Loader text={t(language, "uploading")} />}
                {displayResult && !loading && (
                  <ResultCard
                    result={displayResult}
                    language={language}
                    onDownload={handleDownload}
                  />
                )}
                {!result && !loading && (
                  <div className="flex min-h-[410px] flex-col items-center justify-center rounded-3xl border bg-card p-9 text-center"><div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted"><ScanLine className="h-7 w-7 text-primary"/></div><h2 className="font-heading text-xl font-semibold">{t(language,"emptyResultTitle")}</h2><p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">{t(language,"emptyResultDescription")}</p><button onClick={()=>setTab("chat")} className="mt-6 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium hover:bg-muted"><MessageSquare className="h-4 w-4"/>{t(language,"openAssistant")}</button></div>
                )}
              </div>
            </motion.div>
          )}

          {tab === "research" && <motion.div key="research" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><Suspense fallback={<Loader text={t(language,"typing")}/>}><ResearchPanel language={language}/></Suspense></motion.div>}
          {tab === "history" && (
            <motion.div
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mx-auto max-w-2xl"
            >
              <HistoryPanel
                history={history}
                language={language}
                onSelect={handleHistorySelect}
                onClear={() => { onClearHistory(); setResult(null); setSymptoms(""); }}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <div className={tab === "chat" ? "mx-auto h-[max(600px,calc(100vh-16rem))] max-w-4xl" : "hidden"}><Suspense fallback={<Loader text={t(language,"typing")}/>}><Chatbot language={language} diagnosis={displayResult} symptoms={symptoms} screeningId={screeningId}/></Suspense></div>
        {<Suspense fallback={null}><ReportBuilder key={screeningId} open={reportOpen} onOpenChange={setReportOpen} result={result} symptoms={symptoms} language={language}/></Suspense>}
      </div>
    </div>
  );
}
