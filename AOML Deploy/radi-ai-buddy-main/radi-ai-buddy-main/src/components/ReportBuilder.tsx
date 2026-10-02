import { useState, useRef } from "react";
import { Printer, Download, FileText, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { t, type Language } from "@/lib/i18n";
import type { PredictionResult } from "@/lib/api";
import { toast } from "sonner";

interface Props { open:boolean; onOpenChange:(open:boolean)=>void; result:PredictionResult|null; symptoms:string; language:Language }
export function ReportBuilder({open,onOpenChange,result,symptoms,language}:Props) {
  const [patient,setPatient]=useState({name:"",reference:"",age:"",sex:""});
  const [reportedSymptoms,setReportedSymptoms]=useState(symptoms);
  const [notes,setNotes]=useState("");
  const [reference]=useState(()=> "RAD-"+crypto.randomUUID().slice(0,8).toUpperCase());
  const [prepared]=useState(()=> new Date());
  const preview=useRef<HTMLDivElement>(null);
  const labelKey=!result?"notPerformed":result.disease==="Pneumonia"?"pneumonia":result.disease==="Uncertain"?"uncertain":"normal";
  const findingKey=!result?"reportNotPerformed":result.disease==="Pneumonia"?"reportPneumonia":result.disease==="Uncertain"?"reportUncertain":"reportNoFinding";
  const html = () => {
    const title=t(language,"reportTitle");
    return '<!doctype html><html lang="'+language+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>'+title+'</title><style>'
      + 'body{margin:0;background:#edf2f4;font:14px/1.65 Inter,"Nirmala UI",Arial,sans-serif;color:#192c39}.report{max-width:780px;margin:32px auto;padding:48px;background:white;border:1px solid #dbe4e7}.report h1{font-size:28px;margin:8px 0}.report h2{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#18766d;border-bottom:1px solid #dbe4e7;padding-bottom:8px;margin-top:28px}.report .report-header{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #18766d;padding-bottom:24px}.report .report-brand{font-size:23px;font-weight:700;color:#18766d}.report .report-meta{font-size:11px;text-align:right;color:#526572}.report .report-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.report .report-label{display:block;font-size:11px;color:#526572}.report .report-finding{padding:20px;background:#f1f8f7;border-left:3px solid #18766d}.report .report-small{font-size:11px;color:#526572}.report .report-footer{margin-top:32px;border-top:1px solid #dbe4e7;padding-top:14px}.report p{white-space:pre-wrap;overflow-wrap:anywhere}.report .report-title{margin:8px 0;font-size:26px;font-weight:700}.report .report-score{font-size:12px;margin-top:10px}@page{size:A4;margin:16mm}@media print{body{background:white}.report{margin:0;padding:0;border:0;max-width:none}.report-header,.report-finding{break-inside:avoid}h2{break-after:avoid}}'
      + '</style></head><body>'+ (preview.current?.innerHTML||"") +'</body></html>';
  };
  const download = () => {
    const url=URL.createObjectURL(new Blob([html()],{type:"text/html;charset=utf-8"}));
    const anchor=document.createElement("a");anchor.href=url;anchor.download=reference+".html";document.body.appendChild(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const print = () => {
    const frame=document.createElement("iframe");
    frame.title=t(language,"reportTitle");frame.style.cssText="position:fixed;width:0;height:0;border:0";
    frame.srcdoc=html();
    frame.onload=()=> {
      if(!frame.contentWindow){toast.error(t(language,"server_error"));frame.remove();return;}
      frame.contentWindow.onafterprint=()=>frame.remove();
      frame.contentWindow.focus();frame.contentWindow.print();
      // Clean up after cancelled print dialogs too; keep sufficient time for print preview.
      setTimeout(()=>frame.remove(),120000);
    };
    document.body.appendChild(frame);
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent closeLabel={t(language,"close")} className="max-h-[92vh] max-w-6xl overflow-y-auto rounded-3xl p-0">
    <div className="border-b px-6 py-5"><DialogHeader><DialogTitle className="flex items-center gap-2 text-xl"><FileText className="h-5 w-5 text-primary"/>{t(language,"createReport")}</DialogTitle>
      <DialogDescription>{t(language,"reportSubtitle")}</DialogDescription></DialogHeader></div>
    <div className="grid gap-0 lg:grid-cols-[300px_1fr]">
      <aside className="space-y-5 border-b bg-muted/30 p-6 lg:border-b-0 lg:border-r">
        <h3 className="text-sm font-semibold">{t(language,"patientDetails")}</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">{t(language,"reportNoPatient")}</p>
        {(["name","reference","age"] as const).map(field=><label key={field} className="block text-xs font-medium">
          {t(language,field==="name"?"patientName":field==="reference"?"patientId":"patientAge")}
          <input type={field==="age"?"number":"text"} min={0} max={120} maxLength={100}
            value={patient[field]} onChange={event=>setPatient(previous=>({...previous,[field]:field==="age"?event.target.value.slice(0,3):event.target.value}))}
            className="mt-2 w-full rounded-xl border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
        </label>)}
        <label className="block text-xs font-medium">{t(language,"patientSex")}<select value={patient.sex} onChange={event=>setPatient(previous=>({...previous,sex:event.target.value}))} className="mt-2 w-full rounded-xl border bg-card px-3 py-2.5 text-sm">
          <option value="">{t(language,"notProvided")}</option>{["male","female","other"].map(value=><option key={value} value={value}>{t(language,value)}</option>)}
        </select></label>
        <label className="block text-xs font-medium">{t(language,"reportedSymptoms")}<textarea maxLength={2000} rows={3} value={reportedSymptoms} onChange={event=>setReportedSymptoms(event.target.value)} className="mt-2 w-full rounded-xl border bg-card p-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"/></label>
        <label className="block text-xs font-medium">{t(language,"reportNotes")}<textarea maxLength={2000} rows={5} value={notes} onChange={event=>setNotes(event.target.value)}
          placeholder={t(language,"reportNotesPlaceholder")} className="mt-2 w-full rounded-xl border bg-card p-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"/></label>
        <button onClick={print} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"><Printer className="h-4 w-4"/>{t(language,"savePdf")}</button>
        <button onClick={download} className="flex w-full items-center justify-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm font-medium"><Download className="h-4 w-4"/>{t(language,"downloadHtml")}</button>
      </aside>
      <div className="bg-[#edf2f4] p-4 sm:p-7">
        <p className="mb-3 flex items-center gap-2 text-xs text-[#526572]"><ShieldCheck className="h-3.5 w-3.5"/>{t(language,"reportPreview")}</p>
        <div ref={preview}>
          <article className="report rounded-sm bg-white p-6 text-[#192c39] shadow-sm sm:p-9" style={{fontFamily:'Inter, "Nirmala UI", sans-serif'}}>
            <div className="report-header flex justify-between gap-4 border-b-[3px] border-[#18766d] pb-6">
              <div><div className="report-brand text-2xl font-bold text-[#18766d]">radiant<span className="text-[#526572]">.</span></div>
                <div className="report-title mt-2 text-xl font-bold">{t(language,"reportTitle")}</div><div className="report-small mt-1 text-[10px] text-[#526572]">{t(language,"reportPrepared")}</div></div>
              <div className="report-meta text-right text-[10px] leading-6 text-[#526572]">{t(language,"reportId")}<br/><strong>{reference}</strong><br/>{prepared.toLocaleDateString(language)} · {prepared.toLocaleTimeString(language,{hour:"2-digit",minute:"2-digit"})}</div>
            </div>
            <h2 className="mt-6 border-b pb-2 text-[10px] font-semibold uppercase tracking-widest text-[#18766d]">{t(language,"patientDetails")}</h2>
            <div className="report-grid mt-4 grid grid-cols-2 gap-4">
              {[[t(language,"patientName"),patient.name],[t(language,"patientId"),patient.reference],[t(language,"patientAge"),Number(patient.age)>=0&&Number(patient.age)<=120?patient.age:""],[t(language,"patientSex"),patient.sex?t(language,patient.sex):""]].map(([label,value])=><div key={label}><span className="report-label block text-[10px] text-[#526572]">{label}</span><p className="mt-1 break-words text-sm">{value||t(language,"notProvided")}</p></div>)}
            </div>
            <h2 className="mt-6 border-b pb-2 text-[10px] font-semibold uppercase tracking-widest text-[#18766d]">{t(language,"assessment")}</h2>
            <div className="report-finding mt-4 border-l-[3px] border-[#18766d] bg-[#f1f8f7] p-4">
              <strong className="text-base">{t(language,labelKey)}</strong><p className="mt-2 text-xs leading-6">{t(language,findingKey)}</p>
              <p className="report-score mt-3 text-xs">{t(language,"confidence")}: <strong>{result?Math.round(result.confidence*100)+"%":t(language,"notProvided")}</strong></p>
              <p className="report-small mt-2 text-[10px] text-[#526572]">{t(language,"confidenceNote")}</p>
            </div>
            <h2 className="mt-6 border-b pb-2 text-[10px] font-semibold uppercase tracking-widest text-[#18766d]">{t(language,"reportSection")}</h2>
            <span className="report-label mt-4 block text-[10px] text-[#526572]">{t(language,"reportedSymptoms")}</span><p className="mt-1 whitespace-pre-wrap text-xs">{reportedSymptoms||t(language,"notProvided")}</p>
            {notes && <><span className="report-label mt-4 block text-[10px] text-[#526572]">{t(language,"reportNotes")}</span><p className="mt-1 whitespace-pre-wrap text-xs">{notes}</p></>}
            <h2 className="mt-6 border-b pb-2 text-[10px] font-semibold uppercase tracking-widest text-[#18766d]">{t(language,"technicalDetails")}</h2>
            <p className="mt-3 text-xs">{t(language,"modelVersion")}: {result?.model_version||t(language,"notProvided")}<br/>{t(language,!result?"notPerformed":result.calibrated?"calibrated":"uncalibrated")}</p>
            <div className="report-footer mt-7 border-t pt-4"><strong className="text-[10px] text-[#18766d]">{t(language,"reviewRequired")}</strong>
              <p className="report-small mt-2 text-[10px] leading-5 text-[#526572]">{t(language,"reportDisclaimer")}</p><p className="report-small mt-3 text-[9px] text-[#526572]">{t(language,"confidentiality")}</p></div>
          </article>
        </div>
      </div>
    </div>
  </DialogContent></Dialog>;
}

