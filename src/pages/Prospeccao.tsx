import { useState } from "react";
import { Send, MessageSquare, Flame, TrendingUp, Play, Pause, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type LeadStatus = "enviado" | "respondeu" | "interessado" | "descartado";

interface Lead {
  id: string;
  nome: string;
  telefone: string;
  canal: "WhatsApp" | "Instagram";
  status: LeadStatus;
  ultimaMensagem: string;
  hora: string;
}

const mockLeads: Lead[] = [
  { id: "l1", nome: "Roberto Oliveira", telefone: "(31) 99871-2345", canal: "WhatsApp", status: "interessado", ultimaMensagem: "Quero saber mais sobre proteção veicular", hora: "09:32" },
  { id: "l2", nome: "Márcia Santos", telefone: "(31) 98765-1234", canal: "WhatsApp", status: "respondeu", ultimaMensagem: "Pode me ligar amanhã?", hora: "09:15" },
  { id: "l3", nome: "Fernando Lima", telefone: "(31) 99654-3210", canal: "Instagram", status: "enviado", ultimaMensagem: "Olá Fernando! Vi que você tem interesse em...", hora: "08:55" },
  { id: "l4", nome: "Juliana Costa", telefone: "(31) 98543-2109", canal: "WhatsApp", status: "interessado", ultimaMensagem: "Qual o valor mensal?", hora: "08:40" },
  { id: "l5", nome: "Paulo Mendes", telefone: "(31) 97432-1098", canal: "WhatsApp", status: "descartado", ultimaMensagem: "Não tenho interesse, obrigado", hora: "08:20" },
  { id: "l6", nome: "Carla Ribeiro", telefone: "(31) 96321-0987", canal: "Instagram", status: "respondeu", ultimaMensagem: "Interessante! Me conta mais", hora: "08:10" },
  { id: "l7", nome: "André Pereira", telefone: "(31) 95210-9876", canal: "WhatsApp", status: "enviado", ultimaMensagem: "Olá André! Tudo bem? Sou consultor da...", hora: "07:55" },
  { id: "l8", nome: "Luciana Ferreira", telefone: "(31) 94109-8765", canal: "WhatsApp", status: "interessado", ultimaMensagem: "Posso fechar ainda esta semana?", hora: "07:40" },
  { id: "l9", nome: "Thiago Almeida", telefone: "(31) 93098-7654", canal: "Instagram", status: "enviado", ultimaMensagem: "Boa tarde Thiago! Tenho uma proposta...", hora: "07:25" },
  { id: "l10", nome: "Renata Souza", telefone: "(31) 92087-6543", canal: "WhatsApp", status: "respondeu", ultimaMensagem: "Qual a diferença para o seguro?", hora: "07:10" },
];

const statusColors: Record<LeadStatus, string> = {
  enviado: "bg-muted text-muted-foreground",
  respondeu: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  interessado: "bg-green-500/15 text-green-600 border-green-500/30",
  descartado: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function Prospeccao() {
  const [prospecting, setProspecting] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("todos");

  const kpis = [
    { label: "Enviadas Hoje", value: 48, icon: Send, color: "from-[hsl(var(--kpi-from))] to-[hsl(var(--kpi-to))]" },
    { label: "Respostas", value: 12, icon: MessageSquare, color: "from-[hsl(var(--kpi-from))] to-[hsl(var(--kpi-to))]" },
    { label: "Leads Quentes", value: 5, icon: Flame, color: "from-[hsl(var(--kpi-from))] to-[hsl(var(--kpi-to))]" },
    { label: "Taxa de Resposta", value: "25%", icon: TrendingUp, color: "from-[hsl(var(--kpi-from))] to-[hsl(var(--kpi-to))]" },
  ];

  const filtered = filterStatus === "todos" ? mockLeads : mockLeads.filter(l => l.status === filterStatus);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold">Prospecção</h1>
            <p className="text-muted-foreground text-sm">Gerencie suas campanhas de prospecção</p>
          </div>
          <div className="flex gap-2">
            <Button className="btn-shimmer" onClick={() => setProspecting(true)} disabled={prospecting}>
              <Play className="h-4 w-4 mr-2" /> Prospectar Agora
            </Button>
            <Button variant="outline" onClick={() => setProspecting(false)} disabled={!prospecting}>
              <Pause className="h-4 w-4 mr-2" /> Pausar
            </Button>
          </div>
        </div>

        {/* Status indicator */}
        {prospecting && (
          <div className="flex items-center gap-2 text-sm text-green-600 animate-fade-in">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Prospecção ativa — enviando mensagens automaticamente
          </div>
        )}

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

        {/* Leads Table */}
        <Card className="border bg-card/80 backdrop-blur-sm" style={{ animation: 'fade-slide-up 0.5s ease-out 0.3s both' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">Leads</CardTitle>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <Filter className="h-3.5 w-3.5 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
                <SelectItem value="respondeu">Respondeu</SelectItem>
                <SelectItem value="interessado">Interessado</SelectItem>
                <SelectItem value="descartado">Descartado</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última Mensagem</TableHead>
                  <TableHead>Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((lead) => (
                  <TableRow key={lead.id} className="table-row-hover">
                    <TableCell className="font-medium">{lead.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{lead.telefone}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{lead.canal}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`border ${statusColors[lead.status]}`}>
                        {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{lead.ultimaMensagem}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{lead.hora}</TableCell>
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
