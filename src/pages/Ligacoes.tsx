/**
 * Ligacoes.tsx — Ligações unificadas (Fase 3 — LuxSales V3)
 * Discador + Fila unificados, usando campos novos: interest_status, phone_normalized, call_attempts
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { resolveCompanyFilter } from "@/lib/companyFilter";
import { supabase } from "@/lib/supabase";
import { EDGE_BASE, SUPABASE_ANON_KEY } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Phone, PhoneOff, Pause, Play, Loader2,
  Clock, ChevronDown, ChevronUp, MessageSquare,
  RefreshCw, Wifi, WifiOff, PhoneCall,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PoolLead {
  id: string;
  collaborator_id: string;
  lead_name: string | null;
  phone: string | null;
  phone_normalized: string | null;
  interest_status: string | null;
  call_attempts: number;
  last_call_at: string | null;
  priority: number;
  lead_category: string | null;
  dispatched: boolean | null;
  responded_at: string | null;
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

const INTEREST_LABELS: Record<string, string> = {
  pending: "Aguardando",
  unknown: "Aguardando",
  not_interested_1: "1ª Recusa",
  not_interested_2: "2ª Recusa",
  interested: "Interesse",
  discarded: "Descartado",
};

const INTEREST_COLORS: Record<string, string> = {
  pending: "bg-slate-500/20 text-slate-300",
  unknown: "bg-slate-500/20 text-slate-300",
  not_interested_1: "bg-orange-500/20 text-orange-400",
  not_interested_2: "bg-red-500/20 text-red-400",
  interested: "bg-emerald-500/20 text-emerald-400",
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

function calcScore(lead: PoolLead): { score: number; label: string; emoji: string } {
  let s = 0;
  if (lead.interest_status === "interested") s += 40;
  else if (lead.interest_status === "callback") s += 20;
  if (lead.dispatched) s += 20;
  if (lead.responded_at) s += 15;
  if (lead.call_attempts === 0) s += 10;
  else if (lead.call_attempts === 1) s += 5;
  if (s >= 60) return { score: s, label: "Hot", emoji: "🔥" };
  if (s >= 30) return { score: s, label: "Morno", emoji: "🌡️" };
  return { score: s, label: "Frio", emoji: "❄️" };
}

const attemptLabel = (n: number) => n === 0 ? "1ª lig." : `${n + 1}ª tent.`;
const attemptColor = (n: number) =>
  n === 0 ? "bg-emerald-500/20 text-emerald-400" :
  n < 4   ? "bg-yellow-500/20 text-yellow-400" :
            "bg-red-500/20 text-red-400";

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
};

const displayPhone = (lead: PoolLead) => {
  if (lead.phone_normalized) return lead.phone_normalized;
  const raw = (lead.phone || "").replace(/\D/g, "");
  if (!raw) return "—";
  const withCountry = raw.startsWith("55") ? raw : `55${raw}`;
  return `+${withCountry}`;
};

// ── VoIP Health (via orchestrator-proxy) ──────────────────────────────────────
const voipProxyHeaders = {
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  "apikey": SUPABASE_ANON_KEY,
};

function useVoipStatus() {
  const [online, setOnline] = useState<boolean | null>(null);
  const check = useCallback(async () => {
    try {
      const res = await fetch(
        `${EDGE_BASE}/orchestrator-proxy?path=${encodeURIComponent("/health")}`,
        { headers: voipProxyHeaders, signal: AbortSignal.timeout(5000) }
      );
      setOnline(res.ok);
    } catch {
      setOnline(false);
    }
  }, []);
  useEffect(() => {
    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, [check]);
  return { online, check };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ABA LIGAÇÕES — Discador + Fila unificados
// ═══════════════════════════════════════════════════════════════════════════════
function TabLigacoes({
  collaboratorId,
  companyId,
  isCEO = false,
}: {
  collaboratorId: string;
  companyId: string | undefined;
  isCEO?: boolean;
}) {
  const { online: voipOnline } = useVoipStatus();
  const [voipConfig, setVoipConfig] = useState<{ ramal: string; servidor: string; porta: string; ativo: boolean } | null>(null);
  const [invalidPhoneCount, setInvalidPhoneCount] = useState(0);
  const [dialerState, setDialerState] = useState<DialerState>("idle");
  const activeCallUuidRef = useRef<string | null>(null);
  const realtimeChannelRef = useRef<any>(null);
  const [batchSize, setBatchSize] = useState<string>("100");
  const [concurrency, setConcurrency] = useState(3); // Chamadas simultâneas
  const activeCallsRef = useRef<Map<string, { lead: any; uuid: string; status: string; startedAt: number; channel?: any }>>(new Map());
  const queueIndexRef = useRef(0);
  const fillCallSlotsRef = useRef<() => void>(() => {});
  const originateCallRef = useRef<(lead: any) => Promise<void>>(async () => {});
  const [queue, setQueue] = useState<PoolLead[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [queueLoaded, setQueueLoaded] = useState(false);
  const [currentLead, setCurrentLead] = useState<PoolLead | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callDuration, setCallDuration] = useState(0);
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [processedCount, setProcessedCount] = useState(0);
  const [activeCallCount, setActiveCallCount] = useState(0);
  const [massCallLog, setMassCallLog] = useState<Array<{phone: string; status: string; time: string}>>([]);
  const [stats, setStats] = useState({ total: 0, answered: 0, interested: 0 });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Refs for stable access inside timeouts
  const queueRef = useRef<PoolLead[]>([]);
  const dialerStateRef = useRef<DialerState>("idle");
  const voipOnlineRef = useRef<boolean | null>(null);

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { dialerStateRef.current = dialerState; }, [dialerState]);
  useEffect(() => { voipOnlineRef.current = voipOnline; }, [voipOnline]);

  const fetchStats = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("calls")
      .select("status,interest_detected")
      .eq("direction", "outbound")
      .gte("started_at", today.toISOString());
    if (!data) return;
    setStats({
      total: data.length,
      answered: data.filter(d => d.status === "completed").length,
      interested: data.filter(d => d.interest_detected === true).length,
    });
  }, []);

  useEffect(() => {
    fetchStats();
    (async () => {
      const { data } = await supabase
        .from("system_configs")
        .select("value")
        .eq("key", `voip_config_${collaboratorId}`)
        .maybeSingle();
      if (data?.value) {
        try { setVoipConfig(JSON.parse(data.value)); } catch { /* ignore */ }
      }
    })();
  }, [fetchStats, collaboratorId]);

  // Timer
  useEffect(() => {
    if (callStatus === "in_call") {
      timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (callStatus !== "ended") setCallDuration(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callStatus]);

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true);
    try {
      // First: count leads with invalid phone
      const validStatuses = ["pending", "unknown", "not_interested_1"];
      // CEO sees all leads from the company; consultants see only their own
      let countQ = supabase.from("consultant_lead_pool").select("id, phone_normalized").in("interest_status", validStatuses);
      if (isCEO && companyId) countQ = countQ.eq("company_id", companyId);
      if (!isCEO) countQ = countQ.eq("collaborator_id", collaboratorId);
      const { data: allData } = await countQ;
      const invalidCount = (allData || []).filter(l => !l.phone_normalized).length;
      setInvalidPhoneCount(invalidCount);

      // Load queue — works regardless of VoIP status (it's just a list)
      let query = supabase
        .from("consultant_lead_pool")
        .select("id, collaborator_id, lead_name, phone, phone_normalized, interest_status, call_attempts, last_call_at, priority, lead_category, dispatched, responded_at")
        .in("interest_status", validStatuses)
        .limit(parseInt(batchSize));
      if (isCEO && companyId) query = query.eq("company_id", companyId);
      if (!isCEO) query = query.eq("collaborator_id", collaboratorId);
      const { data, error } = await query;

      if (error) throw error;

      const raw = (data || []) as PoolLead[];
      // Priority: not_interested_1 first, then never-called (call_attempts = 0)
      const sorted = [...raw].sort((a, b) => {
        const pri = (l: PoolLead) =>
          l.interest_status === "not_interested_1" ? 2 : l.call_attempts === 0 ? 1 : 0;
        return pri(b) - pri(a);
      });

      setQueue(sorted);
      setQueueLoaded(true);
      setProcessedCount(0);
      toast.success(`${sorted.length} leads carregados na fila`);
    } catch (e: any) {
      toast.error("Erro ao carregar fila: " + e.message);
    } finally {
      setLoadingQueue(false);
    }
  }, [collaboratorId, batchSize]);

  // Cleanup a single call's realtime subscription
  const cleanupCallRealtime = useCallback((uuid: string) => {
    const call = activeCallsRef.current.get(uuid);
    if (call?.channel) {
      supabase.removeChannel(call.channel);
    }
    activeCallsRef.current.delete(uuid);
  }, []);

  // Cleanup all
  const cleanupRealtime = useCallback(() => {
    activeCallsRef.current.forEach((call, uuid) => {
      if (call.channel) supabase.removeChannel(call.channel);
    });
    activeCallsRef.current.clear();
  }, []);


  // Handle result for a single mass-dialer call
  const handleMassCallResult = useCallback(async (lead: any, result: "interested" | "no_interest" | "no_answer", uuid: string) => {
    const newAttempts = (lead.call_attempts || 0) + 1;
    let newInterestStatus = lead.interest_status || "pending";
    let removeFromQueue = false;
    let dispatchAvailable = false;

    if (result === "interested") {
      newInterestStatus = "interested";
      dispatchAvailable = true;
      removeFromQueue = true;
    } else if (result === "no_interest") {
      if (lead.interest_status === "not_interested_1") {
        newInterestStatus = "not_interested_2";
        removeFromQueue = true;
      } else {
        newInterestStatus = "not_interested_1";
      }
    } else if (newAttempts >= 5) {
      newInterestStatus = "discarded";
      removeFromQueue = true;
    }

    const statusUpdate =
      result === "no_interest" && newInterestStatus === "not_interested_2"
        ? { status: "discarded" }
        : result === "no_interest"
        ? { status: "closed" }
        : newAttempts >= 5
        ? { status: "discarded" }
        : {};

    await supabase
      .from("consultant_lead_pool")
      .update({
        interest_status: newInterestStatus,
        call_attempts: newAttempts,
        last_call_at: new Date().toISOString(),
        ...statusUpdate,
        ...(dispatchAvailable ? { dispatch_available: true } : {}),
      })
      .eq("id", lead.id);

    cleanupCallRealtime(uuid);
    setProcessedCount(p => p + 1);
    setActiveCallCount(activeCallsRef.current.size);
    setMassCallLog(prev => [{phone: lead.phone_normalized || lead.phone || "?", status: result === "interested" ? "✅ Interesse" : result === "no_interest" ? "📞 Sem interesse" : "❌ Sem resposta", time: new Date().toLocaleTimeString("pt-BR")}, ...prev].slice(0, 50));
    fetchStats();

    // Fill next slot
    if (dialerStateRef.current === "running") {
      setTimeout(() => fillCallSlotsRef.current(), 500);
    }
  }, [cleanupCallRealtime, fetchStats]);

  // Originate a single call (for mass dialer)
  const originateCall = useCallback(async (lead: any) => {
    const phoneToCall = lead.phone_normalized ||
      (lead.phone?.startsWith("+") ? lead.phone : `+55${(lead.phone || "").replace(/\D/g, "")}`);

    try {
      await supabase
        .from("consultant_lead_pool")
        .update({ last_call_at: new Date().toISOString() })
        .eq("id", lead.id);

      const res = await fetch(`${EDGE_BASE}/orchestrator-proxy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...voipProxyHeaders },
        body: JSON.stringify({
          _path: "/call",
          to: phoneToCall,
          company_id: companyId,
          lead_name: lead.lead_name ?? null,
          pool_id: lead.id,
        }),
      });

      if (!res.ok) throw new Error("HTTP " + res.status);

      const data = await res.json();
      if (!data.uuid) throw new Error("No UUID");

      const callUuid = data.uuid;

      // Subscribe to realtime status
      const channel = supabase
        .channel(`mass-${callUuid}`)
        .on("postgres_changes", {
          event: "UPDATE",
          schema: "public",
          table: "calls",
          filter: `freeswitch_uuid=eq.${callUuid}`,
        }, (payload: any) => {
          const row = payload.new;
          if (row.status === "answered") {
            const entry = activeCallsRef.current.get(callUuid);
            if (entry) entry.status = "answered";
          }
          if (row.status === "completed" || row.status === "no_answer") {
            const talkTime = row.talk_time_seconds || 0;
            const hasInterest = row.interest_detected === true;
            const autoResult = talkTime === 0 ? "no_answer" : hasInterest ? "interested" : "no_interest";
            handleMassCallResult(lead, autoResult, callUuid);
          }
        })
        .subscribe();

      activeCallsRef.current.set(callUuid, {
        lead,
        uuid: callUuid,
        status: "dialing",
        startedAt: Date.now(),
        channel,
      });
      setActiveCallCount(activeCallsRef.current.size);
      setMassCallLog(prev => [{phone: phoneToCall, status: "discando", time: new Date().toLocaleTimeString("pt-BR")}, ...prev].slice(0, 50));

      // Fallback: 45s max — if no status update, clean up
      setTimeout(() => {
        if (activeCallsRef.current.has(callUuid)) {
          handleMassCallResult(lead, "no_answer", callUuid);
        }
      }, 45000);

    } catch (e: any) {
      // Failed to originate — skip and fill next
      setProcessedCount(p => p + 1);
      setActiveCallCount(activeCallsRef.current.size);
      setMassCallLog(prev => [{phone: phoneToCall || "?", status: "⚠️ Erro", time: new Date().toLocaleTimeString("pt-BR")}, ...prev].slice(0, 50));
      if (dialerStateRef.current === "running") {
        setTimeout(() => fillCallSlotsRef.current(), 500);
      }
    }
  }, [companyId, handleMassCallResult]);


  // Subscribe to call status changes via Supabase Realtime
  const subscribeCallStatus = useCallback((callUuid: string) => {
    cleanupRealtime();
    activeCallUuidRef.current = callUuid;

    const channel = supabase
      .channel(`dialer-${callUuid}`)
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
          if (row.status === "answered" && callStatusRef.current === "dialing") {
            setCallStatus("in_call");
            if (!callStartTimeRef.current) setCallStartTime(new Date());
          }
          if (row.status === "completed" || row.status === "no_answer") {
            setCallStatus("ended");
            // Auto-advance in queue mode
            if (dialerStateRef.current === "running") {
              const talkTime = row.talk_time_seconds || 0;
              const hasInterest = row.interest_detected === true;
              // Auto-classify: no talk = no_answer, interest = interested, talked = no_interest
              const autoResult = talkTime === 0 ? "no_answer" : hasInterest ? "interested" : "no_interest";
              setTimeout(() => {
                markCallResult(autoResult);
              }, 1500);
            }
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;
  }, [cleanupRealtime]);

  // Track callStatus in ref for realtime callback
  const callStatusRef = useRef<CallStatus>("idle");
  const callStartTimeRef = useRef<Date | null>(null);
  useEffect(() => { callStatusRef.current = callStatus; }, [callStatus]);
  useEffect(() => { callStartTimeRef.current = callStartTime; }, [callStartTime]);

  const startNextCall = useCallback(async () => {
    const q = queueRef.current;
    if (q.length === 0) {
      toast.info("Fila finalizada! Todos os leads foram processados.");
      setDialerState("idle");
      cleanupRealtime();
      return;
    }

    const lead = q[0];
    setCurrentLead(lead);
    setCallStatus("dialing");

    const phoneToCall = lead.phone_normalized ||
      (lead.phone?.startsWith("+") ? lead.phone : `+55${(lead.phone || "").replace(/\D/g, "")}`);

    try {
      await supabase
        .from("consultant_lead_pool")
        .update({ last_call_at: new Date().toISOString() })
        .eq("id", lead.id);

      const res = await fetch(`${EDGE_BASE}/orchestrator-proxy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...voipProxyHeaders,
        },
        body: JSON.stringify({
          _path: "/call",
          to: phoneToCall,
          company_id: companyId,
          lead_name: lead.lead_name ?? null,
          pool_id: lead.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      setCallStartTime(new Date());

      if (data.uuid) {
        // Subscribe to real-time call status
        subscribeCallStatus(data.uuid);
        // Fallback: if no CHANNEL_ANSWER in 30s, mark as no_answer
        // Fallback: 30s timeout for dialing, 120s max call duration
        setTimeout(() => {
          if (callStatusRef.current === "dialing") {
            setCallStatus("ended");
            if (dialerStateRef.current === "running") {
              setTimeout(() => markCallResult("no_answer"), 1500);
            }
          }
        }, 30000);
        // Max call duration fallback: 120s — auto-advance if still in_call
        setTimeout(() => {
          if (callStatusRef.current === "in_call" && dialerStateRef.current === "running") {
            setCallStatus("ended");
            setTimeout(() => markCallResult("no_interest"), 1500);
          }
        }, 120000);
      } else {
        // No UUID returned — fallback to timed simulation
        setTimeout(() => setCallStatus("in_call"), 4000);
      }
    } catch (e: any) {
      if (voipOnlineRef.current === false) {
        toast.info("VoIP offline — modo simulação");
        setCallStartTime(new Date());
        setTimeout(() => setCallStatus("in_call"), 800);
      } else {
        toast.error("Erro VoIP: " + e.message);
        setCallStatus("idle");
        setCurrentLead(null);
        // In running mode, skip to next after error
        if (dialerStateRef.current === "running") {
          setTimeout(() => startNextCall(), 3000);
        }
      }
    }
  }, [companyId, subscribeCallStatus, cleanupRealtime]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { cleanupRealtime(); };
  }, [cleanupRealtime]);

  // Fill concurrent call slots
  const fillCallSlots = useCallback(() => {
    const q = queueRef.current;
    const active = activeCallsRef.current;
    const maxSlots = concurrency;
    
    while (active.size < maxSlots && queueIndexRef.current < q.length) {
      const lead = q[queueIndexRef.current];
      queueIndexRef.current++;
      if (!lead) break;
      
      // Fire and forget — each call manages itself
      originateCallRef.current(lead);
    }
    
    // Check if queue exhausted and no active calls
    if (active.size === 0 && queueIndexRef.current >= q.length) {
      toast.info("Fila finalizada! Todos os leads foram processados.");
      setDialerState("idle");
    }
  }, [concurrency]);

  // Keep refs in sync
  useEffect(() => { fillCallSlotsRef.current = fillCallSlots; }, [fillCallSlots]);
  useEffect(() => { originateCallRef.current = originateCall; }, [originateCall]);

  const startDialer = () => {
    if (queueRef.current.length === 0) {
      toast.warning("Carregue a fila primeiro");
      return;
    }
    queueIndexRef.current = 0;
    activeCallsRef.current.clear();
    setProcessedCount(0);
    setActiveCallCount(0);
    setMassCallLog([]);
    setDialerState("running");
    // Small delay to let state propagate
    setTimeout(() => fillCallSlotsRef.current(), 100);
  };

  const stopDialer = () => {
    setDialerState("idle");
    // Clean up all active realtime subscriptions
    activeCallsRef.current.forEach((call, uuid) => {
      if (call.channel) supabase.removeChannel(call.channel);
    });
    activeCallsRef.current.clear();
    setActiveCallCount(0);
    setCurrentLead(null);
    setCallStatus("idle");
    toast.info("Discador parado");
  };

  const pauseDialer = () => {
    setDialerState("paused");
    if (!currentLead) return;
    setCallStatus("idle");
    setCurrentLead(null);
    toast.info("Discador pausado");
  };

  const markCallResult = async (result: "interested" | "no_interest" | "no_answer") => {
    if (!currentLead) return;
    const newAttempts = (currentLead.call_attempts || 0) + 1;
    const duration = callDuration;
    const startedAt = callStartTime?.toISOString() ?? new Date().toISOString();

    let newInterestStatus = currentLead.interest_status || "pending";
    let removeFromQueue = false;
    let dispatchAvailable = false;

    if (result === "interested") {
      newInterestStatus = "interested";
      dispatchAvailable = true;
      removeFromQueue = true;
      toast.success("Lead com interesse — disponível para disparo!");
    } else if (result === "no_interest") {
      if (currentLead.interest_status === "not_interested_1") {
        newInterestStatus = "not_interested_2";
        removeFromQueue = true;
        toast.info("Lead marcado como sem interesse (2ª recusa — descartado)");
      } else {
        newInterestStatus = "not_interested_1";
        toast.info("Lead marcado como sem interesse");
      }
    } else {
      // no_answer
      if (newAttempts >= 5) {
        newInterestStatus = "discarded";
        removeFromQueue = true;
        toast.warning(`Descartado após ${newAttempts} tentativas sem resposta`);
      } else {
        toast.info(`Tentativa ${newAttempts}/5 — voltando pro final da fila`);
      }
    }

    // Update DB
    const statusUpdate =
      result === "no_interest" && newInterestStatus === "not_interested_2"
        ? { status: "discarded" }
        : result === "no_interest"
        ? { status: "closed" }
        : newAttempts >= 5
        ? { status: "discarded" }
        : {};
    await supabase
      .from("consultant_lead_pool")
      .update({
        interest_status: newInterestStatus,
        call_attempts: newAttempts,
        last_call_at: new Date().toISOString(),
        ...statusUpdate,
        ...(dispatchAvailable ? { dispatch_available: true } : {}),
      })
      .eq("id", currentLead.id);

    // Register call_log for answered calls
    if (result !== "no_answer") {
      supabase.from("call_logs").insert({
        collaborator_id: collaboratorId,
        lead_name: currentLead.lead_name,
        lead_phone: displayPhone(currentLead),
        pool_id: currentLead.id,
        transcript: "[ligação registrada via discador]",
        interest_detected: result === "interested",
        duration_sec: duration,
        started_at: startedAt,
      }).then(() => {}).catch(() => {});
    }

    // Update queue: remove current (queue[0]) and optionally push back to end
    const updatedLead: PoolLead = {
      ...currentLead,
      interest_status: newInterestStatus,
      call_attempts: newAttempts,
    };
    setQueue(prev => {
      const rest = prev.slice(1);
      return removeFromQueue ? rest : [...rest, updatedLead];
    });

    setProcessedCount(p => p + 1);
    setCallStatus("idle");
    setCurrentLead(null);
    setCallDuration(0);
    fetchStats();

    if (dialerStateRef.current === "running") {
      setTimeout(() => startNextCall(), 1500);
    }
  };

  const totalInQueue = queue.length + processedCount;

  return (
    <div className="space-y-4">
      {/* VoIP Status */}
      <Card className="border-border/60">
        <CardContent className="py-3 px-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              {voipOnline === null ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : voipOnline ? (
                <Wifi className="h-4 w-4 text-emerald-400" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-400" />
              )}
              <span className={
                voipOnline ? "text-emerald-400" :
                voipOnline === false ? "text-red-400" :
                "text-muted-foreground"
              }>
                Servidor VoIP:{" "}
                {voipOnline === null ? "verificando..." : voipOnline ? "Online" : "Offline"}
              </span>

            </div>
            
          </div>
          <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-primary/70" />
              <span className="text-muted-foreground">
                Pipeline IA:{" "}
                <span className={voipOnline ? "text-emerald-400 font-medium" : "text-red-400"}>
                  {voipOnline ? "Pronto para ligar" : "Indisponível"}
                </span>
              </span>
            </div>
        </CardContent>
      </Card>

      {/* Mass Dialer Status */}
      {dialerState === "running" && (
        <Card>
          <CardContent className="py-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse">
                  ⚡ Discando em massa
                </Badge>
                <span className="text-sm font-mono">
                  {activeCallCount} ativa{activeCallCount !== 1 ? "s" : ""} · {processedCount}/{queue.length + processedCount} processados
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{concurrency} linha{concurrency > 1 ? "s" : ""}</span>
                <Button size="sm" variant="destructive" className="h-6 text-xs px-2" onClick={stopDialer}>
                  Parar tudo
                </Button>
              </div>
            </div>
            {massCallLog.length > 0 && (
              <div className="max-h-[200px] overflow-y-auto space-y-1">
                {massCallLog.map((log, i) => (
                  <div key={i} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/30">
                    <span className="font-mono text-muted-foreground">{log.phone}</span>
                    <span>{log.status}</span>
                    <span className="text-muted-foreground">{log.time}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Invalid phone badge */}
      {invalidPhoneCount > 0 && (
        <div className="flex items-center gap-2 px-1">
          <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-400">
            ⚠️ {invalidPhoneCount} lead{invalidPhoneCount > 1 ? "s" : ""} com telefone inválido (excluídos da fila)
          </Badge>
        </div>
      )}

      {/* Stats */}
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

      {/* Queue loader + controls */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Fila de Ligações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Batch selector + load button */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1.5">Quantidade de leads</p>
              <Select
                value={batchSize}
                onValueChange={setBatchSize}
                disabled={dialerState === "running"}
              >
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
            <Button
              variant="outline"
              className="h-10 px-4"
              onClick={loadQueue}
              disabled={loadingQueue || dialerState === "running"}
            >
              {loadingQueue
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <RefreshCw className="h-4 w-4" />
              }
              <span className="ml-2">Carregar</span>
            </Button>
          </div>

          {/* Queue progress */}
          {queueLoaded && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {currentLead
                    ? `Ligando para ${processedCount + 1} de ${totalInQueue}`
                    : `${queue.length} leads na fila`}
                </span>
                {dialerState === "running" && (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs animate-pulse">
                    Discador ativo
                  </Badge>
                )}
                {dialerState === "paused" && (
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-0 text-xs">
                    Pausado
                  </Badge>
                )}
              </div>
              {totalInQueue > 0 && (
                <Progress value={(processedCount / Math.max(totalInQueue, 1)) * 100} className="h-1.5" />
              )}
            </div>
          )}

          {/* Start / Pause */}
          {queueLoaded && (
            <div className="flex gap-3">
              {dialerState !== "running" ? (
                <Button
                  className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700"
                  onClick={startDialer}
                  disabled={queue.length === 0 || !!currentLead}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {dialerState === "paused" ? "Retomar Ligações" : "▶ Iniciar Ligações"}
                </Button>
              ) : (
                <Button
                  className="flex-1 h-10"
                  variant="outline"
                  onClick={pauseDialer}
                >
                  <Pause className="h-4 w-4 mr-2" />
                  ⏸ Pausar
                </Button>
                <Button
                  className="h-10 bg-red-600 hover:bg-red-700 text-white px-6"
                  onClick={stopDialer}
                >
                  <PhoneOff className="h-4 w-4 mr-2" />
                  Parar
                </Button>
              )}
            </div>
          )}

          {/* Active call card */}
          {currentLead && (
            <div className="rounded-lg border border-border/60 p-4 space-y-3 bg-card/50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">{currentLead.lead_name ?? "Lead"}</p>
                  <p className="text-xs font-mono text-muted-foreground">{displayPhone(currentLead)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tentativa {(currentLead.call_attempts || 0) + 1} de 5
                  </p>
                </div>
                <Badge className={`text-xs ${CALL_COLOR[callStatus]}`}>
                  {CALL_LABEL[callStatus]}
                </Badge>
              </div>

              {callStatus === "dialing" && (
                <div className="flex items-center gap-2 text-yellow-400 text-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Discando para {displayPhone(currentLead)}...</span>
                </div>
              )}

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
                  Encerrar Ligação
                </Button>
              )}

              {callStatus === "ended" && (
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                    onClick={() => markCallResult("interested")}
                  >
                    ✅ Com Interesse
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
                    📵 Não Atendeu
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Queue preview list */}
      {queueLoaded && queue.length > 0 && !currentLead && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Próximos na Fila ({queue.length})
            </CardTitle>
          </CardHeader>
          <div className="divide-y divide-border/40 max-h-72 overflow-y-auto">
            {queue.slice(0, 25).map((lead, idx) => {
              const sc = calcScore(lead);
              const attempts = lead.call_attempts || 0;
              return (
                <div key={lead.id} className="flex items-center justify-between px-4 py-2.5 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-muted-foreground w-5 shrink-0 text-right">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium truncate">{lead.lead_name ?? "—"}</p>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 border-0 shrink-0 ${
                            sc.label === "Hot"   ? "bg-red-500/20 text-red-400" :
                            sc.label === "Morno" ? "bg-yellow-500/20 text-yellow-400" :
                                                   "bg-blue-500/20 text-blue-400"
                          }`}
                        >
                          {sc.emoji} {sc.label} {sc.score}
                        </Badge>
                      </div>
                      <p className="text-xs font-mono text-muted-foreground">{displayPhone(lead)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 border-0 hidden sm:inline-flex ${attemptColor(attempts)}`}
                    >
                      {attemptLabel(attempts)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 border-0 ${
                        INTEREST_COLORS[lead.interest_status ?? "pending"] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {INTEREST_LABELS[lead.interest_status ?? "pending"] ?? lead.interest_status}
                    </Badge>
                  </div>
                </div>
              );
            })}
            {queue.length > 25 && (
              <div className="px-4 py-2.5 text-xs text-muted-foreground text-center">
                +{queue.length - 25} leads na fila...
              </div>
            )}
          </div>
        </Card>
      )}

      {queueLoaded && queue.length === 0 && dialerState === "idle" && processedCount > 0 && (
        <Card className="border-border/60">
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            <Phone className="h-8 w-8 mx-auto mb-2 opacity-30" />
            Fila concluída! {processedCount} leads processados.
            <br />
            <Button variant="outline" size="sm" className="mt-3" onClick={loadQueue}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Carregar nova fila
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ABA HISTÓRICO
// ═══════════════════════════════════════════════════════════════════════════════
function TabHistorico({ companyId }: { companyId: string | null | undefined }) {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("calls")
        .select(
          "id, lead_phone, lead_name, duration_seconds, status, created_at, transcript, ai_summary, ai_analysis, call_summary"
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (companyId) query = query.eq("company_id", companyId);
      const { data, error } = await query;

      if (error) throw error;

      setCalls(
        (data ?? []).map((d: any) => ({
          id: d.id,
          lead_phone: d.lead_phone ?? d.destination_number ?? null,
          lead_name: d.lead_name ?? null,
          duration_sec: d.duration_seconds ?? d.duration_sec ?? null,
          status: d.status ?? null,
          started_at: d.created_at ?? null,
          ai_qualification: d.ai_qualification ?? d.ai_analysis?.interest_level ?? null,
          transcript: d.transcript ?? null,
          ai_summary: d.ai_summary ?? d.ai_analysis?.reason ?? d.call_summary ?? null,
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
    setExpanded(prev => {
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
    c =>
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
          onChange={e => setSearch(e.target.value)}
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
          {filtered.map(call => {
            const isExpanded = expanded.has(call.id);
            return (
              <Card key={call.id} className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{call.lead_name ?? "Desconhecido"}</p>
                        {call.ai_qualification && (
                          <Badge variant="outline" className="text-[10px] px-1.5 border-0 bg-primary/10 text-primary">
                            {call.ai_qualification}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className="font-mono">{call.lead_phone ?? "—"}</span>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-emerald-400 hover:text-emerald-300"
                          title="Chamar no WA"
                          onClick={() => openWhatsApp(call.lead_phone!)}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {(call.transcript || call.ai_summary) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => toggleExpand(call.id)}
                        >
                          {isExpanded
                            ? <ChevronUp className="h-3.5 w-3.5" />
                            : <ChevronDown className="h-3.5 w-3.5" />
                          }
                        </Button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
                      {call.ai_summary && (
                        <div className="rounded-lg bg-primary/5 p-3">
                          <p className="text-xs font-medium text-primary mb-1">💡 Resumo Lucas</p>
                          <p className="text-xs text-muted-foreground">{call.ai_summary}</p>
                        </div>
                      )}
                      {call.transcript && (
                        <div className="rounded-lg bg-secondary/30 p-3 max-h-48 overflow-y-auto">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Transcrição</p>
                          <p className="text-xs whitespace-pre-wrap font-mono">{call.transcript}</p>
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
  const { collaborator, roleLevel } = useCollaborator();
  const { selectedCompanyId } = useCompanyFilter();
  const companyId = resolveCompanyFilter(selectedCompanyId, collaborator?.company_id);
  const collaboratorId = collaborator?.id ?? "";
  const isCEO = roleLevel === 0;

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
        subtitle="Discador e fila unificados — leads com interesse vão direto para Disparos"
      />
      <Tabs defaultValue="ligacoes" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-xs">
          <TabsTrigger value="ligacoes">
            <Phone className="h-3.5 w-3.5 mr-1.5" />
            Ligações
          </TabsTrigger>
          <TabsTrigger value="historico">
            <PhoneCall className="h-3.5 w-3.5 mr-1.5" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ligacoes">
          <TabLigacoes collaboratorId={collaboratorId} companyId={companyId} isCEO={isCEO} />
        </TabsContent>

        <TabsContent value="historico">
          <TabHistorico companyId={companyId} />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
