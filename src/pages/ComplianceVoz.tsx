import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Shield, ShieldCheck, ShieldAlert, AlertTriangle,
  Clock, Phone, Ban, FileText, Search,
  Check, X, Eye, Lock, UserX, Bell,
  Scale, Gavel, BookOpen, Download,
} from "lucide-react";

type BlacklistEntry = {
  id: string;
  phone: string;
  reason: string;
  added_at: string;
  added_by: string;
};

type AuditLog = {
  id: string;
  action: string;
  user: string;
  details: string;
  timestamp: string;
  severity: "info" | "warning" | "critical";
};

export default function ComplianceVoz() {
  const [activeTab, setActiveTab] = useState("lgpd");
  const [blacklistPhone, setBlacklistPhone] = useState("");
  const [blacklistReason, setBlacklistReason] = useState("");

  // LGPD Config
  const [lgpdConfig, setLgpdConfig] = useState({
    recordingConsent: true,
    dataRetentionDays: 90,
    autoDeleteEnabled: true,
    anonymizeAfterDays: 180,
    optOutEnabled: true,
    optOutKeyword: "SAIR",
    consentMessage: "Esta ligação pode ser gravada para fins de qualidade e treinamento.",
    privacyPolicyUrl: "",
  });

  // Horários permitidos
  const [scheduleConfig, setScheduleConfig] = useState({
    startTime: "08:00",
    endTime: "20:00",
    allowWeekends: false,
    allowHolidays: false,
    maxRetries: 3,
    retryIntervalMinutes: 60,
    maxCallsPerDay: 3,
    respectDNC: true,
  });

  const blacklist: BlacklistEntry[] = [
    { id: "1", phone: "5511999887766", reason: "Solicitou opt-out", added_at: new Date().toISOString(), added_by: "Sistema" },
    { id: "2", phone: "5511988776655", reason: "DNC - Do Not Call", added_at: new Date(Date.now() - 86400000).toISOString(), added_by: "Admin" },
    { id: "3", phone: "5511977665544", reason: "Número inválido - reclamação Procon", added_at: new Date(Date.now() - 172800000).toISOString(), added_by: "Compliance" },
  ];

  const auditLogs: AuditLog[] = [
    { id: "1", action: "Blacklist adicionado", user: "Sistema", details: "5511999887766 - Opt-out via WhatsApp", timestamp: new Date().toISOString(), severity: "info" },
    { id: "2", action: "Ligação fora do horário bloqueada", user: "Sistema", details: "Tentativa às 21:15 para campanha Objetivo", timestamp: new Date(Date.now() - 3600000).toISOString(), severity: "warning" },
    { id: "3", action: "Limite de tentativas atingido", user: "Sistema", details: "Lead João Silva - 3/3 tentativas", timestamp: new Date(Date.now() - 7200000).toISOString(), severity: "info" },
    { id: "4", action: "Dados expirados removidos", user: "LGPD Auto-Delete", details: "45 registros de gravação removidos (>90 dias)", timestamp: new Date(Date.now() - 86400000).toISOString(), severity: "critical" },
  ];

  const addToBlacklist = () => {
    if (!blacklistPhone) return;
    toast.success(`${blacklistPhone} adicionado à blacklist.`);
    setBlacklistPhone("");
    setBlacklistReason("");
  };

  const severityColors: Record<string, string> = {
    info: "bg-blue-500/20 text-blue-400",
    warning: "bg-yellow-500/20 text-yellow-400",
    critical: "bg-red-500/20 text-red-400",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Compliance & LGPD"
          subtitle="Conformidade regulatória, blacklist, opt-out e auditoria de ligações"
          badge={<Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30"><ShieldCheck className="h-3 w-3 mr-1" />Compliant</Badge>}
        />

        {/* Status Geral */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "LGPD", value: "Conforme", icon: Shield, color: "text-emerald-400", bg: "bg-emerald-500/10" },
            { label: "Blacklist", value: `${blacklist.length} números`, icon: Ban, color: "text-red-400", bg: "bg-red-500/10" },
            { label: "Horário", value: "08:00-20:00", icon: Clock, color: "text-blue-400", bg: "bg-blue-500/10" },
            { label: "Auditoria", value: `${auditLogs.length} eventos`, icon: Eye, color: "text-yellow-400", bg: "bg-yellow-500/10" },
          ].map((s) => (
            <Card key={s.label} className="bg-card border-border/60">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                    <s.icon className={`h-5 w-5 ${s.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="h-auto flex-wrap gap-2 rounded-xl border border-border/60 bg-secondary/40 p-1">
            <TabsTrigger value="lgpd">LGPD & Privacidade</TabsTrigger>
            <TabsTrigger value="blacklist">Blacklist / Opt-out</TabsTrigger>
            <TabsTrigger value="horarios">Horários & Limites</TabsTrigger>
            <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
          </TabsList>

          {/* LGPD */}
          <TabsContent value="lgpd" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-border/60 bg-card">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4 text-primary" />Consentimento & Gravação</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Aviso de gravação</p>
                      <p className="text-xs text-muted-foreground">Reproduzir mensagem de consentimento antes da ligação</p>
                    </div>
                    <Switch checked={lgpdConfig.recordingConsent} onCheckedChange={(v) => setLgpdConfig({ ...lgpdConfig, recordingConsent: v })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Mensagem de consentimento</Label>
                    <Textarea value={lgpdConfig.consentMessage} onChange={(e) => setLgpdConfig({ ...lgpdConfig, consentMessage: e.target.value })} className="min-h-[80px]" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Opt-out automático</p>
                      <p className="text-xs text-muted-foreground">Permitir leads saírem via palavra-chave</p>
                    </div>
                    <Switch checked={lgpdConfig.optOutEnabled} onCheckedChange={(v) => setLgpdConfig({ ...lgpdConfig, optOutEnabled: v })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Palavra-chave de opt-out</Label>
                    <Input value={lgpdConfig.optOutKeyword} onChange={(e) => setLgpdConfig({ ...lgpdConfig, optOutKeyword: e.target.value })} />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />Retenção de Dados</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Auto-delete de gravações</p>
                      <p className="text-xs text-muted-foreground">Remover gravações após período definido</p>
                    </div>
                    <Switch checked={lgpdConfig.autoDeleteEnabled} onCheckedChange={(v) => setLgpdConfig({ ...lgpdConfig, autoDeleteEnabled: v })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Retenção de gravações (dias)</Label>
                    <Input type="number" value={lgpdConfig.dataRetentionDays} onChange={(e) => setLgpdConfig({ ...lgpdConfig, dataRetentionDays: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Anonimizar dados após (dias)</Label>
                    <Input type="number" value={lgpdConfig.anonymizeAfterDays} onChange={(e) => setLgpdConfig({ ...lgpdConfig, anonymizeAfterDays: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>URL da Política de Privacidade</Label>
                    <Input value={lgpdConfig.privacyPolicyUrl} onChange={(e) => setLgpdConfig({ ...lgpdConfig, privacyPolicyUrl: e.target.value })} placeholder="https://..." />
                  </div>
                  <Button onClick={() => toast.success("Configurações LGPD salvas!")} className="w-full">Salvar Configurações</Button>
                </CardContent>
              </Card>
            </div>

            {/* Checklist LGPD */}
            <Card className="border-border/60 bg-card">
              <CardHeader><CardTitle className="text-base">Checklist de Conformidade LGPD</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { item: "Base legal para tratamento de dados (legítimo interesse / consentimento)", ok: true },
                  { item: "Política de privacidade publicada e acessível", ok: !!lgpdConfig.privacyPolicyUrl },
                  { item: "Mecanismo de opt-out implementado", ok: lgpdConfig.optOutEnabled },
                  { item: "Aviso de gravação antes da ligação", ok: lgpdConfig.recordingConsent },
                  { item: "Retenção de dados com prazo definido", ok: lgpdConfig.autoDeleteEnabled },
                  { item: "Anonimização de dados após período", ok: lgpdConfig.anonymizeAfterDays > 0 },
                  { item: "Registro de consentimento armazenado", ok: true },
                  { item: "Encarregado de dados (DPO) designado", ok: true },
                  { item: "Canal para exercício de direitos do titular", ok: true },
                  { item: "Relatório de Impacto à Proteção de Dados (RIPD)", ok: false },
                ].map((check) => (
                  <div key={check.item} className="flex items-center gap-3">
                    <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${check.ok ? "bg-emerald-500/20" : "bg-red-500/20"}`}>
                      {check.ok ? <Check className="h-3 w-3 text-emerald-400" /> : <X className="h-3 w-3 text-red-400" />}
                    </div>
                    <span className="text-sm text-foreground">{check.item}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* BLACKLIST */}
          <TabsContent value="blacklist" className="space-y-6">
            <Card className="border-border/60 bg-card">
              <CardHeader>
                <CardTitle className="text-base">Adicionar à Blacklist</CardTitle>
                <CardDescription>Números na blacklist nunca serão discados automaticamente</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Input placeholder="Telefone (ex: 5511999887766)" value={blacklistPhone} onChange={(e) => setBlacklistPhone(e.target.value)} className="flex-1 min-w-[200px]" />
                  <Input placeholder="Motivo" value={blacklistReason} onChange={(e) => setBlacklistReason(e.target.value)} className="flex-1 min-w-[200px]" />
                  <Button onClick={addToBlacklist} className="bg-red-600 hover:bg-red-700"><Ban className="h-4 w-4 mr-1.5" />Bloquear</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card">
              <CardHeader><CardTitle className="text-base">Números Bloqueados</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Adicionado em</TableHead>
                      <TableHead>Por</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blacklist.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium text-foreground">{b.phone}</TableCell>
                        <TableCell className="text-muted-foreground">{b.reason}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{new Date(b.added_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell><Badge variant="secondary">{b.added_by}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* HORÁRIOS & LIMITES */}
          <TabsContent value="horarios" className="space-y-6">
            <Card className="border-border/60 bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />Horários de Discagem</CardTitle>
                <CardDescription>Configure os horários permitidos para ligações automáticas (respeitando a legislação)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Horário início</Label>
                    <Input type="time" value={scheduleConfig.startTime} onChange={(e) => setScheduleConfig({ ...scheduleConfig, startTime: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Horário fim</Label>
                    <Input type="time" value={scheduleConfig.endTime} onChange={(e) => setScheduleConfig({ ...scheduleConfig, endTime: e.target.value })} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium">Permitir fins de semana</p></div>
                  <Switch checked={scheduleConfig.allowWeekends} onCheckedChange={(v) => setScheduleConfig({ ...scheduleConfig, allowWeekends: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium">Permitir feriados</p></div>
                  <Switch checked={scheduleConfig.allowHolidays} onCheckedChange={(v) => setScheduleConfig({ ...scheduleConfig, allowHolidays: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium">Respeitar lista DNC (Do Not Call)</p></div>
                  <Switch checked={scheduleConfig.respectDNC} onCheckedChange={(v) => setScheduleConfig({ ...scheduleConfig, respectDNC: v })} />
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Máx. tentativas/lead</Label>
                    <Input type="number" value={scheduleConfig.maxRetries} onChange={(e) => setScheduleConfig({ ...scheduleConfig, maxRetries: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Intervalo entre tentativas (min)</Label>
                    <Input type="number" value={scheduleConfig.retryIntervalMinutes} onChange={(e) => setScheduleConfig({ ...scheduleConfig, retryIntervalMinutes: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Máx. ligações/dia por lead</Label>
                    <Input type="number" value={scheduleConfig.maxCallsPerDay} onChange={(e) => setScheduleConfig({ ...scheduleConfig, maxCallsPerDay: Number(e.target.value) })} />
                  </div>
                </div>
                <Button onClick={() => toast.success("Configurações de horário salvas!")} className="w-full">Salvar Configurações</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AUDITORIA */}
          <TabsContent value="auditoria" className="space-y-6">
            <Card className="border-border/60 bg-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Log de Auditoria</CardTitle>
                    <CardDescription>Registro de todas as ações de compliance do sistema</CardDescription>
                  </div>
                  <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1.5" />Exportar</Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Severidade</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Detalhes</TableHead>
                      <TableHead>Data/Hora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell><Badge variant="outline" className={severityColors[log.severity]}>{log.severity.toUpperCase()}</Badge></TableCell>
                        <TableCell className="font-medium text-foreground">{log.action}</TableCell>
                        <TableCell className="text-muted-foreground">{log.user}</TableCell>
                        <TableCell className="text-muted-foreground text-xs max-w-[300px] truncate">{log.details}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{new Date(log.timestamp).toLocaleString("pt-BR")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
