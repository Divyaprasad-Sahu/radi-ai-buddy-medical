import { t, type Language } from "./i18n";
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
export interface PredictionResult {
  disease: string; confidence: number; chat_response: string;
  model_version?: string; calibrated?: boolean;
}
export interface ChatMessagePayload { role: "user" | "assistant"; content: string }
export class ApiError extends Error {
  constructor(public code: string) { super(code); }
}
export function errorMessage(error: unknown, language: Language): string {
  return t(language, error instanceof ApiError ? error.code : "errorApi");
}
async function request(path: string, init: RequestInit, signal?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(API_BASE + path, { ...init, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const codes: Record<number, string> = {400:"invalid_image",413:"too_large",422:"invalid_request",429:"rate_limited",503:"model_unavailable"};
      throw new ApiError(typeof data.detail === "string" ? data.detail : codes[response.status] || "server_error");
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(signal?.aborted ? "cancelled" : controller.signal.aborted ? "timeout" : "errorApi");
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
}
export async function predictImage(image: File, language: Language, symptoms?: string): Promise<PredictionResult> {
  const body = new FormData();
  body.append("file", image); body.append("language", language); body.append("symptoms", symptoms || "");
  return request("/predict", {method:"POST", body});
}
export async function sendChatMessage(question: string, language: Language, diagnosis?: PredictionResult | null,
  symptoms?: string, history: ChatMessagePayload[] = [], signal?: AbortSignal): Promise<string> {
  const data = await request("/chat", {method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({disease:diagnosis?.disease,confidence:diagnosis?.confidence,
      model_version:diagnosis?.model_version,calibrated:diagnosis?.calibrated,symptoms,language,
      question,history:history.slice(-20)})},signal);
  return data.chat_response;
}
export interface ResearchInsights {
  dataset: { images_found:number; clean_rows:number; clean_patients:number; scope:string; split_counts:Record<string,number> } | null;
  model: { ready:boolean; version?:string; calibrated?:boolean };
  evaluation: { selected?:string; selected_test?:Record<string,number>; candidate_validation?:Record<string,number> } | null;
}
export async function getInsights(): Promise<ResearchInsights> { return request("/insights",{method:"GET"}); }
export async function explainResult(diagnosis: PredictionResult, language: Language, symptoms?: string): Promise<string> {
  const data = await request("/explain", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
    disease:diagnosis.disease,confidence:diagnosis.confidence,language,symptoms,question:"Explain result",history:[]})});
  return data.chat_response;
}

