import { useEffect, useState, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { EDGE_BASE } from "@/lib/constants";
import { toast } from "sonner";
import {
  Loader2, Phone, Volume2, AlertTriangle, CheckCircle, XCircle, Clock,
} from "lucide-react";
import { VoiceSelector, type VoiceProfile } from "@/components/VoiceSelector";
import { VoiceGallery } from "@/components/VoiceGallery";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone as PhoneIcon, Volume2 as Volume2Icon } from "lucide-react";

import { resolveCompanyRequired } from "@/lib/companyFilter";

export default function VoiceSimulate() {
  const { collaborator } = useCollaborator();
  const { selectedCompanyId } = useCompanyFilter();
  const companyId = resolveCompanyRequired(selectedCompanyId, collaborator?.company_id);

  const [testPhone, setTestPhone] = useState("");
  const [testCompanyId, setTestCompanyId] = useState(companyId || "");

  // Re-sincroniza quando o filtro global de empresa mudar
  useEffect(() => {
    if (companyId && companyId !== testCompanyId) setTestCompanyId(companyId);
  }, [companyId]);
  const [calling, setCalling] = useState(false);
  const [callResult, setCallResult] = useState<any>(null);
  const [callHistory, setCallHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [pipelineOnline, setPipelineOnline] = useState<boolean | null>(null);
  const [pipelineHealth, setPipelineHealth] = useState<any>(null);
  const [activeCallTimer, setActiveCallTimer] = useState(0);
  const [activeCallRoom, setActiveCallRoom] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<{ role: string; text: string }[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<VoiceProfile | null>(null);
  const [route, setRoute] = useState<"ivr" | "default">("ivr");
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Pipeline health check
  const checkHealth = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${EDGE_BASE}/make-call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "",
        },
        body: JSON.stringify({ action: "pipeline-status" }),
      });
      if (res.ok) {
        const data = await res.json();
        setPipelineHealth(data);
        setPipelineOnline(data.status === "online" || data.ok === true);
      } else {
        setPipelineOnline(false);
      }
    } catch {
      setPipelineOnline(false);
    }
  }, []);

  // Fetch call history
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { data } = await supabase
        .from("calls")
        .select("id, destination_number, status, duration_seconds, call_summary, sentiment, interest_detected, created_at, transcript")
        .eq("company_id", testCompanyId || companyId)
        .order("created_at", { ascending: false })
        .limit(15);
      setCallHistory(data || []);
    } catch { /* ignore */ }
    setLoadingHistory(false);
  }, [testCompanyId, companyId]);

  // Auto-refresh: health every 15s, history every 5s
  useEffect(() => {
    checkHealth();
    fetchHistory();
    const healthIv = setInterval(checkHealth, 15000);
    const historyIv = setInterval(fetchHistory, 5000);
    return () => {
      clearInterval(healthIv);
      clearInterval(historyIv);
    };
  }, [checkHealth, fetchHistory]);

  // Poll call status every 2s + local timer fallback
  useEffect(() => {
    if (!activeCallRoom) {
      setActiveCallTimer(0);
      return;
    }
    let cancelled = false;
    let localTimer = 0;

    // Local timer (runs regardless of API)
    const timerIv = setInterval(() => {
      localTimer++;
      setActiveCallTimer(localTimer);
    }, 1000);

    // Clear live transcript
    setLiveTranscript([]);

    // API polling: call status + live transcript
    const poll = async () => {
      await new Promise(r => setTimeout(r, 8000));
      while (!cancelled) {
        try {
          // Check call status
          const res = await fetch(`${EDGE_BASE}/make-call`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "",
            },
            body: JSON.stringify({ action: "call-status", room: activeCallRoom }),
            signal: AbortSignal.timeout(5000),
          });
          if (res.ok) {
            const data = await res.json();
            if (!data.active) {
              setActiveCallRoom(null);
              setCalling(false);
              fetchHistory();
              break;
            }
          }

          // Fetch live transcript from Supabase
          const { data: callData } = await supabase
            .from("calls")
            .select("transcript")
            .eq("freeswitch_uuid", activeCallRoom)
            .maybeSingle();
          if (callData?.transcript) {
            try {
              const entries = JSON.parse(callData.transcript);
              if (Array.isArray(entries)) {
                setLiveTranscript(entries);
                transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
              }
            } catch { /* ignore parse errors */ }
          }
        } catch { /* ignore */ }
        await new Promise(r => setTimeout(r, 3000));
      }
    };
    poll();

    return () => {
      cancelled = true;
      clearInterval(timerIv);
    };
  }, [activeCallRoom, fetchHistory]);

  // Dispatch call
  const dispatchCall = async () => {
    if (!testPhone) {
      toast.error("Preencha o número de telefone");
      return;
    }
    setCalling(true);
    setCallResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${EDGE_BASE}/make-call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "",
        },
        body: JSON.stringify({
          action: "dial",
          to: testPhone,
          company_id: testCompanyId || companyId,
          voice_profile_id: selectedVoice?.id ?? null,
          voice_id: selectedVoice?.voice_id ?? null,
          route,
        }),
      });
      const data = await res.json();
      setCallResult({ ...data, startedAt: new Date().toISOString() });
      if (data.success) {
        toast.success(`Chamada disparada para ${testPhone}`);
        setActiveCallRoom(data.room || data.uuid || "active");
      } else {
        toast.error(data.error || "Falha ao disparar chamada");
        setCalling(false);
      }
    } catch (err: any) {
      toast.error("Erro: " + err.message);
      setCallResult({ error: err.message });
      setCalling(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds || seconds === 0) return null;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
    return `${s}s`;
  };

  const formatTimer = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const statusInfo = (status: string, durationSec?: number | null) => {
    if (status === "completed" && durationSec && durationSec > 0) {
      return { label: "Atendida", cls: "bg-green-500/15 text-green-500" };
    }
    if (status === "completed" && (!durationSec || durationSec === 0)) {
      return { label: "Não atendeu", cls: "bg-orange-500/15 text-orange-400" };
    }
    const map: Record<string, { label: string; cls: string }> = {
      calling: { label: "Chamando...", cls: "bg-yellow-500/15 text-yellow-400 animate-pulse" },
      ringing: { label: "Tocando...", cls: "bg-yellow-500/15 text-yellow-400 animate-pulse" },
      "in-progress": { label: "Em andamento", cls: "bg-blue-500/15 text-blue-400 animate-pulse" },
      answered: { label: "Em conversa", cls: "bg-emerald-500/15 text-emerald-400 animate-pulse" },
      "no-answer": { label: "Não atendeu", cls: "bg-orange-500/15 text-orange-400" },
      no_answer: { label: "Não atendeu", cls: "bg-orange-500/15 text-orange-400" },
      busy: { label: "Ocupado", cls: "bg-orange-500/15 text-orange-400" },
      failed: { label: "Falhou", cls: "bg-red-500/15 text-red-400" },
    };
    return map[status] || { label: status, cls: "bg-gray-500/15 text-gray-400" };
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Simulação</h1>
            <p className="text-sm text-muted-foreground">Teste chamadas reais via pipeline de voz</p>
          </div>
          {pipelineOnline === null ? (
            <Badge variant="outline" className="gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Verificando...
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

        <Tabs defaultValue="simular" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 max-w-sm">
            <TabsTrigger value="simular">
              <PhoneIcon className="h-3.5 w-3.5 mr-1.5" />
              Simular
            </TabsTrigger>
            <TabsTrigger value="vozes">
              <Volume2Icon className="h-3.5 w-3.5 mr-1.5" />
              Vozes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="simular">
        <div className="flex gap-4" style={{ minHeight: 600 }}>
          {/* Left: Controls */}
          <div className="w-[400px] shrink-0 space-y-4">
            {/* Pipeline Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${pipelineOnline ? "bg-green-500" : "bg-red-500"}`} />
                  Pipeline de Voz
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Status:</div>
                  <div className={pipelineOnline ? "text-green-400 font-medium" : "text-red-400 font-medium"}>
                    {pipelineOnline ? "Online" : "Offline"}
                  </div>
                </div>
                <Button size="sm" variant="outline" className="w-full mt-2" onClick={checkHealth}>
                  Atualizar Status
                </Button>
              </CardContent>
            </Card>

            {/* Dispatch Call */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Disparar Ligação Teste
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Telefone</Label>
                  <Input
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="31999999999"
                    disabled={calling}
                  />
                </div>
                <div>
                  <Label className="text-xs">Company ID</Label>
                  <Input
                    value={testCompanyId}
                    onChange={(e) => setTestCompanyId(e.target.value)}
                    disabled={calling}
                  />
                </div>

                <VoiceSelector
                  value={selectedVoice?.id ?? null}
                  onChange={setSelectedVoice}
                  companyId={testCompanyId || companyId}
                  provider={route === "ivr" ? "elevenlabs" : "cartesia"}
                />

                <div>
                  <Label className="text-xs">Fluxo da chamada</Label>
                  <div className="flex gap-2 mt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={route === "ivr" ? "default" : "outline"}
                      className="flex-1"
                      disabled={calling}
                      onClick={() => setRoute("ivr")}
                    >
                      IVR v3 cacheado
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={route === "default" ? "default" : "outline"}
                      className="flex-1"
                      disabled={calling}
                      onClick={() => setRoute("default")}
                    >
                      LLM livre
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {route === "ivr"
                      ? "Áudios v3 ElevenLabs pré-renderizados + classificador semântico (idêntico ao produção)."
                      : "TTS Cartesia streaming com LLM livre (fluxo legado)."}
                  </p>
                </div>

                <Button
                  className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                  onClick={dispatchCall}
                  disabled={calling || !testPhone}
                >
                  {calling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Phone className="h-4 w-4" />
                  )}
                  {calling ? "Ligação em andamento..." : "Disparar Ligação Real"}
                </Button>

                {/* Active call timer */}
                {activeCallRoom && (
                  <div className="flex items-center justify-center gap-3 rounded-lg border-2 border-emerald-500/30 bg-emerald-500/5 p-3">
                    <Clock className="h-4 w-4 text-emerald-400 animate-pulse" />
                    <span className="font-mono text-2xl font-bold text-emerald-400">{formatTimer(activeCallTimer)}</span>
                    <span className="text-xs text-emerald-400/60">em andamento</span>
                  </div>
                )}

                {!pipelineOnline && !calling && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>Pipeline offline. Verifique os serviços no PC Gamer.</span>
                  </div>
                )}

                {callResult && !activeCallRoom && (
                  <div className={`rounded-lg border px-3 py-2 text-xs ${
                    callResult.success ? "border-green-500/30 bg-green-500/10 text-green-300" : "border-red-500/30 bg-red-500/10 text-red-300"
                  }`}>
                    {callResult.success ? (
                      <p className="font-medium">Chamada disparada com sucesso</p>
                    ) : (
                      <p>{callResult.error || "Erro desconhecido"}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Live Transcript (during call) or Call History */}
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="pb-2 shrink-0 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {activeCallRoom ? (
                  <>
                    <Volume2 className="h-4 w-4 text-emerald-400 animate-pulse" /> Transcrição ao Vivo
                  </>
                ) : (
                  <>
                    <Volume2 className="h-4 w-4" /> Últimas Chamadas
                    <span className="text-xs text-muted-foreground font-normal ml-1">(atualiza a cada 5s)</span>
                  </>
                )}
              </CardTitle>
              {!activeCallRoom && loadingHistory && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
              {/* Live transcript during active call */}
              {activeCallRoom ? (
                <div
                  ref={transcriptRef}
                  className="p-4 space-y-2 overflow-y-auto"
                  style={{ height: 500, background: "#0d0d14", borderRadius: "0 0 8px 8px" }}
                >
                  {liveTranscript.length === 0 ? (
                    <p className="text-center text-sm text-gray-500 pt-10 animate-pulse">
                      Aguardando conversa...
                    </p>
                  ) : (
                    liveTranscript.map((entry, i) => {
                      const isLead = entry.role === "user";
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
                              {isLead ? "Lead" : "Lucas"}
                            </div>
                            <p className="whitespace-pre-wrap">{entry.text}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
              <div className="divide-y divide-border/40">
                {callHistory.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-10">Nenhuma chamada registrada</p>
                ) : (
                  callHistory.map((call) => {
                    const info = statusInfo(call.status, call.duration_seconds);
                    const dur = formatDuration(call.duration_seconds);
                    const isActive = call.status === "ringing" || call.status === "answered" || call.status === "in-progress";
                    return (
                      <div key={call.id} className={`px-4 py-3 space-y-1 ${isActive ? "bg-emerald-500/5" : ""}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">{call.destination_number}</span>
                            <Badge className={`text-[10px] border-0 ${info.cls}`}>
                              {info.label}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">{formatDate(call.created_at)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                          {dur ? (
                            <span className="text-green-400 font-medium">Duração: {dur}</span>
                          ) : isActive ? (
                            <span className="text-emerald-400 animate-pulse">Em andamento...</span>
                          ) : (
                            <span>Duração: --</span>
                          )}
                          {call.sentiment && <span>| Sentimento: {call.sentiment}</span>}
                          {call.interest_detected && (
                            <Badge className="text-[10px] border-0 bg-emerald-500/15 text-emerald-400">
                              Interesse
                            </Badge>
                          )}
                        </div>
                        {call.call_summary && (
                          <p className="text-xs text-muted-foreground/80 line-clamp-2">💡 {call.call_summary}</p>
                        )}
                        {call.transcript && (
                          <details className="mt-1">
                            <summary className="text-xs text-primary/70 cursor-pointer hover:text-primary">Ver transcrição</summary>
                            <div className="mt-1 rounded-md bg-secondary/30 p-2 max-h-32 overflow-y-auto">
                              <p className="text-xs whitespace-pre-wrap font-mono">{(() => {
                                try {
                                  const entries = JSON.parse(call.transcript);
                                  if (Array.isArray(entries)) {
                                    return entries.map((e: any) => `${e.role === "assistant" ? "Lucas" : "Lead"}: ${e.text}`).join("\n");
                                  }
                                } catch {}
                                return call.transcript;
                              })()}</p>
                            </div>
                          </details>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              )}
            </CardContent>
          </Card>
        </div>
          </TabsContent>

          <TabsContent value="vozes">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Volume2Icon className="h-4 w-4" />
                  Galeria de Vozes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Ouça as amostras e escolha a voz que vai disparar as simulações.
                </p>
                <VoiceGallery
                  selectedId={selectedVoice?.id ?? null}
                  onSelect={(v) => {
                    setSelectedVoice(v);
                    localStorage.setItem("luxsales_selected_voice_id", v.id);
                    window.dispatchEvent(new CustomEvent("voice-selected", { detail: v }));
                  }}
                  companyId={testCompanyId || companyId}
                  provider={route === "ivr" ? "elevenlabs" : "cartesia"}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
