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
  Activity, BarChart2,
} from "lucide-react";

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
  const { collaborator } = useCollaborator();
  const navigate = useNavigate();

  const collaboratorId = collaborator?.id;

  // Leads pessoais
  const [leadsAtivos, setLeadsAtivos] = useState(0);
  const [leadsLoading, setLeadsLoading] = useState(true);

  // Ligações hoje
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

  const [allLoading, setAllLoading] = useState(true);

  const todayStart = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  };

  const monthStart = () => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  };

  const fetchAll = useCallback(async () => {
    if (!collaboratorId || !company_id) return;
    setAllLoading(true);

    const today = todayStart();
    const month = monthStart();

    await Promise.all([
      // Meus leads ativos (na fila)
      (async () => {
        setLeadsLoading(true);
        try {
          const { count } = await supabase
            .from("consultant_lead_pool")
            .select("id", { count: "exact", head: true })
            .eq("company_id", company_id)
            .eq("collaborator_id", collaboratorId)
            .neq("status", "done");
          setLeadsAtivos(count ?? 0);
        } catch { setLeadsAtivos(0); }
        setLeadsLoading(false);
      })(),

      // Ligações hoje + atendidas + interesse
      (async () => {
        setCallsLoading(true);
        try {
          const [ligRes, atendRes, interRes] = await Promise.all([
            supabase
              .from("calls")
              .select("id", { count: "exact", head: true })
              .eq("company_id", company_id)
              .eq("collaborator_id", collaboratorId)
              .gte("created_at", today),
            supabase
              .from("calls")
              .select("id", { count: "exact", head: true })
              .eq("company_id", company_id)
              .eq("collaborator_id", collaboratorId)
              .gte("created_at", today)
              .in("status", ["completed", "answered"]),
            supabase
              .from("leads_master")
              .select("id", { count: "exact", head: true })
              .eq("company_id", company_id)
              .eq("status", "interested"),
          ]);
          setLigacoesHoje(ligRes.count ?? 0);
          setLigacoesAtendidas(atendRes.count ?? 0);
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

          const { count: dispHoje } = await supabase
            .from("smart_dispatches")
            .select("id", { count: "exact", head: true })
            .eq("company_id", company_id)
            .eq("collaborator_id", collaboratorId)
            .gte("created_at", today);

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
          const { count } = await supabase
            .from("wa_conversations")
            .select("id", { count: "exact", head: true })
            .eq("company_id", company_id)
            .eq("collaborator_id", collaboratorId)
            .neq("status", "closed");
          setConversasAtivas(count ?? 0);
        } catch { setConversasAtivas(0); }
      })(),

      // Meta do mês + conversões
      (async () => {
        try {
          // Buscar meta configurada para este consultor
          const { data: metaData } = await supabase
            .from("collaborator_goals")
            .select("monthly_conversions")
            .eq("collaborator_id", collaboratorId)
            .maybeSingle();

          if (metaData?.monthly_conversions) {
            setMetaMes(metaData.monthly_conversions);
          }

          const { count: convMes } = await supabase
            .from("leads_master")
            .select("id", { count: "exact", head: true })
            .eq("company_id", company_id)
            .eq("status", "converted")
            .gte("updated_at", month);

          setConversoesMes(convMes ?? 0);
        } catch {
          setMetaMes(null);
          setConversoesMes(0);
        }
      })(),
    ]);

    setAllLoading(false);
  }, [collaboratorId, company_id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const taxaAtendimento = pct(ligacoesAtendidas, ligacoesHoje);
  const metaPct = metaMes && metaMes > 0 ? pct(conversoesMes, metaMes) : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <PageHeader
            title="Meus Números"
            subtitle={`Olá, ${collaborator?.name?.split(" ")[0] ?? "Consultor"}! Aqui está sua performance.`}
          />
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={allLoading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${allLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* ── LINHA 1 — Meus Leads & Ligações ──────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            Minha Fila
          </p>
          {leadsLoading || callsLoading ? (
            <KpiRowSkeleton />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard
                label="Meus Leads Ativos"
                value={leadsAtivos}
                icon={Users}
                color="text-blue-400"
                bg="bg-blue-500/10"
                onClick={() => navigate("/my-leads")}
              />
              <KpiCard
                label="Ligações Hoje"
                value={ligacoesHoje}
                icon={Phone}
                color="text-green-400"
                bg="bg-green-500/10"
                onClick={() => navigate("/ligacoes")}
              />
              <KpiCard
                label="Taxa de Atendimento"
                value={`${taxaAtendimento}%`}
                icon={Activity}
                color="text-teal-400"
                bg="bg-teal-500/10"
                highlight={taxaAtendimento >= 50}
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
                <span>Taxa de Atendimento</span>
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
      </div>
    </DashboardLayout>
  );
}
