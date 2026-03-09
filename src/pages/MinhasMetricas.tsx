import { Trophy, TrendingUp, Target, Flame, Medal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const prospeccaoData = Array.from({ length: 30 }, (_, i) => ({
  dia: `${i + 1}/02`,
  enviadas: Math.floor(30 + Math.random() * 40),
  respostas: Math.floor(5 + Math.random() * 15),
  conversoes: Math.floor(1 + Math.random() * 5),
}));

const ranking = [
  { pos: 1, nome: "Rafael Souza", conversoes: 38, empresa: "Objetivo" },
  { pos: 2, nome: "Ana Oliveira", conversoes: 35, empresa: "Objetivo" },
  { pos: 3, nome: "Você", conversoes: 32, empresa: "Objetivo", destaque: true },
  { pos: 4, nome: "Carlos Silva", conversoes: 29, empresa: "Objetivo" },
  { pos: 5, nome: "Beatriz Santos", conversoes: 27, empresa: "Objetivo" },
];

const metas = [
  { label: "Prospecções", atual: 1200, meta: 1500 },
  { label: "Conversões", atual: 32, meta: 40 },
  { label: "Faturamento", atual: 24800, meta: 30000 },
];

const topLeads = [
  { nome: "Juliana Costa", score: 9.5, status: "Pronto para fechar" },
  { nome: "Luciana Ferreira", score: 9.2, status: "Negociando" },
  { nome: "Roberto Oliveira", score: 8.8, status: "Interesse alto" },
  { nome: "Carla Ribeiro", score: 8.5, status: "Respondeu" },
  { nome: "Renata Souza", score: 8.1, status: "Interesse alto" },
];

export default function MinhasMetricas() {
  const taxaConversao = ((32 / 1200) * 100).toFixed(1);

  const kpis = [
    { label: "Taxa de Conversão", value: `${taxaConversao}%`, icon: TrendingUp },
    { label: "Ranking", value: "3º lugar", icon: Trophy },
    { label: "Leads Quentes", value: 5, icon: Flame },
    { label: "Meta Atingida", value: "80%", icon: Target },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold">Minhas Métricas</h1>
          <p className="text-muted-foreground text-sm">Acompanhe sua performance pessoal</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-stagger">
          {kpis.map((k) => (
            <Card key={k.label} className="kpi-card border-0 bg-gradient-to-br from-[hsl(var(--kpi-from))] to-[hsl(var(--kpi-to))] text-primary-foreground overflow-hidden">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-primary-foreground/70">{k.label}</p>
                    <p className="text-3xl font-bold mt-1">{k.value}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/10 backdrop-blur-sm">
                    <k.icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart */}
          <Card className="lg:col-span-2 border bg-card/80 backdrop-blur-sm" style={{ animation: 'fade-slide-up 0.5s ease-out 0.3s both' }}>
            <CardHeader><CardTitle className="text-lg">Prospecções — Últimos 30 dias</CardTitle></CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={prospeccaoData}>
                    <defs>
                      <linearGradient id="colorEnv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(204, 93%, 39%)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="hsl(204, 93%, 39%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorResp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(152, 60%, 42%)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="hsl(152, 60%, 42%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="dia" className="text-xs" tick={{ fontSize: 10 }} />
                    <YAxis className="text-xs" />
                    <Tooltip contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }} />
                    <Area type="monotone" dataKey="enviadas" name="Enviadas" stroke="hsl(204, 93%, 39%)" fill="url(#colorEnv)" strokeWidth={2} />
                    <Area type="monotone" dataKey="respostas" name="Respostas" stroke="hsl(152, 60%, 42%)" fill="url(#colorResp)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Metas */}
          <Card className="border bg-card/80 backdrop-blur-sm" style={{ animation: 'fade-slide-up 0.5s ease-out 0.4s both' }}>
            <CardHeader><CardTitle className="text-lg">Metas vs Realizado</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              {metas.map((m) => {
                const pct = Math.round((m.atual / m.meta) * 100);
                const formatted = m.label === "Faturamento" ? `R$${(m.atual / 1000).toFixed(1)}k / R$${(m.meta / 1000).toFixed(0)}k` : `${m.atual} / ${m.meta}`;
                return (
                  <div key={m.label} className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{m.label}</span>
                      <span className="text-muted-foreground">{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                    <p className="text-xs text-muted-foreground">{formatted}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ranking */}
          <Card className="border bg-card/80 backdrop-blur-sm" style={{ animation: 'fade-slide-up 0.5s ease-out 0.5s both' }}>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Medal className="h-5 w-5 text-primary" /> Ranking de Consultores</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {ranking.map((r) => (
                <div key={r.pos} className={`flex items-center justify-between p-3 rounded-lg ${r.destaque ? "bg-primary/10 border border-primary/20" : "bg-muted/50"} table-row-hover`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold ${r.pos <= 3 ? "text-primary" : "text-muted-foreground"}`}>{r.pos}º</span>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[hsl(var(--kpi-from))] to-[hsl(var(--kpi-to))] flex items-center justify-center text-primary-foreground text-xs font-bold">
                      {r.nome.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <span className={`text-sm ${r.destaque ? "font-bold" : "font-medium"}`}>{r.nome} {r.destaque && "⭐"}</span>
                  </div>
                  <Badge variant="outline">{r.conversoes} conversões</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Top Leads */}
          <Card className="border bg-card/80 backdrop-blur-sm" style={{ animation: 'fade-slide-up 0.5s ease-out 0.6s both' }}>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Flame className="h-5 w-5 text-orange-500" /> Top Leads Quentes</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {topLeads.map((lead, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 table-row-hover">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-xs font-bold">
                      {lead.nome.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{lead.nome}</p>
                      <p className="text-xs text-muted-foreground">{lead.status}</p>
                    </div>
                  </div>
                  <Badge className="bg-orange-500/15 text-orange-600 border-orange-500/30">Score {lead.score}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
