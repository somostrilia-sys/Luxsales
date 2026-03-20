import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Shield, ShieldCheck, Ban, Clock, FileText, RefreshCw,
  Check, X, Eye, Lock, Download, Loader2, Plus, Trash2,
} from "lucide-react";

export default function ComplianceVoz() {
  const { collaborator } = useCollaborator();
  const companyId = collaborator?.company_id;
  const [activeTab, setActiveTab] = useState("lgpd");
  const [loading, setLoading] = useState(true);

  // Real data from new tables
  const [blacklist, setBlacklist] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [optIns, setOptIns] = useState<any[]>([]);
  const [complianceRules, setComplianceRules] = useState<any[]>([]);
  const [blacklistPhone, setBlacklistPhone] = useState("");
  const [blacklistReason, setBlacklistReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (companyId) loadAll();
  }, [companyId]);

  const loadAll = async () => {
    setLoading(true);
    const [bl, logs, opts, rules] = await Promise.all([
      supabase.from("ai_call_compliance").select("*").eq("company_id", companyId).in("compliance_type", ["dnc_list", "blacklist"]).eq("is_active", true).order("created_at", { ascending: false }).limit(100),
      supabase.from("audit_logs").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).limit(100),
      supabase.from("whatsapp_meta_opt_ins").select("id, phone_number, contact_name, is_active, opted_in_at, opted_out_at, lgpd_legal_basis, lgpd_deletion_requested_at").eq("company_id", companyId).order("created_at", { ascending: false }).limit(100),
      supabase.from("ai_call_compliance").select("*").eq("company_id", companyId).eq("compliance_type", "call_hours").eq("is_active", true).limit(1),
    ]);
    setBlacklist(bl.data ?? []);
    setAuditLogs(logs.data ?? []);
    setOptIns(opts.data ?? []);
    setComplianceRules(rules.data ?? []);
    setLoading(false);
  };

  const addToBlacklist = async () => {
    if (!blacklistPhone || !companyId) return;
    setSaving(true);
    const normalized = blacklistPhone.replace(/\D/g, "");
    const { error } = await supabase.from("ai_call_compliance").insert({
      company_id: companyId,
      compliance_type: "dnc_list",
      phone_number: blacklistPhone,
      phone_number_normalized: normalized,
      reason: blacklistReason || "Adicionado manualmente",
      source: "manual",
      is_active: true,
    });
    if (error) toast.error("Erro ao adicionar: " + error.message);
    else {
      toast.success(`${blacklistPhone} adicionado à blacklist DNC`);
      // Also opt-out from WhatsApp
      await supabase.functions.invoke("lgpd-manager", {
        body: { company_id: companyId, action: "opt_out", phone: normalized },
      });
      setBlacklistPhone("");
      setBlacklistReason("");
      loadAll();
    }
    setSaving(false);
  };

  const removeFromBlacklist = async (id: string) => {
    await supabase.from("ai_call_compliance").update({ is_active: false }).eq("id", id);
    toast.success("Removido da blacklist");
    loadAll();
  };

  const requestLgpdDeletion = async (phone: string) => {
    if (!companyId) return;
    const { data } = await supabase.functions.invoke("lgpd-manager", {
      body: { company_id: companyId, action: "delete_data", phone },
    });
    if (data?.success) {
      toast.success("Dados anonimizados conforme LGPD Art. 18");
      loadAll();
    } else {
      toast.error("Erro ao processar exclusão LGPD");
    }
  };

  const exportLgpdData = async (phone: string) => {
    if (!companyId) return;
    const { data } = await supabase.functions.invoke("lgpd-manager", {
      body: { company_id: companyId, action: "export_data", phone },
    });
    if (data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lgpd_export_${phone}_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      toast.success("Dados exportados");
    }
  };

  const callHours = complianceRules[0]?.metadata as any;
  const totalBlocked = blacklist.length;
  const totalOptIns = optIns.filter(o => o.is_active).length;
  const totalOptOuts = optIns.filter(o => !o.is_active || o.opted_out_at).length;
  const pendingDeletions = optIns.filter(o => o.lgpd_deletion_requested_at).length;

  const severityColors: Record<string, string> = {
    INSERT: "bg-blue-500/20 text-blue-400",
    UPDATE: "bg-yellow-500/20 text-yellow-400",
    DELETE: "bg-red-500/20 text-red-400",
    API_CALL: "bg-violet-500/20 text-violet-400",
    EXPORT: "bg-emerald-500/20 text-emerald-400",
    LOGIN: "bg-blue-500/20 text-blue-400",
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <PageHeader title="Compliance & LGPD" subtitle="Carregando..." />
          <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Card key={i}><CardContent className="p-5"><Skeleton className="h-16" /></CardContent></Card>)}</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Compliance & LGPD"
          subtitle="DNC, Opt-out, Auditoria, Direito ao Esquecimento"
          badge={<Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30"><ShieldCheck className="h-3 w-3 mr-1" />Compliant</Badge>}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "DNC/Blacklist", value: totalBlocked, icon: Ban, color: "text-red-400", bg: "bg-red-500/10" },
            { label: "Opt-ins Ativos", value: totalOptIns, icon: Check, color: "text-emerald-400", bg: "bg-emerald-500/10" },
            { label: "Opt-outs", value: totalOptOuts, icon: X, color: "text-yellow-400", bg: "bg-yellow-500/10" },
            { label: "Auditoria", value: auditLogs.length, icon: Eye, color: "text-blue-400", bg: "bg-blue-500/10" },
          ].map(s => (
            <Card key={s.label} className="bg-card border-border/60">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg ${s.bg} flex items-center justify-center`}><s.icon className={`h-5 w-5 ${s.color}`} /></div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="h-auto flex-wrap gap-2 rounded-xl border border-border/60 bg-secondary/40 p-1">
            <TabsTrigger value="lgpd">LGPD & Opt-ins</TabsTrigger>
            <TabsTrigger value="blacklist">DNC / Blacklist ({totalBlocked})</TabsTrigger>
            <TabsTrigger value="horarios">Horários & Limites</TabsTrigger>
            <TabsTrigger value="auditoria">Auditoria ({auditLogs.length})</TabsTrigger>
          </TabsList>

          {/* LGPD & OPT-INS */}
          <TabsContent value="lgpd" className="space-y-6">
            <Card className="border-border/60 bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4 text-primary" />Consentimentos & Direitos do Titular</CardTitle>
                <CardDescription>Gerenciar opt-ins, exportar dados e processar exclusões LGPD Art. 18</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Base Legal</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {optIns.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum registro de consentimento</TableCell></TableRow>
                    ) : optIns.slice(0, 50).map(o => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-foreground">{o.phone_number}</TableCell>
                        <TableCell className="text-foreground">{o.contact_name ?? "—"}</TableCell>
                        <TableCell>
                          {o.lgpd_deletion_requested_at ? (
                            <Badge className="bg-red-500/20 text-red-400">Excluído</Badge>
                          ) : o.is_active ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400">Ativo</Badge>
                          ) : (
                            <Badge className="bg-yellow-500/20 text-yellow-400">Opt-out</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{o.lgpd_legal_basis ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{new Date(o.opted_in_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => exportLgpdData(o.phone_number)}>
                              <Download className="h-3 w-3 mr-1" />Exportar
                            </Button>
                            {!o.lgpd_deletion_requested_at && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400 hover:text-red-300" onClick={() => requestLgpdDeletion(o.phone_number)}>
                                <Trash2 className="h-3 w-3 mr-1" />Excluir
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BLACKLIST / DNC */}
          <TabsContent value="blacklist" className="space-y-6">
            <Card className="border-border/60 bg-card">
              <CardHeader>
                <CardTitle className="text-base">Adicionar ao DNC (Do Not Contact)</CardTitle>
                <CardDescription>Números bloqueados para ligações e mensagens WhatsApp</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Input placeholder="Telefone (ex: 5511999887766)" value={blacklistPhone} onChange={e => setBlacklistPhone(e.target.value)} className="flex-1 min-w-[200px]" />
                  <Input placeholder="Motivo" value={blacklistReason} onChange={e => setBlacklistReason(e.target.value)} className="flex-1 min-w-[200px]" />
                  <Button onClick={addToBlacklist} disabled={saving} className="bg-red-600 hover:bg-red-700">
                    {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Ban className="h-4 w-4 mr-1" />}
                    Bloquear
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card">
              <CardHeader><CardTitle className="text-base">Números Bloqueados ({totalBlocked})</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blacklist.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum número bloqueado</TableCell></TableRow>
                    ) : blacklist.map(b => (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono text-foreground">{b.phone_number}</TableCell>
                        <TableCell><Badge variant="secondary">{b.compliance_type}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{b.reason ?? "—"}</TableCell>
                        <TableCell><Badge variant="secondary">{b.source ?? "manual"}</Badge></TableCell>
                        <TableCell className="text-muted-foreground text-xs">{new Date(b.created_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400" onClick={() => removeFromBlacklist(b.id)}>
                            <X className="h-3 w-3 mr-1" />Remover
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* HORÁRIOS */}
          <TabsContent value="horarios" className="space-y-6">
            <Card className="border-border/60 bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />Horários de Discagem (Anatel/Procon)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {callHours ? (
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div className="flex justify-between"><span className="text-sm text-muted-foreground">Dias úteis</span><span className="text-sm font-medium">{callHours.start_hour}:00 - {callHours.end_hour}:00</span></div>
                      <div className="flex justify-between"><span className="text-sm text-muted-foreground">Sábado</span><span className="text-sm font-medium">{callHours.saturday_start}:00 - {callHours.saturday_end}:00</span></div>
                      <div className="flex justify-between"><span className="text-sm text-muted-foreground">Domingo</span><span className="text-sm font-medium">{callHours.sunday_allowed ? "Permitido" : "Bloqueado"}</span></div>
                      <div className="flex justify-between"><span className="text-sm text-muted-foreground">Feriados</span><span className="text-sm font-medium">{callHours.holiday_allowed ? "Permitido" : "Bloqueado"}</span></div>
                      <div className="flex justify-between"><span className="text-sm text-muted-foreground">Timezone</span><span className="text-sm font-medium">{callHours.timezone}</span></div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between"><span className="text-sm text-muted-foreground">Dias permitidos</span><span className="text-sm font-medium">{(callHours.allowed_days || []).map((d: number) => ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][d]).join(", ")}</span></div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Nenhuma regra de horário configurada. Rode a migration 008 para configurar os padrões Anatel/Procon.</p>
                )}
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
                    <CardDescription>Registro de todas as ações do sistema — dados reais</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadAll}><RefreshCw className="h-4 w-4 mr-1" />Atualizar</Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ação</TableHead>
                      <TableHead>Tabela</TableHead>
                      <TableHead>Tipo Ator</TableHead>
                      <TableHead>Detalhes</TableHead>
                      <TableHead>Data/Hora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum log de auditoria ainda</TableCell></TableRow>
                    ) : auditLogs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell><Badge variant="outline" className={severityColors[log.action] ?? "bg-muted text-muted-foreground"}>{log.action}</Badge></TableCell>
                        <TableCell className="text-foreground">{log.table_name}</TableCell>
                        <TableCell className="text-muted-foreground">{log.actor_type ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs max-w-[300px] truncate">{log.metadata ? JSON.stringify(log.metadata).slice(0, 80) : "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{new Date(log.created_at).toLocaleString("pt-BR")}</TableCell>
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
