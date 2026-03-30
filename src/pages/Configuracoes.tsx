import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Phone, MessageSquare, Bot, Building2, ChevronDown, ChevronUp, CheckCircle2, XCircle } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";

interface Config {
  horarioInicio: string;
  horarioFim: string;
  intervalo: string;
  emailNotif: boolean;
  whatsappNotif: boolean;
  alertaErro: boolean;
  alertaLead: boolean;
  relatoriosDiarios: boolean;
}

const DEFAULTS: Config = {
  horarioInicio: "08:00",
  horarioFim: "20:00",
  intervalo: "2",
  emailNotif: true,
  whatsappNotif: false,
  alertaErro: true,
  alertaLead: true,
  relatoriosDiarios: true,
};

const DB_KEYS: Record<keyof Config, string> = {
  horarioInicio: "dispatch_schedule_start",
  horarioFim: "dispatch_schedule_end",
  intervalo: "dispatch_interval_hours",
  emailNotif: "notif_email",
  whatsappNotif: "notif_whatsapp",
  alertaErro: "notif_alert_error",
  alertaLead: "notif_alert_lead",
  relatoriosDiarios: "notif_daily_report",
};

interface LeadDistConfig {
  batchSize: number;
  threshold: number;
  selectedRoleIds: string[];
  interval: string;
}

const LEAD_DIST_DEFAULTS: LeadDistConfig = {
  batchSize: 5000,
  threshold: 500,
  selectedRoleIds: [],
  interval: "manual",
};

interface RoleOption {
  id: string;
  name: string;
  level: number;
}

interface VoipConfig {
  ramal: string;
  servidor: string;
  porta: string;
  ativo: boolean;
}

// Módulo 8: Config por empresa
interface CompanyConfig {
  voip: {
    servidor: string;
    porta: number;
    numero: string;
    ativo: boolean;
  };
  whatsapp: {
    numero: string;
    token: string;
    tier: number;
    phoneNumberId: string;
    businessAccountId: string;
  };
  distribution: {
    batchSize: number;
    threshold: number;
    roles: string[];
    interval: string;
  };
  ai: {
    model: string;
    tone: string;
    temperature: number;
    maxTokens: number;
  };
}

const COMPANY_CONFIG_DEFAULTS: CompanyConfig = {
  voip: { servidor: "192.168.0.206", porta: 5060, numero: "", ativo: true },
  whatsapp: { numero: "", token: "", tier: 1000, phoneNumberId: "", businessAccountId: "" },
  distribution: { batchSize: 5000, threshold: 500, roles: [], interval: "manual" },
  ai: { model: "claude-haiku-20240307", tone: "consultivo", temperature: 0.7, maxTokens: 500 },
};

interface Company {
  id: string;
  name: string;
  logo_url?: string;
}

function isCommercialRole(role: RoleOption): boolean {
  const name = role.name.toLowerCase();
  return (role.level === 2 || role.level === 3) &&
    (name.includes("comercial") || name.includes("consultor") || name.includes("vendas"));
}

export default function Configuracoes() {
  const { collaborator } = useCollaborator();
  const { selectedCompanyId } = useCompanyFilter();
  const companyId = selectedCompanyId && selectedCompanyId !== "all"
    ? selectedCompanyId
    : collaborator?.company_id ?? null;

  const isCEO = collaborator?.role_level === 0;

  const [config, setConfig] = useState<Config>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [leadDistConfig, setLeadDistConfig] = useState<LeadDistConfig>(LEAD_DIST_DEFAULTS);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [savingLeadDist, setSavingLeadDist] = useState(false);

  const VOIP_DEFAULTS: VoipConfig = { ramal: "", servidor: "192.168.0.206", porta: "5060", ativo: false };
  const [voipConfig, setVoipConfig] = useState<VoipConfig>(VOIP_DEFAULTS);
  const [savingVoip, setSavingVoip] = useState(false);

  // Módulo 8: empresas
  const [companies, setCompanies] = useState<Company[]>([]);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [companyConfigs, setCompanyConfigs] = useState<Record<string, CompanyConfig>>({});
  const [savingCompany, setSavingCompany] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadConfig();
    if (companyId) loadLeadDistConfig(companyId);
    if (collaborator?.id) loadVoipConfig(collaborator.id);
    if (isCEO) loadCompanies();
  }, [companyId, isCEO]);

  const loadCompanies = async () => {
    try {
      const { data } = await supabase.from("companies").select("id, name, logo_url").order("name");
      if (data) {
        setCompanies(data);
        for (const c of data) {
          await loadCompanyConfig(c.id);
        }
      }
    } catch { /* silencioso */ }
  };

  const loadCompanyConfig = async (cid: string) => {
    try {
      const { data } = await supabase
        .from("system_configs")
        .select("value")
        .eq("key", `company_config_${cid}`)
        .maybeSingle();
      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          setCompanyConfigs(prev => ({ ...prev, [cid]: { ...COMPANY_CONFIG_DEFAULTS, ...parsed } }));
        } catch { /* ignore */ }
      } else {
        setCompanyConfigs(prev => ({ ...prev, [cid]: { ...COMPANY_CONFIG_DEFAULTS } }));
      }
    } catch {
      setCompanyConfigs(prev => ({ ...prev, [cid]: { ...COMPANY_CONFIG_DEFAULTS } }));
    }
  };

  const saveCompanyConfig = async (cid: string) => {
    setSavingCompany(cid);
    try {
      const cfg = companyConfigs[cid] ?? COMPANY_CONFIG_DEFAULTS;
      const { error } = await supabase.from("system_configs").upsert(
        { key: `company_config_${cid}`, value: JSON.stringify(cfg), company_id: cid },
        { onConflict: "key" }
      );
      if (error) throw error;
      toast.success("Configurações da empresa salvas!");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSavingCompany(null);
    }
  };

  const updateCompanyConfig = (cid: string, section: keyof CompanyConfig, field: string, value: unknown) => {
    setCompanyConfigs(prev => ({
      ...prev,
      [cid]: {
        ...(prev[cid] ?? COMPANY_CONFIG_DEFAULTS),
        [section]: {
          ...((prev[cid] ?? COMPANY_CONFIG_DEFAULTS)[section] as object),
          [field]: value,
        },
      },
    }));
  };

  const testMetaConnection = async (cid: string) => {
    setTestingConnection(prev => ({ ...prev, [`meta_${cid}`]: true }));
    try {
      const cfg = companyConfigs[cid]?.whatsapp;
      if (!cfg?.token || !cfg?.phoneNumberId) {
        toast.error("Preencha o Token e Phone Number ID antes de testar");
        return;
      }
      const res = await fetch(
        `https://graph.facebook.com/v18.0/${cfg.phoneNumberId}?access_token=${cfg.token}`
      );
      if (res.ok) {
        toast.success("✅ Conexão Meta OK!");
      } else {
        toast.error("❌ Falha na conexão Meta — verifique o token");
      }
    } catch {
      toast.error("Erro ao testar conexão Meta");
    } finally {
      setTestingConnection(prev => ({ ...prev, [`meta_${cid}`]: false }));
    }
  };

  const loadConfig = async () => {
    try {
      const keys = Object.values(DB_KEYS);
      const { data, error } = await supabase.from("system_configs").select("key, value").in("key", keys);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((row) => { map[row.key] = row.value; });
      setConfig({
        horarioInicio: map[DB_KEYS.horarioInicio] ?? DEFAULTS.horarioInicio,
        horarioFim: map[DB_KEYS.horarioFim] ?? DEFAULTS.horarioFim,
        intervalo: map[DB_KEYS.intervalo] ?? DEFAULTS.intervalo,
        emailNotif: (map[DB_KEYS.emailNotif] ?? "true") === "true",
        whatsappNotif: (map[DB_KEYS.whatsappNotif] ?? "false") === "true",
        alertaErro: (map[DB_KEYS.alertaErro] ?? "true") === "true",
        alertaLead: (map[DB_KEYS.alertaLead] ?? "true") === "true",
        relatoriosDiarios: (map[DB_KEYS.relatoriosDiarios] ?? "true") === "true",
      });
    } catch (e: any) {
      toast.error("Erro ao carregar configurações: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadVoipConfig = async (colabId: string) => {
    try {
      const { data } = await supabase.from("system_configs").select("value").eq("key", `voip_config_${colabId}`).maybeSingle();
      if (data?.value) {
        try { setVoipConfig({ ...VOIP_DEFAULTS, ...JSON.parse(data.value) }); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  };

  const salvarVoip = async () => {
    if (!collaborator?.id) return;
    setSavingVoip(true);
    try {
      const { error } = await supabase.from("system_configs").upsert(
        { key: `voip_config_${collaborator.id}`, value: JSON.stringify(voipConfig), company_id: companyId },
        { onConflict: "key" }
      );
      if (error) throw error;
      toast.success("Configuração VoIP salva!");
    } catch (e: any) {
      toast.error("Erro ao salvar VoIP: " + e.message);
    } finally {
      setSavingVoip(false);
    }
  };

  const loadLeadDistConfig = async (cid: string) => {
    try {
      const { data: rolesData } = await supabase.from("roles").select("id, name, level").eq("company_id", cid).eq("active", true).order("level");
      const rolesArr: RoleOption[] = (rolesData || []).map((r: any) => ({ id: r.id, name: r.name, level: r.level }));
      setRoles(rolesArr);
      const { data: configRows } = await supabase.from("system_configs").select("key, value").eq("company_id", cid).in("key", ["lead_distribution_batch_size", "lead_distribution_threshold", "lead_distribution_roles", "lead_distribution_interval"]);
      const cfgMap: Record<string, string> = {};
      for (const row of configRows || []) cfgMap[row.key] = row.value;
      let selectedRoleIds: string[] = [];
      if (cfgMap["lead_distribution_roles"]) {
        try { const p = JSON.parse(cfgMap["lead_distribution_roles"]); if (Array.isArray(p)) selectedRoleIds = p; } catch { /* ignore */ }
      } else {
        selectedRoleIds = rolesArr.filter(isCommercialRole).map(r => r.id);
      }
      setLeadDistConfig({
        batchSize: cfgMap["lead_distribution_batch_size"] ? parseInt(cfgMap["lead_distribution_batch_size"], 10) : LEAD_DIST_DEFAULTS.batchSize,
        threshold: cfgMap["lead_distribution_threshold"] ? parseInt(cfgMap["lead_distribution_threshold"], 10) : LEAD_DIST_DEFAULTS.threshold,
        selectedRoleIds,
        interval: cfgMap["lead_distribution_interval"] ?? "manual",
      });
    } catch { /* silencioso */ }
  };

  const salvar = async () => {
    setSaving(true);
    try {
      const upserts = (Object.keys(config) as (keyof Config)[]).map((k) => ({ key: DB_KEYS[k], value: String(config[k]) }));
      const { error } = await supabase.from("system_configs").upsert(upserts, { onConflict: "key" });
      if (error) throw error;
      toast.success("Configurações salvas com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const salvarLeadDist = async () => {
    if (!companyId) { toast.error("Selecione uma empresa primeiro"); return; }
    setSavingLeadDist(true);
    try {
      const upserts = [
        { key: "lead_distribution_batch_size", value: String(leadDistConfig.batchSize), company_id: companyId },
        { key: "lead_distribution_threshold", value: String(leadDistConfig.threshold), company_id: companyId },
        { key: "lead_distribution_roles", value: JSON.stringify(leadDistConfig.selectedRoleIds), company_id: companyId },
        { key: "lead_distribution_interval", value: leadDistConfig.interval, company_id: companyId },
      ];
      const { error } = await supabase.from("system_configs").upsert(upserts, { onConflict: "key,company_id" });
      if (error) {
        const fallback = upserts.map(u => ({ key: u.key, value: u.value }));
        const { error: e2 } = await supabase.from("system_configs").upsert(fallback, { onConflict: "key" });
        if (e2) throw e2;
      }
      toast.success("Configurações de distribuição salvas!");
    } catch (e: any) {
      toast.error("Erro ao salvar distribuição: " + e.message);
    } finally {
      setSavingLeadDist(false);
    }
  };

  const toggleRole = (roleId: string) => {
    setLeadDistConfig(prev => {
      const next = prev.selectedRoleIds.includes(roleId)
        ? prev.selectedRoleIds.filter(id => id !== roleId)
        : [...prev.selectedRoleIds, roleId];
      return { ...prev, selectedRoleIds: next };
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <PageHeader title="Configurações" subtitle="Horários de envio, notificações e configurações por empresa" />

        {/* Horários */}
        <Card className="shadow-sm bg-card/80 backdrop-blur-sm">
          <CardHeader><CardTitle className="text-lg">Horários de Envio</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Início</Label><Input type="time" value={config.horarioInicio} onChange={(e) => setConfig({ ...config, horarioInicio: e.target.value })} /></div>
              <div><Label>Fim</Label><Input type="time" value={config.horarioFim} onChange={(e) => setConfig({ ...config, horarioFim: e.target.value })} /></div>
            </div>
            <div>
              <Label>Intervalo entre disparos</Label>
              <Select value={config.intervalo} onValueChange={(v) => setConfig({ ...config, intervalo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["1","2","3","4","6","12","24"].map(v => <SelectItem key={v} value={v}>{v} hora{parseInt(v)>1?"s":""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Notificações */}
        <Card className="shadow-sm bg-card/80 backdrop-blur-sm">
          <CardHeader><CardTitle className="text-lg">Notificações</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: "emailNotif" as const, label: "Notificações por Email" },
              { key: "whatsappNotif" as const, label: "Notificações por WhatsApp" },
              { key: "alertaErro" as const, label: "Alertas de Erro" },
              { key: "alertaLead" as const, label: "Alertas de Novos Leads" },
              { key: "relatoriosDiarios" as const, label: "Resumo Diário por Email" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <Label>{item.label}</Label>
                <Switch checked={config[item.key]} onCheckedChange={(v) => setConfig({ ...config, [item.key]: v })} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Button onClick={salvar} disabled={saving} className="w-full sm:w-auto btn-shimmer">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : "Salvar Configurações"}
        </Button>

        {/* Distribuição de Leads */}
        <Card className="shadow-sm bg-card/80 backdrop-blur-sm mt-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Distribuição de Leads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="batchSize">Lote por consultor</Label>
                <p className="text-xs text-muted-foreground">Leads por consultor em cada rodada</p>
                <Input id="batchSize" type="number" min={1} max={50000} value={leadDistConfig.batchSize} onChange={e => setLeadDistConfig(prev => ({ ...prev, batchSize: parseInt(e.target.value, 10) || 5000 }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="threshold">Redistribuir quando restar</Label>
                <p className="text-xs text-muted-foreground">Nova distribuição quando consultor tiver menos que X leads</p>
                <Input id="threshold" type="number" min={0} max={10000} value={leadDistConfig.threshold} onChange={e => setLeadDistConfig(prev => ({ ...prev, threshold: parseInt(e.target.value, 10) || 500 }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Intervalo de redistribuição</Label>
              <Select value={leadDistConfig.interval} onValueChange={v => setLeadDistConfig(prev => ({ ...prev, interval: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="daily">Diário (automático)</SelectItem>
                  <SelectItem value="weekly">Semanal (automático)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {roles.length > 0 && (
              <div className="space-y-2">
                <Label>Roles que recebem leads</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {roles.map(role => (
                    <div key={role.id} className="flex items-center gap-2 py-1">
                      <Checkbox id={`role-${role.id}`} checked={leadDistConfig.selectedRoleIds.includes(role.id)} onCheckedChange={() => toggleRole(role.id)} />
                      <label htmlFor={`role-${role.id}`} className="text-sm cursor-pointer flex items-center gap-1.5">
                        {role.name}
                        <span className="text-xs text-muted-foreground">(level {role.level})</span>
                        {isCommercialRole(role) && <span className="text-xs text-primary">✓</span>}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Button onClick={salvarLeadDist} disabled={savingLeadDist} variant="outline" className="w-full sm:w-auto">
              {savingLeadDist ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : "Salvar Distribuição"}
            </Button>
          </CardContent>
        </Card>

        {/* VoIP pessoal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="h-4 w-4 text-primary" />
              Meu Canal VoIP
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Ramal / Número SIP</Label><Input placeholder="Ex: 1001" value={voipConfig.ramal} onChange={e => setVoipConfig(v => ({ ...v, ramal: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Servidor SIP</Label><Input placeholder="192.168.0.206" value={voipConfig.servidor} onChange={e => setVoipConfig(v => ({ ...v, servidor: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Porta</Label><Input placeholder="5060" value={voipConfig.porta} onChange={e => setVoipConfig(v => ({ ...v, porta: e.target.value }))} /></div>
              <div className="flex items-center gap-3 pt-5"><Switch checked={voipConfig.ativo} onCheckedChange={val => setVoipConfig(v => ({ ...v, ativo: val }))} /><Label>Canal ativo</Label></div>
            </div>
            <Button onClick={salvarVoip} disabled={savingVoip} variant="outline" className="w-full sm:w-auto">
              {savingVoip ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : "Salvar VoIP"}
            </Button>
          </CardContent>
        </Card>

        {/* ── MÓDULO 8: Configuração por Empresa (CEO only) ── */}
        {isCEO && (
          <Card className="shadow-sm bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Empresas
                <Badge variant="outline" className="ml-auto text-xs">CEO</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">Configure VoIP, WhatsApp Meta, distribuição e IA por empresa</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {companies.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma empresa encontrada</p>
              )}
              {companies.map(company => {
                const cfg = companyConfigs[company.id] ?? COMPANY_CONFIG_DEFAULTS;
                const isExpanded = expandedCompany === company.id;
                const isSaving = savingCompany === company.id;

                return (
                  <div key={company.id} className="border rounded-lg overflow-hidden">
                    {/* Header da empresa */}
                    <button
                      className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                      onClick={() => setExpandedCompany(isExpanded ? null : company.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {company.name.charAt(0)}
                        </div>
                        <span className="font-medium">{company.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Status badges */}
                        {cfg.voip.ativo
                          ? <span className="flex items-center gap-1 text-xs text-green-500"><CheckCircle2 className="h-3 w-3" />VoIP</span>
                          : <span className="flex items-center gap-1 text-xs text-muted-foreground"><XCircle className="h-3 w-3" />VoIP</span>
                        }
                        {cfg.whatsapp.token
                          ? <span className="flex items-center gap-1 text-xs text-green-500"><CheckCircle2 className="h-3 w-3" />WA</span>
                          : <span className="flex items-center gap-1 text-xs text-muted-foreground"><XCircle className="h-3 w-3" />WA</span>
                        }
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {/* Config expandida */}
                    {isExpanded && (
                      <div className="border-t bg-muted/20">
                        <Tabs defaultValue="voip" className="p-4">
                          <TabsList className="grid grid-cols-4 w-full mb-4">
                            <TabsTrigger value="voip" className="flex items-center gap-1 text-xs"><Phone className="h-3 w-3" />VoIP</TabsTrigger>
                            <TabsTrigger value="whatsapp" className="flex items-center gap-1 text-xs"><MessageSquare className="h-3 w-3" />WhatsApp</TabsTrigger>
                            <TabsTrigger value="distribuicao" className="flex items-center gap-1 text-xs"><Users className="h-3 w-3" />Leads</TabsTrigger>
                            <TabsTrigger value="ia" className="flex items-center gap-1 text-xs"><Bot className="h-3 w-3" />IA</TabsTrigger>
                          </TabsList>

                          {/* VoIP */}
                          <TabsContent value="voip" className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Servidor SIP</Label>
                                <Input className="h-8 text-sm" placeholder="192.168.0.206" value={cfg.voip.servidor} onChange={e => updateCompanyConfig(company.id, "voip", "servidor", e.target.value)} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Porta</Label>
                                <Input className="h-8 text-sm" type="number" placeholder="5060" value={cfg.voip.porta} onChange={e => updateCompanyConfig(company.id, "voip", "porta", parseInt(e.target.value))} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Número Telnyx/Allgar</Label>
                                <Input className="h-8 text-sm" placeholder="+55119..." value={cfg.voip.numero} onChange={e => updateCompanyConfig(company.id, "voip", "numero", e.target.value)} />
                              </div>
                              <div className="flex items-center gap-2 pt-4">
                                <Switch checked={cfg.voip.ativo} onCheckedChange={v => updateCompanyConfig(company.id, "voip", "ativo", v)} />
                                <Label className="text-xs">Canal ativo</Label>
                              </div>
                            </div>
                          </TabsContent>

                          {/* WhatsApp Meta */}
                          <TabsContent value="whatsapp" className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Número WA Business</Label>
                                <Input className="h-8 text-sm" placeholder="+55119..." value={cfg.whatsapp.numero} onChange={e => updateCompanyConfig(company.id, "whatsapp", "numero", e.target.value)} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">TIER Meta</Label>
                                <Select value={String(cfg.whatsapp.tier)} onValueChange={v => updateCompanyConfig(company.id, "whatsapp", "tier", parseInt(v))}>
                                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1000">TIER 1 — 1.000/dia</SelectItem>
                                    <SelectItem value="10000">TIER 2 — 10.000/dia</SelectItem>
                                    <SelectItem value="100000">TIER 3 — 100.000/dia</SelectItem>
                                    <SelectItem value="999999">TIER 4 — Ilimitado</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Phone Number ID</Label>
                                <Input className="h-8 text-sm" placeholder="ID do número" value={cfg.whatsapp.phoneNumberId} onChange={e => updateCompanyConfig(company.id, "whatsapp", "phoneNumberId", e.target.value)} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Business Account ID</Label>
                                <Input className="h-8 text-sm" placeholder="WABA ID" value={cfg.whatsapp.businessAccountId} onChange={e => updateCompanyConfig(company.id, "whatsapp", "businessAccountId", e.target.value)} />
                              </div>
                              <div className="col-span-2 space-y-1">
                                <Label className="text-xs">Token de Acesso Meta</Label>
                                <Input className="h-8 text-sm" type="password" placeholder="EAAxxxxxxxx..." value={cfg.whatsapp.token} onChange={e => updateCompanyConfig(company.id, "whatsapp", "token", e.target.value)} />
                              </div>
                            </div>
                            <Button
                              variant="outline" size="sm"
                              disabled={testingConnection[`meta_${company.id}`]}
                              onClick={() => testMetaConnection(company.id)}
                            >
                              {testingConnection[`meta_${company.id}`] ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Testando...</> : "Testar Conexão Meta"}
                            </Button>
                          </TabsContent>

                          {/* Distribuição */}
                          <TabsContent value="distribuicao" className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Lote por consultor</Label>
                                <Input className="h-8 text-sm" type="number" value={cfg.distribution.batchSize} onChange={e => updateCompanyConfig(company.id, "distribution", "batchSize", parseInt(e.target.value))} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Redistribuir quando restar</Label>
                                <Input className="h-8 text-sm" type="number" value={cfg.distribution.threshold} onChange={e => updateCompanyConfig(company.id, "distribution", "threshold", parseInt(e.target.value))} />
                              </div>
                              <div className="col-span-2 space-y-1">
                                <Label className="text-xs">Intervalo de redistribuição</Label>
                                <Select value={cfg.distribution.interval} onValueChange={v => updateCompanyConfig(company.id, "distribution", "interval", v)}>
                                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="manual">Manual</SelectItem>
                                    <SelectItem value="daily">Diário</SelectItem>
                                    <SelectItem value="weekly">Semanal</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </TabsContent>

                          {/* IA */}
                          <TabsContent value="ia" className="space-y-4">
                            <div className="space-y-1">
                              <Label className="text-xs">Modelo LLM — Lucas</Label>
                              <Select value={cfg.ai.model} onValueChange={v => updateCompanyConfig(company.id, "ai", "model", v)}>
                                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="claude-haiku-20240307">Claude Haiku (rápido, econômico)</SelectItem>
                                  <SelectItem value="claude-sonnet-4-5">Claude Sonnet (balanceado)</SelectItem>
                                  <SelectItem value="claude-opus-4">Claude Opus (mais inteligente)</SelectItem>
                                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                                  <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Tom de voz do Lucas</Label>
                              <Select value={cfg.ai.tone} onValueChange={v => updateCompanyConfig(company.id, "ai", "tone", v)}>
                                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="formal">Formal</SelectItem>
                                  <SelectItem value="amigavel">Amigável</SelectItem>
                                  <SelectItem value="consultivo">Consultivo</SelectItem>
                                  <SelectItem value="direto">Direto ao ponto</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <Label className="text-xs">Temperatura: {cfg.ai.temperature.toFixed(1)}</Label>
                                <span className="text-xs text-muted-foreground">{cfg.ai.temperature < 0.4 ? "Preciso" : cfg.ai.temperature < 0.7 ? "Balanceado" : "Criativo"}</span>
                              </div>
                              <Slider
                                min={0} max={1} step={0.1}
                                value={[cfg.ai.temperature]}
                                onValueChange={([v]) => updateCompanyConfig(company.id, "ai", "temperature", v)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Máx. tokens por resposta</Label>
                              <Input className="h-8 text-sm" type="number" min={100} max={2000} value={cfg.ai.maxTokens} onChange={e => updateCompanyConfig(company.id, "ai", "maxTokens", parseInt(e.target.value))} />
                            </div>
                          </TabsContent>
                        </Tabs>

                        <div className="px-4 pb-4">
                          <Button onClick={() => saveCompanyConfig(company.id)} disabled={isSaving} className="w-full sm:w-auto">
                            {isSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : `Salvar ${company.name}`}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
