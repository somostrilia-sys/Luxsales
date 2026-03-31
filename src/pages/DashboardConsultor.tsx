import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useCompany } from "@/contexts/CompanyContext";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import {
  Phone, MessageCircle, Users, TrendingUp,
  Send, Target, RefreshCw, CheckCircle,
  Activity, BarChart2, Clock, Bot,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("pt-BR");
}

function pct(a: number, b: number) {
  if (!b) return 0;
  return Math.round((a / b) * 100);
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  bg: string;
  sub?: string;
  highlight?: boolean;
  onClick?: () => void;
}

function KpiCard({ label, value, icon: Icon, color, bg, sub, highlight, onClick }: KpiCardProps) {
  return (
    <Card
      className={`${onClick ? "cursor-pointer hover:border-primary/30" : ""} ${
        highlight ? "border-primary/40 bg-primary/5" : ""
      } transition-colors`}
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

export default function DashboardConsultor() {
  const { company_id } = useCompany();
  const { collaborator, isColaborador, isGestor, isCEO, isDiretor } = useCollaborator();
  const navigate = useNavigate();

  const collaboratorId = collaborator?.id;
  const isIndividual = isColaborador;

  // Period toggle
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");

  // Leads pessoais
  const [leadsAtivos, setLeadsAtivos] = useState(0);
  const [leadsLoading, setLeadsLoading] = useState(true);

  // Ligações no período
  const [ligacoesHoje, setLigacoesHoje] = useState(0);
  const [ligacoesAtendidas, setLigacoesAtendidas] = useState(0);
  const [callsLoading, setCallsLoading] = useState(true);

  // Leads com interesse
  const [leadsInteresse, setLeadsInteresse] = useState(0);

  // Disparos
  const [disparosHoje, setDisparosHoje] = useState(0);
  const [disparosDisponiveis, setDisparosDisponiveis] = useState(0);
  const [disparosLoading, setDisparosLoading] = useState(true);

  // Conversas ativas
  const [conversasAtivas, setConversasAtivas] = useState(0);

  // Meta do mês
  const [metaMes, setMetaMes] = useState<number | null>(null);
  const [conversoesMes, setConversoesMes] = useState(0);

  // Últimas atividades
  interface AtividadeItem {
    id: string;
    tipo: "call" | "wa";
    label: string;
    sub: string;
    ts: string;
    positivo?: boolean;
  }
  const [atividades, setAtividades] = useState<AtividadeItem[]>([]);

  const [allLoading, setAllLoading] = useState(true);

  const getPeriodStart = (p: typeof period) => {
    const d = new Date();
    if (p === "today") { d.setHours(0, 0, 0, 0); }
    else if (p === "week") { d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0); }
    else { d.setDate(d.getDate() - 30); d.setHours(0, 0, 0, 0); }
    return d.toISOString();
  };

  const monthStart = () => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  };

  const fetchAll = useCallback(async () => {
    if (!company_id) return;
    if (isIndividual && !collaboratorId) return;
    setAllLoading(true);

    const periodStart = getPeriodStart(period);
    const month = monthStart();

    await Promise.all([
      // Meus leads ativos (na fila)
      (async () => {
        setLeadsLoading(true);
        try {
          let q = supabase
            .from("consultant_lead_pool")
            .select("id", { count: "exact", head: true })
            .eq("company_id", company_id)
            .neq("status", "done");
          if (isIndividual) q = q.eq("collaborator_id", collaboratorId!);
          const { count } = await q;
          setLeadsAtivos(count ?? 0);
        } catch { setLeadsAtivos(0); }
        setLeadsLoading(false);
      })(),

      // Ligações no período + interesses — via consultant_lead_pool
      (async () => {
        setCallsLoading(true);
        try {
          let ligQ = supabase
            .from("consultant_lead_pool")
            .select("id", { count: "exact", head: true })
            .eq("company_id", company_id)
            .gt("call_attempts", 0)
            .gte("last_contact_at", periodStart);
          let interQ = supabase
            .from("consultant_lead_pool")
            .select("id", { count: "exact", head: true })
            .eq("company_id", company_id)
            .eq("interest_status", "interested");
          if (isIndividual) {
            ligQ = ligQ.eq("collaborator_id", collaboratorId!);
            interQ = interQ.eq("collaborator_id", collaboratorId!);
          }
          const [ligRes, interRes] = await Promise.all([ligQ, interQ]);
          setLigacoesHoje(ligRes.count ?? 0);
          setLigacoesAtendidas(0); // não mais usado
          setLeadsInteresse(interRes.count ?? 0);
        } catch {
          setLigacoesHoje(0);
          setLigacoesAtendidas(0);
          setLeadsInteresse(0);
        }
        setCallsLoading(false);
      })(),

      // Disparos hoje + limite
      (async () => {
        setDisparosLoading(true);
        try {
          // Buscar limite do consultor em system_configs ou collaborator config
          let limite = 0;
          try {
            const { data: cfgData } = await supabase
              .from("system_configs")
              .select("value")
              .eq("key", "meta_tier_limit")
              .eq("company_id", company_id)
              .maybeSingle();

            // Buscar qtd consultores para dividir tier
            const { count: totalCollabs } = await supabase
              .from("collaborators")
              .select("id", { count: "exact", head: true })
              .eq("company_id", company_id)
              .eq("active", true);

            const tierLimit = cfgData?.value ? Number(cfgData.value) : 0;
            limite = totalCollabs && totalCollabs > 0 ? Math.floor(tierLimit / totalCollabs) : 0;
          } catch { /* ignore */ }

          let dispQ = supabase
            .from("smart_dispatches")
            .select("id", { count: "exact", head: true })
            .eq("company_id", company_id)
            .gte("created_at", today);
          if (isIndividual) dispQ = dispQ.eq("collaborator_id", collaboratorId!);
          const { count: dispHoje } = await dispQ;

          const usados = dispHoje ?? 0;
          setDisparosHoje(usados);
          setDisparosDisponiveis(Math.max(0, limite - usados));
        } catch {
          setDisparosHoje(0);
          setDisparosDisponiveis(0);
        }
        setDisparosLoading(false);
      })(),

      // Conversas ativas
      (async () => {
        try {
          let waQ = supabase
            .from("wa_conversations")
            .select("id", { count: "exact", head: true })
            .eq("company_id", company_id)
            .neq("status", "closed");
          if (isIndividual) waQ = waQ.eq("collaborator_id", collaboratorId!);
          const { count } = await waQ;
          setConversasAtivas(count ?? 0);
        } catch { setConversasAtivas(0); }
      })(),

      // Meta do mês + conversões
      (async () => {
        try {
          // Buscar meta configurada — só faz sentido para consultor individual
          if (isIndividual && collaboratorId) {
            const { data: metaData } = await supabase
              .from("collaborator_goals")
              .select("monthly_conversions")
              .eq("collaborator_id", collaboratorId)
              .maybeSingle();
            if (metaData?.monthly_conversions) {
              setMetaMes(metaData.monthly_conversions);
            }
          }

          let convQ = supabase
            .from("leads_master")
            .select("id", { count: "exact", head: true })
            .eq("company_id", company_id)
            .eq("status", "converted")
            .gte("updated_at", month);
          if (isIndividual && collaboratorId) convQ = convQ.eq("collaborator_id", collaboratorId);
          const { count: convMes } = await convQ;

          setConversoesMes(convMes ?? 0);
        } catch {
          setMetaMes(null);
          setConversoesMes(0);
        }
      })(),

      // Últimas atividades (5 mais recentes: ligações + WA)
      (async () => {
        try {
          let callLogQ = supabase
            .from("call_logs")
            .select("id, lead_name, lead_phone, status, goal_achieved, created_at")
            .eq("company_id", company_id)
            .order("created_at", { ascending: false })
            .limit(5);
          let waLogQ = supabase
            .from("wa_conversations")
            .select("id, lead_name, phone, status, last_message_at, last_message")
            .eq("company_id", company_id)
            .order("last_message_at", { ascending: false })
            .limit(5);
          if (isIndividual && collaboratorId) {
            callLogQ = callLogQ.eq("collaborator_id", collaboratorId);
            waLogQ = waLogQ.eq("collaborator_id", collaboratorId);
          }
          const [callsRes, waRes] = await Promise.all([callLogQ, waLogQ]);
          const items: AtividadeItem[] = [];
          for (const c of callsRes.data || []) {
            items.push({
              id: c.id,
              tipo: "call",
              label: c.lead_name || c.lead_phone || "Lead",
              sub: `Ligação — ${c.status || "—"}`,
              ts: c.created_at,
              positivo: c.goal_achieved === true,
            });
          }
          for (const w of waRes.data || []) {
            items.push({
              id: `wa-${w.id}`,
              tipo: "wa",
              label: w.lead_name || w.phone || "Lead",
              sub: w.last_message ? w.last_message.slice(0, 60) : "Conversa WA",
              ts: w.last_message_at || "",
            });
          }
          items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
          setAtividades(items.slice(0, 5));
        } catch { setAtividades([]); }
      })(),
    ]);

    setAllLoading(false);
  }, [collaboratorId, company_id, period, isIndividual]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const taxaAtendimento = pct(leadsInteresse, Math.max(ligacoesHoje, 1));
  const metaPct = metaMes && metaMes > 0 ? pct(conversoesMes, metaMes) : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <PageHeader
            title={isIndividual ? "Meus Números" : isGestor ? "Números da Equipe" : "Números Gerais"}
            subtitle={
              isIndividual
                ? `Olá, ${collaborator?.name?.split(" ")[0] ?? "Consultor"}! Aqui está sua performance.`
                : isGestor
                ? `Olá, ${collaborator?.name?.split(" ")[0] ?? "Gestor"}! Performance agregada da equipe.`
                : `Olá, ${collaborator?.name?.split(" ")[0] ?? ""}! Visão geral da empresa.`
            }
          />
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={allLoading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${allLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* Period toggle */}
        <div className="flex gap-1 bg-muted/50 rounded-lg p-1 w-fit">
          {(["today", "week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-xs px-3 py-1 rounded-md transition-colors ${
                period === p
                  ? "bg-background text-foreground shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "today" ? "Hoje" : p === "week" ? "7 dias" : "30 dias"}
            </button>
          ))}
        </div>

        {/* ── LINHA 1 — Meus Leads & Ligações ──────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            {isIndividual ? "Minha Fila" : "Fila da Equipe"}
          </p>
          {leadsLoading || callsLoading ? (
            <KpiRowSkeleton />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard
                label={isIndividual ? "Meus Leads Ativos" : "Leads Ativos"}
                value={leadsAtivos}
                icon={Users}
                color="text-blue-400"
                bg="bg-blue-500/10"
                onClick={() => navigate("/my-leads")}
              />
              <KpiCard
                label={period === "today" ? "Ligações Hoje" : period === "week" ? "Ligações (7 dias)" : "Ligações (30 dias)"}
                value={ligacoesHoje}
                icon={Phone}
                color="text-green-400"
                bg="bg-green-500/10"
                onClick={() => navigate("/ligacoes")}
              />
              <KpiCard
                label="Taxa de Interesse"
                value={`${taxaAtendimento}%`}
                icon={Activity}
                color="text-teal-400"
                bg="bg-teal-500/10"
                highlight={taxaAtendimento >= 20}
              />
              <KpiCard
                label="Leads com Interesse"
                value={leadsInteresse}
                icon={TrendingUp}
                color="text-cyan-400"
                bg="bg-cyan-500/10"
              />
            </div>
          )}
        </div>

        {/* ── LINHA 2 — Disparos & Conversas ───────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            Disparos & Conversas
          </p>
          {disparosLoading ? (
            <KpiRowSkeleton />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard
                label="Disparos Disponíveis"
                value={disparosDisponiveis}
                icon={Send}
                color="text-yellow-400"
                bg="bg-yellow-500/10"
                sub="Meu limite hoje"
              />
              <KpiCard
                label="Disparos Usados Hoje"
                value={disparosHoje}
                icon={Send}
                color="text-emerald-400"
                bg="bg-emerald-500/10"
                onClick={() => navigate("/disparos")}
              />
              <KpiCard
                label="Conversas Ativas"
                value={conversasAtivas}
                icon={MessageCircle}
                color="text-orange-400"
                bg="bg-orange-500/10"
                onClick={() => navigate("/conversations")}
              />
              <KpiCard
                label="Conversões no Mês"
                value={conversoesMes}
                icon={CheckCircle}
                color="text-green-400"
                bg="bg-green-500/10"
                highlight={metaPct !== null && metaPct >= 100}
              />
            </div>
          )}
        </div>

        {/* ── Meta do Mês ───────────────────────────────────────────────── */}
        {metaMes !== null && metaMes > 0 && (
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Meta do Mês
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {fmt(conversoesMes)} / {fmt(metaMes)} conversões
                </span>
                <Badge
                  className={
                    metaPct !== null && metaPct >= 100
                      ? "bg-green-500 text-white"
                      : metaPct !== null && metaPct >= 70
                      ? "bg-yellow-500 text-white"
                      : "bg-red-500 text-white"
                  }
                >
                  {metaPct ?? 0}%
                </Badge>
              </div>
              <Progress value={Math.min(metaPct ?? 0, 100)} className="h-3" />
              {metaPct !== null && metaPct >= 100 && (
                <p className="text-xs text-green-400 font-medium text-center">
                  🎉 Meta atingida! Parabéns!
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Performance rápida ────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-accent" /> Performance Hoje
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Taxa de Interesse</span>
                <span>{taxaAtendimento}%</span>
              </div>
              <Progress value={taxaAtendimento} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Uso de Disparos</span>
                <span>
                  {disparosHoje} / {disparosHoje + disparosDisponiveis}
                </span>
              </div>
              <Progress
                value={pct(disparosHoje, disparosHoje + disparosDisponiveis)}
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Ações Rápidas ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-14 flex flex-col gap-1"
            onClick={() => navigate("/ligacoes")}
          >
            <Phone className="h-5 w-5" />
            <span className="text-xs">Ir para Ligações</span>
          </Button>
          <Button
            variant="outline"
            className="h-14 flex flex-col gap-1"
            onClick={() => navigate("/disparos")}
          >
            <Send className="h-5 w-5" />
            <span className="text-xs">Ir para Disparos</span>
          </Button>
        </div>

        {/* ── Últimas Atividades ────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent" /> Últimas Atividades
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 items-center">
                    <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                      <div className="h-2 w-48 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : atividades.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma atividade recente
              </p>
            ) : (
              <div className="space-y-3">
                {atividades.map((a) => (
                  <div key={a.id} className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-full shrink-0 ${a.tipo === "call" ? "bg-green-500/10" : "bg-blue-500/10"}`}>
                      {a.tipo === "call"
                        ? <Phone className="h-3.5 w-3.5 text-green-400" />
                        : <MessageCircle className="h-3.5 w-3.5 text-blue-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.sub}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-muted-foreground">
                        {a.ts ? format(new Date(a.ts), "dd/MM HH:mm", { locale: ptBR }) : "—"}
                      </p>
                      {a.positivo === true && <CheckCircle className="h-3 w-3 text-green-400 ml-auto mt-0.5" />}
                    </div>
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
