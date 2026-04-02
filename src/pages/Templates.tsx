import { useState, useEffect, useCallback } from "react";
import { resolveCompanyFilter, resolveCompanyRequired } from "@/lib/companyFilter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { EDGE_BASE } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Loader2, CheckCircle, Clock, XCircle, Search, Sparkles,
  AlertTriangle, Users, Send, History, Pencil, ChevronDown, ChevronUp, Info, Trash2,
} from "lucide-react";

interface Template {
  name: string;
  category: string;
  language: string;
  status: string;
  body: string;
  header?: string;
  footer?: string;
  buttons?: string[];
  quality?: string;
  score?: number;
  response_rate?: number;
  read_rate?: number;
  total_sent?: number;
  rejection_reason?: string;
  rejection_suggestion?: string;
  components?: any[];
}

interface GeneratedTemplate {
  name: string;
  category?: string;
  body: string;
  header?: string;
  footer?: string;
  buttons?: { type: string; text: string; url?: string; phone_number?: string }[];
  strategy_notes?: string;
  confidence_score?: number;
  issues?: { type: string; message: string }[];
}

interface Rejection {
  name: string;
  reason: string;
  date: string;
  analysis: string;
}

interface SellerOption {
  id: string;
  name: string;
  role: string;
}

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  APPROVED: { icon: CheckCircle, color: "text-green-400", label: "Aprovado" },
  PENDING: { icon: Clock, color: "text-yellow-400", label: "Pendente" },
  REJECTED: { icon: XCircle, color: "text-red-400", label: "Rejeitado" },
  draft: { icon: Pencil, color: "text-gray-400", label: "Rascunho" },
};

const qualityBadge = (q?: string) => {
  if (q === "GREEN") return <Badge variant="outline" className="text-green-400 text-xs">GREEN</Badge>;
  if (q === "YELLOW") return <Badge variant="outline" className="text-yellow-400 text-xs">YELLOW</Badge>;
  if (q === "RED") return <Badge variant="outline" className="text-red-400 text-xs">RED</Badge>;
  return null;
};

const scoreColor = (s: number) => s >= 85 ? "text-green-400" : s >= 70 ? "text-yellow-400" : "text-red-400";
const scoreBadge = (s: number) => {
  if (s >= 85) return { label: "SUBMETER", color: "bg-green-500/10 text-green-400 border-green-500/30" };
  if (s >= 70) return { label: "REVISAR", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" };
  return { label: "REESCREVER", color: "bg-red-500/10 text-red-400 border-red-500/30" };
};

const FORBIDDEN_WORDS = ["oferta", "desconto", "promoção", "promoção", "compre", "comprar", "preço especial", "condição especial", "você se interessou", "demonstrou interesse"];

const approvalBadge = (category: string, body: string) => {
  const cat = (category || "").toUpperCase();
  const bodyLower = (body || "").toLowerCase();
  const hasForbidden = FORBIDDEN_WORDS.some(w => bodyLower.includes(w));

  if (cat === "MARKETING" || hasForbidden) {
    return { emoji: "🔴", label: "Pode ser rejeitado", color: "bg-red-500/10 text-red-400 border-red-500/30" };
  }
  if (cat === "UTILITY" && !hasForbidden) {
    // Check for questionable patterns even in UTILITY
    const questionable = ["proposta", "simulação", "cotação", "interesse", "pensando"];
    const hasQuestionable = questionable.some(w => bodyLower.includes(w));
    if (hasQuestionable) {
      return { emoji: "🟡", label: "Chance moderada", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" };
    }
    return { emoji: "🟢", label: "Alta chance de aprovação", color: "bg-green-500/10 text-green-400 border-green-500/30" };
  }
  return { emoji: "🟡", label: "Chance moderada", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" };
};

interface VarMapping {
  variable_index: number;
  label: string;
  source: string;
  source_field: string;
  default_value: string;
}

const SOURCE_OPTIONS = [
  { value: "leads_master.lead_name", label: "Nome do lead" },
  { value: "leads_master.phone_number", label: "Telefone do lead" },
  { value: "leads_master.email", label: "Email do lead" },
  { value: "company_config.persona_company", label: "Nome da empresa" },
  { value: "company_config.persona_name", label: "Nome do vendedor" },
  { value: "company_config.product_data.base_price", label: "Preço base" },
  { value: "custom", label: "Valor fixo (custom)" },
];

export default function Templates() {
  const { collaborator, isCEO } = useCollaborator();
  const { selectedCompanyId } = useCompanyFilter();
  // null = show all companies; string = filter by company
  const companyFilter = resolveCompanyFilter(selectedCompanyId, collaborator?.company_id);
  // For inserts that require a company_id
  const effectiveCompanyId = resolveCompanyRequired(selectedCompanyId, collaborator?.company_id);
  // Helper: apply company filter to query (skip filter when null = all companies)
  const withCompanyFilter = (query: any) => companyFilter ? query.eq("company_id", companyFilter) : query;
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("approved");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Create tab state
  const [objective, setObjective] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedTemplate[]>([]);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);

  // Assignment modal
  const [assignTemplate, setAssignTemplate] = useState<Template | null>(null);
  const [sellers, setSellers] = useState<SellerOption[]>([]);
  const [selectedSellers, setSelectedSellers] = useState<string[]>([]);
  const [savingAssign, setSavingAssign] = useState(false);

  // Drafts
  const [drafts, setDrafts] = useState<GeneratedTemplate[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);

  // Resubmit
  const [resubmitting, setResubmitting] = useState<string | null>(null);

  // Submit draft
  const [submittingDraft, setSubmittingDraft] = useState<string | null>(null);

  // Meta rules accordion
  const [metaRulesOpen, setMetaRulesOpen] = useState(false);

  // Rejection history
  const [rejections, setRejections] = useState<Rejection[]>([]);
  const [rejectionsLoading, setRejectionsLoading] = useState(false);

  // Variable mappings
  const [varMappings, setVarMappings] = useState<VarMapping[]>([
    { variable_index: 1, label: "Nome do lead", source: "leads_master", source_field: "lead_name", default_value: "" },
    { variable_index: 2, label: "Produto / Serviço", source: "custom", source_field: "", default_value: "" },
    { variable_index: 3, label: "Data / Prazo", source: "custom", source_field: "", default_value: "" },
    { variable_index: 4, label: "Valor / Preço", source: "custom", source_field: "", default_value: "" },
    { variable_index: 5, label: "Nome do vendedor", source: "company_config", source_field: "persona_name", default_value: "" },
    { variable_index: 6, label: "Nome da empresa", source: "company_config", source_field: "persona_company", default_value: "" },
  ]);
  const [varMappingsLoading, setVarMappingsLoading] = useState(true);
  const [varMappingsSaving, setVarMappingsSaving] = useState(false);

  // Load variable mappings
  useEffect(() => {
    if (!effectiveCompanyId) { setVarMappingsLoading(false); return; }
    (async () => {
      try {
        setVarMappingsLoading(true);
        const { data, error } = await withCompanyFilter(supabase
          .from("template_variable_mappings")
          .select("variable_index, label, source, source_field, default_value"))
          .order("variable_index");
        if (!error && data && data.length > 0) {
          setVarMappings(prev => prev.map(v => {
            const found = data.find((d: any) => d.variable_index === v.variable_index);
            return found ? { ...v, ...found } : v;
          }));
        }
      } catch {
        // silencioso — usa defaults
      }
      setVarMappingsLoading(false);
    })();
  }, [effectiveCompanyId]);

  const saveVarMappings = async () => {
    if (!effectiveCompanyId) return;
    setVarMappingsSaving(true);
    const rows = varMappings.map(v => ({
      company_id: effectiveCompanyId,
      variable_index: v.variable_index,
      label: v.label,
      source: v.source,
      source_field: v.source_field,
      default_value: v.default_value,
      updated_at: new Date().toISOString(),
    }));
    // Delete + insert (evita problema de constraint)
    await supabase
      .from("template_variable_mappings")
      .delete()
      .eq("company_id", effectiveCompanyId);
    const { error } = await supabase
      .from("template_variable_mappings")
      .insert(rows);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Mapeamento de variáveis salvo");
    }
    setVarMappingsSaving(false);
  };

  const updateVarMapping = (idx: number, field: keyof VarMapping, value: string) => {
    setVarMappings(prev => prev.map((v, i) => {
      if (i !== idx) return v;
      const updated = { ...v, [field]: value };
      // Auto-fill label and source_field when selecting a source option
      if (field === "source_field") {
        const opt = SOURCE_OPTIONS.find(o => o.value === value);
        if (opt) {
          updated.label = opt.label;
          const parts = value.split(".");
          updated.source = parts[0];
          updated.source_field = parts.slice(1).join(".");
        }
      }
      return updated;
    }));
  };
  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    };
  }, []);

  const fetchTemplates = useCallback(async () => {
    if (!collaborator) return;
    setLoading(true);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${EDGE_BASE}/whatsapp-meta-templates`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "list", company_id: effectiveCompanyId }),
      });
      const data = await res.json();
      if (res.ok) {
        const mapped = (data.templates || []).map((t: any) => {
          const bodyComp = (t.components || []).find((c: any) => c.type === "BODY");
          const headerComp = (t.components || []).find((c: any) => c.type === "HEADER");
          const footerComp = (t.components || []).find((c: any) => c.type === "FOOTER");
          const buttonsComp = (t.components || []).find((c: any) => c.type === "BUTTONS");
          return {
            name: t.name,
            category: t.category,
            language: t.language,
            status: t.status,
            body: bodyComp?.text || "",
            header: headerComp?.text,
            footer: footerComp?.text,
            buttons: buttonsComp?.buttons?.map((b: any) => b.text) || [],
            quality: t.quality_score,
            rejection_reason: t.rejection_reason,
          } as Template;
        });
        setTemplates(mapped);
      }
    } catch {
      toast.error("Erro ao buscar templates");
    }
    setLoading(false);
  }, [collaborator, getHeaders]);

  const fetchRejections = useCallback(async () => {
    if (!collaborator) return;
    setRejectionsLoading(true);
    try {
      // Fetch rejected templates from same endpoint
      const headers = await getHeaders();
      const res = await fetch(`${EDGE_BASE}/whatsapp-meta-templates`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "list", company_id: effectiveCompanyId }),
      });
      const data = await res.json();
      if (res.ok) {
        const rejected = (data.templates || [])
          .filter((t: any) => t.status === "REJECTED")
          .map((t: any) => ({
            name: t.name,
            reason: t.rejection_reason || "Não especificado",
            date: t.updated_at ? new Date(t.updated_at).toLocaleDateString("pt-BR") : "—",
            analysis: "",
          }));
        setRejections(rejected);
      }
    } catch {}
    setRejectionsLoading(false);
  }, [collaborator, getHeaders]);

  const fetchDrafts = useCallback(async () => {
    if (!collaborator) return;
    setDraftsLoading(true);
    try {
      const { data } = await withCompanyFilter(supabase
        .from("wa_templates")
        .select("name, category, language, body, header, footer, buttons, strategy_notes, confidence_score, status"))
        .eq("status", "draft")
        .order("created_at", { ascending: false });
      setDrafts((data || []).map((d: any) => ({
        name: d.name,
        category: d.category,
        body: d.body || "",
        header: d.header,
        footer: d.footer,
        buttons: d.buttons || [],
        strategy_notes: d.strategy_notes,
        confidence_score: d.confidence_score,
      })));
    } catch { /* silent */ }
    setDraftsLoading(false);
  }, [collaborator, effectiveCompanyId]);

  useEffect(() => {
    fetchTemplates();
    // Sync silencioso ao carregar — atualiza banco local com status da Meta
    (async () => {
      try {
        const headers = await getHeaders();
        await fetch(`${EDGE_BASE}/whatsapp-meta-templates`, {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "sync", company_id: effectiveCompanyId }),
        });
      } catch {}
    })();
  }, [fetchTemplates]);

  useEffect(() => {
    if (tab === "pending") fetchRejections();
    if (tab === "drafts") fetchDrafts();
  }, [tab, fetchRejections, fetchDrafts]);

  const approved = templates.filter((t) =>
    t.status === "APPROVED" &&
    (isCEO || (t.category || "").toUpperCase() !== "MARKETING") &&
    (!search || t.name.toLowerCase().includes(search.toLowerCase())) &&
    (categoryFilter === "all" || (t.category || "").toUpperCase() === categoryFilter.toUpperCase())
  );
  const pending = templates.filter((t) => (t.status === "PENDING" || t.status === "REJECTED") && (!search || t.name.toLowerCase().includes(search.toLowerCase())));

  const handleGenerate = async () => {
    if (!objective.trim() || !collaborator) return;
    setGenerating(true);
    setGenerated([]);
    try {
      const res = await fetch(`${EDGE_BASE}/generate-template`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjYWR1endhdXRscHpwdmpvZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMDQ1MTcsImV4cCI6MjA4ODU4MDUxN30.LinR7PIoK7n79hWjbSJ3EgDwA_y6uN-HfQnOk7GgYi4",
        },
        body: JSON.stringify({
          action: "generate",
          objective,
          company_id: effectiveCompanyId,
          count: 3,
          quantity: 3,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const templates: GeneratedTemplate[] = data.templates || [];
        setGenerated(templates);

        // Auto-salvar cada template como rascunho — NÃO submeter à Meta
        const savePromises = templates.map(async (tmpl) => {
          const row = {
            company_id: effectiveCompanyId,
            name: tmpl.name,
            category: (tmpl.category || "UTILITY").toUpperCase(),
            language: "pt_BR",
            body: tmpl.body,
            header: tmpl.header || null,
            footer: tmpl.footer || null,
            buttons: tmpl.buttons || [],
            strategy_notes: tmpl.strategy_notes || null,
            confidence_score: tmpl.confidence_score || null,
            status: "draft",
          };
          const { error } = await supabase.from("wa_templates").insert(row);
          if (error?.code === "23505") {
            // Duplicata — atualizar existente
            await supabase.from("wa_templates")
              .update({ ...row, updated_at: new Date().toISOString() })
              .eq("name", tmpl.name)
              .eq("company_id", effectiveCompanyId);
          }
        });
        await Promise.all(savePromises);
        toast.success(`${templates.length} variações geradas e salvas como rascunho`);
        // Manter na aba Criar Novo — templates gerados ficam visíveis
        // Atualizar rascunhos em background pra quando o usuário navegar
        setTimeout(() => fetchDrafts(), 500);
      } else {
        toast.error(data.error || "Erro ao gerar");
      }
    } catch {
      toast.error("Erro de conexão");
    }
    setGenerating(false);
  };

  const handleSaveDraft = async (tmpl: GeneratedTemplate) => {
    if (!collaborator) return;
    setSubmitting(tmpl.name);
    try {
      const row = {
        company_id: effectiveCompanyId,
        name: tmpl.name,
        category: (tmpl.category || "UTILITY").toUpperCase(),
        language: "pt_BR",
        body: tmpl.body,
        header: tmpl.header || null,
        footer: tmpl.footer || null,
        buttons: tmpl.buttons || [],
        strategy_notes: tmpl.strategy_notes || null,
        confidence_score: tmpl.confidence_score || null,
        status: "draft",
      };
      const { error } = await supabase.from("wa_templates").insert(row);
      if (error?.code === "23505") {
        const { error: updErr } = await supabase.from("wa_templates")
          .update({ ...row, updated_at: new Date().toISOString() })
          .eq("name", tmpl.name)
          .eq("company_id", effectiveCompanyId);
        if (updErr) throw updErr;
      } else if (error) throw error;
      toast.success("Rascunho salvo — acesse a aba Rascunhos para submeter à Meta");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar rascunho");
    }
    setSubmitting(null);
  };

  const handleSubmitDraft = async (tmpl: GeneratedTemplate) => {
    if (!collaborator) return;
    setSubmittingDraft(tmpl.name);
    try {
      const headers = await getHeaders();
      const components: any[] = [];
      if (tmpl.body) components.push({ type: "BODY", text: tmpl.body });
      if (tmpl.header) components.push({ type: "HEADER", format: "TEXT", text: tmpl.header });
      if (tmpl.footer) components.push({ type: "FOOTER", text: tmpl.footer });
      if (tmpl.buttons && tmpl.buttons.length > 0) {
        components.push({
          type: "BUTTONS",
          buttons: tmpl.buttons.map((b: any) => typeof b === "string"
            ? { type: "QUICK_REPLY", text: b }
            : { type: b.type || "QUICK_REPLY", text: b.text, ...(b.url ? { url: b.url } : {}), ...(b.phone_number ? { phone_number: b.phone_number } : {}) }
          ),
        });
      }
      // Sanitizar body: Meta rejeita variáveis no início ou fim
      const bodyComp = components.find((c: any) => c.type === "BODY");
      if (bodyComp) {
        // Fix: variável no início
        if (/^\s*\{\{/.test(bodyComp.text)) {
          bodyComp.text = "Olá " + bodyComp.text;
        }
        // Fix: variável no fim
        if (/\{\{\d+\}\}\s*$/.test(bodyComp.text)) {
          bodyComp.text = bodyComp.text.replace(/(\{\{\d+\}\})\s*$/, "$1.");
        }
      }
      if (bodyComp) {
        const varMatches = bodyComp.text.match(/\{\{\d+\}\}/g) || [];
        if (varMatches.length > 0) {
          const examples = varMatches.map((_: string, i: number) => {
            const defaults = ["João", "Onix 2024", "150", "SP", "12345"];
            return defaults[i] || `exemplo${i + 1}`;
          });
          bodyComp.example = { body_text: [examples] };
        }
      }

      // Tentar create, se já existe tentar update
      let res = await fetch(`${EDGE_BASE}/whatsapp-meta-templates`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "create",
          company_id: effectiveCompanyId,
          name: tmpl.name,
          category: (tmpl.category || "UTILITY").toUpperCase(),
          language: "pt_BR",
          components,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        // Mark draft as submitted
        const finalName = data.renamed || tmpl.name;
        await supabase.from("wa_templates")
          .update({ status: "submitted", name: finalName })
          .eq("name", tmpl.name)
          .eq("status", "draft");
        const msg = data.renamed
          ? `Template submetido como "${data.renamed}" — aguardando aprovação`
          : "Template submetido à Meta — aguardando aprovação";
        toast.success(msg);
        fetchDrafts();
        fetchTemplates();
      } else {
        // Traduzir erros da Meta
        const metaErr = data?.details?.error;
        let errorMsg = data.error || "Erro ao submeter";
        if (metaErr?.error_subcode === 2388024) {
          errorMsg = "Já existe template com esse nome na Meta. Tente gerar com nome diferente.";
        } else if (metaErr?.error_subcode === 2388299) {
          errorMsg = "Variáveis {{N}} não podem estar no início/fim da mensagem.";
        } else if (metaErr?.error_user_msg) {
          errorMsg = metaErr.error_user_msg;
        }
        toast.error(errorMsg);
      }
    } catch {
      toast.error("Erro de conexão");
    }
    setSubmittingDraft(null);
  };

  const handleSubmitTemplate = async (tmpl: GeneratedTemplate) => {
    if (!collaborator) return;
    setSubmitting(tmpl.name);
    try {
      const headers = await getHeaders();
      const components: any[] = [];
      if (tmpl.body) components.push({ type: "BODY", text: tmpl.body });
      if (tmpl.header) components.push({ type: "HEADER", format: "TEXT", text: tmpl.header });
      if (tmpl.footer) components.push({ type: "FOOTER", text: tmpl.footer });
      if (tmpl.buttons && tmpl.buttons.length > 0) {
        components.push({
          type: "BUTTONS",
          buttons: tmpl.buttons.map(b => typeof b === "string"
            ? { type: "QUICK_REPLY", text: b }
            : { type: b.type || "QUICK_REPLY", text: b.text, ...(b.url ? { url: b.url } : {}), ...(b.phone_number ? { phone_number: b.phone_number } : {}) }
          ),
        });
      }

      const res = await fetch(`${EDGE_BASE}/whatsapp-meta-templates`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "create",
          company_id: effectiveCompanyId,
          name: tmpl.name,
          category: (tmpl.category || "UTILITY").toUpperCase(),
          language: "pt_BR",
          components,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Template submetido — aguardando aprovação da Meta");
        fetchTemplates();
      } else {
        toast.error(data.error || "Erro ao submeter");
      }
    } catch {
      toast.error("Erro de conexão");
    }
    setSubmitting(null);
  };

  const openAssignModal = async (tmpl: Template) => {
    setAssignTemplate(tmpl);
    setSelectedSellers([]);
    // Buscar consultores + gestores comerciais da empresa (quem dispara)
    const { data: roles } = await supabase
      .from("roles")
      .select("id, name, level")
      .in("level", [2, 3]); // Gestor + Consultor Comercial
    const eligibleRoleIds = (roles || []).map((r: any) => r.id);
    if (eligibleRoleIds.length === 0) return;
    
    let query = supabase
      .from("collaborators")
      .select("id, name, role_id")
      .eq("active", true)
      .in("role_id", eligibleRoleIds);
    if (companyFilter) query = query.eq("company_id", companyFilter);
    
    const { data } = await query.order("name");
    const roleMap: Record<string, string> = {};
    (roles || []).forEach((r: any) => { roleMap[r.id] = r.name; });
    
    const list = (data || []).map((d: any) => ({
      id: d.id,
      name: d.name || d.id.slice(0, 8),
      role: roleMap[d.role_id] || "Comercial",
    }));
    setSellers(list);
    // Auto-selecionar todos
    setSelectedSellers(list.map((s: any) => s.id));
  };

  const saveAssignment = async () => {
    if (!assignTemplate || !collaborator) return;
    setSavingAssign(true);
    try {
      const headers = await getHeaders();
      for (const sellerId of selectedSellers) {
        await fetch(`${EDGE_BASE}/dispatch-permissions`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            action: "set-templates",
            collaborator_id: sellerId,
            allowed_templates: [assignTemplate.name],
          }),
        });
      }
      toast.success("Templates atribuídos!");
      setAssignTemplate(null);
    } catch {
      toast.error("Erro");
    }
    setSavingAssign(false);
  };

  const handleDeleteTemplate = async (t: Template) => {
    if (!collaborator || !isCEO) return;
    if (!confirm(`Deletar template "${t.name}"?`)) return;
    try {
      // 1. Deletar do banco local
      await supabase.from("wa_templates").delete().eq("name", t.name).eq("company_id", effectiveCompanyId);
      // 2. Tentar deletar da Meta (silencioso — pode falhar se não existe lá)
      try {
        const headers = await getHeaders();
        await fetch(`${EDGE_BASE}/whatsapp-meta-templates`, {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "delete", name: t.name }),
        });
      } catch { /* Meta delete is best-effort */ }
      toast.success("Template excluído");
      fetchTemplates();
    } catch {
      toast.error("Erro ao excluir template");
    }
  };

  const handleResubmitTemplate = async (t: Template) => {
    if (!collaborator) return;
    setResubmitting(t.name);
    try {
      const headers = await getHeaders();
      const components: any[] = [];
      if (t.body) components.push({ type: "BODY", text: t.body });
      if (t.header) components.push({ type: "HEADER", format: "TEXT", text: t.header });
      if (t.footer) components.push({ type: "FOOTER", text: t.footer });
      if (t.buttons && t.buttons.length > 0) {
        components.push({
          type: "BUTTONS",
          buttons: t.buttons.map((b: any) => typeof b === "string"
            ? { type: "QUICK_REPLY", text: b }
            : { type: b.type || "QUICK_REPLY", text: b.text }
          ),
        });
      }
      const res = await fetch(`${EDGE_BASE}/whatsapp-meta-templates`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "create",
          company_id: effectiveCompanyId,
          name: t.name,
          category: (t.category || "MARKETING").toUpperCase(),
          language: t.language || "pt_BR",
          components,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Template enviado para análise da Meta");
        fetchTemplates();
      } else {
        toast.error(data.error || "Erro ao submeter");
      }
    } catch {
      toast.error("Erro de conexão");
    }
    setResubmitting(null);
  };

  const TemplateCard = ({ t, showAssign, showSubmit }: { t: Template; showAssign?: boolean; showSubmit?: boolean }) => {
    const st = statusConfig[t.status] || statusConfig.PENDING;
    const StIcon = st.icon;
    return (
      <Card className="hover:border-primary/30 transition-colors">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm">{t.name}</CardTitle>
            <div className="flex items-center gap-1.5">
              {qualityBadge(t.quality)}
              <Badge variant="outline" className={`${st.color} text-xs`}>
                <StIcon className="h-3 w-3 mr-1" /> {st.label}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground line-clamp-3">{t.body}</p>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="text-xs">{t.category}</Badge>
            {(t.category || "").toUpperCase() === "UTILITY" && (
              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/30">Economia</Badge>
            )}
            {(t.category || "").toUpperCase() === "MARKETING" && (
              <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/30">Custo 2x</Badge>
            )}
            {t.total_sent !== undefined && <span>{t.total_sent} envios</span>}
            {t.score !== undefined && <span className={scoreColor(t.score)}>Score: {t.score}</span>}
            {t.response_rate !== undefined && <span>{(t.response_rate * 100).toFixed(0)}% resp.</span>}
            {t.read_rate !== undefined && <span>{(t.read_rate * 100).toFixed(0)}% lidos</span>}
          </div>
          {t.status === "REJECTED" && t.rejection_reason && (
            <div className="bg-red-500/5 border border-red-500/20 rounded p-2 text-xs">
              <p className="text-red-400 font-medium">Motivo: {t.rejection_reason}</p>
              {t.rejection_suggestion && <p className="text-muted-foreground mt-1">Sugestão: {t.rejection_suggestion}</p>}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {showAssign && (
              <Button size="sm" variant="outline" onClick={() => openAssignModal(t)}>
                <Users className="h-3.5 w-3.5 mr-1" /> Atribuir a vendedores
              </Button>
            )}
            {showSubmit && (t.status === "REJECTED" || t.status === "PENDING") && (
              isCEO ? (
                <>
                  <Button size="sm" variant="default" disabled={resubmitting === t.name} onClick={() => handleResubmitTemplate(t)}>
                    {resubmitting === t.name ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                    {t.status === "REJECTED" ? "Resubmeter à Meta" : "Enviar para análise"}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDeleteTemplate(t)}>
                    Deletar
                  </Button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground italic">Aguardando aprovação do administrador</p>
              )
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <PageHeader title="Templates" subtitle="Gerencie e crie templates WhatsApp" />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <TabsList>
            <TabsTrigger value="approved">Aprovados</TabsTrigger>
            {isCEO && <TabsTrigger value="pending">Pendentes</TabsTrigger>}
            {isCEO && <TabsTrigger value="drafts">Rascunhos</TabsTrigger>}
            {isCEO && <TabsTrigger value="create">Criar Novo</TabsTrigger>}
          </TabsList>
          {tab !== "create" && (
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          )}
        </div>

        {/* APPROVED TAB */}
        <TabsContent value="approved">
          <div className="flex flex-wrap gap-2 mb-4 items-center">
            {[
              { value: "all", label: "Todos" },
              { value: "UTILITY", label: "Utility" },
              { value: "MARKETING", label: "Marketing" },
            ].map(f => (
              <button
                key={f.value}
                onClick={() => setCategoryFilter(f.value)}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                  categoryFilter === f.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {f.label}
              </button>
            ))}
            <span className="text-xs text-muted-foreground ml-auto">{approved.length} templates</span>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : approved.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum template aprovado.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {approved.map((t) => <TemplateCard key={t.name} t={t} showAssign={isCEO} />)}
            </div>
          )}
        </TabsContent>

        {/* PENDING TAB */}
        <TabsContent value="pending" className="space-y-6">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : pending.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum template pendente ou rejeitado.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pending.map((t) => <TemplateCard key={t.name} t={t} showSubmit />)}
            </div>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="h-4 w-4" /> Rejeições Anteriores
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rejectionsLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : rejections.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sem rejeições registradas</p>
              ) : (
                <div className="space-y-3">
                  {rejections.map((r, i) => (
                    <div key={i} className="p-3 rounded-lg bg-muted/20 border border-border/50 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{r.name}</span>
                        <span className="text-xs text-muted-foreground">{r.date}</span>
                      </div>
                      <p className="text-xs text-red-400 mt-1">Motivo: {r.reason}</p>
                      <p className="text-xs text-muted-foreground mt-1">{r.analysis}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DRAFTS TAB */}
        <TabsContent value="drafts" className="space-y-4">
          {draftsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : drafts.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum rascunho. Gere templates na aba "Criar Novo" e salve como rascunho.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {drafts.map((d) => {
                const score = d.confidence_score || 0;
                const sb = score > 0 ? scoreBadge(score) : null;
                const catColor = (d.category || "").toUpperCase() === "MARKETING"
                  ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                  : "bg-green-500/10 text-green-400 border-green-500/30";
                const ab = approvalBadge(d.category || "MARKETING", d.body);
                return (
                  <Card key={d.name} className="hover:border-primary/30 transition-colors">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm">{d.name}</CardTitle>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {d.category && (
                            <Badge variant="outline" className={`text-xs ${catColor}`}>
                              {d.category.toUpperCase()}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs bg-muted/30 text-muted-foreground">Rascunho</Badge>
                          {sb && <Badge variant="outline" className={`text-xs ${sb.color}`}>{sb.label}</Badge>}
                          <Badge variant="outline" className={`text-xs ${ab.color}`} title={ab.label}>
                            {ab.emoji} {ab.label}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground bg-muted/30 p-2 rounded whitespace-pre-wrap">{d.body}</p>
                      {d.strategy_notes && (
                        <p className="text-xs italic text-muted-foreground border-l-2 border-primary/30 pl-2">{d.strategy_notes}</p>
                      )}
                      <div className="flex gap-2">
                        {isCEO ? (
                          <Button size="sm" disabled={submittingDraft === d.name} onClick={() => handleSubmitDraft(d)}>
                            {submittingDraft === d.name ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                            Submeter à Meta
                          </Button>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Aguardando aprovação do administrador</p>
                        )}
                        <Button size="sm" variant="destructive" onClick={async () => {
                          if (!confirm(`Excluir rascunho "${d.name}"?`)) return;
                          // Deletar por nome (todas as empresas — pode ter duplicatas)
                          await supabase.from("wa_templates").delete().eq("name", d.name).eq("status", "draft");
                          setDrafts(prev => prev.filter(x => x.name !== d.name));
                          toast.success("Rascunho excluído");
                        }}>
                          <Trash2 className="h-3 w-3 mr-1" />
                          Excluir
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* CREATE TAB */}
        <TabsContent value="create" className="space-y-6">
          {/* Regras Meta - base de conhecimento colapsável */}
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardHeader className="pb-2 cursor-pointer" onClick={() => setMetaRulesOpen(o => !o)}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span>📋 Regras Meta — Guia de Aprovação</span>
                  <span
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 cursor-help text-[10px]"
                    title="A IA usa estas regras automaticamente para maximizar aprovação"
                  >
                    <Info className="h-3 w-3" />
                  </span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-blue-400">A IA usa estas regras automaticamente para maximizar aprovação</span>
                  {metaRulesOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
            </CardHeader>
            {metaRulesOpen && (
              <CardContent className="space-y-4 pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-green-400 flex items-center gap-1">✅ UTILITY — Use quando:</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Confirmação de transação já realizada</li>
                      <li>• Atualização de pedido/serviço em andamento</li>
                      <li>• Lembrete de pagamento de obrigação <strong>EXISTENTE</strong></li>
                      <li>• Notificação operacional (código, senha, status)</li>
                      <li>• <strong>ALERTA</strong> sobre situação que afeta o lead diretamente</li>
                      <li>• Informação que o lead precisa agir para proteger interesse próprio</li>
                    </ul>
                    <div className="space-y-1 mt-2">
                      <p className="text-[11px] font-medium text-green-400">Exemplos corretos como UTILITY:</p>
                      <p className="text-[11px] text-muted-foreground bg-green-500/5 border border-green-500/20 p-2 rounded">✅ "⚠️ {`{{1}}`}, seu veículo {`{{2}}`} está sem proteção há {`{{3}}`} dias. Regularize: {`{{4}}`}"</p>
                      <p className="text-[11px] text-muted-foreground bg-green-500/5 border border-green-500/20 p-2 rounded">✅ "🔔 Lembrete: a proteção do seu {`{{1}}`} vence em {`{{2}}`} dias. Renove: {`{{3}}`}"</p>
                      <p className="text-[11px] text-muted-foreground bg-green-500/5 border border-green-500/20 p-2 rounded">✅ "⚡ {`{{1}}`}, identificamos pendência no cadastro do seu veículo {`{{2}}`}. Regularize: {`{{3}}`}"</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-yellow-400 flex items-center gap-1">⚠️ MARKETING — Obrigatório se contiver:</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Proposta de preço ou oferta direta</li>
                      <li>• "Você pode se interessar por..."</li>
                      <li>• Convite para conhecer produto</li>
                      <li>• Reengajamento sem contexto de utilidade</li>
                      <li>• Qualquer CTA comercial direto</li>
                    </ul>
                    <div className="space-y-1 mt-2">
                      <p className="text-[11px] font-medium text-red-400">Exemplos incorretos como UTILITY:</p>
                      <p className="text-[11px] text-muted-foreground bg-red-500/5 border border-red-500/20 p-2 rounded">❌ "Temos uma oferta especial de proteção veicular para você!"</p>
                      <p className="text-[11px] text-muted-foreground bg-red-500/5 border border-red-500/20 p-2 rounded">❌ "{`{{1}}`}, você demonstrou interesse. Podemos enviar uma proposta?"</p>
                      <p className="text-[11px] text-muted-foreground bg-red-500/5 border border-red-500/20 p-2 rounded">❌ "Quer economizar no seguro do seu {`{{1}}`}? Temos o melhor preço!"</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded p-3">
                  <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-300">
                    <strong>Estratégia ISCA DE UTILIDADE:</strong> A IA transforma intenções comerciais em alertas/notificações de utilidade genuína.
                    Ex: "quero vender proteção" → "⚠️ Alerta: seu veículo pode estar desprotegido. Acesse: {`{{1}}`}".
                    Templates UTILITY aprovados têm custo menor e maior alcance.
                  </p>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Configuração de variáveis Meta */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-400" /> Variáveis de Template — Meta WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Configure o que cada variável representa. Na hora do envio, serão substituídas pelos dados reais.
              </p>
              {varMappingsLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (
                <>
                  <div className="grid grid-cols-[60px_1fr_1fr_1fr] gap-2 text-xs font-medium text-muted-foreground px-1">
                    <span>Variável</span>
                    <span>Descrição</span>
                    <span>Fonte do dado</span>
                    <span>Valor fixo (se custom)</span>
                  </div>
                  {varMappings.map((v, idx) => (
                    <div key={v.variable_index} className="grid grid-cols-[60px_1fr_1fr_1fr] gap-2 items-center">
                      <code className="font-mono text-primary font-bold text-sm text-center">{`{{${v.variable_index}}}`}</code>
                      <Input
                        value={v.label}
                        onChange={(e) => updateVarMapping(idx, "label", e.target.value)}
                        placeholder="Ex: Nome do lead"
                        className="h-8 text-xs"
                      />
                      <select
                        value={`${v.source}.${v.source_field}` || "custom"}
                        onChange={(e) => updateVarMapping(idx, "source_field", e.target.value)}
                        className="h-8 text-xs rounded-md border border-border bg-background px-2 text-foreground"
                      >
                        {SOURCE_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <Input
                        value={v.default_value}
                        onChange={(e) => updateVarMapping(idx, "default_value", e.target.value)}
                        placeholder={v.source === "custom" ? "Valor fixo" : "Fallback (opcional)"}
                        className="h-8 text-xs"
                      />
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[11px] text-muted-foreground">
                      Exemplo: <code className="text-primary">Olá {"{{1}}"}, aqui é {"{{5}}"} da {"{{6}}"}.</code>
                    </p>
                    <Button size="sm" onClick={saveVarMappings} disabled={varMappingsSaving}>
                      {varMappingsSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                      Salvar Mapeamento
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Gerar com IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Objetivo</Label>
                <Textarea
                  placeholder="Descreva o que quer comunicar ao lead. Ex: 'Lembrar que a proposta expira em 48h, criar urgência com tom amigável'"
                  rows={3}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                />
              </div>
              <Button onClick={handleGenerate} disabled={generating || !objective.trim()}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                Gerar 3 Variações
              </Button>
            </CardContent>
          </Card>

          {generated.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {generated.map((g, idx) => {
                const score = g.confidence_score || 0;
                const sb = score > 0 ? scoreBadge(score) : null;
                const isEditing = editIdx === idx;
                const catColor = (g.category || "").toUpperCase() === "MARKETING"
                  ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                  : "bg-green-500/10 text-green-400 border-green-500/30";
                const ab = approvalBadge(g.category || "MARKETING", g.body);
                return (
                  <Card key={idx} className="hover:border-primary/30 transition-colors">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm">{g.name}</CardTitle>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {g.category && (
                            <Badge variant="outline" className={`text-xs ${catColor}`}>
                              {g.category.toUpperCase()}
                            </Badge>
                          )}
                          {sb && <Badge variant="outline" className={`text-xs ${sb.color}`}>{sb.label}</Badge>}
                          <Badge variant="outline" className={`text-xs ${ab.color}`} title={ab.label}>
                            {ab.emoji} {ab.label}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {score > 0 && (
                        <div className="flex items-center gap-2">
                          <span className={`text-lg font-bold ${scoreColor(score)}`}>{score}</span>
                          <span className="text-xs text-muted-foreground">confiança</span>
                        </div>
                      )}

                      {isEditing ? (
                        <div className="space-y-2">
                          <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={4} />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => {
                              const updated = [...generated];
                              updated[idx] = { ...updated[idx], body: editBody };
                              setGenerated(updated);
                              setEditIdx(null);
                            }}>Salvar</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditIdx(null)}>Cancelar</Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground bg-muted/30 p-2 rounded whitespace-pre-wrap">{g.body}</p>
                      )}

                      {g.strategy_notes && (
                        <p className="text-xs italic text-muted-foreground border-l-2 border-primary/30 pl-2">{g.strategy_notes}</p>
                      )}

                      {g.buttons && g.buttons.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Botões:</p>
                          {g.buttons.map((btn, bi) => (
                            <Badge key={bi} variant="secondary" className="text-xs mr-1">
                              {typeof btn === "string" ? btn : btn.text}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {(g.issues || []).length > 0 && (
                        <div className="space-y-1">
                          {(g.issues || []).map((issue, ii) => (
                            <p key={ii} className={`text-xs flex items-center gap-1 ${issue.type === "error" ? "text-red-400" : "text-yellow-400"}`}>
                              <AlertTriangle className="h-3 w-3" /> {issue.message}
                            </p>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setEditIdx(idx); setEditBody(g.body); }}>
                          Editar
                        </Button>
                        <Button size="sm" variant="outline" disabled={submitting === g.name} onClick={() => handleSaveDraft(g)}>
                          {submitting === g.name ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                          Salvar Rascunho
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Assignment Modal */}
      <Dialog open={!!assignTemplate} onOpenChange={() => setAssignTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir Template</DialogTitle>
            <DialogDescription>
              Selecione os vendedores que podem usar "{assignTemplate?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">{selectedSellers.length} de {sellers.length} selecionados</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedSellers(
                selectedSellers.length === sellers.length ? [] : sellers.map(s => s.id)
              )}
            >
              {selectedSellers.length === sellers.length ? "Desmarcar Todos" : "Selecionar Todos"}
            </Button>
          </div>
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {sellers.map((s) => (
              <label key={s.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/30 cursor-pointer">
                <Checkbox
                  checked={selectedSellers.includes(s.id)}
                  onCheckedChange={(checked) => {
                    setSelectedSellers(prev =>
                      checked ? [...prev, s.id] : prev.filter(id => id !== s.id)
                    );
                  }}
                />
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.role}</p>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTemplate(null)}>Cancelar</Button>
            <Button onClick={saveAssignment} disabled={savingAssign || selectedSellers.length === 0}>
              {savingAssign ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Atribuir ({selectedSellers.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
