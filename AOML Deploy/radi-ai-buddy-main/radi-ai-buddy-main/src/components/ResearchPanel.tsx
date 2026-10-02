import { useEffect,useState } from "react";
import { Database, ShieldCheck, Activity, Users, RefreshCw, ExternalLink } from "lucide-react";
import { getInsights,errorMessage,type ResearchInsights } from "@/lib/api";
import { t,type Language } from "@/lib/i18n";
export function ResearchPanel({language}:{language:Language}) {
  const [data,setData]=useState<ResearchInsights|null>(null);
  const [error,setError]=useState("");
  const [reload,setReload]=useState(0);
  useEffect(()=>{let active=true;getInsights().then(value=>{if(active){setData(value);setError("");}}).catch(value=>{if(active)setError(errorMessage(value,language));});
    return()=>{active=false;};},[language,reload]);
  const metrics=data?.evaluation?.selected_test;
  const positives=data?.dataset ? Object.entries(data.dataset.split_counts).filter(([key])=>key.endsWith(":1")).reduce((sum,[,value])=>sum+value,0):0;
  const stats=[{key:"imagesReviewed",value:data?.dataset?.images_found,icon:Database},{key:"cleanImages",value:data?.dataset?.clean_rows,icon:ShieldCheck},
    {key:"patients",value:data?.dataset?.clean_patients,icon:Users},{key:"pneumoniaExamples",value:data?.dataset?positives:undefined,icon:Activity}];
  return <section className="mx-auto max-w-5xl space-y-6">
    <div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-bold tracking-tight">{t(language,"researchTitle")}</h2><p className="mt-2 text-sm text-muted-foreground">{t(language,"researchSubtitle")}</p></div>
      <button onClick={()=>setReload(value=>value+1)} aria-label={t(language,"retry")} className="rounded-xl border bg-card p-3 hover:bg-muted"><RefreshCw className="h-4 w-4"/></button></div>
    {error && <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">{error}</p>}
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{stats.map(({key,value,icon:Icon})=><div key={key} className="rounded-2xl border bg-card p-5 shadow-card">
      <Icon className="mb-5 h-5 w-5 text-primary"/><p className="text-3xl font-semibold tracking-tight">{value?.toLocaleString(language)??"—"}</p><p className="mt-2 text-xs text-muted-foreground">{t(language,key)}</p></div>)}</div>
    <div className="grid gap-5 md:grid-cols-2">
      <div className="rounded-2xl border bg-card p-6"><h3 className="mb-4 text-sm font-semibold">{t(language,"datasetSource")}</h3>
        <p className="text-lg font-bold">NIH ChestX-ray14</p><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(language,"partialDataset")}</p>
        <a className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-primary" href="https://nihcc.app.box.com/v/ChestXray-NIHCC" target="_blank" rel="noopener noreferrer">NIH Clinical Center <ExternalLink className="h-3 w-3"/></a>
      </div>
      <div className="rounded-2xl border bg-card p-6"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{t(language,"modelStatus")}</h3>
        <span className={"rounded-full px-3 py-1 text-xs "+(data?.model.ready?"bg-primary/10 text-primary":"bg-muted text-muted-foreground")}>{t(language,data?.model.ready?"ready":"notReady")}</span></div>
        <p className="mt-4 break-all text-xs text-muted-foreground">{data?.model.version||"ResNet18 · ONNX CPU"}</p>
        {data?.evaluation?.selected === "baseline" && <div className="mt-4 rounded-xl bg-muted p-3"><p className="text-xs font-semibold">{t(language,"legacyEvaluation")}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t(language,"unknownProvenance")}</p></div>}
        {metrics ? <div className="mt-6 space-y-4">{[["balanced_accuracy","balancedAccuracy"],["sensitivity","sensitivity"],["specificity","specificity"]].map(([key,label])=><div key={key}>
          <div className="mb-2 flex justify-between text-xs"><span>{t(language,label)}</span><strong>{Math.round(metrics[key]*100)}%</strong></div>
          <div className="h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width:metrics[key]*100+"%"}}/></div></div>)}</div>:
          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">{t(language,"noMetrics")}</p>}
      </div>
    </div>
  </section>;
}

