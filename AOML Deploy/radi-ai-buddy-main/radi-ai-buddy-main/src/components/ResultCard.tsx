import { motion } from "framer-motion";
import { AlertTriangle, Download } from "lucide-react";
import { t, type Language } from "@/lib/i18n";
import type { PredictionResult } from "@/lib/api";
export function ResultCard({ result, language, onDownload }: {result:PredictionResult;language:Language;onDownload:()=>void}) {
  const label = result.disease === "Pneumonia" ? "pneumonia" : result.disease === "Uncertain" ? "uncertain" : "normal";
  return <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} className="space-y-5">
    <h2 className="font-heading text-xl font-bold">{t(language,"resultTitle")}</h2>
    <div className="rounded-xl gradient-card shadow-card p-5">
      <div className="flex items-center justify-between"><p className="text-2xl font-bold">{t(language,label)}</p><AlertTriangle className="text-warning"/></div>
      <p className="mt-4">{t(language,"confidence")}: {Math.round(result.confidence*100)}%</p>
      <progress className="mt-2 w-full" value={result.confidence} max={1} aria-label={t(language,"confidence")}/>
      <p className="mt-3 text-sm text-muted-foreground">{t(language,"confidenceNote")}</p>
      <p className="mt-2 text-xs">{t(language,result.calibrated ? "calibrated" : "uncalibrated")}</p>
    </div>
    <div className="rounded-xl border bg-card p-5"><h3>{t(language,"explanation")}</h3>
      <p className="mt-2 text-sm">{result.chat_response}</p><p className="mt-3 text-sm">{t(language,"poweredBy")}</p></div>
    <button onClick={onDownload} className="flex w-full items-center justify-center gap-2 rounded-lg border p-3"><Download className="h-4 w-4"/>{t(language,"downloadReport")}</button>
  </motion.div>;
}

