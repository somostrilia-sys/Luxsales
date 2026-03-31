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
import { Loader2, Users, Phone, MessageSquare, Bot, Building2, ChevronDown, ChevronUp, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { EDGE_BASE, SUPABASE_ANON_KEY } from "@/lib/constants";

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
    metaTierDaily: number;
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
  distribution: { batchSize: 5000, threshold: 500, roles: [], interval: "manual", metaTierDaily: 250 },
  ai: { model: "claude-haiku-20240307", tone: "consultivo", temperature: 0.7, maxTokens: 500 },
};

interface Company {
  id: string;
  name: string;
  logo_url?: string;
}

// ── Meta Status por Empresa (inline no módulo 8) ─────────────────────────────

function CompanyMetaStatus({ companyId, phoneNumberId, token }: { companyId: string; phoneNumberId: string; token: string }) {
  const connected = !!(phoneNumberId && token);
  const [status, setStatus] = useState<{ quality: string; tier: string; tier_limit: number; usage_pct: number; blocks_24h: number; verified_name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    if (!connected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${EDGE_BASE}/quality-monitor`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ action: "check", company_id: companyId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.error) { setError(data.error); }
        else { setStatus(data); }
      } else {
        setError("Erro ao consultar Meta API");
      }
    } catch { setError("Erro de rede"); }
    setLoading(false);
  };

  useEffect(() => {
    if (connected) fetchStatus();
  }, [companyId, phoneNumberId]);

  const qColor = status?.quality === "GREEN" ? "text-green-500" : status?.quality === "YELLOW" ? "text-yellow-500" : status?.quality === "RED" ? "text-red-500" : "text-muted-foreground";
  const qBg = status?.quality === "GREEN" ? "bg-green-500/10 border-green-500/30" : status?.quality === "YELLOW" ? "bg-yellow-500/10 border-yellow-500/30" : status?.quality === "RED" ? "bg-red-500/10 border-red-500/30" : "bg-muted/50 border-border";

  return (
    <div className="space-y-2 pt-3 border-t border-border/50 mt-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Status WhatsApp Meta</p>
        {connected && (
          <Button variant="ghost" size="sm" onClick={fetchStatus} disabled={loading} className="h-6 px-2 text-[10px]">
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
            {loading ? "..." : "Atualizar"}
          </Button>
        )}
      </div>

      {!connected ? (
        <div className="rounded-lg border border-dashed border-yellow-500/40 bg-yellow-500/5 p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-yellow-500 shrink-0" />
            <p className="text-sm font-medium text-yellow-600">WhatsApp n&atilde;o conectado</p>
          </div>
          <p className="text-xs text-muted-foreground">Para ativar disparos e ver o tier Meta desta empresa:</p>
          <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-0.5">
            <li>Acesse o <strong>Meta Business Suite</strong> e copie o <strong>Phone Number ID</strong></li>
            <li>Gere um <strong>Token de Acesso Permanente</strong> no painel de desenvolvedores</li>
            <li>Cole o <strong>Business Account ID</strong> (WABA ID)</li>
            <li>Preencha os campos acima e clique em <strong>Testar Conex&atilde;o</strong></li>
          </ol>
          <div className="grid grid-cols-4 gap-2 pt-2">
            <div className="rounded border border-dashed border-border px-2 py-1.5 text-center opacity-40">
              <p className="text-sm font-bold">—</p>
              <p className="text-[9px] text-muted-foreground">Qualidade</p>
            </div>
            <div className="rounded border border-dashed border-border px-2 py-1.5 text-center opacity-40">
              <p className="text-sm font-bold">—</p>
              <p className="text-[9px] text-muted-foreground">Tier/dia</p>
            </div>
            <div className="rounded border border-dashed border-border px-2 py-1.5 text-center opacity-40">
              <p className="text-sm font-bold">—</p>
              <p className="text-[9px] text-muted-foreground">Uso 24h</p>
            </div>
            <div className="rounded border border-dashed border-border px-2 py-1.5 text-center opacity-40">
              <p className="text-sm font-bold">—</p>
              <p className="text-[9px] text-muted-foreground">Bloqueios</p>
            </div>
          </div>
        </div>
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : status ? (
        <>
          <div className="grid grid-cols-4 gap-2">
            <div className={`rounded border px-2 py-1.5 text-center ${qBg}`}>
              <p className={`text-sm font-bold ${qColor}`}>{status.quality}</p>
              <p className="text-[9px] text-muted-foreground">Qualidade</p>
            </div>
            <div className="rounded border border-primary/20 bg-primary/5 px-2 py-1.5 text-center">
              <p className="text-sm font-bold text-primary">{status.tier_limit > 0 ? status.tier_limit.toLocaleString("pt-BR") : "—"}</p>
              <p className="text-[9px] text-muted-foreground">{status.tier === "STANDARD" ? "Standard/dia" : (status.tier || "").replace("TIER_", "").replace("K", "K/dia")}</p>
            </div>
            <div className="rounded border px-2 py-1.5 text-center">
              <p className="text-sm font-bold">{status.usage_pct}%</p>
              <p className="text-[9px] text-muted-foreground">Uso 24h</p>
            </div>
            <div className="rounded border px-2 py-1.5 text-center">
              <p className="text-sm font-bold">{status.blocks_24h}</p>
              <p className="text-[9px] text-muted-foreground">Bloqueios</p>
            </div>
          </div>
          {status.verified_name && <p className="text-[10px] text-muted-foreground">Verified: {status.verified_name}</p>}
        </>
      ) : loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Consultando Meta API...</div>
      ) : null}
    </div>
  );
}

// ── WhatsApp Meta Section (CEO - visão geral) ────────────────────────────────

interface ConsultorTier {
  id: string;
  name: string;
  disparosHoje: number;
  limite: number;
}

function WhatsAppMetaSection({ companyId }: { companyId: string | null }) {
  const [tier, setTier] = useState(0);
  const [tierLabel, setTierLabel] = useState("—");
  const [quality, setQuality] = useState("UNKNOWN");
  const [usagePct, setUsagePct] = useState(0);
  const [conversations24h, setConversations24h] = useState(0);
  const [blocks24h, setBlocks24h] = useState(0);
  const [verifiedName, setVerifiedName] = useState("");
  const [consultores, setConsultores] = useState<ConsultorTier[]>([]);
  const [totalConsultoresAtivos, setTotalConsultoresAtivos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastCheck, setLastCheck] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    loadData();
  }, [companyId]);

  const fetchMetaTier = async () => {
    if (!companyId) return;
    try {
      const res = await fetch(`${EDGE_BASE}/quality-monitor`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ action: "check", company_id: companyId }),
      });
      if (res.ok) {
        const data = await res.json();
        const tierLimit = data.tier_limit || 0;
        setTier(tierLimit);
        setTierLabel(data.tier || "UNKNOWN");
        setQuality(data.quality || "UNKNOWN");
        setUsagePct(data.usage_pct || 0);
        setConversations24h(data.conversations_24h || 0);
        setBlocks24h(data.blocks_24h || 0);
        setVerifiedName(data.verified_name || "");
        setLastCheck(new Date().toLocaleTimeString("pt-BR"));

        // Sincronizar tier no system_configs para que Disparos use o valor real
        await supabase.from("system_configs").upsert(
          { key: "meta_tier_limit", value: String(tierLimit), company_id: companyId },
          { onConflict: "key,company_id" }
        );
        return tierLimit;
      }
    } catch { /* silencioso */ }

    // Fallback: buscar do último check salvo
    const { data: latest } = await supabase
      .from("meta_quality_tracking")
      .select("quality_rating, messaging_limit_tier, tier_limit, usage_pct, conversations_24h, blocks_24h, checked_at")
      .eq("company_id", companyId)
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest) {
      setTier(latest.tier_limit || 0);
      setTierLabel(latest.messaging_limit_tier || "UNKNOWN");
      setQuality(latest.quality_rating || "UNKNOWN");
      setUsagePct(latest.usage_pct || 0);
      setConversations24h(latest.conversations_24h || 0);
      setBlocks24h(latest.blocks_24h || 0);
      setLastCheck(latest.checked_at ? new Date(latest.checked_at).toLocaleTimeString("pt-BR") : null);
      return latest.tier_limit || 0;
    }

    // Último fallback: system_configs
    const { data: cfgData } = await supabase
      .from("system_configs")
      .select("value")
      .eq("key", "meta_tier_limit")
      .eq("company_id", companyId)
      .maybeSingle();
    const tierVal = cfgData?.value ? Number(cfgData.value) : 1000;
    setTier(tierVal);
    setTierLabel(tierVal >= 100000 ? "TIER_100K" : tierVal >= 10000 ? "TIER_10K" : "TIER_1K");
    return tierVal;
  };

  const loadData = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const tierVal = await fetchMetaTier() || 1000;

      // Consultores ativos
      const { data: eligibleRoles } = await supabase
        .from("roles")
        .select("id, name, level")
        .eq("company_id", companyId)
        .in("level", [2, 3]);

      const eligibleRoleIds = (eligibleRoles || [])
        .filter(r => {
          const name = r.name.toLowerCase();
          return (name.includes("consultor") && name.includes("comercial")) ||
                 (name.includes("gestor") && name.includes("comercial"));
        })
        .map(r => r.id);

      if (eligibleRoleIds.length === 0) {
        setTotalConsultoresAtivos(0);
        setConsultores([]);
        setLoading(false);
        return;
      }

      const [{ count: totalCount }, { data: collabs }] = await Promise.all([
        supabase
          .from("collaborators")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("active", true)
          .in("role_id", eligibleRoleIds),
        supabase
          .from("collaborators")
          .select("id, name")
          .eq("company_id", companyId)
          .eq("active", true)
          .in("role_id", eligibleRoleIds)
          .order("name")
          .limit(100),
      ]);

      const totalAtivos = totalCount ?? collabs?.length ?? 0;
      setTotalConsultoresAtivos(totalAtivos);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const items: ConsultorTier[] = [];
      const perConsultor = totalAtivos > 0 ? Math.floor(tierVal / totalAtivos) : 0;

      for (const c of collabs || []) {
        const { count } = await supabase
          .from("smart_dispatches")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("collaborator_id", c.id)
          .gte("created_at", today.toISOString());
        items.push({ id: c.id, name: c.name, disparosHoje: count ?? 0, limite: perConsultor });
      }
      setConsultores(items);
    } catch { /* silencioso */ }
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMetaTier();
    toast.success("TIER atualizado da Meta API");
    await loadData();
    setRefreshing(false);
  };

  const qualityColor = quality === "GREEN" ? "text-green-500" : quality === "YELLOW" ? "text-yellow-500" : quality === "RED" ? "text-red-500" : "text-muted-foreground";
  const qualityBg = quality === "GREEN" ? "bg-green-500/10 border-green-500/30" : quality === "YELLOW" ? "bg-yellow-500/10 border-yellow-500/30" : quality === "RED" ? "bg-red-500/10 border-red-500/30" : "bg-muted/50 border-border";
  const perConsultor = totalConsultoresAtivos > 0 ? Math.floor(tier / totalConsultoresAtivos) : 0;

  return (
    <Card className="shadow-sm bg-card/80 backdrop-blur-sm border-primary/20">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          WhatsApp Meta — TIER & Qualidade
          <Badge variant="outline" className="ml-auto text-xs">CEO</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">Dados em tempo real da API Meta — atualiza automaticamente</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Status Meta */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className={`rounded-lg border px-3 py-2 text-center ${qualityBg}`}>
            <p className={`text-lg font-bold ${qualityColor}`}>{quality}</p>
            <p className="text-[10px] text-muted-foreground">Qualidade</p>
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-center">
            <p className="text-lg font-bold text-primary">{tier > 0 ? tier.toLocaleString("pt-BR") : "—"}</p>
            <p className="text-[10px] text-muted-foreground">{tierLabel === "STANDARD" ? "Standard (1K/dia)" : tierLabel.replace("TIER_", "TIER ").replace("K", "K/dia")}</p>
          </div>
          <div className="rounded-lg border border-border px-3 py-2 text-center">
            <p className="text-lg font-bold">{usagePct}%</p>
            <p className="text-[10px] text-muted-foreground">Uso 24h ({conversations24h.toLocaleString("pt-BR")})</p>
          </div>
          <div className="rounded-lg border border-border px-3 py-2 text-center">
            <p className="text-lg font-bold">{blocks24h}</p>
            <p className="text-[10px] text-muted-foreground">Bloqueios 24h</p>
          </div>
        </div>

        {/* Refresh + info */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {verifiedName && <span className="font-medium">{verifiedName}</span>}
            {lastCheck && <span className="ml-2">Atualizado: {lastCheck}</span>}
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Atualizando..." : "Atualizar da Meta"}
          </Button>
        </div>

        {/* Distribuição por consultor */}
        {totalConsultoresAtivos > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-2 flex items-center gap-4">
            <div>
              <p className="text-2xl font-bold text-primary">{perConsultor.toLocaleString("pt-BR")}</p>
              <p className="text-xs text-muted-foreground">disparos / consultor / dia</p>
            </div>
            <p className="text-[10px] text-muted-foreground">{tier.toLocaleString("pt-BR")} ÷ {totalConsultoresAtivos} consultores ativos</p>
          </div>
        )}

        {/* Tabela de consultores */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-8 bg-muted animate-pulse rounded" />)}
          </div>
        ) : consultores.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum consultor comercial ativo encontrado</p>
        ) : (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Uso hoje por consultor</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground text-xs">
                    <th className="text-left py-2 pr-4 font-medium">Consultor</th>
                    <th className="text-right py-2 px-2 font-medium">Limite</th>
                    <th className="text-right py-2 px-2 font-medium">Usados</th>
                    <th className="text-right py-2 pl-2 font-medium">Disponíveis</th>
                  </tr>
                </thead>
                <tbody>
                  {consultores.map(c => {
                    const disponivel = Math.max(0, c.limite - c.disparosHoje);
                    const usoPct = c.limite > 0 ? Math.round((c.disparosHoje / c.limite) * 100) : 0;
                    return (
                      <tr key={c.id} className="border-b border-border/30 hover:bg-muted/20">
                        <td className="py-2 pr-4 font-medium truncate max-w-[140px]">{c.name}</td>
                        <td className="text-right py-2 px-2 text-muted-foreground">{c.limite.toLocaleString("pt-BR")}</td>
                        <td className="text-right py-2 px-2">
                          <span className={usoPct >= 90 ? "text-red-400 font-semibold" : usoPct >= 70 ? "text-yellow-400" : "text-foreground"}>
                            {c.disparosHoje.toLocaleString("pt-BR")}
                          </span>
                        </td>
                        <td className="text-right py-2 pl-2 text-emerald-400 font-semibold">{disponivel.toLocaleString("pt-BR")}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border/50 text-xs text-muted-foreground font-medium">
                    <td className="py-2 pr-4">Total</td>
                    <td className="text-right py-2 px-2">{tier.toLocaleString("pt-BR")}</td>
                    <td className="text-right py-2 px-2">
                      {consultores.reduce((a, c) => a + c.disparosHoje, 0).toLocaleString("pt-BR")}
                    </td>
                    <td className="text-right py-2 pl-2 text-emerald-400">
                      {Math.max(0, tier - consultores.reduce((a, c) => a + c.disparosHoje, 0)).toLocaleString("pt-BR")}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
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

  const { isCEO } = useCollaborator();

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
      // Save full JSON blob
      const { error } = await supabase.from("system_configs").upsert(
        { key: `company_config_${cid}`, value: JSON.stringify(cfg), company_id: cid },
        { onConflict: "key,company_id" }
      );
      if (error) throw error;
      // Also save flat keys for edge functions
      await supabase.from("system_configs").upsert([
        { key: `distribution_batch_size_${cid}`, value: String(cfg.distribution.batchSize), company_id: cid },
        { key: `distribution_threshold_${cid}`, value: String(cfg.distribution.threshold), company_id: cid },
      ], { onConflict: "key,company_id" });

      // Sincronizar credenciais WhatsApp Meta para quality-monitor
      if (cfg.whatsapp.phoneNumberId && cfg.whatsapp.token) {
        await supabase.from("whatsapp_meta_credentials").upsert({
          company_id: cid,
          meta_phone_number_id: cfg.whatsapp.phoneNumberId,
          meta_access_token: cfg.whatsapp.token,
          meta_waba_id: cfg.whatsapp.businessAccountId || null,
          meta_display_phone: cfg.whatsapp.numero || null,
          is_active: true,
        }, { onConflict: "company_id" });
      }

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
      let query = supabase.from("system_configs").select("key, value").in("key", keys);
      if (companyId) query = query.eq("company_id", companyId);
      const { data, error } = await query;
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
        { onConflict: "key,company_id" }
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
      const upserts = (Object.keys(config) as (keyof Config)[]).map((k) => ({ key: DB_KEYS[k], value: String(config[k]), company_id: companyId }));
      const { error } = await supabase.from("system_configs").upsert(upserts, { onConflict: "key,company_id" });
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
      if (error) throw error;
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

        {/* ── WhatsApp Meta — Distribuição por Consultor (CEO only) ── */}
        {isCEO && <WhatsAppMetaSection companyId={companyId} />}

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
                                <Label className="text-xs">TIER Meta (automático)</Label>
                                <div className="h-8 flex items-center px-3 rounded-md border border-input bg-muted/50 text-sm text-muted-foreground">
                                  {cfg.whatsapp.tier >= 100000 ? "TIER 3 — 100K/dia" : cfg.whatsapp.tier >= 10000 ? "TIER 2 — 10K/dia" : cfg.whatsapp.tier >= 1000 ? "TIER 1 — 1K/dia" : "Não detectado"}
                                </div>
                                <p className="text-[10px] text-muted-foreground">Obtido automaticamente da API Meta</p>
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
                            <CompanyMetaStatus companyId={company.id} phoneNumberId={cfg.whatsapp.phoneNumberId} token={cfg.whatsapp.token} />
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
                              <div className="col-span-2 space-y-1">
                                <Label className="text-xs">TIER Meta diário</Label>
                                <p className="text-xs text-muted-foreground">Limite diário de disparos da Meta para esta empresa</p>
                                <Input
                                  className="h-8 text-sm"
                                  type="number"
                                  min={0}
                                  placeholder="250"
                                  value={cfg.distribution.metaTierDaily ?? 250}
                                  onChange={e => updateCompanyConfig(company.id, "distribution", "metaTierDaily", parseInt(e.target.value) || 250)}
                                />
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
