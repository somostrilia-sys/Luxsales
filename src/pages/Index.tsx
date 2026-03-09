import { Bot, FileText, Target, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/components/DashboardLayout";
import { agentes, performanceData } from "@/lib/mock-data";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const stats = [
  { label: "Agentes Ativos", value: agentes.filter(a => a.status === "ativo").length, icon: Bot },
  { label: "Relatórios Hoje", value: 6, icon: FileText },
  { label: "Leads Gerados", value: 248, icon: Target },
  { label: "Alertas Pendentes", value: 2, icon: AlertTriangle },
];

export default function Index() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Visão geral dos seus agentes de IA</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-stagger">
          {stats.map((s) => (
            <Card
              key={s.label}
              className="kpi-card border-0 bg-gradient-to-br from-[hsl(var(--kpi-from))] to-[hsl(var(--kpi-to))] text-primary-foreground overflow-hidden"
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-primary-foreground/70">{s.label}</p>
                    <p className="text-3xl font-bold mt-1">{s.value}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/10 backdrop-blur-sm">
                    <s.icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="shadow-sm border bg-card/80 backdrop-blur-sm" style={{ animation: 'fade-slide-up 0.5s ease-out 0.3s both' }}>
          <CardHeader>
            <CardTitle className="text-lg">Performance dos Agentes — Últimos 7 dias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(204, 93%, 39%)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(204, 93%, 39%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorRel" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(152, 60%, 42%)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(152, 60%, 42%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorAt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="dia" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }} />
                  <Legend />
                  <Area type="monotone" dataKey="leads" name="Leads" stroke="hsl(204, 93%, 39%)" fill="url(#colorLeads)" strokeWidth={2.5} />
                  <Area type="monotone" dataKey="relatorios" name="Relatórios" stroke="hsl(152, 60%, 42%)" fill="url(#colorRel)" strokeWidth={2.5} />
                  <Area type="monotone" dataKey="atendimentos" name="Atendimentos" stroke="hsl(38, 92%, 50%)" fill="url(#colorAt)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
