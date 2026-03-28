import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompany } from "@/contexts/CompanyContext";
import { EDGE_BASE, SUPABASE_ANON_KEY } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Shield, RefreshCw, Send, CheckCircle, Eye, MessageSquare,
  XCircle, AlertTriangle, ArrowUp, ArrowDown, Minus, Users,
  TrendingUp, Clock, Loader2, BadgeCheck,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts";

// ── helpers ──
async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
  };
}

async function callQM(body: Record<string, unknown>) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${EDGE_BASE}/quality-monitor`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Erro");
  return res.json();
}

// ── types ──
interface Quality {
  quality: string;
  verified_name: string;
  tier: string;
  tier_limit: number;
  conversations_24h: number;
  usage_pct: number;
  blocks_24h: number;
  alerts: { template: string; quality: string; message?: string }[];
  paused_templates?: string[];
}

interface Dispatches {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  failed: number;
}

interface TemplatePerfRow {
  name: string;
  performance_score: number;
  delivered: number;
  read_rate: number;
  reply_rate: number;
  block_rate: number;
  quality_rating: string;
}

interface SellerRow {
  name: string;
  role: string;
  dispatches_today: number;
  daily_limit: number;
}

interface HistoryPoint {
  checked_at: string;
  usage_pct: number;
  quality_rating: string;
}

interface TierEvent {
  date: string;
  old_tier: string;
  new_tier: string;
  old_quality: string;
  new_quality: string;
  notes: string;
}

// ── component ──
export default function DashboardMeta() {
  const { company_id, user_role } = useCompany();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);

  const [quality, setQuality] = useState<Quality | null>(null);
  const [dispatches, setDispatches] = useState<Dispatches | null>(null);
  const [templates, setTemplates] = useState<TemplatePerfRow[]>([]);
  const [sellers, setSellers] = useState<SellerRow[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [tierHistory, setTierHistory] = useState<TierEvent[]>([]);

  const base = { company_id, requester_role: user_role || "ceo" };

  const fetchAll = useCallback(async (silent = false) => {
    if (!company_id) return;
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [dash, hist, tier] = await Promise.all([
        callQM({ action: "dashboard", ...base }),
        callQM({ action: "history", ...base, limit: 24 }).catch(() => ({ history: [] })),
        callQM({ action: "tier-history", ...base }).catch(() => ({ history: [] })),
      ]);
      setQuality(dash.quality || null);
      setDispatches(dash.dispatches_today || null);
      setTemplates((dash.templates?.performance || []).sort((a: TemplatePerfRow, b: TemplatePerfRow) => b.performance_score - a.performance_score));
      setSellers(dash.seller_usage || []);
      setHistory(hist.history || []);
      setTierHistory(tier.history || []);
    } catch {
      if (!silent) toast.error("Erro ao carregar dados Meta");
    }
    setLoading(false);
    setRefreshing(false);
  }, [company_id, user_role]);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(() => fetchAll(true), 300000); // 5 min
    return () => clearInterval(iv);
  }, [fetchAll]);

  const checkNow = async () => {
    setChecking(true);
    try {
      await callQM({ action: "check", ...base });
      toast.success("Verificação concluída");
      fetchAll(true);
    } catch {
      toast.error("Erro na verificação");
    }
    setChecking(false);
  };

  // ── quality badge ──
  const qualityBadge = (q: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      GREEN: { label: "QUALIDADE VERDE", cls: "bg-green-500 text-white" },
      YELLOW: { label: "QUALIDADE AMARELA — Reduzir volume", cls: "bg-yellow-500 text-black" },
      RED: { label: "QUALIDADE VERMELHA — ENVIOS PAUSADOS", cls: "bg-red-500 text-white" },
    };
    const m = map[q] || { label: q, cls: "bg-muted text-foreground" };
    return <Badge className={`text-sm px-4 py-1.5 ${m.cls}`}>{m.label}</Badge>;
  };

  const usagePctColor = (pct: number) => pct < 30 ? "text-green-400" : pct < 50 ? "text-yellow-400" : "text-red-400";
  const scoreColor = (s: number) => s >= 70 ? "text-green-400" : s >= 40 ? "text-yellow-400" : "text-red-400";
  const qBadgeSmall = (q: string) => {
    const cls = q === "GREEN" ? "bg-green-500/15 text-green-400 border-green-500/30"
      : q === "YELLOW" ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
      : "bg-red-500/15 text-red-400 border-red-500/30";
    return <Badge variant="outline" className={`text-xs ${cls}`}>{q}</Badge>;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => <Card key={i}><CardContent className="pt-5"><Skeleton className="h-10 w-full" /></CardContent></Card>)}
          </div>
          <Card><CardContent className="pt-5"><Skeleton className="h-48 w-full" /></CardContent></Card>
        </div>
      </DashboardLayout>
    );
  }

  const dispatchCards = dispatches ? [
    { label: "Total", value: dispatches.total, icon: Send, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Enviados", value: dispatches.sent, icon: Send, color: "text-primary", bg: "bg-primary/10" },
    { label: "Entregues", value: dispatches.delivered, icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10" },
    { label: "Lidos", value: dispatches.read, icon: Eye, color: "text-cyan-400", bg: "bg-cyan-500/10" },
    { label: "Respondidos", value: dispatches.replied, icon: MessageSquare, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Falhos", value: dispatches.failed, icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
  ] : [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <PageHeader title="Dashboard Meta WhatsApp" subtitle="Qualidade, disparos e performance" />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={checkNow} disabled={checking}>
              {checking ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Shield className="h-4 w-4 mr-1.5" />}
              Verificar Agora
            </Button>
            <Button variant="outline" size="sm" onClick={() => fetchAll(true)} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* ═══ SEÇÃO 1 — Status Atual ═══ */}
        {quality && (
          <>
            <Card className={quality.quality === "GREEN" ? "border-green-500/30" : quality.quality === "YELLOW" ? "border-yellow-500/30" : "border-red-500/30"}>
              <CardContent className="pt-6 pb-5">
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  {qualityBadge(quality.quality)}
                  {quality.verified_name && (
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <BadgeCheck className="h-4 w-4 text-green-400" />
                      {quality.verified_name}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Tier</p>
                    <p className="text-lg font-bold font-mono">{quality.tier}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Limite do Tier</p>
                    <p className="text-lg font-bold">{quality.tier_limit?.toLocaleString("pt-BR")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Uso em 24h</p>
                    <p className="text-lg font-bold">{quality.conversations_24h?.toLocaleString("pt-BR")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Uso %</p>
                    <p className={`text-lg font-bold ${usagePctColor(quality.usage_pct)}`}>{quality.usage_pct}%</p>
                    <Progress value={quality.usage_pct} className="h-2 mt-1" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Bloqueios 24h</p>
                    <p className="text-lg font-bold text-destructive">{quality.blocks_24h}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ═══ SEÇÃO 2 — Disparos Hoje ═══ */}
        {dispatchCards.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {dispatchCards.map((c) => {
              const pct = dispatches!.total > 0 ? (c.value / dispatches!.total) * 100 : 0;
              return (
                <Card key={c.label}>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-lg ${c.bg}`}>
                        <c.icon className={`h-4 w-4 ${c.color}`} />
                      </div>
                    </div>
                    <p className="text-2xl font-bold">{c.value.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                    {c.label !== "Total" && (
                      <Progress value={pct} className="h-1.5 mt-2" />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ═══ SEÇÃO 3 — Performance Templates ═══ */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Performance de Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem dados de templates</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="text-left py-2 pr-3">Template</th>
                      <th className="text-center py-2 px-2">Score</th>
                      <th className="text-center py-2 px-2">Entregas</th>
                      <th className="text-center py-2 px-2">Leituras</th>
                      <th className="text-center py-2 px-2">Respostas</th>
                      <th className="text-center py-2 px-2">Bloqueios</th>
                      <th className="text-center py-2 px-2">Quality Meta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((t) => (
                      <tr key={t.name} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="py-2 pr-3 font-medium">{t.name}</td>
                        <td className={`text-center py-2 px-2 font-bold ${scoreColor(t.performance_score)}`}>{t.performance_score}</td>
                        <td className="text-center py-2 px-2">{t.delivered}</td>
                        <td className="text-center py-2 px-2">{(t.read_rate * 100).toFixed(0)}%</td>
                        <td className="text-center py-2 px-2">{(t.reply_rate * 100).toFixed(0)}%</td>
                        <td className="text-center py-2 px-2">{(t.block_rate * 100).toFixed(1)}%</td>
                        <td className="text-center py-2 px-2">{qBadgeSmall(t.quality_rating)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══ SEÇÃO 4 — Uso da Equipe ═══ */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" /> Uso da Equipe
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sellers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem colaboradores ativos</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="text-left py-2">Colaborador</th>
                      <th className="text-center py-2">Role</th>
                      <th className="text-center py-2">Usados / Limite</th>
                      <th className="py-2 w-40">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sellers.map((s) => {
                      const pct = s.daily_limit > 0 ? (s.dispatches_today / s.daily_limit) * 100 : 0;
                      const near = pct > 80;
                      return (
                        <tr key={s.name} className={`border-b border-border/50 ${near ? "bg-destructive/5" : "hover:bg-muted/20"}`}>
                          <td className="py-2 font-medium">{s.name}</td>
                          <td className="text-center py-2">
                            <Badge variant="outline" className="text-xs">{s.role}</Badge>
                          </td>
                          <td className="text-center py-2">{s.dispatches_today} / {s.daily_limit}</td>
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <Progress value={pct} className="flex-1 h-2" />
                              <span className={`text-xs font-mono w-10 text-right ${near ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                                {pct.toFixed(0)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══ SEÇÃO 5 — Histórico de Qualidade ═══ */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" /> Histórico de Qualidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sem histórico</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="checked_at"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => {
                      try { return new Date(v).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); } catch { return v; }
                    }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} domain={[0, 100]} />
                  <RechartsTooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    labelFormatter={(v) => { try { return new Date(v).toLocaleString("pt-BR"); } catch { return v; } }}
                  />
                  <Line type="monotone" dataKey="usage_pct" name="Uso %" stroke="hsl(var(--primary))" strokeWidth={2}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      const color = payload.quality_rating === "GREEN" ? "#22c55e"
                        : payload.quality_rating === "YELLOW" ? "#eab308" : "#ef4444";
                      return <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={color} stroke="none" />;
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* ═══ SEÇÃO 6 — Histórico de Tier ═══ */}
        {tierHistory.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Histórico de Tier
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative pl-7 space-y-4">
                <div className="absolute left-2.5 top-1 bottom-1 w-px bg-border" />
                {tierHistory.map((ev, i) => {
                  const isUpgrade = ev.new_tier > ev.old_tier || ev.new_quality === "GREEN";
                  const isDowngrade = ev.new_tier < ev.old_tier || ev.new_quality === "RED";
                  const DirIcon = isUpgrade ? ArrowUp : isDowngrade ? ArrowDown : Minus;
                  const dotColor = isUpgrade ? "bg-green-400" : isDowngrade ? "bg-red-400" : "bg-yellow-400";
                  const dirColor = isUpgrade ? "text-green-400" : isDowngrade ? "text-red-400" : "text-yellow-400";

                  return (
                    <div key={i} className="relative">
                      <div className={`absolute -left-[18px] top-1.5 h-3 w-3 rounded-full ${dotColor}`} />
                      <div className="flex items-start gap-2">
                        <DirIcon className={`h-4 w-4 mt-0.5 shrink-0 ${dirColor}`} />
                        <div>
                          <p className="text-sm">
                            <span className="text-muted-foreground">{ev.date}:</span>{" "}
                            <span className="font-mono text-xs">{ev.old_tier}</span>
                            <span className="text-muted-foreground mx-1">→</span>
                            <span className="font-mono text-xs font-bold">{ev.new_tier}</span>
                            <span className="mx-2">|</span>
                            {qBadgeSmall(ev.old_quality)}
                            <span className="mx-1">→</span>
                            {qBadgeSmall(ev.new_quality)}
                          </p>
                          {ev.notes && <p className="text-xs text-muted-foreground mt-0.5">{ev.notes}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══ SEÇÃO 7 — Alertas ═══ */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Alertas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!quality?.alerts || quality.alerts.length === 0) && (!quality?.paused_templates || quality.paused_templates.length === 0) ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                <CheckCircle className="h-4 w-4 text-green-400" />
                Nenhum alerta — tudo operando normalmente ✓
              </div>
            ) : (
              <div className="space-y-2">
                {quality?.alerts?.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/50 text-sm">
                    <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${a.quality === "RED" ? "text-destructive" : "text-warning"}`} />
                    <span>Template "<strong>{a.template}</strong>" — quality {qBadgeSmall(a.quality)}</span>
                  </div>
                ))}
                {quality?.paused_templates && quality.paused_templates.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-sm">
                    <p className="font-medium text-destructive mb-1">Templates pausados:</p>
                    <ul className="list-disc list-inside text-xs text-muted-foreground">
                      {quality.paused_templates.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
