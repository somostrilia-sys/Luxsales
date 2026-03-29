import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompany } from "@/contexts/CompanyContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { supabase } from "@/lib/supabase";
import { EDGE_BASE, SUPABASE_ANON_KEY } from "@/lib/constants";
import { toast } from "sonner";
import {
  Building2, User, Package, ChevronLeft, ChevronRight, Save,
  Loader2, X, Plus, Sparkles, Check,
} from "lucide-react";

const SEGMENTS = [
  { value: "protecao_veicular", label: "Proteção Veicular" },
  { value: "clinica_estetica", label: "Clínica / Estética" },
  { value: "imobiliaria", label: "Imobiliária" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "saas", label: "SaaS" },
  { value: "educacao", label: "Educação" },
  { value: "servicos_financeiros", label: "Serviços Financeiros" },
  { value: "outro", label: "Outro" },
];

const TONE_OPTIONS = [
  "informal", "coloquial", "profissional", "acolhedor", "técnico", "entusiasmado", "empático",
];

interface Plan {
  name: string;
  price: string;
  description: string;
}

interface FormData {
  company_name: string;
  segment: string;
  segment_custom: string;
  persona_name: string;
  persona_role: string;
  persona_company: string;
  persona_tone: string[];
  forbidden_words: string[];
  allowed_words: string[];
  product_description: string;
  base_price: string;
  plans: Plan[];
  differentials: string[];
}

const initialForm: FormData = {
  company_name: "",
  segment: "",
  segment_custom: "",
  persona_name: "",
  persona_role: "",
  persona_company: "",
  persona_tone: [],
  forbidden_words: [],
  allowed_words: [],
  product_description: "",
  base_price: "",
  plans: [],
  differentials: [],
};

function TagsInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState("");
  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput("");
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={!input.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CompanySetup() {
  const navigate = useNavigate();
  const { company_id: baseCompanyId, companyConfig: baseConfig, refetch } = useCompany();
  const { selectedCompanyId } = useCompanyFilter();
  // Import useCollaborator at the top is needed — adding inline
  const [isCEO, setIsCEO] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        supabase.from("collaborators").select("role:roles(level)").eq("user_id", session.user.id).maybeSingle().then(({ data }) => {
          setIsCEO((data?.role as any)?.level <= 1);
        });
      }
    });
  }, []);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(initialForm);
  const [companyConfig, setFetchedConfig] = useState<any>(null);

  // Resolve which company to configure
  const company_id = (selectedCompanyId && selectedCompanyId !== "all") ? selectedCompanyId : baseCompanyId;

  // Fetch config when selected company changes
  useEffect(() => {
    if (!company_id) return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${EDGE_BASE}/company-config`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ action: "get", company_id }),
        });
        if (res.ok) {
          const json = await res.json();
          setFetchedConfig(json?.config || json?.data || json);
        }
      } catch {}
    })();
  }, [company_id]);
  const [saving, setSaving] = useState(false);

  // Pre-fill from existing config (fetched or from context)
  const activeConfig = companyConfig || baseConfig;
  useEffect(() => {
    if (activeConfig) {
      const cfg = activeConfig as any;
      const pd = cfg.product_data || {};
      setForm({
        company_name: cfg.company_name || "",
        segment: cfg.segment || "",
        segment_custom: cfg.segment === "outro" ? (cfg.segment_display_name || "") : "",
        persona_name: cfg.persona_name || "",
        persona_role: cfg.persona_role || "",
        persona_company: cfg.persona_company || "",
        persona_tone: cfg.persona_tone ? cfg.persona_tone.split(", ") : [],
        forbidden_words: cfg.forbidden_words || [],
        allowed_words: cfg.allowed_words || [],
        product_description: pd.description || "",
        base_price: pd.base_price || "",
        plans: pd.plans || [],
        differentials: pd.differentials || [],
      });
    }
  }, [activeConfig]);

  const update = <K extends keyof FormData>(key: K, val: FormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!company_id) { toast.error("Empresa não identificada"); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const segDisplay = SEGMENTS.find((s) => s.value === form.segment)?.label || form.segment_custom || form.segment;

      const body = {
        action: "set",
        company_id,
        requester_role: "ceo",
        company_name: form.company_name.trim(),
        segment: form.segment,
        segment_display_name: segDisplay,
        persona_name: form.persona_name.trim(),
        persona_role: form.persona_role.trim(),
        persona_company: form.persona_company.trim(),
        persona_tone: form.persona_tone.join(", "),
        forbidden_words: form.forbidden_words,
        allowed_words: form.allowed_words,
        product_data: {
          base_price: form.base_price,
          description: form.product_description.trim(),
          plans: form.plans,
          differentials: form.differentials,
        },
      };

      const res = await fetch(`${EDGE_BASE}/company-config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao salvar configuração");
      }

      toast.success("Configuração salva!");
      await refetch();
      navigate("/");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const addPlan = () => update("plans", [...form.plans, { name: "", price: "", description: "" }]);
  const updatePlan = (idx: number, field: keyof Plan, val: string) => {
    const updated = [...form.plans];
    updated[idx] = { ...updated[idx], [field]: val };
    update("plans", updated);
  };
  const removePlan = (idx: number) => update("plans", form.plans.filter((_, i) => i !== idx));

  const stepIcons = [Building2, User, Package];
  const stepLabels = ["Dados da Empresa", "Persona da IA", "Produto / Serviço"];

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Configure sua Empresa
          </h1>
          <p className="text-sm text-muted-foreground">
            {companyConfig ? "Edite as configurações da sua empresa" : "Configure para começar a usar a plataforma"}
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => {
            const Icon = stepIcons[s - 1];
            const active = s === step;
            const done = s < step;
            return (
              <div key={s} className="flex items-center gap-2">
                {s > 1 && <div className={`h-px w-8 ${done ? "bg-primary" : "bg-border"}`} />}
                <button
                  onClick={() => setStep(s)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : done
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{stepLabels[s - 1]}</span>
                  <span className="sm:hidden">{s}/3</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5 text-primary" />
                Dados da Empresa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da empresa</Label>
                <Input
                  value={form.company_name}
                  onChange={(e) => update("company_name", e.target.value)}
                  placeholder="Ex: Objetivo Proteção Veicular"
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label>Segmento</Label>
                <Select value={form.segment} onValueChange={(v) => update("segment", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o segmento" /></SelectTrigger>
                  <SelectContent>
                    {SEGMENTS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.segment === "outro" && (
                <div className="space-y-2">
                  <Label>Descreva seu segmento</Label>
                  <Input
                    value={form.segment_custom}
                    onChange={(e) => update("segment_custom", e.target.value)}
                    placeholder="Ex: Consultoria tributária"
                    maxLength={100}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-primary" />
                Persona da IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome da persona</Label>
                  <Input value={form.persona_name} onChange={(e) => update("persona_name", e.target.value)} placeholder="Ex: Lucas" maxLength={50} />
                </div>
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Input value={form.persona_role} onChange={(e) => update("persona_role", e.target.value)} placeholder="Ex: consultor de proteção veicular" maxLength={100} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Nome da empresa na fala da IA</Label>
                <Input value={form.persona_company} onChange={(e) => update("persona_company", e.target.value)} placeholder="Ex: Objetivo Proteção Veicular" maxLength={100} />
              </div>
              <div className="space-y-2">
                <Label>Tom de voz</Label>
                <div className="flex flex-wrap gap-2">
                  {TONE_OPTIONS.map((tone) => {
                    const selected = form.persona_tone.includes(tone);
                    return (
                      <button
                        key={tone}
                        type="button"
                        onClick={() =>
                          update("persona_tone", selected ? form.persona_tone.filter((t) => t !== tone) : [...form.persona_tone, tone])
                        }
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          selected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                        }`}
                      >
                        {tone}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Palavras proibidas</Label>
                <TagsInput value={form.forbidden_words} onChange={(v) => update("forbidden_words", v)} placeholder="Ex: seguro, apólice" />
              </div>
              <div className="space-y-2">
                <Label>Palavras preferidas</Label>
                <TagsInput value={form.allowed_words} onChange={(v) => update("allowed_words", v)} placeholder="Ex: proteção, plano" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5 text-primary" />
                Produto / Serviço
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Descrição curta do produto</Label>
                <Textarea
                  value={form.product_description}
                  onChange={(e) => update("product_description", e.target.value.slice(0, 500))}
                  placeholder="Descreva seu produto ou serviço principal..."
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">{form.product_description.length}/500</p>
              </div>

              <div className="space-y-2 max-w-xs">
                <Label>Preço base</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                  <Input
                    value={form.base_price}
                    onChange={(e) => update("base_price", e.target.value.replace(/[^0-9.,]/g, ""))}
                    placeholder="99,90"
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Plans */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Planos</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addPlan} className="gap-1">
                    <Plus className="h-3.5 w-3.5" /> Adicionar plano
                  </Button>
                </div>
                {form.plans.map((plan, idx) => (
                  <Card key={idx} className="bg-muted/30">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Plano {idx + 1}</span>
                        <button type="button" onClick={() => removePlan(idx)} className="text-muted-foreground hover:text-destructive">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input value={plan.name} onChange={(e) => updatePlan(idx, "name", e.target.value)} placeholder="Nome do plano" maxLength={60} />
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                          <Input value={plan.price} onChange={(e) => updatePlan(idx, "price", e.target.value.replace(/[^0-9.,]/g, ""))} placeholder="Preço" className="pl-9" />
                        </div>
                      </div>
                      <Input value={plan.description} onChange={(e) => updatePlan(idx, "description", e.target.value)} placeholder="Descrição curta" maxLength={200} />
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Diferenciais</Label>
                <TagsInput value={form.differentials} onChange={(v) => update("differentials", v)} placeholder="Ex: Sem análise de perfil, Assistência 24h" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" onClick={() => setStep(step - 1)} disabled={step === 1} className="gap-1">
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>

          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} className="gap-1">
              Próximo <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving || !form.company_name.trim() || !form.segment} className="gap-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Configuração
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
