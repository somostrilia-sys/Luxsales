import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PhoneCall, Plus, Target, TrendingUp, Activity, BarChart3 } from "lucide-react";

const campaigns = [
  { id: "1", nome: "Campanha Objetivo Mar/26", voz: "Alexander Donato", produto: "Objetivo", leads: 450, feitas: 312, atendidas: 187, convertidas: 34, status: "Ativa" },
  { id: "2", nome: "Reativação Trilia Q1", voz: "Consultor Demo", produto: "Trilia", leads: 200, feitas: 89, atendidas: 45, convertidas: 8, status: "Pausada" },
  { id: "3", nome: "Prospecção Walk Mar/26", voz: "Alexander Donato", produto: "Walk Holding", leads: 320, feitas: 156, atendidas: 98, convertidas: 21, status: "Ativa" },
];

const statusColor = (s: string) => {
  if (s === "Ativa") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (s === "Pausada") return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  return "bg-red-500/20 text-red-400 border-red-500/30";
};

const companyColor = (c: string) => {
  if (c === "Walk Holding") return "bg-primary/20 text-primary border-primary/30";
  if (c === "Objetivo") return "bg-violet-500/20 text-violet-400 border-violet-500/30";
  return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
};

export default function CallCampaigns() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ligações IA</h1>
            <p className="text-muted-foreground text-sm">Campanhas de ligação automatizadas com inteligência artificial</p>
          </div>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white"><Plus className="h-4 w-4 mr-1.5" />Nova Campanha</Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Campanhas", value: "3", icon: PhoneCall, color: "text-primary" },
            { label: "Ligações Hoje", value: "47", icon: Activity, color: "text-emerald-400" },
            { label: "Taxa Atendimento", value: "59%", icon: Target, color: "text-amber-400" },
            { label: "Taxa Conversão", value: "14%", icon: TrendingUp, color: "text-emerald-400" },
          ].map(s => (
            <Card key={s.label} className="bg-card border-border">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center"><s.icon className={`h-5 w-5 ${s.color}`} /></div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-base">Campanhas</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Nome</TableHead><TableHead>Voz</TableHead><TableHead>Produto</TableHead><TableHead>Total Leads</TableHead><TableHead>Feitas</TableHead><TableHead>Atendidas</TableHead><TableHead>Convertidas</TableHead><TableHead>Status</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-foreground">{c.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{c.voz}</TableCell>
                    <TableCell><Badge variant="outline" className={companyColor(c.produto)}>{c.produto}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{c.leads}</TableCell>
                    <TableCell className="text-muted-foreground">{c.feitas}</TableCell>
                    <TableCell className="text-muted-foreground">{c.atendidas}</TableCell>
                    <TableCell className="text-foreground font-semibold">{c.convertidas}</TableCell>
                    <TableCell><Badge variant="outline" className={statusColor(c.status)}>{c.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}