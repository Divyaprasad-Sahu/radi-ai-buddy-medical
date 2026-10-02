import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useHistory } from "@/lib/store";
import { ApiError, errorMessage, predictImage, sendChatMessage } from "@/lib/api";
import { translations, t, type Language } from "@/lib/i18n";
import { ResultCard } from "@/components/ResultCard";
import { ReportBuilder } from "@/components/ReportBuilder";
import { Chatbot } from "@/components/Chatbot";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const result = {disease:"Pneumonia",confidence:.91,chat_response:"example",model_version:"fixture",calibrated:true};

describe("API contract and privacy", () => {
  it("sends multipart file and selected language", async () => {
    const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>result});vi.stubGlobal("fetch",fetchMock);
    await predictImage(new File(["test"],"x.png",{type:"image/png"}),"hi","cough");
    const body=fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get("language")).toBe("hi");expect(body.get("file")).toBeInstanceOf(File);
  });
  it("sends model context and bounds history", async () => {
    const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({chat_response:"reply"})});vi.stubGlobal("fetch",fetchMock);
    await sendChatMessage("confidence","mr",result,"",Array.from({length:25},()=>({role:"user" as const,content:"question"})));
    const payload=JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.external_ai).toBeUndefined();expect(payload.model_version).toBe("fixture");expect(payload.calibrated).toBe(true);expect(payload.disease).toBe("Pneumonia");expect(payload.history).toHaveLength(20);
  });
  it("localizes an unavailable-model response", async () => {
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false,status:503,json:async()=>({detail:"model_unavailable"})}));
    await expect(predictImage(new File(["test"],"x.png"),"en")).rejects.toBeInstanceOf(ApiError);
    expect(errorMessage(new ApiError("model_unavailable"),"mr")).toBe(t("mr","model_unavailable"));
  });
  it("stores no medical history and revokes URLs on clear", () => {
    localStorage.setItem("med-history",JSON.stringify([{symptoms:"private"}]));
    const revoke=vi.fn();vi.stubGlobal("URL",{revokeObjectURL:revoke});
    const {result:hook}=renderHook(()=>useHistory());
    act(()=>hook.current.addToHistory({imageUrl:"blob:private",result,symptoms:"private"}));
    expect(localStorage.getItem("med-history")).toBeNull();
    expect(hook.current.history).toHaveLength(1);
    act(()=>hook.current.clearHistory());expect(revoke).toHaveBeenCalledWith("blob:private");
  });
});

describe.each(["en","hi","mr"] as Language[])("%s frontend", language => {
  it("translates every added UI key", () => {
    for(const key of ["chatFootnote","createReport","savePdf","research","clearHistory","confidenceNote","model_unavailable","timeout","too_large"])
      expect(translations[language][key]).toBeTruthy();
  });
  it("shows screening score without severity or safe labels", () => {
    render(<ResultCard result={result} language={language} onDownload={()=>{}}/>);
    expect(screen.getByText(t(language,"pneumonia"))).toBeInTheDocument();
    expect(screen.getByText(t(language,"confidenceNote"))).toBeInTheDocument();
    expect(screen.queryByText(t(language,"safe"))).not.toBeInTheDocument();
  });
  it("does not invent findings when generating a report without screening", () => {
    render(<ReportBuilder open onOpenChange={()=>{}} result={null} symptoms="" language={language}/>);
    expect(screen.getByText(t(language,"reportNotPerformed"))).toBeInTheDocument();
    expect(screen.queryByText("91%")).not.toBeInTheDocument();
  });
  it("creates a structured report with optional private details", () => {
    render(<ReportBuilder open onOpenChange={()=>{}} result={result} symptoms="cough" language={language}/>);
    fireEvent.change(screen.getByLabelText(t(language,"patientName")),{target:{value:"Test patient"}});
    expect(screen.getByText("Test patient")).toBeInTheDocument();
    expect(screen.getByText(t(language,"reportDisclaimer"))).toBeInTheDocument();
    expect(screen.getByRole("button",{name:t(language,"savePdf")})).toBeInTheDocument();
    expect(screen.getByText(/fixture/)).toBeInTheDocument();
  });
  it("resets conversation when selecting another screening", async () => {
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({chat_response:"API answer"})}));
    const props={language,diagnosis:result};
    const view=render(<Chatbot {...props}/>);
    fireEvent.change(screen.getByRole("textbox"),{target:{value:"confidence"}});
    fireEvent.click(screen.getByRole("button",{name:t(language,"send")}));
    await waitFor(()=>expect(screen.getByText("API answer")).toBeInTheDocument());
    view.rerender(<Chatbot {...props} diagnosis={{...result,disease:"Uncertain",confidence:.55}}/>);
    expect(screen.queryByText("API answer")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
  it("highlights urgent medical warnings in bold red", async () => {
    const warning = "🚨 **Seek urgent medical help now:** if breathing becomes severely difficult.";
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({chat_response:`Rest and drink fluids.\n\n${warning}`})}));
    render(<Chatbot language={language}/>);
    fireEvent.change(screen.getByRole("textbox"),{target:{value:"What should I do?"}});
    fireEvent.click(screen.getByRole("button",{name:t(language,"send")}));
    const warningText = await screen.findByText(/Seek urgent medical help now/);
    expect(warningText.tagName).toBe("STRONG");
    expect(warningText).toHaveClass("text-red-700");
    expect(warningText.closest("p")).toHaveClass("font-bold", "text-red-800");
  });
});

it("allows standalone API chat without a prediction",async()=>{
 const mock=vi.fn().mockResolvedValue({ok:true,json:async()=>({chat_response:"reply"})});vi.stubGlobal("fetch",mock);
 await sendChatMessage("What is an X-ray?","en",null);
 expect(JSON.parse(mock.mock.calls[0][1].body).disease).toBeUndefined();
});

it("exports a self-contained report and escapes user-supplied text",async()=>{
 let captured:Blob|undefined;
 vi.spyOn(URL,"createObjectURL").mockImplementation(blob=>{captured=blob as Blob;return "blob:report";});
 vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(()=>{});
 render(<ReportBuilder open onOpenChange={()=>{}} result={null} symptoms="" language="mr"/>);
 fireEvent.change(screen.getByLabelText(t("mr","patientName")),{target:{value:"<script>alert(1)</script>"}});
 fireEvent.click(screen.getByRole("button",{name:t("mr","downloadHtml")}));
 const html=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsText(captured!);});
 expect(html).toContain('<html lang="mr">');expect(html).toContain('@page{size:A4');
 expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>');
 expect(html).toContain(t("mr","reportNotPerformed"));
});
