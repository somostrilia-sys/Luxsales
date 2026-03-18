import { useEffect, useState, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Phone, PhoneOff, Loader2, Clock, User, MessageSquare,
  ThumbsUp, ThumbsDown, Flame, Snowflake, Sun,
  ShieldAlert, SkipForward, Pause, Play, Volume2,
} from "lucide-react";

type CallStatus = "idle" | "dialing" | "ringing" | "in_call" | "ended";
type Qualification = "hot" | "warm" | "cold" | "not_qualified";

type CurrentLead = {
  queue_id: string;
  lead_id: string;
  name: string;
  phone: string;
  campaign_name?: string;
  attempts?: number;
  custom_fields?: Record<string, string>;
};

type TranscriptEntry = {
  role: "ai" | "lead";
  text: string;
  timestamp: string;
};

const formatPhone = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  if (d.length <= 2) return d;
  if (d.length <= 4) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 9) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
};

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

export default function Discador() {
  const { collaborator, roleLevel } = useCollaborator();
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [currentLead, setCurrentLead] = useState<CurrentLead | null>(null);
  const [nextLead, setNextLead] = useState<CurrentLead | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [callId, setCallId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [qualificationNotes, setQualificationNotes] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [campaigns, setCampaigns] = useState<{ id: string; name: string; ai_enabled?: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentStatus, setAgentStatus] = useState<"online" | "paused" | "offline">("offline");

  // Timer
  useEffect(() => {
    if (callStatus !== "in_call") return;
    const interval = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [callStatus]);

  // Load campaigns
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.from("call_campaigns").select("id, name");
      setCampaigns((data ?? []).map((c: any) => ({ id: c.id, name: c.name })));
      setLoading(false);
    };
    load();
  }, []);

  const fetchNextLead = useCallback(async () => {
    if (!selectedCampaign) return;
    // Simulated - in production this calls the RPC get_next_lead_to_dial
    setNextLead({
      queue_id: crypto.randomUUID(),
      lead_id: crypto.randomUUID(),
      name: "Aguardando fila...",
      phone: "",
    });
  }, [selectedCampaign]);

  const startCall = async () => {
    if (!currentLead && !nextLead) {
      toast.error("Nenhum lead na fila. Selecione uma campanha ativa.");
      return;
    }

    const lead = currentLead || nextLead;
    if (!lead) return;

    setCurrentLead(lead);
    setCallStatus("dialing");
    setCallDuration(0);
    setTranscript([]);
    setQualificationNotes("");

    // Simulate call progression
    setTimeout(() => setCallStatus("ringing"), 1000);
    setTimeout(() => {
      setCallStatus("in_call");
      setCallId(crypto.randomUUID());
      toast.success("Ligação conectada!");
    }, 3000);
  };

  const hangUp = async () => {
    setCallStatus("ended");
    toast.info("Ligação encerrada. Classifique o lead.");
  };

  const classifyLead = async (qualification: Qualification) => {
    const labels: Record<Qualification, string> = {
      hot: "HOT - Qualificado",
      warm: "WARM - Morno",
      cold: "COLD - Frio",
      not_qualified: "Não Qualificado",
    };

    toast.success(`Lead classificado como ${labels[qualification]}`);
    setCallStatus("idle");
    setCurrentLead(null);
    setCallId(null);
    setCallDuration(0);
    await fetchNextLead();
  };

  const toggleAgentStatus = () => {
    if (agentStatus === "offline") {
      setAgentStatus("online");
      toast.success("Você está online e pronto para discagem.");
    } else if (agentStatus === "online") {
      setAgentStatus("paused");
      toast.info("Pausado. Nenhuma ligação será atribuída.");
    } else {
      setAgentStatus("offline");
      toast.info("Offline.");
    }
  };

  if (roleLevel > 3) {
    return (
      <DashboardLayout>
        <Card className="border-border/60 bg-card">
          <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-4 text-center">
            <ShieldAlert className="h-10 w-10 text-primary" />
            <div className="space-y-1">
              <h1 className="text-xl font-semibold text-foreground">Acesso restrito</h1>
              <p className="text-sm text-muted-foreground">Você não tem permissão para acessar o discador.</p>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const statusColors: Record<CallStatus, string> = {
    idle: "bg-muted text-muted-foreground",
    dialing: "bg-yellow-500/20 text-yellow-400 animate-pulse",
    ringing: "bg-yellow-500/20 text-yellow-400 animate-pulse",
    in_call: "bg-emerald-500/20 text-emerald-400",
    ended: "bg-blue-500/20 text-blue-400",
  };

  const statusLabels: Record<CallStatus, string> = {
    idle: "Aguardando",
    dialing: "Discando...",
    ringing: "Chamando...",
    in_call: "Em Ligação",
    ended: "Encerrada",
  };

  const agentColors: Record<string, string> = {
    online: "bg-emerald-500",
    paused: "bg-yellow-500",
    offline: "bg-red-500",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Discador"
          subtitle="Tela de operação — Faça ligações e qualifique leads em tempo real"
          badge={
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${agentColors[agentStatus]}`} />
              <span className="text-xs text-muted-foreground capitalize">{agentStatus}</span>
            </div>
          }
        >
          <div className="flex items-center gap-2">
            <Select value={selectedCampaign} onValueChange={(v) => { setSelectedCampaign(v); fetchNextLead(); }}>
              <SelectTrigger className="w-[200px] h-9 text-xs">
                <SelectValue placeholder="Selecionar campanha" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant={agentStatus === "online" ? "default" : "outline"} size="sm" onClick={toggleAgentStatus}>
              {agentStatus === "online" ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
              {agentStatus === "online" ? "Pausar" : agentStatus === "paused" ? "Retomar" : "Ficar Online"}
            </Button>
          </div>
        </PageHeader>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          {/* Coluna Esquerda - Controle de Ligação */}
          <div className="space-y-4">
            {/* Status da Ligação */}
            <Card className="border-border/60 bg-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <Badge className={`px-4 py-1.5 text-sm font-medium ${statusColors[callStatus]}`}>
                    {statusLabels[callStatus]}
                  </Badge>
                  {callStatus === "in_call" && (
                    <div className="flex items-center gap-2 text-emerald-400">
                      <Clock className="h-4 w-4" />
                      <span className="text-lg font-mono font-bold">{formatDuration(callDuration)}</span>
                    </div>
                  )}
                </div>

                {/* Lead Atual */}
                {currentLead ? (
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-foreground">{currentLead.name}</p>
                        <p className="text-sm text-muted-foreground">{formatPhone(currentLead.phone)}</p>
                      </div>
                    </div>
                    {currentLead.campaign_name && (
                      <Badge variant="outline" className="text-xs">{currentLead.campaign_name}</Badge>
                    )}
                    {currentLead.attempts !== undefined && (
                      <p className="text-xs text-muted-foreground">Tentativas anteriores: {currentLead.attempts}</p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Phone className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Selecione uma campanha e clique em LIGAR</p>
                  </div>
                )}

                {/* Botões de Ação */}
                <div className="flex gap-3">
                  {callStatus === "idle" && (
                    <Button
                      size="lg"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-14 text-lg"
                      onClick={startCall}
                      disabled={!selectedCampaign || agentStatus !== "online"}
                    >
                      <Phone className="h-5 w-5 mr-2" />
                      LIGAR
                    </Button>
                  )}
                  {(callStatus === "dialing" || callStatus === "ringing" || callStatus === "in_call") && (
                    <Button
                      size="lg"
                      variant="destructive"
                      className="flex-1 h-14 text-lg"
                      onClick={hangUp}
                    >
                      <PhoneOff className="h-5 w-5 mr-2" />
                      DESLIGAR
                    </Button>
                  )}
                  {callStatus === "idle" && (
                    <Button variant="outline" size="lg" className="h-14" onClick={fetchNextLead}>
                      <SkipForward className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Classificação pós-ligação */}
            {callStatus === "ended" && (
              <Card className="border-border/60 bg-card border-primary/30">
                <CardHeader>
                  <CardTitle className="text-base">Classificar Lead</CardTitle>
                  <CardDescription>Como você qualifica este lead?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      className="h-16 bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                      variant="outline"
                      onClick={() => classifyLead("hot")}
                    >
                      <Flame className="h-5 w-5 mr-2" />
                      HOT
                    </Button>
                    <Button
                      className="h-16 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30"
                      variant="outline"
                      onClick={() => classifyLead("warm")}
                    >
                      <Sun className="h-5 w-5 mr-2" />
                      WARM
                    </Button>
                    <Button
                      className="h-16 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30"
                      variant="outline"
                      onClick={() => classifyLead("cold")}
                    >
                      <Snowflake className="h-5 w-5 mr-2" />
                      COLD
                    </Button>
                    <Button
                      className="h-16 bg-muted/50 text-muted-foreground hover:bg-muted/70"
                      variant="outline"
                      onClick={() => classifyLead("not_qualified")}
                    >
                      <ThumbsDown className="h-5 w-5 mr-2" />
                      N/Q
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Notas sobre a ligação (opcional)..."
                      value={qualificationNotes}
                      onChange={(e) => setQualificationNotes(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Coluna Direita - Transcript IA / Próximo Lead */}
          <div className="space-y-4">
            {/* Transcript IA */}
            <Card className="border-border/60 bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Transcript IA
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] overflow-y-auto space-y-3 p-3 rounded-lg bg-secondary/20">
                  {transcript.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      {callStatus === "in_call"
                        ? "Aguardando transcrição em tempo real..."
                        : "O transcript aparecerá aqui durante a ligação"}
                    </div>
                  ) : (
                    transcript.map((entry, i) => (
                      <div key={i} className={`flex ${entry.role === "ai" ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[80%] rounded-xl px-4 py-2 text-sm ${
                          entry.role === "ai"
                            ? "bg-primary/10 text-foreground"
                            : "bg-emerald-500/10 text-foreground"
                        }`}>
                          <p className="text-[10px] text-muted-foreground mb-1">{entry.role === "ai" ? "IA" : "Lead"}</p>
                          <p>{entry.text}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Próximo na Fila */}
            <Card className="border-border/60 bg-card">
              <CardHeader>
                <CardTitle className="text-base">Próximo na Fila</CardTitle>
              </CardHeader>
              <CardContent>
                {nextLead ? (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{nextLead.name}</p>
                      <p className="text-xs text-muted-foreground">{nextLead.phone ? formatPhone(nextLead.phone) : "Carregando..."}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum lead na fila</p>
                )}
              </CardContent>
            </Card>

            {/* Estatísticas do Agente */}
            <Card className="border-border/60 bg-card">
              <CardHeader>
                <CardTitle className="text-base">Suas Estatísticas Hoje</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">0</p>
                    <p className="text-xs text-muted-foreground">Ligações</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-400">0</p>
                    <p className="text-xs text-muted-foreground">Qualificados</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">00:00</p>
                    <p className="text-xs text-muted-foreground">Tempo Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
