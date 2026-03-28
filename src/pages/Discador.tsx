import { useEffect, useState, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { DIALER_URL } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Phone, PhoneOff, Clock, User, MessageSquare,
  Flame, Snowflake, Sun, ThumbsDown,
  ShieldAlert, SkipForward, Pause, Play,
  TestTube, Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { EDGE_BASE } from "@/lib/constants";

type CallStatus = "idle" | "dialing" | "ringing" | "in_call" | "ended";
type Qualification = "hot" | "warm" | "cold" | "not_qualified";
type CurrentLead = { queue_id: string; lead_id: string; name: string; phone: string; attempts?: number };
type TranscriptEntry = { role: "ai" | "lead"; text: string; timestamp: string };

const formatPhone = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  if (d.length >= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
  return phone;
};
const formatDuration = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

export default function Discador() {
  const { collaborator, roleLevel } = useCollaborator();
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [currentLead, setCurrentLead] = useState<CurrentLead | null>(null);
  const [nextLead, setNextLead] = useState<CurrentLead | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [callId, setCallId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [qualificationNotes, setQualificationNotes] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [agentStatus, setAgentStatus] = useState<"online" | "paused" | "offline">("offline");
  const [agentStats, setAgentStats] = useState({ calls: 0, qualified: 0, talkTime: 0 });
  const [testPhone, setTestPhone] = useState("+5531997441277");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{success:boolean; message:string}|null>(null);

  const handleTestCall = async () => {
    setTestLoading(true); setTestResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${EDGE_BASE}/initiate-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({ company_id: collaborator?.company_id, test_mode: true, test_phone: testPhone }),
      });
      const data = await res.json();
      setTestResult(res.ok
        ? { success: true, message: `✅ Ligação iniciada! UUID: ${data.freeswitch_uuid?.slice(0,8)}...` }
        : { success: false, message: `❌ ${data.error || "falha"}` });
    } catch(e:any) { setTestResult({ success: false, message: `❌ ${e.message}` }); }
    finally { setTestLoading(false); }
  };

  // Timer
  useEffect(() => {
    if (callStatus !== "in_call") return;
    const interval = setInterval(() => setCallDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [callStatus]);

  // Load campaigns
  useEffect(() => {
    const load = async () => {
      const companyId = collaborator?.company_id;
      if (!companyId) return;
      const { data } = await supabase.from("campaigns").select("id, name").eq("company_id", companyId).in("status", ["active", "paused"]);
      setCampaigns((data ?? []).map((c: any) => ({ id: c.id, name: c.name })));
    };
    load();
  }, [collaborator]);

  // Realtime subscription on calls
  useEffect(() => {
    if (!callId) return;
    const channel = supabase
      .channel(`call-${callId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "calls", filter: `id=eq.${callId}` }, (payload) => {
        const updated = payload.new as any;
        if (updated.ai_transcript) {
          try {
            const parsed = JSON.parse(updated.ai_transcript);
            if (Array.isArray(parsed)) setTranscript(parsed);
          } catch { /* ignore */ }
        }
        if (updated.status === "completed" || updated.status === "ended") {
          setCallStatus("ended");
          toast.info("Ligação encerrada. Classifique o lead.");
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [callId]);

  const fetchNextLead = useCallback(async () => {
    if (!selectedCampaign || !collaborator?.company_id) return;
    const { data, error } = await supabase.rpc("get_next_lead_to_dial", {
      p_company_id: collaborator.company_id,
      p_campaign_id: selectedCampaign,
    } as any);
    if (error) { console.error(error); return; }
    const lead = Array.isArray(data) ? data[0] : data;
    if (lead) {
      setNextLead({ queue_id: lead.queue_id, lead_id: lead.lead_id, name: lead.lead_name ?? "Sem nome", phone: lead.lead_phone ?? "" });
    } else {
      setNextLead(null);
      toast.info("Nenhum lead na fila desta campanha.");
    }
  }, [selectedCampaign, collaborator]);

  const startCall = async () => {
    const lead = currentLead || nextLead;
    if (!lead) { toast.error("Nenhum lead na fila."); return; }
    setCurrentLead(lead);
    setCallStatus("dialing");
    setCallDuration(0);
    setTranscript([]);
    setQualificationNotes("");

    // Create call record in Supabase
    const { data: callData, error } = await supabase.from("calls").insert({
      company_id: collaborator?.company_id,
      campaign_id: selectedCampaign || null,
      lead_id: lead.lead_id,
      destination_number: lead.phone,
      status: "initiated",
      started_at: new Date().toISOString(),
    } as any).select("id").single();

    if (error) { console.error(error); toast.error("Erro ao iniciar ligação."); setCallStatus("idle"); return; }
    setCallId(callData.id);

    // Initiate real call via luxsales-dialer
    try {
      const res = await fetch(`${DIALER_URL}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: lead.phone.startsWith("+") ? lead.phone : `+55${lead.phone.replace(/\D/g, "")}`,
          from: "+18155950103",
          system_prompt: `Você é Lucas, vendedor IA da Objetivo Proteção Veicular. Fale em português brasileiro natural. Respostas de 2-4 frases. Seja educado e direto.`,
          opening_script: "Boa tarde! Meu nome é Lucas da Objetivo Proteção Veicular. Tudo bem com você?",
          supabase_call_id: callData.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error("Erro Telnyx: " + (data.error || "falha")); setCallStatus("idle"); return; }
      toast.info("Discando...");
      setCallStatus("ringing");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao conectar no dialer: " + err.message);
      setCallStatus("idle");
      return;
    }
    await fetchNextLead();
  };

  const hangUp = async () => {
    if (callId) {
      await supabase.from("calls").update({ status: "completed", ended_at: new Date().toISOString(), duration_seconds: callDuration } as any).eq("id", callId);
    }
    setCallStatus("ended");
    toast.info("Ligação encerrada. Classifique o lead.");
  };

  const classifyLead = async (qualification: Qualification) => {
    if (callId) {
      await supabase.rpc("complete_call", {
        p_call_id: callId,
        p_status: "completed",
        p_duration: callDuration,
        p_ai_qualification: qualification,
        p_ai_summary: qualificationNotes || null,
      } as any);
    }
    const labels: Record<Qualification, string> = { hot: "HOT", warm: "WARM", cold: "COLD", not_qualified: "N/Q" };
    toast.success(`Lead classificado como ${labels[qualification]}`);
    setAgentStats(s => ({ ...s, calls: s.calls + 1, qualified: s.qualified + (qualification === "hot" ? 1 : 0), talkTime: s.talkTime + callDuration }));
    setCallStatus("idle");
    setCurrentLead(null);
    setCallId(null);
    setCallDuration(0);
  };

  const toggleAgentStatus = () => {
    if (agentStatus === "offline") { setAgentStatus("online"); toast.success("Você está online."); }
    else if (agentStatus === "online") { setAgentStatus("paused"); toast.info("Pausado."); }
    else { setAgentStatus("offline"); toast.info("Offline."); }
  };

  if (roleLevel > 3) {
    return (
      <DashboardLayout>
        <Card className="border-border/60 bg-card"><CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-4 text-center">
          <ShieldAlert className="h-10 w-10 text-primary" /><h1 className="text-xl font-semibold">Acesso restrito</h1>
        </CardContent></Card>
      </DashboardLayout>
    );
  }

  const statusColors: Record<CallStatus, string> = {
    idle: "bg-muted text-muted-foreground", dialing: "bg-yellow-500/20 text-yellow-400 animate-pulse",
    ringing: "bg-yellow-500/20 text-yellow-400 animate-pulse", in_call: "bg-emerald-500/20 text-emerald-400", ended: "bg-blue-500/20 text-blue-400",
  };
  const statusLabels: Record<CallStatus, string> = { idle: "Aguardando", dialing: "Discando...", ringing: "Chamando...", in_call: "Em Ligação", ended: "Encerrada" };
  const agentColors: Record<string, string> = { online: "bg-emerald-500", paused: "bg-yellow-500", offline: "bg-red-500" };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader title="Discador" subtitle="Faça ligações e qualifique leads em tempo real"
          badge={<div className="flex items-center gap-2"><div className={`h-2.5 w-2.5 rounded-full ${agentColors[agentStatus]}`} /><span className="text-xs text-muted-foreground capitalize">{agentStatus}</span></div>}>
          <div className="flex items-center gap-2">
            <Select value={selectedCampaign} onValueChange={v => { setSelectedCampaign(v); }}>
              <SelectTrigger className="w-[200px] h-9 text-xs"><SelectValue placeholder="Selecionar campanha" /></SelectTrigger>
              <SelectContent>{campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant={agentStatus === "online" ? "default" : "outline"} size="sm" onClick={toggleAgentStatus}>
              {agentStatus === "online" ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
              {agentStatus === "online" ? "Pausar" : agentStatus === "paused" ? "Retomar" : "Ficar Online"}
            </Button>
          </div>
        </PageHeader>

        {roleLevel <= 1 && (
          <Card className="border-yellow-500/30 bg-yellow-500/5 mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-yellow-400">
                <TestTube className="h-4 w-4" /> Teste de Ligação
              </CardTitle>
              <CardDescription className="text-xs">Testa o pipeline de voz IA</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input placeholder="+5531997441277" value={testPhone} onChange={e => setTestPhone(e.target.value)} className="h-8 text-sm" />
                <Button size="sm" variant="outline" className="border-yellow-500/50 text-yellow-400" onClick={handleTestCall} disabled={testLoading || !testPhone}>
                  {testLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Phone className="h-3 w-3" />}
                  <span className="ml-1">{testLoading ? "Ligando..." : "Testar"}</span>
                </Button>
              </div>
              {testResult && <p className={`text-xs mt-2 ${testResult.success ? "text-green-400" : "text-red-400"}`}>{testResult.message}</p>}
            </CardContent>
          </Card>
        )}

          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            <Card className="border-border/60 bg-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <Badge className={`px-4 py-1.5 text-sm font-medium ${statusColors[callStatus]}`}>{statusLabels[callStatus]}</Badge>
                  {callStatus === "in_call" && (
                    <div className="flex items-center gap-2 text-emerald-400"><Clock className="h-4 w-4" /><span className="text-lg font-mono font-bold">{formatDuration(callDuration)}</span></div>
                  )}
                </div>
                {currentLead ? (
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center"><User className="h-6 w-6 text-primary" /></div>
                      <div><p className="text-lg font-semibold text-foreground">{currentLead.name}</p><p className="text-sm text-muted-foreground">{formatPhone(currentLead.phone)}</p></div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground"><Phone className="h-12 w-12 mx-auto mb-3 opacity-30" /><p className="text-sm">Selecione uma campanha e busque leads</p></div>
                )}
                <div className="flex gap-3">
                  {callStatus === "idle" && (
                    <>
                      <Button size="lg" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-14 text-lg" onClick={startCall} disabled={!selectedCampaign || agentStatus !== "online" || (!currentLead && !nextLead)}>
                        <Phone className="h-5 w-5 mr-2" />LIGAR
                      </Button>
                      <Button variant="outline" size="lg" className="h-14" onClick={fetchNextLead} disabled={!selectedCampaign}><SkipForward className="h-5 w-5" /></Button>
                    </>
                  )}
                  {(callStatus === "dialing" || callStatus === "ringing" || callStatus === "in_call") && (
                    <Button size="lg" variant="destructive" className="flex-1 h-14 text-lg" onClick={hangUp}><PhoneOff className="h-5 w-5 mr-2" />DESLIGAR</Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {callStatus === "ended" && (
              <Card className="border-border/60 bg-card border-primary/30">
                <CardHeader><CardTitle className="text-base">Classificar Lead</CardTitle><CardDescription>Como você qualifica este lead?</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Button className="h-16 bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30" variant="outline" onClick={() => classifyLead("hot")}><Flame className="h-5 w-5 mr-2" />HOT</Button>
                    <Button className="h-16 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30" variant="outline" onClick={() => classifyLead("warm")}><Sun className="h-5 w-5 mr-2" />WARM</Button>
                    <Button className="h-16 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30" variant="outline" onClick={() => classifyLead("cold")}><Snowflake className="h-5 w-5 mr-2" />COLD</Button>
                    <Button className="h-16 bg-muted/50 text-muted-foreground hover:bg-muted/70" variant="outline" onClick={() => classifyLead("not_qualified")}><ThumbsDown className="h-5 w-5 mr-2" />N/Q</Button>
                  </div>
                  <Textarea placeholder="Notas sobre a ligação (opcional)..." value={qualificationNotes} onChange={e => setQualificationNotes(e.target.value)} className="min-h-[80px]" />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <Card className="border-border/60 bg-card">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" />Transcript IA</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px] overflow-y-auto space-y-3 p-3 rounded-lg bg-secondary/20">
                  {transcript.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      {callStatus === "in_call" ? "Aguardando transcrição em tempo real..." : "O transcript aparecerá aqui durante a ligação"}
                    </div>
                  ) : transcript.map((entry, i) => (
                    <div key={i} className={`flex ${entry.role === "ai" ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[80%] rounded-xl px-4 py-2 text-sm ${entry.role === "ai" ? "bg-primary/10" : "bg-emerald-500/10"}`}>
                        <p className="text-[10px] text-muted-foreground mb-1">{entry.role === "ai" ? "IA" : "Lead"}</p>
                        <p>{entry.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card">
              <CardHeader><CardTitle className="text-base">Próximo na Fila</CardTitle></CardHeader>
              <CardContent>
                {nextLead ? (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center"><User className="h-5 w-5 text-muted-foreground" /></div>
                    <div><p className="text-sm font-medium">{nextLead.name}</p><p className="text-xs text-muted-foreground">{nextLead.phone ? formatPhone(nextLead.phone) : "—"}</p></div>
                  </div>
                ) : <p className="text-sm text-muted-foreground text-center py-4">Nenhum lead na fila</p>}
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card">
              <CardHeader><CardTitle className="text-base">Suas Estatísticas Hoje</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center"><p className="text-2xl font-bold text-foreground">{agentStats.calls}</p><p className="text-xs text-muted-foreground">Ligações</p></div>
                  <div className="text-center"><p className="text-2xl font-bold text-emerald-400">{agentStats.qualified}</p><p className="text-xs text-muted-foreground">Qualificados</p></div>
                  <div className="text-center"><p className="text-2xl font-bold text-foreground">{formatDuration(agentStats.talkTime)}</p><p className="text-xs text-muted-foreground">Tempo Total</p></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
