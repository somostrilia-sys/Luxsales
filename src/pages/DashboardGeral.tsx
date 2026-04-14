import { useState, useEffect, useCallback } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCompany } from "@/contexts/CompanyContext";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { EDGE_BASE, SUPABASE_ANON_KEY } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Users, Phone, MessageCircle, UserCheck,
  RefreshCw, AlertTriangle, CheckCircle, Shield,
  BarChart3, Loader2, Info, TrendingUp, Send,
  ThumbsDown, Zap, Target, Activity,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────────

interface CallsData {
  today: { total: number; answered: number };
  answer_rate: number;
  opt_in_rate: number;
}
interface WhatsAppData {
  today: { total: number };
  delivery_rate: number;
  read_rate: number;
  reply_rate: number;
}
interface MetaQuality {
  status: string;
  messaging_limit_tier: string;
  usage_pct: number;
}
interface TeamData {
  total: number;
  active_dispatchers: number;
  total_dispatches_today: number;
  total_limit_today: number;
}
interface AlertItem {
  type: string;
  message: string;
  severity: "info" | "warning" | "error";
}
interface QueueItem {
  name: string;
  leads_called?: number;
  dispatched?: number;
  total_leads: number;
}
interface DashboardData {
  calls: CallsData;
  whatsapp: WhatsAppData;
  meta_quality: MetaQuality;
  team: TeamData;
  alerts: AlertItem[];
  queues: { call_queues: QueueItem[]; dispatch_queues: QueueItem[] };
}
interface KPIData {
  [key: string]: unknown;
}

// ── Defaults ───────────────────────────────────────────────────────────────────

const defaultData: DashboardData = {
  calls: { today: { total: 0, answered: 0 }, answer_rate: 0, opt_in_rate: 0 },
  whatsapp: { today: { total: 0 }, delivery_rate: 0, read_rate: 0, reply_rate: 0 },
  meta_quality: { status: "GREEN", messaging_limit_tier: "—", usage_pct: 0 },
  team: { total: 0, active_dispatchers: 0, total_dispatches_today: 0, total_limit_today: 0 },
  alerts: [],
  queues: { call_queues: [], dispatch_queues: [] },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
  };
}

function fmt(n: number) {
  return n.toLocaleString("pt-BR");
}

function pct(a: number, b: number) {
  if (!b) return 0;
  return Math.round((a / b) * 100);
}

// ── KPI Card Component ─────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  bg: string;
  sub?: string;
  onClick?: () => void;
}

function KpiCard({ label, value, icon: Icon, color, bg, sub, onClick }: KpiCardProps) {
  return (
    <Card
      className={`${onClick ? "cursor-pointer hover:border-primary/30" : ""} transition-colors`}
      onClick={onClick}
    >
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={`p-1.5 rounded-lg ${bg}`}>
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
        </div>
        <p className="text-2xl font-bold tracking-tight">
          {typeof value === "number" ? fmt(value) : value}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function KpiRowSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="pt-5 space-y-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function DashboardGeral() {
  const { company_id: baseCompanyId, user_role } = useCompany();
  const { roleLevel } = useCollaborator();
  const { selectedCompanyId } = useCompanyFilter();
  const { collaborator, isCEO, isColaborador } = useCollaborator();
  const company_id = selectedCompanyId !== "all" ? selectedCompanyId : baseCompanyId;
  const navigate = useNavigate();

  // Gestors (level 2) and consultors (level 3) should use their own dashboard
  if (roleLevel >= 2) {
    return <Navigate to="/meus-numeros" replace />;
  }

  // Edge-function data (existing sections)
  const [data, setData] = useState<DashboardData>(defaultData);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kpiOpen, setKpiOpen] = useState(false);
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);

  // ── LINHA 1 — Volume Operacional ──────────────────────────────────────────────
  const [opKpis, setOpKpis] = useState({
    totalLeads: 0,
    leadsDistribuidos: 0,
    leadsDisponiveis: 0,
    consultoresAtivos: 0,
  });
  const [opLoading, setOpLoading] = useState(true);

  // ── LINHA 2 — Pipeline de Ligações ────────────────────────────────────────────
  const [callKpis, setCallKpis] = useState({
    ligacoesHoje: 0,
    taxaAtendimento: 0,
    leadsInteresse: 0,
    leadsDescartados: 0,
  });
  const [callKpisLoading, setCallKpisLoading] = useState(true);

  // ── LINHA 3 — Disparos WhatsApp ───────────────────────────────────────────────
  const [waKpis, setWaKpis] = useState({
    disparosHoje: 0,
    taxaRespostaWA: 0,
    janelasAbertas: 0,
    convertidos: 0,
  });
  const [waKpisLoading, setWaKpisLoading] = useState(true);

  // ── LINHA 4 — TIER Meta ───────────────────────────────────────────────────────
  const [tierKpis, setTierKpis] = useState({
    tierAtual: 0,
    disponiveisHoje: 0,
    limitePorConsultor: 0,
    previsaoAumento: "—",
  });
  const [tierLoading, setTierLoading] = useState(true);

  // ── Distribuição de leads por consultor ───────────────────────────────────────
  const [leadsPerConsultor, setLeadsPerConsultor] = useState<{ name: string; leads: number }[]>([]);
  const [leadsConsultorLoading, setLeadsConsultorLoading] = useState(true);

  // ── Charts ────────────────────────────────────────────────────────────────────
  const [funnelData, setFunnelData] = useState<{ name: string; value: number }[]>([]);
  const [callsPerDay, setCallsPerDay] = useState<{ date: string; calls: number }[]>([]);
  const [dispatchPerDay, setDispatchPerDay] = useState<{ date: string; dispatches: number }[]>([]);
  const [topConsultores, setTopConsultores] = useState<{
    name: string;
    ligacoes: number;
    taxa: number;
    disparos: number;
    conversoes: number;
  }[]>([]);
  const [chartsLoading, setChartsLoading] = useState(true);

  // ─────────────────────────────────────────────────────────────────────────────
  // Edge function fetch (existing sections)
  // ─────────────────────────────────────────────────────────────────────────────
  const fetchDashboard = useCallback(async (silent = false) => {
    if (!company_id) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${EDGE_BASE}/dashboard-geral`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "overview", company_id, requester_role: user_role || "ceo" }),
      });
      if (res.ok) {
        const json = await res.json();
        setData({ ...defaultData, ...json });
      } else if (!silent) {
        toast.error("Erro ao carregar dashboard");
      }
    } catch {
      if (!silent) toast.error("Falha de conexão");
    }
    setLoading(false);
    setRefreshing(false);
  }, [company_id, user_role]);

  useEffect(() => {
    if (!isCEO) { setLoading(false); return; }
    fetchDashboard();
    const interval = setInterval(() => fetchDashboard(true), 60000);
    return () => clearInterval(interval);
  }, [fetchDashboard, isCEO]);

  // ─────────────────────────────────────────────────────────────────────────────
  // KPI modal
  // ─────────────────────────────────────────────────────────────────────────────
  const fetchKPIs = async () => {
    setKpiOpen(true);
    setKpiLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${EDGE_BASE}/dashboard-geral`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "kpis", company_id, requester_role: user_role || "ceo" }),
      });
      if (res.ok) setKpiData(await res.json());
      else toast.error("Erro ao carregar KPIs");
    } catch {
      toast.error("Falha de conexão");
    }
    setKpiLoading(false);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // LINHA 1 — Volume Operacional
  // ─────────────────────────────────────────────────────────────────────────────
  const fetchOpKpis = useCallback(async () => {
    setOpLoading(true);
    const filter = selectedCompanyId !== "all" ? selectedCompanyId : null;

    const [totalRes, distribRes, collabRes] = await Promise.all([
      (() => {
        let q = supabase.from("leads_master").select("id", { count: "exact", head: true });
        if (filter) q = q.eq("company_id", filter);
        if (!isCEO && collaborator?.id) q = (q as any).eq("collaborator_id", collaborator.id);
        return q;
      })(),
      (() => {
        let q = supabase.from("consultant_lead_pool").select("id", { count: "exact", head: true });
        if (filter) q = q.eq("company_id", filter);
        if (!isCEO && collaborator?.id) q = q.eq("collaborator_id", collaborator.id);
        return q;
      })(),
      (() => {
        let q = supabase.from("collaborators").select("id", { count: "exact", head: true }).eq("active", true);
        if (filter) q = q.eq("company_id", filter);
        return q;
      })(),
    ]);

    const total = totalRes.count ?? 0;
    const distribuidos = distribRes.count ?? 0;
    setOpKpis({
      totalLeads: total,
      leadsDistribuidos: distribuidos,
      leadsDisponiveis: Math.max(0, total - distribuidos),
      consultoresAtivos: collabRes.count ?? 0,
    });
    setOpLoading(false);
  }, [selectedCompanyId, isCEO, collaborator]);

  // ─────────────────────────────────────────────────────────────────────────────
  // LINHA 2 — Pipeline de Ligações
  // ─────────────────────────────────────────────────────────────────────────────
  const fetchCallKpis = useCallback(async () => {
    setCallKpisLoading(true);
    const filter = selectedCompanyId !== "all" ? selectedCompanyId : null;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let ligacoesHoje = 0;
    let ligacoesAtendidas = 0;
    try {
      const [totalCallRes, answeredCallRes] = await Promise.all([
        (() => {
          let q = supabase.from("calls").select("id", { count: "exact", head: true })
            .gte("created_at", todayStart.toISOString());
          if (filter) q = q.eq("company_id", filter);
          if (!isCEO && collaborator?.id) q = (q as any).eq("collaborator_id", collaborator.id);
          return q;
        })(),
        (() => {
          let q = supabase.from("calls").select("id", { count: "exact", head: true })
            .gte("created_at", todayStart.toISOString())
            .in("status", ["completed", "answered"]);
          if (filter) q = q.eq("company_id", filter);
          if (!isCEO && collaborator?.id) q = (q as any).eq("collaborator_id", collaborator.id);
          return q;
        })(),
      ]);
      ligacoesHoje = totalCallRes.count ?? 0;
      ligacoesAtendidas = answeredCallRes.count ?? 0;
    } catch { /* calls table may not exist */ }

    const [interRes, discRes] = await Promise.all([
      (() => {
        let q = supabase.from("consultant_lead_pool").select("id", { count: "exact", head: true })
          .eq("interest_status", "interested");
        if (filter) q = q.eq("company_id", filter);
        if (!isCEO && collaborator?.id) q = q.eq("collaborator_id", collaborator.id);
        return q;
      })(),
      (() => {
        let q = supabase.from("consultant_lead_pool").select("id", { count: "exact", head: true })
          .in("interest_status", ["lost", "dnc", "invalid", "discarded"]);
        if (filter) q = q.eq("company_id", filter);
        if (!isCEO && collaborator?.id) q = q.eq("collaborator_id", collaborator.id);
        return q;
      })(),
    ]);

    setCallKpis({
      ligacoesHoje,
      taxaAtendimento: pct(ligacoesAtendidas, ligacoesHoje),
      leadsInteresse: interRes.count ?? 0,
      leadsDescartados: discRes.count ?? 0,
    });
    setCallKpisLoading(false);
  }, [selectedCompanyId, isCEO, collaborator]);

  // ─────────────────────────────────────────────────────────────────────────────
  // LINHA 3 — Disparos WhatsApp
  // ─────────────────────────────────────────────────────────────────────────────
  const fetchWaKpis = useCallback(async () => {
    setWaKpisLoading(true);
    const filter = selectedCompanyId !== "all" ? selectedCompanyId : null;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [dispHojeRes, dispRespRes, janelaRes, convRes] = await Promise.all([
      (() => {
        let q = supabase.from("smart_dispatches").select("id", { count: "exact", head: true })
          .gte("created_at", todayStart.toISOString());
        if (filter) q = q.eq("company_id", filter);
        if (!isCEO && collaborator?.id) q = (q as any).eq("collaborator_id", collaborator.id);
        return q;
      })(),
      (() => {
        let q = supabase.from("smart_dispatches").select("id", { count: "exact", head: true })
          .gte("created_at", todayStart.toISOString())
          .not("replied_at", "is", null);
        if (filter) q = q.eq("company_id", filter);
        if (!isCEO && collaborator?.id) q = (q as any).eq("collaborator_id", collaborator.id);
        return q;
      })(),
      (() => {
        let q = supabase.from("wa_conversations").select("id", { count: "exact", head: true })
          .neq("status", "closed");
        if (filter) q = q.eq("company_id", filter);
        if (!isCEO && collaborator?.id) q = q.eq("collaborator_id", collaborator.id);
        return q;
      })(),
      (() => {
        let q = supabase.from("consultant_lead_pool").select("id", { count: "exact", head: true })
          .eq("interest_status", "converted");
        if (filter) q = q.eq("company_id", filter);
        if (!isCEO && collaborator?.id) q = q.eq("collaborator_id", collaborator.id);
        return q;
      })(),
    ]);

    const dispHoje = dispHojeRes.count ?? 0;
    const dispResp = dispRespRes.count ?? 0;
    setWaKpis({
      disparosHoje: dispHoje,
      taxaRespostaWA: pct(dispResp, dispHoje),
      janelasAbertas: janelaRes.count ?? 0,
      convertidos: convRes.count ?? 0,
    });
    setWaKpisLoading(false);
  }, [selectedCompanyId, isCEO, collaborator]);

  // ─────────────────────────────────────────────────────────────────────────────
  // LINHA 4 — TIER Meta
  // ─────────────────────────────────────────────────────────────────────────────
  const fetchTierKpis = useCallback(async () => {
    setTierLoading(true);
    const filter = selectedCompanyId !== "all" ? selectedCompanyId : null;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let tierLimit = 0;
    try {
      let q = supabase.from("system_configs").select("value").eq("key", "meta_tier_limit");
      if (filter) q = q.eq("company_id", filter);
      const { data: cfgData } = await q.maybeSingle();
      tierLimit = cfgData?.value ? Number(cfgData.value) : 0;
    } catch { /* ignore */ }

    let dispHoje = 0;
    try {
      let q = supabase.from("smart_dispatches").select("id", { count: "exact", head: true })
        .gte("created_at", todayStart.toISOString());
      if (filter) q = q.eq("company_id", filter);
      const { count } = await q;
      dispHoje = count ?? 0;
    } catch { /* ignore */ }

    let consultores = 0;
    try {
      let q = supabase.from("collaborators").select("id", { count: "exact", head: true }).eq("active", true);
      if (filter) q = q.eq("company_id", filter);
      const { count } = await q;
      consultores = count ?? 0;
    } catch { /* ignore */ }

    const disponiveisHoje = Math.max(0, tierLimit - dispHoje);
    const limitePorConsultor = consultores > 0 ? Math.floor(tierLimit / consultores) : 0;

    let previsao = "—";
    try {
      const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      let q = supabase.from("smart_dispatches").select("id", { count: "exact", head: true })
        .gte("created_at", since7d);
      if (filter) q = q.eq("company_id", filter);
      const { count: w7 } = await q;
      const dailyAvg = (w7 ?? 0) / 7;
      if (tierLimit > 0) {
        const usoPct = (dailyAvg / tierLimit) * 100;
        previsao = usoPct >= 80 ? "Alta ↑" : usoPct >= 50 ? "Média →" : "Baixa ↓";
      }
    } catch { /* ignore */ }

    setTierKpis({ tierAtual: tierLimit, disponiveisHoje, limitePorConsultor, previsaoAumento: previsao });
    setTierLoading(false);
  }, [selectedCompanyId, isCEO, collaborator]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Distribuição de leads por consultor
  // ─────────────────────────────────────────────────────────────────────────────
  const fetchLeadsPerConsultor = useCallback(async () => {
    setLeadsConsultorLoading(true);
    const filter = selectedCompanyId !== "all" ? selectedCompanyId : null;
    try {
      let q = supabase
        .from("consultant_lead_pool")
        .select("collaborator_id, collaborators!inner(name)");
      if (filter) q = (q as any).eq("company_id", filter);
      const { data } = await q;
      const map: Record<string, { name: string; count: number }> = {};
      ((data ?? []) as any[]).forEach((row) => {
        const id: string = row.collaborator_id;
        const name: string = row.collaborators?.name ?? "—";
        if (!map[id]) map[id] = { name, count: 0 };
        map[id].count++;
      });
      const sorted = Object.values(map)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(({ name, count }) => ({ name, leads: count }));
      setLeadsPerConsultor(sorted);
    } catch {
      setLeadsPerConsultor([]);
    }
    setLeadsConsultorLoading(false);
  }, [selectedCompanyId, isCEO, collaborator]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Charts
  // ─────────────────────────────────────────────────────────────────────────────
  const fetchCharts = useCallback(async () => {
    setChartsLoading(true);
    const filter = selectedCompanyId !== "all" ? selectedCompanyId : null;
    const since30 = new Date();
    since30.setDate(since30.getDate() - 29);
    since30.setHours(0, 0, 0, 0);

    // ── Funil ─────────────────────────────────────────────────────────────────
    try {
      const [
        totalRes, ligacoesRes, atendRes, interRes, dispRes, respRes, convRes,
      ] = await Promise.all([
        (() => { let q = supabase.from("leads_master").select("id", { count: "exact", head: true }); if (filter) q = q.eq("company_id", filter); return q; })(),
        (() => { let q = supabase.from("calls").select("id", { count: "exact", head: true }); if (filter) q = q.eq("company_id", filter); return q; })(),
        (() => { let q = supabase.from("calls").select("id", { count: "exact", head: true }).in("status", ["completed", "answered"]); if (filter) q = q.eq("company_id", filter); return q; })(),
        (() => { let q = supabase.from("leads_master").select("id", { count: "exact", head: true }).eq("status", "interested"); if (filter) q = q.eq("company_id", filter); return q; })(),
        (() => { let q = supabase.from("smart_dispatches").select("id", { count: "exact", head: true }); if (filter) q = q.eq("company_id", filter); return q; })(),
        (() => { let q = supabase.from("smart_dispatches").select("id", { count: "exact", head: true }).not("replied_at", "is", null); if (filter) q = q.eq("company_id", filter); return q; })(),
        (() => { let q = supabase.from("leads_master").select("id", { count: "exact", head: true }).eq("status", "converted"); if (filter) q = q.eq("company_id", filter); return q; })(),
      ]);
      setFunnelData([
        { name: "Total Leads", value: totalRes.count ?? 0 },
        { name: "Ligações", value: ligacoesRes.count ?? 0 },
        { name: "Atendidas", value: atendRes.count ?? 0 },
        { name: "Interesse", value: interRes.count ?? 0 },
        { name: "Disparos", value: dispRes.count ?? 0 },
        { name: "Respostas", value: respRes.count ?? 0 },
        { name: "Convertidos", value: convRes.count ?? 0 },
      ]);
    } catch { setFunnelData([]); }

    // ── Ligações por dia ───────────────────────────────────────────────────────
    try {
      let q = supabase.from("leads_master").select("last_call_at")
        .gte("last_call_at", since30.toISOString())
        .not("last_call_at", "is", null);
      if (filter) q = q.eq("company_id", filter);
      const { data: rawCalls } = await q;
      const dayMap: Record<string, number> = {};
      for (let i = 0; i < 30; i++) {
        const d = new Date(since30);
        d.setDate(d.getDate() + i);
        dayMap[d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })] = 0;
      }
      (rawCalls ?? []).forEach((l: { last_call_at: string }) => {
        const key = new Date(l.last_call_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        if (key in dayMap) dayMap[key]++;
      });
      setCallsPerDay(Object.entries(dayMap).map(([date, calls]) => ({ date, calls })));
    } catch { setCallsPerDay([]); }

    // ── Disparos por dia ──────────────────────────────────────────────────────
    try {
      let q = supabase.from("smart_dispatches").select("created_at")
        .gte("created_at", since30.toISOString());
      if (filter) q = q.eq("company_id", filter);
      const { data: rawDisp } = await q;
      const dayMap: Record<string, number> = {};
      for (let i = 0; i < 30; i++) {
        const d = new Date(since30);
        d.setDate(d.getDate() + i);
        dayMap[d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })] = 0;
      }
      (rawDisp ?? []).forEach((l: { created_at: string }) => {
        const key = new Date(l.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        if (key in dayMap) dayMap[key]++;
      });
      setDispatchPerDay(Object.entries(dayMap).map(([date, dispatches]) => ({ date, dispatches })));
    } catch { setDispatchPerDay([]); }

    // ── Top Consultores ───────────────────────────────────────────────────────
    try {
      let q = supabase.from("collaborators")
        .select("id, name, total_calls, calls_answered, total_dispatches, total_conversions")
        .eq("active", true);
      if (filter) q = q.eq("company_id", filter);
      q = q.order("total_calls", { ascending: false }).limit(10);
      const { data: collabs } = await q;
      setTopConsultores(
        (collabs ?? []).map((c: {
          id: string;
          name: string;
          total_calls?: number;
          calls_answered?: number;
          total_dispatches?: number;
          total_conversions?: number;
        }) => ({
          name: c.name ?? "—",
          ligacoes: c.total_calls ?? 0,
          taxa: pct(c.calls_answered ?? 0, c.total_calls ?? 0),
          disparos: c.total_dispatches ?? 0,
          conversoes: c.total_conversions ?? 0,
        }))
      );
    } catch { setTopConsultores([]); }

    setChartsLoading(false);
  }, [selectedCompanyId, isCEO, collaborator]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Mount & auto-refresh
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchOpKpis();
    fetchCallKpis();
    fetchWaKpis();
    fetchTierKpis();
    fetchCharts();
    fetchLeadsPerConsultor();
  }, [fetchOpKpis, fetchCallKpis, fetchWaKpis, fetchTierKpis, fetchCharts, fetchLeadsPerConsultor]);

  const refreshAll = () => {
    fetchDashboard(true);
    fetchOpKpis();
    fetchCallKpis();
    fetchWaKpis();
    fetchTierKpis();
    fetchCharts();
    fetchLeadsPerConsultor();
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Derived helpers
  // ─────────────────────────────────────────────────────────────────────────────
  const { calls, whatsapp: wa, meta_quality: mq, team, alerts, queues } = data;

  const qualityColorMap: Record<string, string> = {
    GREEN: "bg-green-500",
    YELLOW: "bg-yellow-500",
    RED: "bg-red-500",
  };

  const alertIcon = (severity: string) => {
    if (severity === "error") return <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />;
    if (severity === "warning") return <AlertTriangle className="h-4 w-4 text-warning shrink-0" />;
    return <Info className="h-4 w-4 text-accent shrink-0" />;
  };

  const teamPct = team.total_limit_today > 0
    ? (team.total_dispatches_today / team.total_limit_today) * 100
    : 0;

  const hasCallsData = callsPerDay.some((d) => d.calls > 0);
  const hasDispatchData = dispatchPerDay.some((d) => d.dispatches > 0);

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <PageHeader title="Dashboard Geral" subtitle="Visão executiva da operação" />
          <Button variant="outline" size="sm" onClick={refreshAll} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* ── LINHA 1 — Volume Operacional ─────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            Volume Operacional
          </p>
          {opLoading ? (
            <KpiRowSkeleton />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard
                label="Total Leads na Base"
                value={opKpis.totalLeads}
                icon={Users}
                color="text-blue-400"
                bg="bg-blue-500/10"
                onClick={() => navigate("/leads")}
              />
              <KpiCard
                label="Leads Distribuídos"
                value={opKpis.leadsDistribuidos}
                icon={UserCheck}
                color="text-emerald-400"
                bg="bg-emerald-500/10"
                onClick={() => navigate("/lead-distribution")}
              />
              <KpiCard
                label="Leads Disponíveis"
                value={opKpis.leadsDisponiveis}
                icon={Target}
                color="text-yellow-400"
                bg="bg-yellow-500/10"
              />
              <KpiCard
                label="Consultores Ativos"
                value={opKpis.consultoresAtivos}
                icon={Users}
                color="text-purple-400"
                bg="bg-purple-500/10"
                onClick={() => navigate("/team")}
              />
            </div>
          )}
        </div>

        {/* ── LINHA 2 — Pipeline de Ligações ───────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            Pipeline de Ligações
          </p>
          {callKpisLoading ? (
            <KpiRowSkeleton />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard
                label="Ligações Hoje"
                value={callKpis.ligacoesHoje}
                icon={Phone}
                color="text-green-400"
                bg="bg-green-500/10"
                onClick={() => navigate("/dashboard-voip")}
              />
              <KpiCard
                label="Taxa de Atendimento"
                value={`${callKpis.taxaAtendimento}%`}
                icon={Activity}
                color="text-teal-400"
                bg="bg-teal-500/10"
              />
              <KpiCard
                label="Leads com Interesse"
                value={callKpis.leadsInteresse}
                icon={TrendingUp}
                color="text-cyan-400"
                bg="bg-cyan-500/10"
              />
              <KpiCard
                label="Leads Descartados"
                value={callKpis.leadsDescartados}
                icon={ThumbsDown}
                color="text-red-400"
                bg="bg-red-500/10"
              />
            </div>
          )}
        </div>

        {/* ── LINHA 3 — Disparos WhatsApp ──────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            Disparos WhatsApp
          </p>
          {waKpisLoading ? (
            <KpiRowSkeleton />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard
                label="Disparos Realizados Hoje"
                value={waKpis.disparosHoje}
                icon={Send}
                color="text-emerald-400"
                bg="bg-emerald-500/10"
                onClick={() => navigate("/disparos")}
              />
              <KpiCard
                label="Taxa de Resposta WA"
                value={`${waKpis.taxaRespostaWA}%`}
                icon={MessageCircle}
                color="text-blue-400"
                bg="bg-blue-500/10"
              />
              <KpiCard
                label="Janelas Abertas"
                value={waKpis.janelasAbertas}
                icon={MessageCircle}
                color="text-orange-400"
                bg="bg-orange-500/10"
                onClick={() => navigate("/conversations")}
              />
              <KpiCard
                label="Leads Convertidos"
                value={waKpis.convertidos}
                icon={CheckCircle}
                color="text-green-400"
                bg="bg-green-500/10"
              />
            </div>
          )}
        </div>

        {/* ── LINHA 4 — TIER Meta ───────────────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            TIER Meta
          </p>
          {tierLoading ? (
            <KpiRowSkeleton />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard
                label="TIER Atual"
                value={fmt(tierKpis.tierAtual)}
                icon={Shield}
                color="text-purple-400"
                bg="bg-purple-500/10"
                onClick={() => navigate("/whatsapp-meta")}
              />
              <KpiCard
                label="Disponíveis Hoje"
                value={tierKpis.disponiveisHoje}
                icon={Zap}
                color="text-yellow-400"
                bg="bg-yellow-500/10"
              />
              <KpiCard
                label="Limite por Consultor"
                value={tierKpis.limitePorConsultor}
                icon={UserCheck}
                color="text-blue-400"
                bg="bg-blue-500/10"
              />
              <KpiCard
                label="Previsão de Aumento"
                value={tierKpis.previsaoAumento}
                icon={TrendingUp}
                color="text-emerald-400"
                bg="bg-emerald-500/10"
                sub="Baseado no volume dos últimos 7 dias"
              />
            </div>
          )}
        </div>

        {/* ── GRÁFICOS ─────────────────────────────────────────────────── */}

        {/* Funil de Conversão */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Funil de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartsLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : funnelData.every((d) => d.value === 0) ? (
              <div className="flex flex-col items-center justify-center h-[220px] gap-3 text-muted-foreground">
                <BarChart3 className="h-10 w-10 opacity-20" />
                <div className="text-center">
                  <p className="text-sm font-medium">Funil ainda vazio</p>
                  <p className="text-xs opacity-60 mt-1">Comece ligando para seus leads — os dados aparecerão aqui</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={funnelData} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="value" name="Leads" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
                    {funnelData.map((_, i) => (
                      <rect key={i} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Ligações por dia + Disparos por dia */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Phone className="h-4 w-4 text-green-400" /> Ligações por Dia (30 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartsLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : !hasCallsData ? (
                <div className="flex flex-col items-center justify-center h-[200px] gap-3 text-muted-foreground">
                  <Phone className="h-8 w-8 opacity-20" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Nenhuma ligação nos últimos 30 dias</p>
                    <p className="text-xs opacity-60 mt-1">Comece ligando para seus leads!</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={callsPerDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9 }}
                      interval={Math.floor(callsPerDay.length / 6)}
                    />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="calls"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={false}
                      name="Ligações"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Send className="h-4 w-4 text-emerald-400" /> Disparos por Dia (30 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartsLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : !hasDispatchData ? (
                <div className="flex flex-col items-center justify-center h-[200px] gap-3 text-muted-foreground">
                  <Send className="h-8 w-8 opacity-20" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Nenhum disparo nos últimos 30 dias</p>
                    <p className="text-xs opacity-60 mt-1">Qualifique leads por ligação e dispare via WhatsApp</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dispatchPerDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9 }}
                      interval={Math.floor(dispatchPerDay.length / 6)}
                    />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Bar
                      dataKey="dispatches"
                      fill="#10b981"
                      name="Disparos"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Consultores */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Top Consultores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartsLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : topConsultores.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[120px] gap-2 text-muted-foreground">
                <Users className="h-8 w-8 opacity-20" />
                <div className="text-center">
                  <p className="text-sm font-medium">Nenhum consultor com atividade ainda</p>
                  <p className="text-xs opacity-60 mt-0.5">Os dados aparecerão conforme as ligações forem realizadas</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-muted-foreground text-xs">
                      <th className="text-left py-2 pr-4 font-medium">Consultor</th>
                      <th className="text-right py-2 px-2 font-medium">Ligações</th>
                      <th className="text-right py-2 px-2 font-medium">Taxa Atend.</th>
                      <th className="text-right py-2 px-2 font-medium">Disparos</th>
                      <th className="text-right py-2 pl-2 font-medium">Conversões</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topConsultores.map((c, i) => (
                      <tr
                        key={i}
                        className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                      >
                        <td className="py-2 pr-4 font-medium truncate max-w-[140px]">{c.name}</td>
                        <td className="text-right py-2 px-2">{fmt(c.ligacoes)}</td>
                        <td className="text-right py-2 px-2">
                          <span className={c.taxa >= 50 ? "text-green-400" : c.taxa >= 30 ? "text-yellow-400" : "text-red-400"}>
                            {c.taxa}%
                          </span>
                        </td>
                        <td className="text-right py-2 px-2">{fmt(c.disparos)}</td>
                        <td className="text-right py-2 pl-2 text-emerald-400 font-semibold">{fmt(c.conversoes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Distribuição de Leads por Consultor ──────────────────────── */}
        {isCEO && <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400" /> Distribuição de Leads por Consultor
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leadsConsultorLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : leadsPerConsultor.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[220px] gap-3 text-muted-foreground">
                <Users className="h-10 w-10 opacity-20" />
                <div className="text-center">
                  <p className="text-sm font-medium">Nenhum lead distribuído ainda</p>
                  <p className="text-xs opacity-60 mt-1">Os dados aparecerão conforme os leads forem distribuídos</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={leadsPerConsultor} margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={40} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="leads" name="Leads" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>}

        {/* ── SEÇÕES EXISTENTES — Calls / WhatsApp / Meta Quality ─────── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-5 space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Calls */}
            <Card
              className="cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => navigate("/dashboard-voip")}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Phone className="h-4 w-4 text-green-400" /> Ligações (Edge)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Hoje</span>
                  <span className="font-semibold">
                    {calls.today.total} chamadas, {calls.today.answered} atendidas
                  </span>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Taxa de atendimento</span>
                    <span>{calls.answer_rate}%</span>
                  </div>
                  <Progress value={calls.answer_rate} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Taxa de opt-in</span>
                    <span>{calls.opt_in_rate}%</span>
                  </div>
                  <Progress value={calls.opt_in_rate} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* WhatsApp */}
            <Card
              className="cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => navigate("/whatsapp-meta")}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-emerald-400" /> WhatsApp
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Hoje</span>
                  <span className="font-semibold">{wa.today.total} disparos</span>
                </div>
                {[
                  { label: "Entregues", value: wa.delivery_rate },
                  { label: "Lidos", value: wa.read_rate },
                  { label: "Respondidos", value: wa.reply_rate },
                ].map((m) => (
                  <div key={m.label}>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{m.label}</span>
                      <span>{m.value}%</span>
                    </div>
                    <Progress value={m.value} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Meta Quality */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4 text-accent" /> Qualidade Meta
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Badge className={`${qualityColorMap[mq.status] || "bg-muted"} text-white font-bold`}>
                    {mq.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Tier: <strong className="text-foreground">{mq.messaging_limit_tier}</strong>
                  </span>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Uso do limite</span>
                    <span>{mq.usage_pct}%</span>
                  </div>
                  <Progress value={mq.usage_pct} className="h-2" />
                </div>
                {mq.status === "RED" && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/30">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                    <span className="text-xs text-destructive font-medium">
                      Envios pausados — qualidade crítica
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Team & Alerts ─────────────────────────────────────────────── */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Equipe
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-2xl font-bold">{team.total}</p>
                    <p className="text-xs text-muted-foreground">membros ativos</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{team.active_dispatchers}</p>
                    <p className="text-xs text-muted-foreground">disparando hoje</p>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Disparos usados</span>
                    <span>
                      {team.total_dispatches_today} / {team.total_limit_today}
                    </span>
                  </div>
                  <Progress value={teamPct} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" /> Alertas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {alerts.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    Tudo operando normalmente ✓
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {alerts.map((a, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 border border-border/50 text-sm"
                      >
                        {alertIcon(a.severity)}
                        <span>{a.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Filas Ativas ──────────────────────────────────────────────── */}
        {!loading && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-accent" /> Filas Ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="calls">
                <TabsList className="mb-3">
                  <TabsTrigger value="calls">Ligações</TabsTrigger>
                  <TabsTrigger value="dispatches">Disparos</TabsTrigger>
                </TabsList>
                <TabsContent value="calls">
                  {queues.call_queues.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma fila ativa</p>
                  ) : (
                    <div className="space-y-3">
                      {queues.call_queues.map((q, i) => {
                        const p = q.total_leads > 0 ? ((q.leads_called || 0) / q.total_leads) * 100 : 0;
                        return (
                          <div key={i} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">{q.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {q.leads_called || 0}/{q.total_leads}
                              </span>
                            </div>
                            <Progress value={p} className="h-2" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="dispatches">
                  {queues.dispatch_queues.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma fila ativa</p>
                  ) : (
                    <div className="space-y-3">
                      {queues.dispatch_queues.map((q, i) => {
                        const p = q.total_leads > 0 ? ((q.dispatched || 0) / q.total_leads) * 100 : 0;
                        return (
                          <div key={i} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">{q.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {q.dispatched || 0}/{q.total_leads}
                              </span>
                            </div>
                            <Progress value={p} className="h-2" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* ── KPIs Button ───────────────────────────────────────────────── */}
        <div className="flex justify-center">
          <Button variant="outline" onClick={fetchKPIs}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Ver KPIs Semanais
          </Button>
        </div>

        {/* KPI Modal */}
        <Dialog open={kpiOpen} onOpenChange={setKpiOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>KPIs Semanais / Mensais</DialogTitle>
            </DialogHeader>
            {kpiLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : kpiData ? (
              <div className="space-y-4">
                {Object.entries(kpiData).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex justify-between items-center p-3 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <span className="text-sm font-medium capitalize">{key.replace(/_/g, " ")}</span>
                    <span className="text-sm font-bold">
                      {typeof value === "number" ? fmt(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                Sem dados de KPIs disponíveis
              </p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
