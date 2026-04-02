import { useEffect, useState, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { EDGE_BASE, SUPABASE_ANON_KEY } from "@/lib/constants";
import { toast } from "sonner";
import {
  Loader2, Phone, PhoneOff, Volume2,
  AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp,
  MessageSquare, ThumbsUp, ThumbsDown, Minus,
} from "lucide-react";

import { resolveCompanyRequired } from "@/lib/companyFilter";

interface TranscriptTurn {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

interface RecentCall {
  id: string;
  freeswitch_uuid: string | null;
  destination_number: string | null;
  status: string;
  duration_seconds: number | null;
  talk_time_seconds: number | null;
  created_at: string;
  hangup_cause: string | null;
  transcript: string | null;
  ai_summary: string | null;
  sentiment: string | null;
  interest_detected: boolean;
  lead_name: string | null;
}

// Headers padrão para orchestrator-proxy
const proxyHeaders = {
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  "apikey": SUPABASE_ANON_KEY,
};

export default function VoiceSimulate() {
  const { collaborator } = useCollaborator();
  const { selectedCompanyId } = useCompanyFilter();
  const companyId = resolveCompanyRequired(selectedCompanyId, collaborator?.company_id);

  const [inCall, setInCall] = useState(false);
  const [callTimer, setCallTimer] = useState(0);
  const [phoneNumber, setPhoneNumber] = useState("5531997441277");

  // Pipeline
  const [pipelineOnline, setPipelineOnline] = useState<boolean | null>(null);

  // Live transcript (from Supabase Realtime)
  const [liveTurns, setLiveTurns] = useState<TranscriptTurn[]>([]);
  const [systemMessages, setSystemMessages] = useState<string[]>([]);

  // Recent calls
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [expandedCall, setExpandedCall] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const realtimeRef = useRef<any>(null);

  // ── Recent calls fetch ──
  useEffect(() => {
    const fetchCalls = async () => {
      const { data } = await supabase
        .from("calls")
        .select("id, freeswitch_uuid, destination_number, status, duration_seconds, talk_time_seconds, created_at, hangup_cause, transcript, ai_summary, sentiment, interest_detected, lead_name")
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) setRecentCalls(data as RecentCall[]);
    };
    fetchCalls();
    const interval = setInterval(fetchCalls, 5000);
    return () => clearInterval(interval);
  }, []);

  // ── Health check ──
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${EDGE_BASE}/orchestrator-proxy?path=${encodeURIComponent("/health")}`, {
        headers: proxyHeaders,
        signal: AbortSignal.timeout(5000),
      });
      setPipelineOnline(res.ok);
    } catch {
      setPipelineOnline(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const iv = setInterval(checkHealth, 60000);
    return () => clearInterval(iv);
  }, [checkHealth]);

  // ── Auto-scroll transcript ──
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [liveTurns, systemMessages]);

  const addSystem = useCallback((text: string) => {
    setSystemMessages((prev) => [...prev, `${new Date().toLocaleTimeString("pt-BR")} — ${text}`]);
  }, []);

  // ── Supabase Realtime subscription for live transcript ──
  const subscribeToCall = useCallback((callUuid: string) => {
    // Unsubscribe previous
    if (realtimeRef.current) {
      supabase.removeChannel(realtimeRef.current);
    }

    const channel = supabase
      .channel(`call-${callUuid}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "calls",
          filter: `freeswitch_uuid=eq.${callUuid}`,
        },
        (payload: any) => {
          const row = payload.new;
          // Parse transcript JSON
          if (row.transcript) {
            try {
              const turns = typeof row.transcript === "string"
                ? JSON.parse(row.transcript)
                : row.transcript;
              if (Array.isArray(turns)) {
                setLiveTurns(turns as TranscriptTurn[]);
              }
            } catch {}
          }
          // Check if call ended
          if (row.status === "completed" || row.status === "no_answer") {
            addSystem(`📵 Chamada ${row.status === "completed" ? "concluída" : "sem resposta"}`);
          }
        }
      )
      .subscribe();

    realtimeRef.current = channel;
  }, [addSystem]);

  // ── VoIP call logic ──
  const voipCallUuidRef = useRef<string | null>(null);
  const voipPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const endVoipCall = useCallback(async (reason?: string) => {
    if (voipCallUuidRef.current) {
      try {
        await fetch(`${EDGE_BASE}/orchestrator-proxy`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...proxyHeaders },
          body: JSON.stringify({ _path: "/hangup", uuid: voipCallUuidRef.current }),
          signal: AbortSignal.timeout(5000),
        });
      } catch {}
    }

    voipCallUuidRef.current = null;
    if (voipPollRef.current) { clearInterval(voipPollRef.current); voipPollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (realtimeRef.current) { supabase.removeChannel(realtimeRef.current); realtimeRef.current = null; }
    setInCall(false);
    addSystem(`📵 ${reason || "Chamada encerrada"}`);
  }, [addSystem]);

  const startVoipCall = useCallback(async () => {
    if (!phoneNumber || phoneNumber.replace(/\D/g, "").length < 10) {
      toast.error("Informe um número válido com DDD");
      return;
    }

    setInCall(true);
    setCallTimer(0);
    setLiveTurns([]);
    setSystemMessages([]);
    timerRef.current = setInterval(() => setCallTimer((p) => p + 1), 1000);
    addSystem("📞 Originando chamada via pipeline VoIP...");

    try {
      const res = await fetch(`${EDGE_BASE}/orchestrator-proxy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...proxyHeaders },
        body: JSON.stringify({
          _path: "/call",
          to: phoneNumber.replace(/\D/g, ""),
          company_id: companyId,
        }),
        signal: AbortSignal.timeout(20000),
      });

      const data = await res.json();
      if (data.success && data.uuid) {
        voipCallUuidRef.current = data.uuid;
        addSystem(`✅ Chamada originada: ${data.destination}`);

        // Subscribe to real-time transcript updates
        subscribeToCall(data.uuid);

        // Status tracking via Supabase Realtime (no polling needed)
        voipPollRef.current = null;
      } else {
        addSystem(`❌ Erro: ${data.error || "Falha ao originar"}`);
        endVoipCall("Falha ao originar chamada");
      }
    } catch (err: any) {
      addSystem(`❌ Pipeline indisponível: ${err.message}`);
      endVoipCall("Pipeline offline");
    }
  }, [phoneNumber, companyId, addSystem, endVoipCall, subscribeToCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);
    };
  }, []);

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m${s.toString().padStart(2, "0")}s`;
  };

  const formatTimestamp = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const renderStatusBadge = (call: RecentCall) => {
    const { status, hangup_cause, talk_time_seconds, duration_seconds } = call;
    const dur = talk_time_seconds || duration_seconds;
    if (status === "ringing" || status === "calling") {
      return <Badge className="gap-1 bg-yellow-500/15 text-yellow-400 border-yellow-500/30">Chamando...</Badge>;
    }
    if (status === "answered") {
      return <Badge className="gap-1 bg-blue-500/15 text-blue-400 border-blue-500/30">Em chamada</Badge>;
    }
    if (status === "completed") {
      return (
        <Badge className="gap-1 bg-green-500/15 text-green-500 border-green-500/30">
          Concluída · {formatDuration(dur)}
        </Badge>
      );
    }
    if (status === "no_answer") {
      return <Badge variant="outline" className="gap-1 text-muted-foreground">Sem resposta</Badge>;
    }
    const cause = hangup_cause || status || "Encerrada";
    return <Badge variant="outline" className="gap-1 text-muted-foreground">{cause}</Badge>;
  };

  const sentimentIcon = (s: string | null) => {
    if (!s) return null;
    const sl = s.toLowerCase();
    if (sl.includes("positiv") || sl.includes("interest")) return <ThumbsUp className="h-3.5 w-3.5 text-green-400" />;
    if (sl.includes("negativ") || sl.includes("desinteress")) return <ThumbsDown className="h-3.5 w-3.5 text-red-400" />;
    return <Minus className="h-3.5 w-3.5 text-gray-400" />;
  };

  const parseTranscript = (raw: string | null): TranscriptTurn[] => {
    if (!raw) return [];
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Ligação VoIP</h1>
          <div>
            {pipelineOnline === null ? (
              <Badge variant="outline" className="gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Verificando pipeline...
              </Badge>
            ) : pipelineOnline ? (
              <Badge className="gap-1.5 bg-green-500/15 text-green-500 border-green-500/30">
                <CheckCircle className="h-3 w-3" /> Pipeline Online
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1.5 text-muted-foreground">
                <XCircle className="h-3 w-3" /> Pipeline Offline
              </Badge>
            )}
          </div>
        </div>

        {/* Main area */}
        <div className="flex gap-4" style={{ minHeight: 550 }}>
          {/* Left panel: dialer */}
          <div className="w-[320px] shrink-0 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Discador
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="(31) 99744-1277"
                  disabled={inCall}
                />
                {!inCall ? (
                  <Button
                    className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                    disabled={!pipelineOnline}
                    onClick={startVoipCall}
                  >
                    <Phone className="h-4 w-4" />
                    {pipelineOnline ? "Ligar Agora" : "Pipeline Offline"}
                  </Button>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <Badge className="gap-1 bg-green-500/15 text-green-500 border-green-500/30 animate-pulse">
                        <Phone className="h-3 w-3" /> Em chamada
                      </Badge>
                      <span className="font-mono text-lg font-bold">{formatTimer(callTimer)}</span>
                    </div>
                    <Button
                      className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white"
                      onClick={() => endVoipCall("Chamada encerrada pelo operador")}
                    >
                      <PhoneOff className="h-4 w-4" /> Desligar
                    </Button>
                  </>
                )}
                {!pipelineOnline && !inCall && (
                  <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>Pipeline VoIP offline. Verifique o servidor.</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right panel: transcript */}
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="pb-2 shrink-0">
              <CardTitle className="text-base flex items-center gap-2">
                <Volume2 className="h-4 w-4" /> Transcrição em Tempo Real
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <div
                ref={scrollRef}
                className="overflow-y-auto px-4 py-3 space-y-2"
                style={{ height: 500, background: "#0d0d14", borderRadius: "0 0 8px 8px" }}
              >
                {liveTurns.length === 0 && systemMessages.length === 0 ? (
                  <p className="text-center text-sm text-gray-500 pt-10">Aguardando chamada...</p>
                ) : (
                  <>
                    {systemMessages.map((msg, i) => (
                      <div key={`sys-${i}`} className="text-center">
                        <span className="text-xs text-gray-500">{msg}</span>
                      </div>
                    ))}
                    {liveTurns.map((turn, i) => {
                      const isLead = turn.role === "user";
                      const ts = turn.timestamp ? new Date(turn.timestamp * 1000).toLocaleTimeString("pt-BR") : "";
                      return (
                        <div key={i} className={`flex ${isLead ? "justify-end" : "justify-start"}`}>
                          <div
                            className="max-w-[75%] rounded-xl px-3 py-2 text-sm"
                            style={{
                              background: isLead ? "#1a7a4c" : "#3b2d7a",
                              color: "#e5e7eb",
                            }}
                          >
                            <div className="text-[10px] opacity-60 mb-0.5">
                              {isLead ? "👤 Lead" : "🤖 Lucas"} · {ts}
                            </div>
                            <p className="whitespace-pre-wrap">{turn.text}</p>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent calls with expandable analysis */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4" /> Chamadas Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentCalls.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma chamada registrada.</p>
            ) : (
              <div className="space-y-2">
                {recentCalls.map((call) => {
                  const isExpanded = expandedCall === call.id;
                  const turns = parseTranscript(call.transcript);
                  const hasAnalysis = call.ai_summary || call.sentiment || turns.length > 0;

                  return (
                    <div key={call.id} className="rounded-lg border border-border overflow-hidden">
                      <div
                        className={`flex items-center justify-between px-3 py-2 text-sm ${hasAnalysis ? "cursor-pointer hover:bg-muted/30" : ""}`}
                        onClick={() => hasAnalysis && setExpandedCall(isExpanded ? null : call.id)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-muted-foreground">{call.destination_number || "—"}</span>
                          {call.lead_name && <span className="text-xs text-muted-foreground">({call.lead_name})</span>}
                          {renderStatusBadge(call)}
                          {call.interest_detected && (
                            <Badge className="gap-1 bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
                              Interesse
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {sentimentIcon(call.sentiment)}
                          <span className="text-xs text-muted-foreground">{formatTimestamp(call.created_at)}</span>
                          {hasAnalysis && (
                            isExpanded
                              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-border px-3 py-3 space-y-3 bg-muted/10">
                          {/* AI Summary */}
                          {call.ai_summary && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">📋 Resumo IA</p>
                              <p className="text-sm">{call.ai_summary}</p>
                            </div>
                          )}

                          {/* Sentiment */}
                          {call.sentiment && (
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-medium text-muted-foreground">🎭 Sentimento:</p>
                              <span className="text-sm">{call.sentiment}</span>
                            </div>
                          )}

                          {/* Transcript */}
                          {turns.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" /> Transcrição ({turns.length} turnos)
                              </p>
                              <div className="space-y-1.5 max-h-[300px] overflow-y-auto rounded-md p-2" style={{ background: "#0d0d14" }}>
                                {turns.map((turn, i) => {
                                  const isLead = turn.role === "user";
                                  return (
                                    <div key={i} className={`flex ${isLead ? "justify-end" : "justify-start"}`}>
                                      <div
                                        className="max-w-[80%] rounded-lg px-2.5 py-1.5 text-xs"
                                        style={{
                                          background: isLead ? "#1a7a4c" : "#3b2d7a",
                                          color: "#e5e7eb",
                                        }}
                                      >
                                        <span className="opacity-50 text-[9px]">{isLead ? "Lead" : "Lucas"}</span>
                                        <p className="whitespace-pre-wrap">{turn.text}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
