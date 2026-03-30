import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { supabase } from "@/lib/supabase";
import { EDGE_BASE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Send,
  Bot,
  Hand,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  Phone,
  Loader2,
  Info,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Types ──────────────────────────────────────────────────────────────────

interface EligibleLead {
  id: string;
  lead_id: string | null;
  collaborator_id: string;
  phone_number: string;
  lead_name: string | null;
  status: string;
  dispatched: boolean;
  total_call_attempts: number;
  call_summary: string | null;
}

interface DispatchHistory {
  id: string;
  phone_number: string;
  lead_name: string | null;
  template_name: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  wa_status: string | null;
  replied: boolean;
  converted: boolean;
}

interface WaTemplate {
  id: string;
  name: string;
  status: string;
  language: string;
}

interface DispatchLimit {
  meta_tier_limit: number;
  active_consultants: number;
  limit_per_consultant: number;
  dispatches_used_today: number;
  dispatches_available: number;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function Disparos() {
  const { collaborator, roleLevel, isCEO } = useCollaborator();
  const { selectedCompanyId } = useCompanyFilter();

  const companyId =
    selectedCompanyId && selectedCompanyId !== "all"
      ? selectedCompanyId
      : collaborator?.company_id || "";

  const [activeTab, setActiveTab] = useState("disparar");

  // ── Disparar tab state ──
  const [eligibleLeads, setEligibleLeads] = useState<EligibleLead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  // ── Histórico tab state ──
  const [history, setHistory] = useState<DispatchHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<string>("all");

  // ── Limite tab state ──
  const [limitInfo, setLimitInfo] = useState<DispatchLimit | null>(null);
  const [loadingLimit, setLoadingLimit] = useState(false);

  // ── Load eligible leads ──
  const loadEligibleLeads = useCallback(async () => {
    if (!collaborator?.id) return;
    setLoadingLeads(true);
    try {
      // Query consultant_lead_pool: status = interested, dispatched = false, total_call_attempts > 0
      const { data, error } = await supabase
        .from("consultant_lead_pool")
        .select(
          "id, lead_id, collaborator_id, phone_number, lead_name, status, dispatched, total_call_attempts, call_summary"
        )
        .eq("collaborator_id", collaborator.id)
        .eq("status", "interested")
        .eq("dispatched", false)
        .gt("total_call_attempts", 0)
        .order("updated_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Erro ao buscar leads elegíveis:", error);
        // Se tabela não tiver coluna total_call_attempts, fallback sem esse filtro
        if (error.message?.includes("total_call_attempts")) {
          const { data: fallback } = await supabase
            .from("consultant_lead_pool")
            .select(
              "id, lead_id, collaborator_id, phone_number, lead_name, status, dispatched, total_call_attempts, call_summary"
            )
            .eq("collaborator_id", collaborator.id)
            .eq("status", "interested")
            .eq("dispatched", false)
            .order("updated_at", { ascending: false })
            .limit(50);
          setEligibleLeads((fallback || []) as EligibleLead[]);
        }
      } else {
        setEligibleLeads((data || []) as EligibleLead[]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLeads(false);
    }
  }, [collaborator?.id]);

  // ── Load templates ──
  const loadTemplates = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("wa_templates")
      .select("id, name, status, language")
      .eq("company_id", companyId)
      .eq("status", "approved")
      .order("name");

    if (data && data.length > 0) {
      setTemplates(data as WaTemplate[]);
    } else {
      // Fallback: whatsapp_meta_templates
      const { data: fallback } = await supabase
        .from("whatsapp_meta_templates")
        .select("id, name, status, language")
        .eq("company_id", companyId)
        .eq("status", "APPROVED")
        .order("name");
      setTemplates((fallback || []) as WaTemplate[]);
    }
  }, [companyId]);

  // ── Load dispatch history ──
  const loadHistory = useCallback(async () => {
    if (!collaborator?.id) return;
    setLoadingHistory(true);
    try {
      let query = supabase
        .from("smart_dispatches")
        .select(
          "id, phone_number, lead_name, template_name, status, created_at, sent_at"
        )
        .eq("collaborator_id", collaborator.id)
        .order("created_at", { ascending: false })
        .limit(100);

      const { data } = await query;
      setHistory((data || []) as DispatchHistory[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  }, [collaborator?.id]);

  // ── Load limit info ──
  const loadLimitInfo = useCallback(async () => {
    if (!companyId || !collaborator?.id) return;
    setLoadingLimit(true);
    try {
      // Buscar tier limit de system_configs
      const { data: configs } = await supabase
        .from("system_configs")
        .select("key, value")
        .in("key", ["meta_tier_limit"]);

      const configMap: Record<string, string> = {};
      for (const c of configs || []) configMap[c.key] = c.value;

      const metaTierLimit = parseInt(configMap["meta_tier_limit"] || "250", 10);

      // Contar consultores ativos da empresa
      const { count: activeCount } = await supabase
        .from("collaborators")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("active", true);

      const activeConsultants = Math.max(activeCount || 1, 1);
      const limitPerConsultant = Math.floor(metaTierLimit / activeConsultants);

      // Contar disparos hoje
      const today = new Date().toISOString().split("T")[0];
      const { count: dispatchedToday } = await supabase
        .from("smart_dispatches")
        .select("id", { count: "exact", head: true })
        .eq("collaborator_id", collaborator.id)
        .eq("status", "sent")
        .gte("sent_at", `${today}T00:00:00`);

      const usedToday = dispatchedToday || 0;

      setLimitInfo({
        meta_tier_limit: metaTierLimit,
        active_consultants: activeConsultants,
        limit_per_consultant: limitPerConsultant,
        dispatches_used_today: usedToday,
        dispatches_available: Math.max(0, limitPerConsultant - usedToday),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLimit(false);
    }
  }, [companyId, collaborator?.id]);

  useEffect(() => {
    if (activeTab === "disparar") {
      loadEligibleLeads();
      loadTemplates();
      loadLimitInfo();
    } else if (activeTab === "historico") {
      loadHistory();
    } else if (activeTab === "limite") {
      loadLimitInfo();
    }
  }, [activeTab, loadEligibleLeads, loadTemplates, loadHistory, loadLimitInfo]);

  // ── Get headers for edge function calls ──
  const getHeaders = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
      apikey:
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        import.meta.env.VITE_SUPABASE_ANON_KEY ||
        "",
    };
  };

  // ── Dispatch action ──
  const handleDispatch = async (
    lead: EligibleLead,
    mode: "lucas" | "manual"
  ) => {
    if (!selectedTemplate) {
      toast.error("Selecione um template antes de disparar");
      return;
    }
    if (!collaborator?.id) return;

    // Check limit
    if (limitInfo && limitInfo.dispatches_available <= 0) {
      toast.error("Limite diário atingido. Disponível amanhã.");
      return;
    }

    setDispatchingId(lead.id);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${EDGE_BASE}/smart-dispatcher`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "send",
          company_id: companyId,
          collaborator_id: collaborator.id,
          phone_number: lead.phone_number,
          template_name: selectedTemplate,
          dispatch_reason: mode === "lucas" ? "lucas_ia" : "manual",
          use_lucas: mode === "lucas",
        }),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        toast.success(
          mode === "lucas"
            ? "🤖 Lucas assumiu a conversa!"
            : "✅ Template enviado com sucesso!"
        );

        // Mark as dispatched in consultant_lead_pool
        await supabase
          .from("consultant_lead_pool")
          .update({ dispatched: true, dispatched_at: new Date().toISOString() })
          .eq("id", lead.id);

        // Remove from local list
        setEligibleLeads((prev) => prev.filter((l) => l.id !== lead.id));

        // Update limit
        if (limitInfo) {
          setLimitInfo({
            ...limitInfo,
            dispatches_used_today: limitInfo.dispatches_used_today + 1,
            dispatches_available: Math.max(
              0,
              limitInfo.dispatches_available - 1
            ),
          });
        }
      } else {
        const errMsg = result.error || "Erro ao disparar";
        if (res.status === 429) {
          toast.error("Limite diário atingido. Disponível amanhã.");
        } else {
          toast.error(errMsg);
        }
      }
    } catch (e) {
      toast.error("Erro de conexão");
    } finally {
      setDispatchingId(null);
    }
  };

  // ── Filter history ──
  const filteredHistory = history.filter((h) => {
    if (historyFilter === "all") return true;
    if (historyFilter === "replied") return h.replied;
    if (historyFilter === "not_replied") return !h.replied;
    if (historyFilter === "converted") return h.converted;
    return true;
  });

  // ── Renders ──────────────────────────────────────────────────────────────

  const renderDispararsTab = () => (
    <div className="space-y-4">
      {/* Limit summary */}
      {limitInfo && (
        <div className="rounded-xl border border-border/60 bg-card p-4 flex items-center gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              {limitInfo.dispatches_available} de {limitInfo.limit_per_consultant} disparos disponíveis hoje
            </p>
            <Progress
              value={
                limitInfo.limit_per_consultant > 0
                  ? (limitInfo.dispatches_used_today /
                      limitInfo.limit_per_consultant) *
                    100
                  : 0
              }
              className="mt-2 h-2"
            />
          </div>
          <Badge
            variant={
              limitInfo.dispatches_available > 0 ? "secondary" : "destructive"
            }
          >
            {limitInfo.dispatches_available > 0 ? "Disponível" : "Esgotado"}
          </Badge>
        </div>
      )}

      {/* Template selector */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger>
              <SelectValue placeholder="Selecionar template aprovado..." />
            </SelectTrigger>
            <SelectContent>
              {templates.length === 0 ? (
                <SelectItem value="__none" disabled>
                  Nenhum template aprovado
                </SelectItem>
              ) : (
                templates.map((t) => (
                  <SelectItem key={t.id} value={t.name}>
                    {t.name}{" "}
                    <span className="text-muted-foreground text-xs">
                      ({t.language})
                    </span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Leads list */}
      {loadingLeads ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : eligibleLeads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center">
          <Send className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground font-medium">
            Nenhum lead elegível para disparo
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Leads aparecem aqui após ligação + interesse confirmado
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {eligibleLeads.map((lead) => (
            <div
              key={lead.id}
              className="rounded-xl border border-border/60 bg-card p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">
                    {lead.lead_name || "Lead"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {lead.phone_number}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="text-[10px]">
                    <Phone className="h-2.5 w-2.5 mr-1" />
                    {lead.total_call_attempts || 0} lig.
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] border-emerald-500/50 text-emerald-600"
                  >
                    Interessado
                  </Badge>
                </div>
              </div>

              {lead.call_summary && (
                <div className="rounded-lg bg-muted/40 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">
                    Resumo: {lead.call_summary}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 gap-1.5 text-xs"
                  disabled={
                    dispatchingId === lead.id ||
                    !selectedTemplate ||
                    (limitInfo?.dispatches_available ?? 1) <= 0
                  }
                  onClick={() => handleDispatch(lead, "lucas")}
                >
                  {dispatchingId === lead.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Bot className="h-3 w-3" />
                  )}
                  Disparar com Lucas
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1.5 text-xs"
                  disabled={
                    dispatchingId === lead.id ||
                    !selectedTemplate ||
                    (limitInfo?.dispatches_available ?? 1) <= 0
                  }
                  onClick={() => handleDispatch(lead, "manual")}
                >
                  <Hand className="h-3 w-3" />
                  Disparar manualmente
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderHistoricoTab = () => (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2">
        {(
          [
            { value: "all", label: "Todos" },
            { value: "replied", label: "Respondeu" },
            { value: "not_replied", label: "Não respondeu" },
            { value: "converted", label: "Convertido" },
          ] as const
        ).map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={historyFilter === f.value ? "default" : "outline"}
            className="text-xs h-7 px-2.5"
            onClick={() => setHistoryFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {loadingHistory ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center">
          <Clock className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Nenhum disparo encontrado
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredHistory.map((d) => (
            <div
              key={d.id}
              className="rounded-xl border border-border/50 bg-card px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {d.lead_name || d.phone_number}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {d.template_name} •{" "}
                  {format(new Date(d.created_at), "dd/MM HH:mm", {
                    locale: ptBR,
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {d.converted ? (
                  <Badge
                    variant="secondary"
                    className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                  >
                    <TrendingUp className="h-2.5 w-2.5 mr-1" />
                    Convertido
                  </Badge>
                ) : d.replied ? (
                  <Badge
                    variant="secondary"
                    className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30"
                  >
                    <CheckCircle className="h-2.5 w-2.5 mr-1" />
                    Respondeu
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    <XCircle className="h-2.5 w-2.5 mr-1 text-muted-foreground" />
                    Sem resposta
                  </Badge>
                )}
                <DispatchStatusBadge status={d.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderLimiteTab = () => (
    <div className="space-y-4">
      {loadingLimit ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : limitInfo ? (
        <>
          {/* Tier info */}
          <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  TIER Meta Atual
                </p>
                <p className="text-2xl font-bold mt-0.5">
                  {limitInfo.meta_tier_limit.toLocaleString("pt-BR")}
                </p>
                <p className="text-xs text-muted-foreground">
                  disparos/dia no total
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Consultores Ativos
                </p>
                <p className="text-2xl font-bold mt-0.5">
                  {limitInfo.active_consultants}
                </p>
              </div>
            </div>

            <div className="h-px bg-border/50" />

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Seu limite diário</p>
                <p className="text-sm font-bold">
                  {limitInfo.limit_per_consultant} disparos/dia
                </p>
              </div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">Usados hoje</p>
                <p className="text-xs font-medium">
                  {limitInfo.dispatches_used_today}
                </p>
              </div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">Disponíveis</p>
                <p className="text-xs font-semibold text-emerald-600">
                  {limitInfo.dispatches_available}
                </p>
              </div>
              <Progress
                value={
                  limitInfo.limit_per_consultant > 0
                    ? (limitInfo.dispatches_used_today /
                        limitInfo.limit_per_consultant) *
                      100
                    : 0
                }
                className="h-3"
              />
              <div className="flex justify-between mt-1">
                <p className="text-[10px] text-muted-foreground">0</p>
                <p className="text-[10px] text-muted-foreground">
                  {limitInfo.limit_per_consultant}
                </p>
              </div>
            </div>
          </div>

          {/* Info card */}
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex gap-3">
            <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Como funciona o limite?
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Seu limite é calculado automaticamente: TIER Meta ÷ consultores
                ativos. Quando o TIER aumentar, seu limite aumenta
                automaticamente. O limite reseta toda meia-noite.
              </p>
              <p className="text-xs text-muted-foreground">
                Fórmula:{" "}
                <span className="font-mono text-foreground">
                  {limitInfo.meta_tier_limit} ÷ {limitInfo.active_consultants} ={" "}
                  {limitInfo.limit_per_consultant}/dia
                </span>
              </p>
            </div>
          </div>

          {limitInfo.dispatches_available === 0 && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 flex gap-3">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Limite atingido
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Você atingiu seu limite de disparos para hoje. Os disparos
                  serão liberados novamente amanhã à meia-noite.
                </p>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar informações de limite
          </p>
        </div>
      )}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Send className="h-6 w-6 text-primary" />
            Disparos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Dispare WhatsApp para leads com interesse confirmado pós-ligação
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="disparar">Disparar</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="limite">Limite</TabsTrigger>
          </TabsList>

          <TabsContent value="disparar" className="mt-4">
            {renderDispararsTab()}
          </TabsContent>

          <TabsContent value="historico" className="mt-4">
            {renderHistoricoTab()}
          </TabsContent>

          <TabsContent value="limite" className="mt-4">
            {renderLimiteTab()}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ── Small helper component ─────────────────────────────────────────────────

function DispatchStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; class: string }> = {
    sent: { label: "Enviado", class: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
    failed: { label: "Falhou", class: "bg-destructive/10 text-destructive border-destructive/30" },
    queued: { label: "Aguardando", class: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
    delivered: { label: "Entregue", class: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  };
  const s = map[status] || { label: status, class: "" };
  return (
    <Badge variant="outline" className={`text-[10px] ${s.class}`}>
      {s.label}
    </Badge>
  );
}
