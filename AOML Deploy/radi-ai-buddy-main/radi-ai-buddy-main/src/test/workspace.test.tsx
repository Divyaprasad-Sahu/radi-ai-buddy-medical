import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Dashboard } from "@/components/Dashboard";
import { useHistory } from "@/lib/store";
import { t } from "@/lib/i18n";
const fixture={disease:"Uncertain",confidence:.62,chat_response:"Test-only screening summary",model_version:"fixture-only",calibrated:false};
function Workspace(){const history=useHistory();return <Dashboard language="en" history={history.history} onAddHistory={history.addToHistory} onClearHistory={history.clearHistory} onBack={()=>{}}/>;}
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
it("connects upload, result, contextual chat, history and report with explicit fixtures",async()=>{
 const calls: {url:string;init:RequestInit}[]=[];
 vi.stubGlobal("fetch",vi.fn(async(url:string,init:RequestInit)=>{calls.push({url,init});return {ok:true,json:async()=>url.endsWith('/predict')?fixture:{chat_response:url.endsWith('/chat')?'Context understood':'Test-only explanation'}};}));
 const revoke=vi.fn();vi.spyOn(URL,"createObjectURL").mockReturnValue('blob:fixture');vi.spyOn(URL,"revokeObjectURL").mockImplementation(revoke);
 render(<Workspace/>);
 fireEvent.change(screen.getByLabelText(t('en','uploadTitle')),{target:{files:[new File(['test'],'fixture.png',{type:'image/png'})]}});
 fireEvent.change(screen.getByLabelText(t('en','symptoms')),{target:{value:'Synthetic cough'}});
 fireEvent.click(screen.getByRole('button',{name:t('en','upload')}));
 await waitFor(()=>expect(screen.getByText(t('en','uncertain'))).toBeInTheDocument());
 fireEvent.click(screen.getByRole('button',{name:t('en','chat')}));
 const composer=await screen.findByPlaceholderText(t('en','chatPlaceholder'));
 fireEvent.change(composer,{target:{value:'Explain the score'}});
 fireEvent.click(screen.getByRole('button',{name:t('en','send')}));
 await screen.findByText('Context understood');
 const payload=JSON.parse(calls.find(call=>call.url.endsWith('/chat'))!.init.body as string);
 expect(payload).toMatchObject({disease:'Uncertain',confidence:.62,model_version:'fixture-only',symptoms:'Synthetic cough',calibrated:false});
 fireEvent.click(screen.getByRole('button',{name:t('en','history')}));
 await screen.findByRole("heading",{name:t("en","historyTitle")});
 await screen.findByRole("button",{name:/Uncertain/});
 fireEvent.click(screen.getAllByRole('button',{name:t('en','createReport')})[0]);
 expect(await screen.findByRole('dialog')).toBeInTheDocument();
 expect(screen.getByText('Synthetic cough',{selector:'p'})).toBeInTheDocument();
 expect(screen.getByText(t('en','reportDisclaimer'))).toBeInTheDocument();
});

