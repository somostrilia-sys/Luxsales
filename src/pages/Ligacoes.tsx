/**
 * Ligacoes.tsx — Página unificada de ligações (Discador + Fila + Histórico)
 * Fase 2 — LuxSales
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { EDGE_BASE } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Phone, PhoneCall, PhoneOff, Pause, Play, Loader2,
  Clock, ChevronDown, ChevronUp, MessageSquare, Trash2,
  RefreshCw, Wifi, WifiOff,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PoolLead {
  id: string;
  collaborator_id: string;
  lead_name: string | null;
  phone: string;
  status: string | null;
  call_attempts: number;
  last_call_at: string | null;
  priority: number;
}

interface CallLog {
  id: string;
  lead_phone: string | null;
  lead_name: string | null;
  duration_sec: number | null;
  status: string | null;
  started_at: string | null;
  ai_qualification: string | null;
  transcript: string | null;
  ai_summary: string | null;
}

type DialerState = "idle" | "running" | "paused";
type CallStatus = "idle" | "dialing" | "answered" | "in_call" | "ended";

const STATUS_LABELS: Record<string, string> = {
  new: "Aguardando",
  in_progress: "Ligando",
  answered: "Atendeu",
  no_answer: "Não Atendeu",
  interested: "Interesse",
  no_interest: "Sem Interesse",
  discarded: "Descartado",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-slate-500/20 text-slate-300",
  in_progress: "bg-yellow-500/20 text-yellow-400",
  answered: "bg-blue-500/20 text-blue-400",
  no_answer: "bg-orange-500/20 text-orange-400",
  interested: "bg-emerald-500/20 text-emerald-400",
  no_interest: "bg-red-500/20 text-red-400",
  discarded: "bg-gray-500/20 text-gray-500",
};

const CALL_COLOR: Record<CallStatus, string> = {
  idle:     "bg-muted text-muted-foreground",
  dialing:  "bg-yellow-500/20 text-yellow-400",
  answered: "bg-blue-500/20 text-blue-400",
  in_call:  "bg-emerald-500/20 text-emerald-400",
  ended:    "bg-purple-500/20 text-purple-400",
};

const CALL_LABEL: Record<CallStatus, string> = {
  idle:     "Aguardando",
  dialing:  "Discando...",
  answered: "Atendeu",
  in_call:  "Em conversa",
  ended:    "Encerrou",
};

const formatDuration = (s: number) =>
  `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
};

// ── VoIP Health ───────────────────────────────────────────────────────────────
function useVoipStatus() {
  const [online, setOnline] = useState<boolean | null>(null);
  const check = useCallback(async () => {
    try {
      const res = await fetch("http://192.168.0.206:8500/health", {
        signal: AbortSignal.timeout(3000),
      });
      setOnline(res.ok);
    } catch {
      setOnline(false);
    }
  }, []);
  useEffect(() => {
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, [check]);
  return { online, check };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ABA DISCADOR
// ═══════════════════════════════════════════════════════════════════════════════
function TabDiscador({
  collaboratorId,
  companyId,
}: {
  collaboratorId: string;
  companyId: string | undefined;
}) {
  const { online: voipOnline } = useVoipStatus();
  const [dialerState, setDialerState] = useState<DialerState>("idle");
  const [batchSize, setBatchSize] = useState<string>("100");
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [currentLead, setCurrentLead] = useState<PoolLead | null>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, answered: 0, interested: 0 });

  const fetchStats = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("consultant_lead_pool")
      .select("status")
      .eq("collaborator_id", collaboratorId)
      .gte("last_call_at", today.toISOString());
    if (!data) return;
    setStats({
      total: data.length,
      answered: data.filter(
        (d) => d.status && ["answered", "interested", "no_interest"].includes(d.status)
      ).length,
      interested: data.filter((d) => d.status === "interested").length,
    });
  }, [collaboratorId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Timer
  useEffect(() => {
    if (callStatus === "in_call") {
      timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (callStatus !== "ended") setCallDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  const startDialer = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("consultant_lead_pool")
        .select("*")
        .eq("collaborator_id", collaboratorId)
        .eq("status", "new")
        .order("priority", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.info("Nenhum lead novo na fila");
        setLoading(false);
        return;
      }

      setCurrentLead(data as PoolLead);
      setDialerState("running");
      setCallStatus("dialing");

      await supabase
        .from("consultant_lead_pool")
        .update({ status: "in_progress", last_call_at: new Date().toISOString() })
        .eq("id", data.id);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const phone: string = (data as any).phone;
      const normalizedPhone = phone.startsWith("+") ? phone : `+55${phone.replace(/\D/g, "")}`;

      const res = await fetch(`${EDGE_BASE}/orchestrator-proxy?path=/api/calls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          phone: normalizedPhone,
          company_id: companyId,
          lead_name: (data as any).lead_name ?? null,
          pool_id: data.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? `HTTP ${res.status}`);
      }

      toast.success(`Ligando para ${(data as any).lead_name ?? phone}`);
      setCallStatus("answered");
      setTimeout(() => setCallStatus("in_call"), 4000);
    } catch (e: any) {
      toast.error("Erro ao iniciar: " + e.message);
      setDialerState("idle");
      setCallStatus("idle");
    } finally {
      setLoading(false);
    }
  }, [collaboratorId, companyId]);

  const pauseDialer = () => {
    setDialerState("paused");
    setCallStatus("idle");
    toast.info("Discador pausado");
  };

  const markCallResult = async (result: "interested" | "no_interest" | "no_answer") => {
    if (!currentLead) return;
    const currentAttempts = (currentLead.call_attempts || 0) + 1;
    let newStatus: string = result;
    let shouldDiscard = false;

    if (result === "no_interest" && currentAttempts >= 2) {
      newStatus = "discarded";
      shouldDiscard = true;
    }

    await supabase
      .from("consultant_lead_pool")
      .update({
        status: newStatus,
        call_attempts: currentAttempts,
        last_call_at: new Date().toISOString(),
        ...(result === "no_interest" && currentAttempts < 2 ? { priority: -1 } : {}),
      })
      .eq("id", currentLead.id);

    if (shouldDiscard) {
      toast.warning(`Lead descartado após ${currentAttempts} recusas`);
    } else {
      toast.success("Resultado salvo");
    }

    setCallStatus("idle");
    setCurrentLead(null);
    fetchStats();

    if (dialerState === "running") {
      setTimeout(() => startDialer(), 1500);
    }
  };

  return (
    <div className="space-y-4">
      {/* VoIP status */}
      <Card className="border-border/60">
        <CardContent className="flex items-center justify-between py-3 px-4">
          <div className="flex items-center gap-2 text-sm">
            {voipOnline === null ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : voipOnline ? (
              <Wifi className="h-4 w-4 text-emerald-400" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-400" />
            )}
            <span
              className={
                voipOnline
                  ? "text-emerald-400"
                  : voipOnline === false
                  ? "text-red-400"
                  : "text-muted-foreground"
              }
            >
              Canal VoIP:{" "}
              {voipOnline === null
                ? "verificando..."
                : voipOnline
                ? "Online"
                : "Offline"}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">192.168.0.206:8500</span>
        </CardContent>
      </Card>

      {/* Counters */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Ligações hoje", value: stats.total, color: "text-primary" },
          { label: "Atendidas", value: stats.answered, color: "text-blue-400" },
          { label: "Com interesse", value: stats.interested, color: "text-emerald-400" },
        ].map(({ label, value, color }) => (
          <Card key={label} className="border-border/60">
            <CardContent className="py-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Controls */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Controle do Discador
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1.5">Leads por rodada</p>
              <Select value={batchSize} onValueChange={setBatchSize}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">100 leads</SelectItem>
                  <SelectItem value="500">500 leads</SelectItem>
                  <SelectItem value="1000">1.000 leads</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              {dialerState === "idle" || dialerState === "paused" ? (
                <Button
                  className="w-full h-10 bg-emerald-600 hover:bg-emerald-700"
                  onClick={startDialer}
                  disabled={loading || voipOnline === false}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  {dialerState === "paused" ? "Retomar" : "▶ Iniciar Ligações"}
                </Button>
              ) : (
                <Button
                  className="w-full h-10"
                  variant="outline"
                  onClick={pauseDialer}
                >
                  <Pause className="h-4 w-4 mr-2" />
                  ⏸ Pausar
                </Button>
              )}
            </div>
          </div>

          {/* Active call */}
          {currentLead && (
            <div className="rounded-lg border border-border/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{currentLead.lead_name ?? "Lead"}</p>
                  <p className="text-xs font-mono text-muted-foreground">{currentLead.phone}</p>
                </div>
                <Badge className={`text-xs ${CALL_COLOR[callStatus]}`}>
                  {CALL_LABEL[callStatus]}
                </Badge>
              </div>
              {(callStatus === "in_call" || callStatus === "ended") && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="font-mono text-sm">{formatDuration(callDuration)}</span>
                </div>
              )}
              {callStatus === "in_call" && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => setCallStatus("ended")}
                >
                  <PhoneOff className="h-3.5 w-3.5 mr-2" />
                  Encerrar
                </Button>
              )}
              {callStatus === "ended" && (
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                    onClick={() => markCallResult("interested")}
                  >
                    ✅ Interesse
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="text-xs"
                    onClick={() => markCallResult("no_interest")}
                  >
                    ❌ Sem Interesse
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => markCallResult("no_answer")}
                  >
                    📵 N. Atendeu
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ABA FILA
// ═══════════════════════════════════════════════════════════════════════════════
function TabFila({ collaboratorId }: { collaboratorId: string }) {
  const [leads, setLeads] = useState<PoolLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("consultant_lead_pool")
        .select("*")
        .eq("collaborator_id", collaboratorId)
        .neq("status", "discarded");
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q
        .order("priority", { ascending: false })
        .limit(200);
      if (error) throw error;
      setLeads((data ?? []) as PoolLead[]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [collaboratorId, filter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const discardLead = async (id: string) => {
    await supabase
      .from("consultant_lead_pool")
      .update({ status: "discarded" })
      .eq("id", id);
    toast.success("Lead descartado");
    fetchLeads();
  };

  // Sort: interested first, then new/in_progress, then no_answer, then no_interest
  const sorted = [...leads].sort((a, b) => {
    const pri = (s: string | null) => {
      if (s === "interested") return 4;
      if (s === "new") return 3;
      if (s === "in_progress") return 2;
      if (s === "no_answer") return 1;
      return 0;
    };
    return pri(b.status) - pri(a.status);
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="new">Aguardando</SelectItem>
            <SelectItem value="in_progress">Ligando</SelectItem>
            <SelectItem value="interested">Com interesse</SelectItem>
            <SelectItem value="no_interest">Sem interesse</SelectItem>
            <SelectItem value="no_answer">Não atendeu</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetchLeads}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">{leads.length} leads</span>
      </div>

      <Card className="border-border/60">
        {loading ? (
          <CardContent className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </CardContent>
        ) : sorted.length === 0 ? (
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            Nenhum lead encontrado.
          </CardContent>
        ) : (
          <div className="divide-y divide-border/40">
            {sorted.map((lead) => {
              const attempts = lead.call_attempts || 0;
              const showDiscard =
                attempts >= 2 && lead.status === "no_interest";
              return (
                <div
                  key={lead.id}
                  className="flex items-center justify-between px-4 py-3 gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {lead.lead_name ?? "—"}
                    </p>
                    <p className="text-xs font-mono text-muted-foreground">
                      {lead.phone}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right text-xs text-muted-foreground hidden sm:block">
                      <p>
                        {attempts} tentativa{attempts !== 1 ? "s" : ""}
                      </p>
                      <p>{formatDate(lead.last_call_at)}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 border-0 ${
                        STATUS_COLORS[lead.status ?? "new"] ??
                        "bg-muted text-muted-foreground"
                      }`}
                    >
                      {STATUS_LABELS[lead.status ?? "new"] ?? lead.status}
                    </Badge>
                    {showDiscard && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => discardLead(lead.id)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Descartar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ABA HISTÓRICO
// ═══════════════════════════════════════════════════════════════════════════════
function TabHistorico({ companyId }: { companyId: string | undefined }) {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const fetchCalls = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("calls")
        .select(
          "id, lead_phone, lead_name, duration_seconds, status, created_at, transcript, ai_summary, ai_analysis, call_summary"
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      setCalls(
        (data ?? []).map((d: any) => ({
          id: d.id,
          lead_phone: d.lead_phone ?? d.destination_number ?? null,
          lead_name: d.lead_name ?? null,
          duration_sec: d.duration_seconds ?? d.duration_sec ?? null,
          status: d.status ?? null,
          started_at: d.created_at ?? null,
          ai_qualification:
            d.ai_qualification ??
            d.ai_analysis?.interest_level ??
            null,
          transcript: d.transcript ?? null,
          ai_summary:
            d.ai_summary ??
            d.ai_analysis?.reason ??
            d.call_summary ??
            null,
        }))
      );
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { fetchCalls(); }, [fetchCalls]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const openWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    const num = cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
    window.open(`https://wa.me/${num}`, "_blank");
  };

  const filtered = calls.filter(
    (c) =>
      !search ||
      (c.lead_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.lead_phone ?? "").includes(search)
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Button variant="outline" size="sm" onClick={fetchCalls}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">
          Nenhuma ligação encontrada.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((call) => {
            const isExpanded = expanded.has(call.id);
            return (
              <Card key={call.id} className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">
                          {call.lead_name ?? "Desconhecido"}
                        </p>
                        {call.ai_qualification && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 border-0 bg-primary/10 text-primary"
                          >
                            {call.ai_qualification}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className="font-mono">
                          {call.lead_phone ?? "—"}
                        </span>
                        <span>{formatDate(call.started_at)}</span>
                        {call.duration_sec != null && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(call.duration_sec)}
                          </span>
                        )}
                      </div>
                      {call.ai_summary && (
                        <p className="mt-1.5 text-xs text-muted-foreground italic line-clamp-1">
                          💡 {call.ai_summary}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {call.lead_phone && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-emerald-400 hover:text-emerald-300"
                            title="Chamar no WA"
                            onClick={() => openWhatsApp(call.lead_phone!)}
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-primary hover:text-primary/80"
                            title="Ligar manualmente"
                            onClick={() =>
                              toast.info(
                                `Para ligar para ${call.lead_phone}, use a aba Discador`
                              )
                            }
                          >
                            <PhoneCall className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      {(call.transcript || call.ai_summary) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => toggleExpand(call.id)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Expanded transcript */}
                  {isExpanded && (
                    <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
                      {call.ai_summary && (
                        <div className="rounded-lg bg-primary/5 p-3">
                          <p className="text-xs font-medium text-primary mb-1">
                            💡 Resumo Lucas
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {call.ai_summary}
                          </p>
                        </div>
                      )}
                      {call.transcript && (
                        <div className="rounded-lg bg-secondary/30 p-3 max-h-48 overflow-y-auto">
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Transcrição
                          </p>
                          <p className="text-xs whitespace-pre-wrap font-mono">
                            {call.transcript}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function Ligacoes() {
  const { collaborator } = useCollaborator();
  const companyId = collaborator?.company_id;
  const collaboratorId = collaborator?.id ?? "";

  if (!collaborator) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Ligações"
        subtitle="Discador, fila e histórico de ligações unificados"
      />
      <Tabs defaultValue="discador" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-sm">
          <TabsTrigger value="discador">
            <Phone className="h-3.5 w-3.5 mr-1.5" />
            Discador
          </TabsTrigger>
          <TabsTrigger value="fila">
            <PhoneCall className="h-3.5 w-3.5 mr-1.5" />
            Fila
          </TabsTrigger>
          <TabsTrigger value="historico">
            <Clock className="h-3.5 w-3.5 mr-1.5" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="discador">
          <TabDiscador collaboratorId={collaboratorId} companyId={companyId} />
        </TabsContent>

        <TabsContent value="fila">
          <TabFila collaboratorId={collaboratorId} />
        </TabsContent>

        <TabsContent value="historico">
          <TabHistorico companyId={companyId} />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
