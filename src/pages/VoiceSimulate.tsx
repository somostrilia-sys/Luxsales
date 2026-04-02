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
  AlertTriangle, CheckCircle, XCircle,
} from "lucide-react";

import { resolveCompanyRequired } from "@/lib/companyFilter";

interface TranscriptEntry {
  type: "lead" | "ai" | "system";
  text: string;
  ts: string;
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
}

// Headers padrão para orchestrator-proxy (sempre anon key)
const proxyHeaders = {
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  "apikey": SUPABASE_ANON_KEY,
};

export default function VoiceSimulate() {
  const { collaborator } = useCollaborator();
  const { selectedCompanyId } = useCompanyFilter();
  const companyId = resolveCompanyRequired(selectedCompanyId, collaborator?.company_id);

  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [inCall, setInCall] = useState(false);
  const [callTimer, setCallTimer] = useState(0);
  const [phoneNumber, setPhoneNumber] = useState("5531997441277");

  // Pipeline
  const [pipelineOnline, setPipelineOnline] = useState<boolean | null>(null);

  // Recent calls
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Recent calls fetch ──
  useEffect(() => {
    const fetchCalls = async () => {
      const { data } = await supabase
        .from("calls")
        .select("id, freeswitch_uuid, destination_number, status, duration_seconds, talk_time_seconds, created_at, hangup_cause")
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
  }, [transcript]);

  const addSystem = useCallback((text: string) => {
    setTranscript((prev) => [...prev, { type: "system", text, ts: new Date().toLocaleTimeString("pt-BR") }]);
  }, []);

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
    setTranscript([]);
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

        voipPollRef.current = setInterval(async () => {
          try {
            const pollRes = await fetch(`${EDGE_BASE}/orchestrator-proxy?path=${encodeURIComponent("/calls")}`, {
              headers: proxyHeaders,
              signal: AbortSignal.timeout(5000),
            });
            const calls = await pollRes.json();
            const myCall = Array.isArray(calls) ? calls.find((c: any) => c.uuid === voipCallUuidRef.current) : null;

            if (!myCall && voipCallUuidRef.current) {
              endVoipCall("Chamada encerrada pelo servidor");
            }
          } catch {}
        }, 3000);
      } else {
        addSystem(`❌ Erro: ${data.error || "Falha ao originar"}`);
        endVoipCall("Falha ao originar chamada");
      }
    } catch (err: any) {
      addSystem(`❌ Pipeline indisponível: ${err.message}`);
      endVoipCall("Pipeline offline");
    }
  }, [phoneNumber, companyId, addSystem, endVoipCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
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
    if (status === "ringing") {
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
    if (status === "calling") {
      return <Badge className="gap-1 bg-yellow-500/15 text-yellow-400 border-yellow-500/30">Chamando...</Badge>;
    }
    if (status === "no_answer") {
      return <Badge variant="outline" className="gap-1 text-muted-foreground">Sem resposta</Badge>;
    }
    const cause = hangup_cause || status || "Encerrada";
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        {cause}
      </Badge>
    );
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
                {transcript.length === 0 ? (
                  <p className="text-center text-sm text-gray-500 pt-10">Aguardando chamada...</p>
                ) : (
                  transcript.map((entry, i) => {
                    if (entry.type === "system") {
                      return (
                        <div key={i} className="text-center">
                          <span className="text-xs text-gray-500">{entry.ts} — {entry.text}</span>
                        </div>
                      );
                    }
                    const isLead = entry.type === "lead";
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
                            {isLead ? "👤 Lead" : "🤖 Lucas"} · {entry.ts}
                          </div>
                          <p className="whitespace-pre-wrap">{entry.text}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent calls */}
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
                {recentCalls.map((call) => (
                  <div
                    key={call.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-muted-foreground">{call.destination_number || "—"}</span>
                      {renderStatusBadge(call)}
                    </div>
                    <span className="text-xs text-muted-foreground">{formatTimestamp(call.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
