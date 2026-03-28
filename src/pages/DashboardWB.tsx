import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { EDGE_BASE } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Loader2, Users, Send, MessageSquare, ShieldCheck,
  TrendingUp, AlertTriangle, RefreshCw, Eye, Ban,
  CheckCircle, XCircle, Clock, ArrowUpRight,
} from "lucide-react";

interface QualityData {
  status: string;
  tier: string;
  conversations_today: number;
  conversations_limit: number;
  blocks_24h: number;
  blocks_rate: number;
  reports_24h: number;
  reports_rate: number;
  next_tier: string;
  next_tier_days: number;
  alerts: { template: string; quality: string }[];
}

interface DispatchMetrics {
  sent: number;
  sent_change: number;
  delivered: number;
  delivered_rate: number;
  read: number;
  read_rate: number;
  responded: number;
  responded_rate: number;
  failed: number;
  failed_rate: number;
}

interface TemplatePerf {
  name: string;
  score: number;
  sent: number;
  read_rate: number;
  response_rate: number;
  block_rate: number;
}

interface SellerUsage {
  name: string;
  role: string;
  dispatches_today: number;
  daily_limit: number;
  leads_count: number;
  response_rate: number;
  last_dispatch_at: string | null;
}

interface TierEvent {
  date: string;
  tier: string;
  status: string;
  note: string;
}

export default function DashboardWB() {
  const { collaborator } = useCollaborator();
  const [loading, setLoading] = useState(true);
  const [quality, setQuality] = useState<QualityData | null>(null);
  const [metrics, setMetrics] = useState<DispatchMetrics | null>(null);
  const [templatePerf, setTemplatePerf] = useState<TemplatePerf[]>([]);
  const [sellers, setSellers] = useState<SellerUsage[]>([]);
  const [tierHistory, setTierHistory] = useState<TierEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    };
  }, []);

  const fetchDashboard = useCallback(async (silent = false) => {
    if (!collaborator) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const headers = await getHeaders();
      const [dashRes, tierRes] = await Promise.all([
        fetch(`${EDGE_BASE}/quality-monitor`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            action: "dashboard",
            company_id: collaborator.company_id,
            requester_role: "ceo",
          }),
        }),
        fetch(`${EDGE_BASE}/quality-monitor`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            action: "tier-history",
            company_id: collaborator.company_id,
          }),
        }),
      ]);
      const dashData = await dashRes.json();
      const tierData = await tierRes.json();
      if (dashRes.ok) {
        setQuality(dashData.quality || null);
        setMetrics(dashData.dispatches_today || null);
        setTemplatePerf(dashData.templates?.performance || []);
        setSellers(dashData.seller_usage || []);
      } else if (!silent) {
        toast.error(dashData.error || "Erro ao carregar dashboard");
      }
      if (tierRes.ok) {
        setTierHistory(tierData.history || []);
      }
    } catch {
      if (!silent) toast.error("Erro de conexão");
    }
    setLoading(false);
    setRefreshing(false);
  }, [collaborator, getHeaders]);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(() => fetchDashboard(true), 60000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const qualityColor =
    quality?.status === "GREEN" ? "text-green-400" :
    quality?.status === "YELLOW" ? "text-yellow-400" : "text-red-400";

  const qualityBg =
    quality?.status === "GREEN" ? "border-green-500/20 bg-green-500/5" :
    quality?.status === "YELLOW" ? "border-yellow-500/20 bg-yellow-500/5" : "border-red-500/20 bg-red-500/5";

  const convPercent = quality ? Math.min(100, (quality.conversations_today / quality.conversations_limit) * 100) : 0;
  const convBarColor = convPercent < 50 ? "bg-green-500" : convPercent < 80 ? "bg-yellow-500" : "bg-red-500";

  const scoreColor = (s: number) => s >= 85 ? "text-green-400" : s >= 70 ? "text-yellow-400" : "text-red-400";

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <PageHeader title="Dashboard WhatsApp" subtitle="Qualidade, disparos e performance" />
        <Button variant="outline" size="sm" onClick={() => fetchDashboard(true)} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* SECTION 1: Quality Card */}
      <Card className={`mb-6 ${qualityBg}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Qualidade do Número
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Badge variant="outline" className={`${qualityColor} font-bold`}>
                {quality?.status || "—"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Tier:</span>
              <Badge variant="secondary" className="font-mono text-xs">{quality?.tier || "—"}</Badge>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Conversas hoje</span>
              <span>{quality?.conversations_today ?? 0} / {quality?.conversations_limit ?? 0} ({convPercent.toFixed(1)}%)</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div className={`h-full rounded-full transition-all ${convBarColor}`} style={{ width: `${convPercent}%` }} />
            </div>
          </div>

          <div className="flex flex-wrap gap-6 text-sm">
            <span>
              <Ban className="h-3.5 w-3.5 inline mr-1 text-red-400" />
              Bloqueios 24h: <strong>{quality?.blocks_24h ?? 0}</strong> ({(quality?.blocks_rate ?? 0).toFixed(2)}%)
            </span>
            <span>
              <AlertTriangle className="h-3.5 w-3.5 inline mr-1 text-yellow-400" />
              Reports: <strong>{quality?.reports_24h ?? 0}</strong> ({(quality?.reports_rate ?? 0).toFixed(2)}%)
            </span>
          </div>

          {quality?.next_tier && (
            <p className="text-xs text-muted-foreground">
              <ArrowUpRight className="h-3 w-3 inline mr-1" />
              Previsão próximo tier: <strong>{quality.next_tier}</strong> em ~{quality.next_tier_days} dias
            </p>
          )}

          {quality?.alerts && quality.alerts.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Alertas:</p>
              {quality.alerts.map((a, i) => (
                <p key={i} className="text-xs text-yellow-400">
                  ⚠️ Template "{a.template}" com quality {a.quality}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 2: Dispatch Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Enviados", value: metrics?.sent, sub: metrics?.sent_change ? `${metrics.sent_change > 0 ? "+" : ""}${metrics.sent_change}%` : null, icon: Send, color: "text-blue-400" },
          { label: "Entregues", value: metrics?.delivered, sub: metrics?.delivered_rate ? `${(metrics.delivered_rate * 100).toFixed(0)}%` : null, icon: CheckCircle, color: "text-green-400" },
          { label: "Lidos", value: metrics?.read, sub: metrics?.read_rate ? `${(metrics.read_rate * 100).toFixed(0)}%` : null, icon: Eye, color: "text-cyan-400" },
          { label: "Respondidos", value: metrics?.responded, sub: metrics?.responded_rate ? `${(metrics.responded_rate * 100).toFixed(0)}%` : null, icon: MessageSquare, color: "text-emerald-400" },
          { label: "Falhos", value: metrics?.failed, sub: metrics?.failed_rate ? `${(metrics.failed_rate * 100).toFixed(1)}%` : null, icon: XCircle, color: "text-red-400" },
        ].map((m) => (
          <Card key={m.label}>
            <CardContent className="pt-4 text-center">
              <m.icon className={`h-4 w-4 mx-auto mb-1 ${m.color}`} />
              <p className="text-2xl font-bold">{m.value ?? 0}</p>
              <p className="text-xs text-muted-foreground">{m.label}</p>
              {m.sub && <p className={`text-xs mt-0.5 ${m.color}`}>{m.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* SECTION 3: Template Performance Table */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Performance dos Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          {templatePerf.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sem dados de templates</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-3">Template</th>
                    <th className="text-center py-2 px-2">Score</th>
                    <th className="text-center py-2 px-2">Enviados</th>
                    <th className="text-center py-2 px-2">Lidos</th>
                    <th className="text-center py-2 px-2">Respond.</th>
                    <th className="text-center py-2 px-2">Blocks</th>
                  </tr>
                </thead>
                <tbody>
                  {templatePerf.map((t) => (
                    <tr key={t.name} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-2 pr-3 font-medium">
                        {t.score < 70 && <AlertTriangle className="h-3 w-3 inline mr-1 text-red-400" />}
                        {t.name}
                      </td>
                      <td className={`text-center py-2 px-2 font-bold ${scoreColor(t.score)}`}>{t.score}</td>
                      <td className="text-center py-2 px-2">{t.sent}</td>
                      <td className="text-center py-2 px-2">{(t.read_rate * 100).toFixed(0)}%</td>
                      <td className="text-center py-2 px-2">{(t.response_rate * 100).toFixed(0)}%</td>
                      <td className="text-center py-2 px-2">{(t.block_rate * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 4: Team */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" /> Equipe
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sellers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sem vendedores ativos</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sellers.map((s) => {
                const pct = s.daily_limit > 0 ? (s.dispatches_today / s.daily_limit) * 100 : 0;
                const lastDispatch = s.last_dispatch_at
                  ? `há ${Math.round((Date.now() - new Date(s.last_dispatch_at).getTime()) / 3600000)}h`
                  : "—";
                return (
                  <div key={s.name} className="p-3 rounded-lg bg-muted/20 border border-border/50 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-sm">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.role}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">{s.leads_count} leads</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={pct} className="flex-1 h-2" />
                      <span className="text-xs text-muted-foreground w-14 text-right">
                        {s.dispatches_today}/{s.daily_limit}
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Resp: {(s.response_rate * 100).toFixed(0)}%</span>
                      <span>Último: {lastDispatch}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 5: Tier History Timeline */}
      {tierHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" /> Histórico de Tier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative pl-6 space-y-4">
              <div className="absolute left-2 top-1 bottom-1 w-px bg-border" />
              {tierHistory.map((ev, i) => {
                const dotColor =
                  ev.status === "GREEN" ? "bg-green-400" :
                  ev.status === "YELLOW" ? "bg-yellow-400" : "bg-red-400";
                return (
                  <div key={i} className="relative">
                    <div className={`absolute -left-[18px] top-1.5 h-2.5 w-2.5 rounded-full ${dotColor}`} />
                    <div>
                      <p className="text-sm font-medium">
                        {ev.date}: <span className="font-mono text-xs">{ev.tier}</span>{" "}
                        <Badge variant="outline" className={`text-xs ${ev.status === "GREEN" ? "text-green-400" : ev.status === "YELLOW" ? "text-yellow-400" : "text-red-400"}`}>
                          {ev.status}
                        </Badge>
                      </p>
                      <p className="text-xs text-muted-foreground">{ev.note}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
