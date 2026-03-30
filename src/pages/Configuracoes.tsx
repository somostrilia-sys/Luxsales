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
import { Loader2, Users } from "lucide-react";
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

// ── FASE 1: Configurações de Distribuição de Leads ──
interface LeadDistConfig {
  batchSize: number;
  threshold: number;
  selectedRoleIds: string[];
}

const LEAD_DIST_DEFAULTS: LeadDistConfig = {
  batchSize: 5000,
  threshold: 500,
  selectedRoleIds: [],
};

interface RoleOption {
  id: string;
  name: string;
  level: number;
}

// Detecta se role é comercial/consultor/vendas para pré-selecionar
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

  const [config, setConfig] = useState<Config>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // FASE 1: Lead distribution config state
  const [leadDistConfig, setLeadDistConfig] = useState<LeadDistConfig>(LEAD_DIST_DEFAULTS);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [savingLeadDist, setSavingLeadDist] = useState(false);

  useEffect(() => {
    loadConfig();
    if (companyId) loadLeadDistConfig(companyId);
  }, [companyId]);

  const loadConfig = async () => {
    try {
      const keys = Object.values(DB_KEYS);
      const { data, error } = await supabase
        .from("system_configs")
        .select("key, value")
        .in("key", keys);

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

  // FASE 1: Carregar configurações de distribuição de leads
  const loadLeadDistConfig = async (cid: string) => {
    try {
      // Buscar roles da empresa
      const { data: rolesData } = await supabase
        .from("roles")
        .select("id, name, level")
        .eq("company_id", cid)
        .eq("active", true)
        .order("level");

      const rolesArr: RoleOption[] = (rolesData || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        level: r.level,
      }));
      setRoles(rolesArr);

      // Buscar config salva
      const { data: configRows } = await supabase
        .from("system_configs")
        .select("key, value")
        .eq("company_id", cid)
        .in("key", ["lead_distribution_batch_size", "lead_distribution_threshold", "lead_distribution_roles"]);

      const cfgMap: Record<string, string> = {};
      for (const row of configRows || []) cfgMap[row.key] = row.value;

      let selectedRoleIds: string[] = [];
      if (cfgMap["lead_distribution_roles"]) {
        try {
          const parsed = JSON.parse(cfgMap["lead_distribution_roles"]);
          if (Array.isArray(parsed)) selectedRoleIds = parsed;
        } catch { /* ignore */ }
      } else {
        // Pré-selecionar roles comerciais por padrão
        selectedRoleIds = rolesArr.filter(isCommercialRole).map(r => r.id);
      }

      setLeadDistConfig({
        batchSize: cfgMap["lead_distribution_batch_size"]
          ? parseInt(cfgMap["lead_distribution_batch_size"], 10)
          : LEAD_DIST_DEFAULTS.batchSize,
        threshold: cfgMap["lead_distribution_threshold"]
          ? parseInt(cfgMap["lead_distribution_threshold"], 10)
          : LEAD_DIST_DEFAULTS.threshold,
        selectedRoleIds,
      });
    } catch (e: any) {
      // Silencioso — não bloqueia a página
    }
  };

  const salvar = async () => {
    setSaving(true);
    try {
      const upserts = (Object.keys(config) as (keyof Config)[]).map((k) => ({
        key: DB_KEYS[k],
        value: String(config[k]),
      }));

      const { error } = await supabase
        .from("system_configs")
        .upsert(upserts, { onConflict: "key" });

      if (error) throw error;
      toast.success("Configurações salvas com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  // FASE 1: Salvar configurações de distribuição de leads
  const salvarLeadDist = async () => {
    if (!companyId) {
      toast.error("Selecione uma empresa primeiro");
      return;
    }
    setSavingLeadDist(true);
    try {
      const upserts = [
        { key: "lead_distribution_batch_size", value: String(leadDistConfig.batchSize), company_id: companyId },
        { key: "lead_distribution_threshold", value: String(leadDistConfig.threshold), company_id: companyId },
        { key: "lead_distribution_roles", value: JSON.stringify(leadDistConfig.selectedRoleIds), company_id: companyId },
      ];

      const { error } = await supabase
        .from("system_configs")
        .upsert(upserts, { onConflict: "key,company_id" });

      if (error) {
        // Fallback: tentar sem company_id no conflict (schema sem company_id unique)
        const upsertsFallback = [
          { key: "lead_distribution_batch_size", value: String(leadDistConfig.batchSize) },
          { key: "lead_distribution_threshold", value: String(leadDistConfig.threshold) },
          { key: "lead_distribution_roles", value: JSON.stringify(leadDistConfig.selectedRoleIds) },
        ];
        const { error: err2 } = await supabase
          .from("system_configs")
          .upsert(upsertsFallback, { onConflict: "key" });
        if (err2) throw err2;
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
      const current = prev.selectedRoleIds;
      const next = current.includes(roleId)
        ? current.filter(id => id !== roleId)
        : [...current, roleId];
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
      <div className="space-y-6 max-w-2xl">
        <PageHeader
          title="Configurações"
          subtitle="Horários de envio e notificações"
        />

        <Card className="shadow-sm bg-card/80 backdrop-blur-sm">
          <CardHeader><CardTitle className="text-lg">Horários de Envio</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Início</Label>
                <Input
                  type="time"
                  value={config.horarioInicio}
                  onChange={(e) => setConfig({ ...config, horarioInicio: e.target.value })}
                />
              </div>
              <div>
                <Label>Fim</Label>
                <Input
                  type="time"
                  value={config.horarioFim}
                  onChange={(e) => setConfig({ ...config, horarioFim: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Intervalo entre disparos</Label>
              <Select
                value={config.intervalo}
                onValueChange={(v) => setConfig({ ...config, intervalo: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hora</SelectItem>
                  <SelectItem value="2">2 horas</SelectItem>
                  <SelectItem value="3">3 horas</SelectItem>
                  <SelectItem value="4">4 horas</SelectItem>
                  <SelectItem value="6">6 horas</SelectItem>
                  <SelectItem value="12">12 horas</SelectItem>
                  <SelectItem value="24">24 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

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
                <Switch
                  checked={config[item.key]}
                  onCheckedChange={(v) => setConfig({ ...config, [item.key]: v })}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Button onClick={salvar} disabled={saving} className="w-full sm:w-auto btn-shimmer">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : "Salvar Configurações"}
        </Button>

        {/* ── FASE 1: Distribuição de Leads ── */}
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
                <Label htmlFor="batchSize">Tamanho do lote por consultor</Label>
                <p className="text-xs text-muted-foreground">Quantos leads distribuir de uma vez para cada colaborador</p>
                <Input
                  id="batchSize"
                  type="number"
                  min={1}
                  max={50000}
                  value={leadDistConfig.batchSize}
                  onChange={e => setLeadDistConfig(prev => ({ ...prev, batchSize: parseInt(e.target.value, 10) || LEAD_DIST_DEFAULTS.batchSize }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="threshold">Redistribuir quando restar</Label>
                <p className="text-xs text-muted-foreground">Nova distribuição automática quando o consultor tiver menos que este número de leads ativos</p>
                <Input
                  id="threshold"
                  type="number"
                  min={0}
                  max={10000}
                  value={leadDistConfig.threshold}
                  onChange={e => setLeadDistConfig(prev => ({ ...prev, threshold: parseInt(e.target.value, 10) || LEAD_DIST_DEFAULTS.threshold }))}
                />
              </div>
            </div>

            {roles.length > 0 && (
              <div className="space-y-2">
                <Label>Roles que recebem leads</Label>
                <p className="text-xs text-muted-foreground">
                  Apenas colaboradores com esses roles receberão leads na distribuição.
                  Roles comerciais/consultor/vendas (level 2-3) são pré-selecionados.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {roles.map(role => {
                    const isCommercial = isCommercialRole(role);
                    return (
                      <div key={role.id} className="flex items-center gap-2 py-1">
                        <Checkbox
                          id={`role-${role.id}`}
                          checked={leadDistConfig.selectedRoleIds.includes(role.id)}
                          onCheckedChange={() => toggleRole(role.id)}
                        />
                        <label htmlFor={`role-${role.id}`} className="text-sm cursor-pointer flex items-center gap-1.5">
                          {role.name}
                          <span className="text-xs text-muted-foreground">(level {role.level})</span>
                          {isCommercial && (
                            <span className="text-xs text-primary">✓ comercial</span>
                          )}
                        </label>
                      </div>
                    );
                  })}
                </div>
                {leadDistConfig.selectedRoleIds.length === 0 && (
                  <p className="text-xs text-amber-500">⚠️ Nenhum role selecionado — nenhum lead será distribuído automaticamente</p>
                )}
              </div>
            )}

            {roles.length === 0 && !loading && (
              <p className="text-xs text-muted-foreground">Nenhum role encontrado para esta empresa.</p>
            )}

            <Button onClick={salvarLeadDist} disabled={savingLeadDist} variant="outline" className="w-full sm:w-auto">
              {savingLeadDist ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : "Salvar Distribuição de Leads"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
