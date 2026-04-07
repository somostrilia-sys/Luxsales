/**
 * Ligacoes.tsx — Ligações unificadas (Fase 3 — LuxSales V3)
 * Discador + Fila unificados, usando campos novos: interest_status, phone_normalized, call_attempts
 * CEO vê stats agregados por colaborador; colaborador vê andamento detalhado + histórico
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
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Phone, PhoneOff, Pause, Play, Loader2,
  Clock, ChevronDown, ChevronUp, MessageSquare,
  RefreshCw, Wifi, WifiOff, PhoneCall, Users,
  TrendingUp, PhoneMissed, PhoneIncoming,
} from "lucide-react";
import { VoiceSelector, type VoiceProfile } from "@/components/VoiceSelector";
import { VoiceGallery } from "@/components/VoiceGallery";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";

// Wrapper da galeria que persiste escolha no localStorage
function LigacoesVoiceGallery() {
  const [selected, setSelected] = useState<VoiceProfile | null>(() => {
    const stored = localStorage.getItem("luxsales_selected_voice_id");
    return stored ? ({ id: stored } as VoiceProfile) : null;
  });
  return (
    <VoiceGallery
      selectedId={selected?.id ?? null}
      onSelect={(v) => {
        setSelected(v);
        localStorage.setItem("luxsales_selected_voice_id", v.id);
        // Dispatch evento pra outros componentes escutarem
        window.dispatchEvent(new CustomEvent("voice-selected", { detail: v }));
      }}
    />
  );
}

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
  sentiment: string | null;
  interest_detected: boolean | null;
}

// Log de progresso da sessão de discagem
interface DialerLogEntry {
  leadName: string;
  phone: string;
  result: "answered" | "no_answer" | "interested" | "no_interest" | "dialing";
  duration: number;
  time: Date;
}

type DialerState = "idle" | "running" | "paused";
type CallStatus = "idle" | "dialing" | "answered" | "in_call" | "ended";

const MAX_CALL_DURATION_SEC = 75; // 75s — nenhuma ligação dura mais que isso
const POLL_FAIL_LIMIT = 10; // falhas consecutivas → encerra

const INTEREST_LABELS: Record<string, string> = {
  pending: "Aguardando",
  not_interested_1: "1ª Recusa",
  not_interested_2: "2ª Recusa",
  interested: "Interesse",
  discarded: "Descartado",
};

const INTEREST_COLORS: Record<string, string> = {
  pending: "bg-slate-500/20 text-slate-300",
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

const SENTIMENT_CONFIG: Record<string, { label: string; color: string }> = {
  positive: { label: "Positivo", color: "bg-emerald-500/20 text-emerald-400" },
  interested: { label: "Interessado", color: "bg-emerald-500/20 text-emerald-400" },
  neutral: { label: "Neutro", color: "bg-slate-500/20 text-slate-300" },
  negative: { label: "Negativo", color: "bg-red-500/20 text-red-400" },
  objecting: { label: "Objeção", color: "bg-orange-500/20 text-orange-400" },
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

// ── VoIP Health (via edge function) ───────────────────────────────────────────
function useVoipStatus() {
  const [online, setOnline] = useState<boolean | null>(null);
  const check = useCallback(async () => {
    try {
      const res = await fetch(`${EDGE_BASE}/make-call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "",
        },
        body: JSON.stringify({ action: "pipeline-status" }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        setOnline(data.status === "online");
      } else {
        setOnline(false);
      }
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
// ABA LIGAÇÕES — Discador + Fila + Log de Progresso
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
  const [batchSize, setBatchSize] = useState<string>("100");
  const [concurrentSlots, setConcurrentSlots] = useState<string>("1");
  const [queue, setQueue] = useState<PoolLead[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [queueLoaded, setQueueLoaded] = useState(false);
  const [currentLead, setCurrentLead] = useState<PoolLead | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callDuration, setCallDuration] = useState(0);
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [processedCount, setProcessedCount] = useState(0);
  const [stats, setStats] = useState({ total: 0, answered: 0, interested: 0 });
  const [dialerLog, setDialerLog] = useState<DialerLogEntry[]>([]);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<VoiceProfile | null>(null);
  // Slot 2 (chamada simultânea)
  const [currentLead2, setCurrentLead2] = useState<PoolLead | null>(null);
  const [callStatus2, setCallStatus2] = useState<CallStatus>("idle");
  const [activeRoom2, setActiveRoom2] = useState<string | null>(null);
  const [callStartTime2, setCallStartTime2] = useState<Date | null>(null);
  const [callDuration2, setCallDuration2] = useState(0);
  // Slot 3
  const [currentLead3, setCurrentLead3] = useState<PoolLead | null>(null);
  const [callStatus3, setCallStatus3] = useState<CallStatus>("idle");
  const [activeRoom3, setActiveRoom3] = useState<string | null>(null);
  const [callStartTime3, setCallStartTime3] = useState<Date | null>(null);
  const [callDuration3, setCallDuration3] = useState(0);
  const callDurationRef = useRef(0);
  const callDurationRef2 = useRef(0);
  const callDurationRef3 = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef2 = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef3 = useRef<ReturnType<typeof setInterval> | null>(null);
  const queueRef = useRef<PoolLead[]>([]);
  const dialerStateRef = useRef<DialerState>("idle");
  const voipOnlineRef = useRef<boolean | null>(null);
  const concurrentRef = useRef(1);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { dialerStateRef.current = dialerState; }, [dialerState]);
  useEffect(() => { voipOnlineRef.current = voipOnline; }, [voipOnline]);
  useEffect(() => { concurrentRef.current = parseInt(concurrentSlots); }, [concurrentSlots]);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dialerLog]);

  const fetchStats = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("consultant_lead_pool")
      .select("interest_status")
      .eq("collaborator_id", collaboratorId)
      .gte("last_call_at", today.toISOString());
    if (!data) return;
    setStats({
      total: data.length,
      answered: data.filter(d =>
        d.interest_status && ["interested", "not_interested_1", "not_interested_2"].includes(d.interest_status)
      ).length,
      interested: data.filter(d => d.interest_status === "interested").length,
    });
  }, [collaboratorId]);

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
      timerRef.current = setInterval(() => {
        setCallDuration(d => { callDurationRef.current = d + 1; return d + 1; });
      }, 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (callStatus !== "ended") setCallDuration(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callStatus]);

  // Auto-detect call end via polling + timeout máximo
  useEffect(() => {
    if (callStatus !== "in_call" && callStatus !== "dialing" && callStatus !== "answered") return;
    let cancelled = false;
    const poll = async () => {
      await new Promise(r => setTimeout(r, 8000));
      let failures = 0;
      while (!cancelled) {
        // Timeout máximo: encerra automaticamente
        if (callDurationRef.current >= MAX_CALL_DURATION_SEC) {
          const dur = callDurationRef.current;
          setActiveRoom(null);
          markCallResult((dur >= 5 ? "interested" : "no_answer") as "interested" | "no_answer");
          break;
        }
        // Se não tem room, só espera o timeout
        if (!activeRoom) {
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        try {
          const res = await fetch(`${EDGE_BASE}/make-call`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "",
            },
            body: JSON.stringify({ action: "call-status", room: activeRoom }),
            signal: AbortSignal.timeout(5000),
          });
          if (res.ok) {
            const data = await res.json();
            failures = 0;
            if (!data.active) {
              const dur = callDurationRef.current;
              setActiveRoom(null);
              markCallResult((dur >= 5 ? "interested" : "no_answer") as "interested" | "no_answer");
              break;
            }
          } else {
            failures++;
          }
        } catch {
          failures++;
        }
        if (failures >= POLL_FAIL_LIMIT) {
          const dur = callDurationRef.current;
          setActiveRoom(null);
          markCallResult((dur >= 5 ? "interested" : "no_answer") as "interested" | "no_answer");
          break;
        }
        await new Promise(r => setTimeout(r, 3000));
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [activeRoom, callStatus]);

  // Timer slot 2
  useEffect(() => {
    if (callStatus2 === "in_call") {
      timerRef2.current = setInterval(() => {
        setCallDuration2(d => { callDurationRef2.current = d + 1; return d + 1; });
      }, 1000);
    } else {
      if (timerRef2.current) { clearInterval(timerRef2.current); timerRef2.current = null; }
      if (callStatus2 !== "ended") setCallDuration2(0);
    }
    return () => { if (timerRef2.current) clearInterval(timerRef2.current); };
  }, [callStatus2]);

  // Auto-detect call end slot 2 + timeout máximo
  useEffect(() => {
    if (callStatus2 !== "in_call" && callStatus2 !== "dialing" && callStatus2 !== "answered") return;
    let cancelled = false;
    const poll = async () => {
      await new Promise(r => setTimeout(r, 8000));
      let failures = 0;
      while (!cancelled) {
        if (callDurationRef2.current >= MAX_CALL_DURATION_SEC) {
          const dur = callDurationRef2.current;
          setActiveRoom2(null);
          markCallResult2((dur >= 5 ? "interested" : "no_answer") as "interested" | "no_answer");
          break;
        }
        if (!activeRoom2) {
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        try {
          const res = await fetch(`${EDGE_BASE}/make-call`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "",
            },
            body: JSON.stringify({ action: "call-status", room: activeRoom2 }),
            signal: AbortSignal.timeout(5000),
          });
          if (res.ok) {
            const data = await res.json();
            failures = 0;
            if (!data.active) {
              const dur = callDurationRef2.current;
              setActiveRoom2(null);
              markCallResult2((dur >= 5 ? "interested" : "no_answer") as "interested" | "no_answer");
              break;
            }
          } else { failures++; }
        } catch { failures++; }
        if (failures >= POLL_FAIL_LIMIT) {
          const dur = callDurationRef2.current;
          setActiveRoom2(null);
          markCallResult2((dur >= 5 ? "interested" : "no_answer") as "interested" | "no_answer");
          break;
        }
        await new Promise(r => setTimeout(r, 3000));
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [activeRoom2, callStatus2]);

  // Timer slot 3
  useEffect(() => {
    if (callStatus3 === "in_call") {
      timerRef3.current = setInterval(() => {
        setCallDuration3(d => { callDurationRef3.current = d + 1; return d + 1; });
      }, 1000);
    } else {
      if (timerRef3.current) { clearInterval(timerRef3.current); timerRef3.current = null; }
      if (callStatus3 !== "ended") setCallDuration3(0);
    }
    return () => { if (timerRef3.current) clearInterval(timerRef3.current); };
  }, [callStatus3]);

  // Auto-detect call end slot 3 + timeout máximo
  useEffect(() => {
    if (callStatus3 !== "in_call" && callStatus3 !== "dialing" && callStatus3 !== "answered") return;
    let cancelled = false;
    const poll = async () => {
      await new Promise(r => setTimeout(r, 8000));
      let failures = 0;
      while (!cancelled) {
        if (callDurationRef3.current >= MAX_CALL_DURATION_SEC) {
          const dur = callDurationRef3.current;
          setActiveRoom3(null);
          markCallResult3((dur >= 5 ? "interested" : "no_answer") as "interested" | "no_answer");
          break;
        }
        if (!activeRoom3) {
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        try {
          const res = await fetch(`${EDGE_BASE}/make-call`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "" },
            body: JSON.stringify({ action: "call-status", room: activeRoom3 }),
            signal: AbortSignal.timeout(5000),
          });
          if (res.ok) {
            const data = await res.json();
            failures = 0;
            if (!data.active) {
              const dur = callDurationRef3.current;
              setActiveRoom3(null);
              markCallResult3((dur >= 5 ? "interested" : "no_answer") as "interested" | "no_answer");
              break;
            }
          } else { failures++; }
        } catch { failures++; }
        if (failures >= POLL_FAIL_LIMIT) {
          const dur = callDurationRef3.current;
          setActiveRoom3(null);
          markCallResult3((dur >= 5 ? "interested" : "no_answer") as "interested" | "no_answer");
          break;
        }
        await new Promise(r => setTimeout(r, 3000));
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [activeRoom3, callStatus3]);

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true);
    try {
      const validStatuses = ["pending", "unknown", "not_interested_1"];
      let countQ = supabase.from("consultant_lead_pool").select("id, phone_normalized").in("interest_status", validStatuses);
      if (isCEO && companyId) countQ = countQ.eq("company_id", companyId);
      if (!isCEO) countQ = countQ.eq("collaborator_id", collaboratorId);
      const { data: allData } = await countQ;
      const invalidCount = (allData || []).filter(l => !l.phone_normalized).length;
      setInvalidPhoneCount(invalidCount);

      let query = supabase
        .from("consultant_lead_pool")
        .select("id, collaborator_id, lead_name, phone, phone_normalized, interest_status, call_attempts, last_call_at, priority, lead_category, dispatched, responded_at")
        .in("interest_status", validStatuses)
        .order("call_attempts", { ascending: true })
        .order("last_call_at", { ascending: true, nullsFirst: true })
        .limit(parseInt(batchSize));
      if (isCEO && companyId) query = query.eq("company_id", companyId);
      if (!isCEO) query = query.eq("collaborator_id", collaboratorId);
      const { data, error } = await query;

      if (error) throw error;

      const sorted = (data || []) as PoolLead[];

      setQueue(sorted);
      setQueueLoaded(true);
      setProcessedCount(0);
      setDialerLog([]);
      toast.success(`${sorted.length} leads carregados na fila`);
    } catch (e: any) {
      toast.error("Erro ao carregar fila: " + e.message);
    } finally {
      setLoadingQueue(false);
    }
  }, [collaboratorId, batchSize, isCEO, companyId]);

  const startCallInSlot = useCallback(async (slot: 1 | 2 | 3) => {
    const q = queueRef.current;
    if (q.length === 0) {
      if (slot === 1 && !currentLead2) {
        toast.info("Fila finalizada! Todos os leads foram processados.");
        setDialerState("idle");
      }
      return;
    }

    const lead = q[0];
    // Remove from queue immediately to prevent double-pick
    setQueue(prev => prev.slice(1));

    if (slot === 1) {
      setCurrentLead(lead);
      setCallStatus("dialing");
    } else if (slot === 2) {
      setCurrentLead2(lead);
      setCallStatus2("dialing");
    } else {
      setCurrentLead3(lead);
      setCallStatus3("dialing");
    }

    setDialerLog(prev => [...prev, {
      leadName: lead.lead_name ?? "Lead",
      phone: displayPhone(lead),
      result: "dialing",
      duration: 0,
      time: new Date(),
    }]);

    const phoneToCall = lead.phone_normalized ||
      (lead.phone?.startsWith("+") ? lead.phone : `+55${(lead.phone || "").replace(/\D/g, "")}`);

    try {
      await supabase
        .from("consultant_lead_pool")
        .update({ last_call_at: new Date().toISOString() })
        .eq("id", lead.id);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch(`${EDGE_BASE}/make-call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "",
        },
        body: JSON.stringify({
          action: "dial",
          to: phoneToCall,
          company_id: companyId,
          lead_name: lead.lead_name || "Lead",
          lead_id: lead.id,
          consultor_id: collaboratorId,
          voice_profile_id: selectedVoice?.id ?? null,
          voice_id: selectedVoice?.voice_id ?? null,
        }),
      });

      const callData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((callData as any).error ?? `HTTP ${res.status}`);
      }

      if (slot === 1) {
        setActiveRoom(callData.room || null);
        setCallStartTime(new Date());
        setTimeout(() => setCallStatus("in_call"), 4000);
      } else if (slot === 2) {
        setActiveRoom2(callData.room || null);
        setCallStartTime2(new Date());
        setTimeout(() => setCallStatus2("in_call"), 4000);
      } else {
        setActiveRoom3(callData.room || null);
        setCallStartTime3(new Date());
        setTimeout(() => setCallStatus3("in_call"), 4000);
      }
    } catch (e: any) {
      if (voipOnlineRef.current === false) {
        toast.info("VoIP offline — modo simulação");
        if (slot === 1) { setCallStartTime(new Date()); setTimeout(() => setCallStatus("in_call"), 800); }
        else if (slot === 2) { setCallStartTime2(new Date()); setTimeout(() => setCallStatus2("in_call"), 800); }
        else { setCallStartTime3(new Date()); setTimeout(() => setCallStatus3("in_call"), 800); }
      } else {
        toast.error("Erro VoIP: " + e.message);
        if (slot === 1) { setCallStatus("idle"); setCurrentLead(null); }
        else if (slot === 2) { setCallStatus2("idle"); setCurrentLead2(null); }
        else { setCallStatus3("idle"); setCurrentLead3(null); }
      }
    }
  }, [companyId, collaboratorId, selectedVoice]);

  const startNextCall = useCallback(async () => {
    await startCallInSlot(1);
  }, [startCallInSlot]);

  const startDialer = () => {
    if (queueRef.current.length === 0) {
      toast.warning("Carregue a fila primeiro");
      return;
    }
    setDialerState("running");
    startCallInSlot(1);
    if (concurrentRef.current >= 2 && queueRef.current.length > 0) {
      setTimeout(() => startCallInSlot(2), 500);
    }
    if (concurrentRef.current >= 3 && queueRef.current.length > 0) {
      setTimeout(() => startCallInSlot(3), 1000);
    }
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
      // Atendeu — IA vai decidir interesse via call-complete
      newInterestStatus = "pending";
      removeFromQueue = true;
      toast.success(`Atendeu (${duration}s) — IA analisando interesse...`);
    } else if (result === "no_interest") {
      if (currentLead.interest_status === "not_interested_1") {
        newInterestStatus = "not_interested_2";
        removeFromQueue = true;
      } else {
        newInterestStatus = "not_interested_1";
      }
    } else {
      // no_answer
      if (newAttempts >= 5) {
        newInterestStatus = "discarded";
        removeFromQueue = true;
        toast.warning(`Descartado após ${newAttempts} tentativas`);
      }
    }

    // Update log entry
    const logResult = result === "interested" ? "interested" as const
      : result === "no_interest" ? "no_interest" as const
      : result === "no_answer" ? "no_answer" as const
      : "no_answer" as const;
    setDialerLog(prev => {
      const updated = [...prev];
      if (updated.length > 0) {
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          result: logResult,
          duration: duration,
        };
      }
      return updated;
    });

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
        company_id: companyId,
        collaborator_id: collaboratorId,
        lead_name: currentLead.lead_name,
        lead_phone: displayPhone(currentLead),
        status: "completed",
        interest_detected: result === "interested",
        duration_sec: duration,
        started_at: startedAt,
      } as any).then(() => {}).catch((err: any) => console.error("call_logs insert failed:", err));
    }

    // Update queue
    if (!removeFromQueue) {
      const updatedLead: PoolLead = {
        ...currentLead,
        interest_status: newInterestStatus,
        call_attempts: newAttempts,
      };
      setQueue(prev => [...prev, updatedLead]);
    }

    setProcessedCount(p => p + 1);
    setCallStatus("idle");
    setCurrentLead(null);
    setCallDuration(0);
    fetchStats();

    if (dialerStateRef.current === "running") {
      setTimeout(() => startCallInSlot(1), 1500);
    }
  };

  const markCallResult2 = async (result: "interested" | "no_interest" | "no_answer") => {
    if (!currentLead2) return;
    const newAttempts = (currentLead2.call_attempts || 0) + 1;
    const duration = callDuration2;

    let newInterestStatus = currentLead2.interest_status || "pending";
    let removeFromQueue = false;

    if (result === "interested") {
      newInterestStatus = "pending";
      removeFromQueue = true;
    } else if (result === "no_interest") {
      if (currentLead2.interest_status === "not_interested_1") {
        newInterestStatus = "not_interested_2";
        removeFromQueue = true;
      } else {
        newInterestStatus = "not_interested_1";
      }
    } else {
      if (newAttempts >= 5) {
        newInterestStatus = "discarded";
        removeFromQueue = true;
      }
    }

    await supabase
      .from("consultant_lead_pool")
      .update({
        interest_status: newInterestStatus,
        call_attempts: newAttempts,
        last_call_at: new Date().toISOString(),
      })
      .eq("id", currentLead2.id);

    if (result !== "no_answer") {
      supabase.from("call_logs").insert({
        company_id: companyId,
        collaborator_id: collaboratorId,
        lead_name: currentLead2.lead_name,
        lead_phone: displayPhone(currentLead2),
        status: "completed",
        interest_detected: result === "interested",
        duration_sec: duration,
        started_at: callStartTime2?.toISOString() ?? new Date(Date.now() - duration * 1000).toISOString(),
      } as any).then(() => {}).catch((err: any) => console.error("call_logs insert failed:", err));
    }

    if (!removeFromQueue) {
      const updatedLead: PoolLead = {
        ...currentLead2,
        interest_status: newInterestStatus,
        call_attempts: newAttempts,
      };
      setQueue(prev => [...prev, updatedLead]);
    }

    setProcessedCount(p => p + 1);
    setCallStatus2("idle");
    setCurrentLead2(null);
    setCallDuration2(0);
    fetchStats();

    if (dialerStateRef.current === "running" && concurrentRef.current >= 2) {
      setTimeout(() => startCallInSlot(2), 1500);
    }
  };

  const markCallResult3 = async (result: "interested" | "no_interest" | "no_answer") => {
    if (!currentLead3) return;
    const newAttempts = (currentLead3.call_attempts || 0) + 1;
    const duration = callDuration3;
    let newInterestStatus = currentLead3.interest_status || "pending";
    let removeFromQueue = false;
    if (result === "interested") { newInterestStatus = "pending"; removeFromQueue = true; }
    else if (result === "no_interest") {
      if (currentLead3.interest_status === "not_interested_1") { newInterestStatus = "not_interested_2"; removeFromQueue = true; }
      else { newInterestStatus = "not_interested_1"; }
    } else { if (newAttempts >= 5) { newInterestStatus = "discarded"; removeFromQueue = true; } }
    await supabase.from("consultant_lead_pool").update({
      interest_status: newInterestStatus, call_attempts: newAttempts, last_call_at: new Date().toISOString(),
    }).eq("id", currentLead3.id);
    if (result !== "no_answer") {
      supabase.from("call_logs").insert({
        company_id: companyId,
        collaborator_id: collaboratorId,
        lead_name: currentLead3.lead_name,
        lead_phone: displayPhone(currentLead3),
        status: "completed",
        interest_detected: result === "interested",
        duration_sec: duration,
        started_at: callStartTime3?.toISOString() ?? new Date(Date.now() - duration * 1000).toISOString(),
      } as any).then(() => {}).catch((err: any) => console.error("call_logs insert failed:", err));
    }
    if (!removeFromQueue) {
      setQueue(prev => [...prev, { ...currentLead3, interest_status: newInterestStatus, call_attempts: newAttempts }]);
    }
    setProcessedCount(p => p + 1);
    setCallStatus3("idle"); setCurrentLead3(null); setCallDuration3(0);
    fetchStats();
    if (dialerStateRef.current === "running" && concurrentRef.current >= 3) {
      setTimeout(() => startCallInSlot(3), 1500);
    }
  };

  const totalInQueue = queue.length + processedCount;

  const LOG_RESULT_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
    dialing: { icon: "📞", color: "text-yellow-400", label: "Discando..." },
    answered: { icon: "✅", color: "text-emerald-400", label: "Atendeu" },
    no_answer: { icon: "📵", color: "text-red-400", label: "Não atendeu" },
    interested: { icon: "🔥", color: "text-emerald-400", label: "Com interesse" },
    no_interest: { icon: "❌", color: "text-orange-400", label: "Sem interesse" },
  };

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
              {voipOnline === false && (
                <Badge variant="outline" className="text-[10px] ml-1 border-yellow-500/30 text-yellow-400">
                  modo simulação
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">LiveKit Pipeline</span>
          </div>
          {voipConfig && voipConfig.ramal ? (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-primary/70" />
              <span className="text-muted-foreground">
                Canal VoIP:{" "}
                <span className="text-foreground font-mono">{voipConfig.ramal}</span>
                {" — "}
                <span className={voipConfig.ativo && voipOnline ? "text-emerald-400" : "text-muted-foreground"}>
                  {voipConfig.ativo && voipOnline ? "Online" : "Offline"}
                </span>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground/50" />
              <span className="text-muted-foreground/60">Canal VoIP: Não configurado</span>
              <span className="text-xs text-yellow-400/80">— Peça ao gestor para configurar seu canal VoIP</span>
            </div>
          )}
        </CardContent>
      </Card>

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
          {/* Batch selector + concurrent selector + load button */}
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
            <div className="w-[160px]">
              <p className="text-xs text-muted-foreground mb-1.5">Chamadas simultâneas</p>
              <Select
                value={concurrentSlots}
                onValueChange={setConcurrentSlots}
                disabled={dialerState === "running"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 chamada</SelectItem>
                  <SelectItem value="2">2 simultâneas</SelectItem>
                  <SelectItem value="3">3 simultâneas</SelectItem>
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

          {/* Voice Selector */}
          {queueLoaded && (
            <div className="mb-3">
              <VoiceSelector
                value={selectedVoice?.id ?? null}
                onChange={setSelectedVoice}
              />
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
                  disabled={!!currentLead && callStatus !== "idle"}
                >
                  <Pause className="h-4 w-4 mr-2" />
                  ⏸ Pausar
                </Button>
              )}
            </div>
          )}

          {/* Active call card */}
          {currentLead && (
            <div className="rounded-lg border-2 border-emerald-500/30 p-4 space-y-3 bg-emerald-500/5">
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
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-400" />
                  <span className="font-mono text-lg font-bold text-emerald-400">{formatDuration(callDuration)}</span>
                  {callStatus === "in_call" && (
                    <span className="text-xs text-emerald-400/60 animate-pulse ml-1">em andamento</span>
                  )}
                </div>
              )}

              {callStatus === "in_call" && (
                <div className="text-center text-xs text-muted-foreground animate-pulse">
                  IA conversando com o lead... Encerra automaticamente.
                </div>
              )}

              {callStatus === "ended" && (
                <div className="text-center text-xs text-emerald-400 animate-pulse">
                  Analisando conversa... Próximo lead em instantes.
                </div>
              )}
            </div>
          )}

          {/* Active call card - Slot 2 */}
          {currentLead2 && (
            <div className="rounded-lg border-2 border-blue-500/30 p-4 space-y-3 bg-blue-500/5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">{currentLead2.lead_name ?? "Lead"} <span className="text-xs text-blue-400">(slot 2)</span></p>
                  <p className="text-xs font-mono text-muted-foreground">{displayPhone(currentLead2)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tentativa {(currentLead2.call_attempts || 0) + 1} de 5
                  </p>
                </div>
                <Badge className={`text-xs ${CALL_COLOR[callStatus2]}`}>
                  {CALL_LABEL[callStatus2]}
                </Badge>
              </div>

              {callStatus2 === "dialing" && (
                <div className="flex items-center gap-2 text-yellow-400 text-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Discando para {displayPhone(currentLead2)}...</span>
                </div>
              )}

              {(callStatus2 === "in_call" || callStatus2 === "ended") && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-400" />
                  <span className="font-mono text-lg font-bold text-blue-400">{formatDuration(callDuration2)}</span>
                  {callStatus2 === "in_call" && (
                    <span className="text-xs text-blue-400/60 animate-pulse ml-1">em andamento</span>
                  )}
                </div>
              )}

              {callStatus2 === "in_call" && (
                <div className="text-center text-xs text-muted-foreground animate-pulse">
                  IA conversando com o lead... Encerra automaticamente.
                </div>
              )}

              {callStatus2 === "ended" && (
                <div className="text-center text-xs text-blue-400 animate-pulse">
                  Analisando conversa... Próximo lead em instantes.
                </div>
              )}
            </div>
          )}

          {/* Active call card - Slot 3 */}
          {currentLead3 && (
            <div className="rounded-lg border-2 border-purple-500/30 p-4 space-y-3 bg-purple-500/5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">{currentLead3.lead_name ?? "Lead"} <span className="text-xs text-purple-400">(slot 3)</span></p>
                  <p className="text-xs font-mono text-muted-foreground">{displayPhone(currentLead3)}</p>
                </div>
                <Badge className={`text-xs ${CALL_COLOR[callStatus3]}`}>
                  {CALL_LABEL[callStatus3]}
                </Badge>
              </div>
              {callStatus3 === "dialing" && (
                <div className="flex items-center gap-2 text-yellow-400 text-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Discando para {displayPhone(currentLead3)}...</span>
                </div>
              )}
              {(callStatus3 === "in_call" || callStatus3 === "ended") && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-400" />
                  <span className="font-mono text-lg font-bold text-purple-400">{formatDuration(callDuration3)}</span>
                  {callStatus3 === "in_call" && <span className="text-xs text-purple-400/60 animate-pulse ml-1">em andamento</span>}
                </div>
              )}
              {callStatus3 === "in_call" && (
                <div className="text-center text-xs text-muted-foreground animate-pulse">
                  IA conversando com o lead... Encerra automaticamente.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialer Progress Log */}
      {dialerLog.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <PhoneCall className="h-4 w-4" />
              Progresso da Sessão ({dialerLog.length} chamadas)
            </CardTitle>
          </CardHeader>
          <div className="max-h-60 overflow-y-auto divide-y divide-border/40">
            {dialerLog.map((entry, idx) => {
              const cfg = LOG_RESULT_CONFIG[entry.result] ?? LOG_RESULT_CONFIG.no_answer;
              const isActive = entry.result === "dialing";
              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between px-4 py-2 gap-3 ${
                    isActive ? "bg-yellow-500/5" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{idx + 1}</span>
                    <span className="text-sm">{cfg.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm truncate">{entry.leadName}</p>
                      <p className="text-xs font-mono text-muted-foreground">{entry.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {entry.duration > 0 && (
                      <span className="text-xs font-mono text-muted-foreground">
                        {formatDuration(entry.duration)}
                      </span>
                    )}
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border-0 ${
                      entry.result === "dialing" ? "bg-yellow-500/20 text-yellow-400 animate-pulse" :
                      entry.result === "interested" ? "bg-emerald-500/20 text-emerald-400" :
                      entry.result === "no_answer" ? "bg-red-500/20 text-red-400" :
                      entry.result === "no_interest" ? "bg-orange-500/20 text-orange-400" :
                      "bg-blue-500/20 text-blue-400"
                    }`}>
                      {cfg.label}
                    </Badge>
                    {isActive && <Loader2 className="h-3 w-3 animate-spin text-yellow-400" />}
                  </div>
                </div>
              );
            })}
            <div ref={logEndRef} />
          </div>
        </Card>
      )}

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
// ABA HISTÓRICO — Colaborador: detalhado | CEO: agregado por colaborador
// ═══════════════════════════════════════════════════════════════════════════════

// Stats por colaborador (visão CEO)
interface CollaboratorStats {
  id: string;
  name: string;
  role: string;
  totalCalls: number;
  answered: number;
  interested: number;
  avgDuration: number;
}

function TabHistoricoCEO({ companyId }: { companyId: string | undefined }) {
  const [collabStats, setCollabStats] = useState<CollaboratorStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCollab, setExpandedCollab] = useState<string | null>(null);
  const [collabCalls, setCollabCalls] = useState<CallLog[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [loadingMoreCalls, setLoadingMoreCalls] = useState(false);
  const [hasMoreCalls, setHasMoreCalls] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      // Get collaborators (only consultants and managers, not CEOs/directors)
      const { data: allCollabs } = await supabase
        .from("collaborators")
        .select("id, name, role:roles!collaborators_role_id_fkey(name, level)")
        .eq("company_id", companyId)
        .eq("active", true);

      if (!allCollabs) { setLoading(false); return; }

      // Filter: only show roles with level >= 2 (consultants, managers)
      const collabs = allCollabs.filter((c: any) => {
        const level = (c.role as any)?.level;
        return level === undefined || level === null || level >= 2;
      });

      // Get today's calls per collaborator from consultant_lead_pool
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const statsPromises = collabs.map(async (collab: any) => {
        const { data: poolData } = await supabase
          .from("consultant_lead_pool")
          .select("interest_status")
          .eq("collaborator_id", collab.id)
          .gte("last_call_at", today.toISOString());

        const calls = poolData || [];
        const answered = calls.filter((c: any) =>
          c.interest_status && ["interested", "not_interested_1", "not_interested_2"].includes(c.interest_status)
        ).length;

        return {
          id: collab.id,
          name: collab.name || "Sem nome",
          role: (collab.role as any)?.name || "Colaborador",
          totalCalls: calls.length,
          answered,
          interested: calls.filter((c: any) => c.interest_status === "interested").length,
          avgDuration: 0,
        };
      });

      const stats = await Promise.all(statsPromises);
      setCollabStats(stats.sort((a, b) => b.totalCalls - a.totalCalls));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const mapCollabCall = (d: any): CallLog => ({
    id: d.id,
    lead_phone: d.destination_number ?? null,
    lead_name: d.lead_name ?? null,
    duration_sec: d.duration_seconds ?? null,
    status: d.status ?? null,
    started_at: d.created_at ?? null,
    ai_qualification: d.ai_analysis?.interest_level ?? null,
    transcript: formatTranscript(d.transcript) ?? null,
    ai_summary: d.ai_analysis?.call_summary ?? d.ai_analysis?.reason ?? d.call_summary ?? null,
    sentiment: d.sentiment ?? null,
    interest_detected: d.interest_detected ?? null,
  });

  const loadCollabCalls = async (collabId: string) => {
    if (expandedCollab === collabId) {
      setExpandedCollab(null);
      return;
    }
    setExpandedCollab(collabId);
    setLoadingCalls(true);
    setHasMoreCalls(true);
    try {
      const { data } = await supabase
        .from("calls")
        .select("id, destination_number, lead_name, duration_seconds, status, created_at, call_summary, sentiment, interest_detected, ai_analysis, transcript")
        .eq("collaborator_id", collabId)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .range(0, PAGE_SIZE - 1);

      const mapped = (data ?? []).map(mapCollabCall);
      setCollabCalls(mapped);
      setHasMoreCalls(mapped.length >= PAGE_SIZE);
    } catch { /* ignore */ }
    setLoadingCalls(false);
  };

  const loadMoreCollabCalls = async () => {
    if (!expandedCollab || loadingMoreCalls || !hasMoreCalls) return;
    setLoadingMoreCalls(true);
    try {
      const from = collabCalls.length;
      const { data } = await supabase
        .from("calls")
        .select("id, destination_number, lead_name, duration_seconds, status, created_at, call_summary, sentiment, interest_detected, ai_analysis, transcript")
        .eq("collaborator_id", expandedCollab)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      const mapped = (data ?? []).map(mapCollabCall);
      setCollabCalls(prev => [...prev, ...mapped]);
      setHasMoreCalls(mapped.length >= PAGE_SIZE);
    } catch { /* ignore */ }
    setLoadingMoreCalls(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/60">
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-primary">{collabStats.reduce((a, c) => a + c.totalCalls, 0)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total ligações hoje</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{collabStats.reduce((a, c) => a + c.answered, 0)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total atendidas</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{collabStats.reduce((a, c) => a + c.interested, 0)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Com interesse</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-collaborator breakdown */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Users className="h-4 w-4" />
            Desempenho por Colaborador
          </CardTitle>
        </CardHeader>
        <div className="divide-y divide-border/40">
          {collabStats.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Nenhum colaborador com atividade hoje.
            </div>
          ) : collabStats.map(collab => (
            <div key={collab.id}>
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => loadCollabCalls(collab.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {collab.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{collab.name}</p>
                    <p className="text-xs text-muted-foreground">{collab.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-primary" />
                        <span className="font-bold">{collab.totalCalls}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <PhoneIncoming className="h-3 w-3 text-blue-400" />
                        <span className="font-bold text-blue-400">{collab.answered}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-emerald-400" />
                        <span className="font-bold text-emerald-400">{collab.interested}</span>
                      </span>
                    </div>
                  </div>
                  {expandedCollab === collab.id
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  }
                </div>
              </div>

              {/* Expanded: recent calls */}
              {expandedCollab === collab.id && (
                <div className="px-4 pb-3">
                  {loadingCalls ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                  ) : collabCalls.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">Sem chamadas registradas</p>
                  ) : (
                    <div className="space-y-1.5">
                      {collabCalls.map(call => (
                        <div key={call.id} className="flex items-center justify-between rounded-md bg-muted/20 px-3 py-2 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-muted-foreground">{call.lead_phone ?? "—"}</span>
                            {call.lead_name && <span className="truncate">{call.lead_name}</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {call.duration_sec != null && (
                              <span className="font-mono text-muted-foreground">{formatDuration(call.duration_sec)}</span>
                            )}
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border-0 ${
                              call.status === "completed" ? "bg-emerald-500/20 text-emerald-400" :
                              call.status === "answered" ? "bg-blue-500/20 text-blue-400" :
                              call.status === "ringing" ? "bg-yellow-500/20 text-yellow-400" :
                              "bg-slate-500/20 text-slate-300"
                            }`}>
                              {call.status === "completed" ? "Atendida" :
                               call.status === "answered" ? "Atendida" :
                               call.status === "ringing" ? "Não atendeu" :
                               call.status ?? "—"}
                            </Badge>
                            {call.interest_detected && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-0 bg-emerald-500/20 text-emerald-400">
                                🔥 Interesse
                              </Badge>
                            )}
                            <span className="text-muted-foreground">{formatDate(call.started_at)}</span>
                          </div>
                        </div>
                      ))}

                      {/* Carregar mais calls do colaborador */}
                      {hasMoreCalls && (
                        <div className="flex justify-center pt-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={loadMoreCollabCalls}
                            disabled={loadingMoreCalls}
                            className="text-xs h-7"
                          >
                            {loadingMoreCalls ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                            ) : null}
                            {loadingMoreCalls ? "Carregando..." : "Carregar mais"}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// Format transcript from JSON array to readable text
function formatTranscript(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries)) return raw;
    return entries.map((e: any) => {
      const role = e.role === "assistant" ? "Lucas" : "Lead";
      return `${role}: ${e.text}`;
    }).join("\n");
  } catch {
    return raw;
  }
}

// Histórico detalhado (visão Colaborador ou CEO)
const PAGE_SIZE = 50;

function TabHistorico({ companyId, collaboratorId, isCEO = false }: { companyId: string | undefined; collaboratorId?: string; isCEO?: boolean }) {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const mapCall = (d: any): CallLog => ({
    id: d.id,
    lead_phone: d.destination_number ?? null,
    lead_name: d.lead_name ?? null,
    duration_sec: d.duration_seconds ?? d.duration_sec ?? null,
    status: d.status ?? null,
    started_at: d.created_at ?? null,
    ai_qualification: d.ai_analysis?.interest_level ?? null,
    transcript: formatTranscript(d.transcript) ?? null,
    ai_summary: d.ai_summary ?? d.ai_analysis?.call_summary ?? d.ai_analysis?.reason ?? d.call_summary ?? null,
    sentiment: d.sentiment ?? null,
    interest_detected: d.interest_detected ?? null,
  });

  const buildQuery = useCallback(() => {
    let query = supabase
      .from("calls")
      .select(
        "id, destination_number, lead_name, duration_seconds, status, created_at, transcript, ai_summary, ai_analysis, call_summary, sentiment, interest_detected"
      )
      .order("created_at", { ascending: false });

    if (companyId) query = query.eq("company_id", companyId);
    if (!isCEO && collaboratorId) query = query.eq("collaborator_id", collaboratorId);

    return query;
  }, [companyId, collaboratorId, isCEO]);

  const fetchCalls = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await buildQuery().range(0, PAGE_SIZE - 1);
      if (error) throw error;
      setCalls((data ?? []).map(mapCall));
      setHasMore((data ?? []).length >= PAGE_SIZE);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [companyId, buildQuery]);

  const loadMore = useCallback(async () => {
    if (!companyId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const from = calls.length;
      const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      const newCalls = (data ?? []).map(mapCall);
      setCalls(prev => [...prev, ...newCalls]);
      setHasMore(newCalls.length >= PAGE_SIZE);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoadingMore(false);
    }
  }, [companyId, calls.length, loadingMore, hasMore, buildQuery]);

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
            const sentimentCfg = call.sentiment ? SENTIMENT_CONFIG[call.sentiment] : null;
            return (
              <Card key={call.id} className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{call.lead_name || "Lead"}</p>
                        {call.interest_detected && (
                          <Badge variant="outline" className="text-[10px] px-1.5 border-0 bg-emerald-500/20 text-emerald-400">
                            🔥 Interesse detectado
                          </Badge>
                        )}
                        {sentimentCfg && (
                          <Badge variant="outline" className={`text-[10px] px-1.5 border-0 ${sentimentCfg.color}`}>
                            {sentimentCfg.label}
                          </Badge>
                        )}
                        {call.ai_qualification && (
                          <Badge variant="outline" className="text-[10px] px-1.5 border-0 bg-primary/10 text-primary">
                            {call.ai_qualification}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className="font-mono">{call.lead_phone ?? "—"}</span>
                        <span>{formatDate(call.started_at)}</span>
                        {call.duration_sec != null && call.duration_sec > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(call.duration_sec)}
                          </span>
                        )}
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border-0 ${
                          call.status === "completed" ? "bg-emerald-500/20 text-emerald-400" :
                          call.status === "answered" ? "bg-blue-500/20 text-blue-400" :
                          call.status === "ringing" ? "bg-yellow-500/20 text-yellow-400" :
                          call.status === "no_answer" ? "bg-red-500/20 text-red-400" :
                          "bg-slate-500/20 text-slate-300"
                        }`}>
                          {call.status === "completed" ? "Completa" :
                           call.status === "answered" ? "Atendida" :
                           call.status === "ringing" ? "Discando" :
                           call.status === "no_answer" ? "Não atendeu" :
                           call.status ?? "—"}
                        </Badge>
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
                          <p className="text-xs font-medium text-primary mb-1">💡 Resumo da IA</p>
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

          {/* Carregar mais */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full max-w-xs"
              >
                {loadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {loadingMore ? "Carregando..." : "Carregar mais"}
              </Button>
            </div>
          )}

          {!hasMore && filtered.length > 0 && (
            <p className="text-center text-xs text-muted-foreground pt-2">
              Todas as {filtered.length} ligações carregadas.
            </p>
          )}
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
  // CEO pode ter company_id diferente (holding) — usar empresa selecionada ou Objetivo como fallback
  const companyId = selectedCompanyId && selectedCompanyId !== "all"
    ? selectedCompanyId
    : collaborator?.company_id || "70967469-9a9b-4e29-a744-410e41eb47a5";
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
        subtitle={isCEO
          ? "Visão geral das ligações de todos os colaboradores"
          : "Discador e fila unificados — leads com interesse vão direto para Disparos"
        }
      />
      <Tabs defaultValue="ligacoes" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="ligacoes">
            <Phone className="h-3.5 w-3.5 mr-1.5" />
            Ligações
          </TabsTrigger>
          <TabsTrigger value="vozes">
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
            Vozes
          </TabsTrigger>
          <TabsTrigger value="historico">
            <PhoneCall className="h-3.5 w-3.5 mr-1.5" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ligacoes">
          {isCEO ? (
            <TabHistoricoCEO companyId={companyId} />
          ) : (
            <TabLigacoes collaboratorId={collaboratorId} companyId={companyId} isCEO={isCEO} />
          )}
        </TabsContent>

        <TabsContent value="vozes">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Galeria de Vozes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400 mb-4">
                Ouça as amostras e escolha a voz do agente pras suas ligações. A voz selecionada será usada em todas as próximas chamadas.
              </p>
              <LigacoesVoiceGallery />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <TabHistorico companyId={companyId} collaboratorId={collaboratorId} isCEO={isCEO} />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
