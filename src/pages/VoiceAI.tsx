import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Mic, Play, Pause, Plus, Download, Send, Wand2,
  BarChart3, AudioLines, Users, TrendingUp, Pencil, Trash2
} from "lucide-react";

const DUMMY_VOICES = [
  { id: "1", name: "Alexander Donato", company: "Walk Holding", status: "ready" as const },
  { id: "2", name: "Consultor Demo", company: "Objetivo", status: "processing" as const },
  { id: "3", name: "Voz Teste", company: "Trilia", status: "error" as const },
];

const STATUS_MAP = {
  ready: { label: "Pronta", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  processing: { label: "Processando", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  error: { label: "Erro", className: "bg-destructive/15 text-destructive border-destructive/30" },
};

const DUMMY_TEMPLATES = [
  { id: "1", name: "Abertura", text: "Olá {nome}, tudo bem? Aqui é o {consultor}...", voice: "Alexander Donato", product: "Objetivo" },
  { id: "2", name: "Follow-up", text: "Oi {nome}, passando para saber se conseguiu analisar...", voice: "Consultor Demo", product: "Trilia" },
  { id: "3", name: "Qualificação", text: "{nome}, vi que você demonstrou interesse em...", voice: "Alexander Donato", product: "Objetivo" },
];

const DUMMY_HISTORY = [
  { id: "1", text: "Olá João, tudo bem?", voice: "Alexander Donato", date: "15/03/2026 14:30" },
  { id: "2", text: "Passando para dar um retorno...", voice: "Consultor Demo", date: "15/03/2026 13:15" },
  { id: "3", text: "Vi que você tem interesse...", voice: "Alexander Donato", date: "14/03/2026 18:00" },
];

function VoicesTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Vozes Clonadas</h2>
          <p className="text-sm text-muted-foreground">Gerencie as vozes dos consultores</p>
        </div>
        <Button><Plus className="mr-2 h-4 w-4" />Nova Voz</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {DUMMY_VOICES.map((v) => {
          const st = STATUS_MAP[v.status];
          return (
            <Card key={v.id} className="border-border/60 bg-card">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <Mic className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground truncate">{v.name}</p>
                    <Badge variant="outline" className="text-[10px] mt-1">{v.company}</Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={st.className}>{st.label}</Badge>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" disabled={v.status !== "ready"}>
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="secondary" disabled={v.status !== "ready"}>Usar</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function GenerateTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left - Input */}
        <div className="lg:col-span-3 space-y-4">
          <Textarea
            placeholder="Digite o texto que será convertido em áudio com a voz clonada..."
            className="min-h-[160px] bg-secondary/50 border-border"
          />
          <Select>
            <SelectTrigger className="bg-secondary/50 border-border">
              <SelectValue placeholder="Selecione a voz" />
            </SelectTrigger>
            <SelectContent>
              {DUMMY_VOICES.filter(v => v.status === "ready").map(v => (
                <SelectItem key={v.id} value={v.id}>{v.name} — {v.company}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button><Wand2 className="mr-2 h-4 w-4" />Gerar Áudio</Button>
        </div>

        {/* Right - Preview */}
        <div className="lg:col-span-2">
          <Card className="border-border/60 bg-card">
            <CardContent className="p-5 space-y-4">
              <p className="text-sm font-medium text-muted-foreground">Pré-visualização</p>
              <div className="h-20 rounded-lg bg-secondary/50 flex items-center justify-center">
                <AudioLines className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" className="flex-1">
                  <Play className="mr-1 h-4 w-4" />Ouvir
                </Button>
                <Button size="sm" variant="secondary" className="flex-1">
                  <Download className="mr-1 h-4 w-4" />Baixar
                </Button>
              </div>
              <Button size="sm" variant="outline" className="w-full">
                <Send className="mr-2 h-4 w-4" />Enviar via WhatsApp
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* History */}
      <Card className="border-border/60 bg-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border/60">
                <TableHead>Texto</TableHead>
                <TableHead>Voz</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DUMMY_HISTORY.map(h => (
                <TableRow key={h.id} className="border-border/60">
                  <TableCell className="max-w-[300px] truncate text-sm">{h.text}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{h.voice}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{h.date}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost"><Play className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost"><Download className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function TemplatesTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Templates de Áudio</h2>
        <Button><Plus className="mr-2 h-4 w-4" />Novo Template</Button>
      </div>
      <Card className="border-border/60 bg-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border/60">
                <TableHead>Nome do Template</TableHead>
                <TableHead>Texto</TableHead>
                <TableHead>Voz Padrão</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DUMMY_TEMPLATES.map(t => (
                <TableRow key={t.id} className="border-border/60">
                  <TableCell className="font-medium text-sm">{t.name}</TableCell>
                  <TableCell className="max-w-[250px] truncate text-sm text-muted-foreground">{t.text}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.voice}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{t.product}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost"><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricsTab() {
  const stats = [
    { label: "Total Áudios Gerados", value: "1.247", icon: AudioLines },
    { label: "Áudios Hoje", value: "34", icon: BarChart3 },
    { label: "Vozes Ativas", value: "8", icon: Users },
    { label: "Taxa de Resposta", value: "42%", icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label} className="border-border/60 bg-card">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <s.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-border/60 bg-card">
        <CardContent className="p-10 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Gráfico de uso em breve</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VoiceAI() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Walk Voice AI</h1>
          <p className="text-sm text-muted-foreground">Clonagem de voz e geração de áudios personalizados</p>
        </div>

        <Tabs defaultValue="vozes">
          <TabsList className="bg-secondary/50 border border-border/60">
            <TabsTrigger value="vozes">Vozes</TabsTrigger>
            <TabsTrigger value="gerar">Gerar Áudio</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="metricas">Métricas</TabsTrigger>
          </TabsList>

          <TabsContent value="vozes"><VoicesTab /></TabsContent>
          <TabsContent value="gerar"><GenerateTab /></TabsContent>
          <TabsContent value="templates"><TemplatesTab /></TabsContent>
          <TabsContent value="metricas"><MetricsTab /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
