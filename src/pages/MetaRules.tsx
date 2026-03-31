import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Search, Plus, Trash2, CheckCircle2, AlertTriangle, XCircle, Lightbulb, Sparkles, Shield, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { EDGE_BASE, SUPABASE_ANON_KEY } from "@/lib/constants";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { useCollaborator } from "@/contexts/CollaboratorContext";

function useCompanyId() {
  const { selectedCompanyId } = useCompanyFilter();
  const { collaborator } = useCollaborator();
  return selectedCompanyId && selectedCompanyId !== "all"
    ? selectedCompanyId
    : collaborator?.company_id ?? null;
}

async function callMetaRules(body: Record<string, unknown>) {
  const res = await fetch(`${EDGE_BASE}/meta-rules`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Severity Badge ───
function SeverityBadge({ severity }: { severity: string }) {
  const s = severity?.toUpperCase();
  if (s === "MUST") return <Badge className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 text-[10px]">MUST</Badge>;
  if (s === "SHOULD") return <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100 text-[10px]">SHOULD</Badge>;
  return <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 text-[10px]">INFO</Badge>;
}

// ─── Circular Score ───
function CircularScore({ score, size = 100 }: { score: number; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "hsl(142,71%,45%)" : score >= 50 ? "hsl(45,93%,47%)" : "hsl(0,84%,60%)";
  return (
    <svg width={size} height={size} className="block">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} className="transition-all duration-700" />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        className="fill-foreground text-lg font-bold" style={{ fontSize: size * 0.22 }}>
        {score}%
      </text>
    </svg>
  );
}

// ═══════════════════ TAB 1: REGRAS ═══════════════════
function TabRegras({ companyId }: { companyId: string | null }) {
  const [compliance, setCompliance] = useState<any>(null);
  const [grouped, setGrouped] = useState<Record<string, any[]>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    Promise.all([
      callMetaRules({ action: "check-compliance", company_id: companyId }).catch(() => null),
      callMetaRules({ action: "list" }).catch(() => null),
    ]).then(([comp, list]) => {
      if (comp) setCompliance(comp);
      if (list?.grouped) setGrouped(list.grouped);
      setLoading(false);
    });
  }, [companyId]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    try {
      const res = await callMetaRules({ action: "search", query: searchQuery });
      setSearchResults(res.results || []);
    } catch { toast.error("Erro na busca"); }
  }, [searchQuery]);

  const categoryEmojis: Record<string, string> = {
    templates: "📝", qualidade: "📊", tiers: "📈", janela_24h: "⏰",
    opt_in: "✅", pricing: "💰", rate_limits: "⚡", lgpd: "🔒", boas_praticas: "💡",
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Compliance Score */}
      {compliance && (
        <Card>
          <CardContent className="flex items-center gap-6 py-6">
            <CircularScore score={compliance.score ?? 0} size={110} />
            <div className="flex-1 space-y-3">
              <h3 className="text-lg font-semibold">Compliance Score</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(compliance.checks || []).map((c: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    {c.status === "ok" ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" /> :
                     c.status === "warning" ? <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" /> :
                     <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />}
                    <div>
                      <span className="font-medium">{c.item}</span>
                      {c.detail && <p className="text-xs text-muted-foreground">{c.detail}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar regras..." className="pl-9" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()} />
        </div>
        <Button onClick={handleSearch} variant="outline">Buscar</Button>
      </div>

      {/* Search Results */}
      {searchResults && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Resultados ({searchResults.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {searchResults.length === 0 && <p className="text-sm text-muted-foreground">Nenhum resultado</p>}
            {searchResults.map((r: any, i: number) => (
              <div key={i} className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={r.severity} />
                  <span className="font-medium text-sm">{r.title}</span>
                </div>
                <p className="text-xs text-muted-foreground">{r.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Grouped Rules */}
      <Accordion type="multiple" className="space-y-2">
        {Object.entries(grouped).map(([cat, rules]) => (
          <AccordionItem key={cat} value={cat} className="border rounded-lg px-1">
            <AccordionTrigger className="hover:no-underline px-3">
              <span className="flex items-center gap-2 text-sm font-medium">
                <span>{categoryEmojis[cat] || "📌"}</span>
                <span className="capitalize">{cat.replace(/_/g, " ")}</span>
                <Badge variant="secondary" className="text-[10px]">{(rules as any[]).length}</Badge>
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3 space-y-3">
              {(rules as any[]).map((rule, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SeverityBadge severity={rule.severity} />
                    <span className="font-semibold text-sm">{rule.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{rule.description}</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {(rule.applies_to || []).map((t: string) => (
                      <Badge key={t} variant="outline" className="text-[9px]">{t}</Badge>
                    ))}
                    {rule.region && <Badge variant="outline" className="text-[9px]">🌍 {rule.region}</Badge>}
                  </div>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

// ═══════════════════ TAB 2: VALIDAR ═══════════════════
function TabValidar({ companyId }: { companyId: string | null }) {
  const [templateName, setTemplateName] = useState("");
  const [category, setCategory] = useState("MARKETING");
  const [body, setBody] = useState("");
  const [buttons, setButtons] = useState([{ type: "QUICK_REPLY", text: "Parar de receber" }]);
  const [validating, setValidating] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any>(null);

  useEffect(() => {
    if (category === "MARKETING" && buttons.length === 0) {
      setButtons([{ type: "QUICK_REPLY", text: "Parar de receber" }]);
    }
  }, [category]);

  const handleValidate = async () => {
    if (!body.trim()) { toast.error("Preencha o corpo do template"); return; }
    setValidating(true); setResult(null); setSuggestions(null);
    try {
      const res = await callMetaRules({
        action: "validate", template_body: body, template_category: category,
        template_buttons: buttons, company_id: companyId,
      });
      setResult(res);
    } catch { toast.error("Erro ao validar"); }
    setValidating(false);
  };

  const handleSuggest = async () => {
    if (!body.trim()) { toast.error("Preencha o corpo do template"); return; }
    setSuggesting(true); setSuggestions(null);
    try {
      const res = await callMetaRules({
        action: "suggest", template_body: body, template_category: category, company_id: companyId,
      });
      setSuggestions(res);
    } catch { toast.error("Erro ao buscar sugestões"); }
    setSuggesting(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Validar Template</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Nome do template (opcional)" value={templateName} onChange={e => setTemplateName(e.target.value)} />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="MARKETING">Marketing</SelectItem>
              <SelectItem value="UTILITY">Utility</SelectItem>
              <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
            </SelectContent>
          </Select>
          <div>
            <Textarea placeholder='Olá {{1}}! Aqui é o {{2}} da empresa...' className="min-h-[120px]"
              value={body} onChange={e => setBody(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Use {"{{1}}"}, {"{{2}}"}, {"{{3}}"} para variáveis personalizáveis</p>
          </div>

          {/* Buttons */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Botões</span>
              <Button variant="outline" size="sm" onClick={() => setButtons([...buttons, { type: "QUICK_REPLY", text: "" }])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
              </Button>
            </div>
            {buttons.map((btn, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Select value={btn.type} onValueChange={v => {
                  const nb = [...buttons]; nb[i] = { ...nb[i], type: v }; setButtons(nb);
                }}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="QUICK_REPLY">Quick Reply</SelectItem>
                    <SelectItem value="URL">URL</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Texto do botão" value={btn.text} className="flex-1"
                  onChange={e => { const nb = [...buttons]; nb[i] = { ...nb[i], text: e.target.value }; setButtons(nb); }} />
                <Button variant="ghost" size="icon" onClick={() => setButtons(buttons.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleValidate} disabled={validating} className="flex-1">
              {validating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
              Validar Template
            </Button>
            <Button onClick={handleSuggest} disabled={suggesting} variant="outline" className="flex-1">
              {suggesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Sugestões IA
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Validation Result */}
      {result && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-4">
              <CircularScore score={result.score ?? 0} size={80} />
              <div>
                <Badge className={result.approved ? "bg-green-100 text-green-800 hover:bg-green-200 text-sm" : "bg-red-100 text-red-800 hover:bg-red-200 text-sm"}>
                  {result.approved ? "APROVADO" : "REPROVADO"}
                </Badge>
                {result.suggested_category && result.suggested_category !== category && (
                  <p className="text-xs text-muted-foreground mt-1">Categoria sugerida: <strong>{result.suggested_category}</strong></p>
                )}
              </div>
            </div>

            {result.violations?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-red-700 flex items-center gap-1"><XCircle className="h-4 w-4" /> Violações</h4>
                {result.violations.map((v: any, i: number) => (
                  <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                    <span className="font-medium text-red-800">{v.rule_key}</span>
                    <p className="text-red-700 text-xs">{v.message}</p>
                  </div>
                ))}
              </div>
            )}

            {result.warnings?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-yellow-700 flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Avisos</h4>
                {result.warnings.map((w: any, i: number) => (
                  <div key={i} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">{w}</div>
                ))}
              </div>
            )}

            {result.suggestions?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-blue-700 flex items-center gap-1"><Lightbulb className="h-4 w-4" /> Sugestões</h4>
                {result.suggestions.map((s: any, i: number) => (
                  <div key={i} className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">{s}</div>
                ))}
              </div>
            )}

            {result.improved_body && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-semibold text-green-800">Versão Melhorada</h4>
                <p className="text-sm text-green-900 whitespace-pre-wrap">{result.improved_body}</p>
                <Button size="sm" variant="outline" onClick={() => { setBody(result.improved_body); toast.success("Template atualizado"); }}>
                  Usar esta versão
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* AI Suggestions */}
      {suggestions && (
        <div className="space-y-4">
          {suggestions.analysis && (
            <Card><CardContent className="pt-6 text-sm text-muted-foreground">{suggestions.analysis}</CardContent></Card>
          )}
          {(suggestions.suggestions || []).map((s: any, i: number) => (
            <Card key={i} className="border-blue-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Sugestão {i + 1}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-lg p-3">{s.body}</p>
                {s.buttons?.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {s.buttons.map((b: any, j: number) => (
                      <Badge key={j} variant="outline" className="text-xs">{b.text || b}</Badge>
                    ))}
                  </div>
                )}
                {s.reason && <p className="text-xs text-muted-foreground">{s.reason}</p>}
                <Button size="sm" variant="outline" onClick={() => { setBody(s.body); toast.success("Template atualizado"); }}>
                  Usar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════ TAB 3: LGPD ═══════════════════
function TabLGPD({ companyId }: { companyId: string | null }) {
  const [lgpdRules, setLgpdRules] = useState<any[]>([]);
  const [optIns, setOptIns] = useState<any[]>([]);
  const [optOuts, setOptOuts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [rulesRes, optInRes, optOutRes] = await Promise.all([
        callMetaRules({ action: "list", category: "lgpd" }).catch(() => ({ rules: [] })),
        supabase.from("whatsapp_meta_opt_ins").select("phone_number, contact_name, opt_in_source, opt_in_proof_type, opt_in_at")
          .eq("company_id", companyId!).order("opt_in_at", { ascending: false }).limit(20),
        supabase.from("whatsapp_meta_opt_ins").select("phone_number, opt_out_at, opt_out_reason")
          .eq("company_id", companyId!).eq("status", "opted_out").order("opt_out_at", { ascending: false }).limit(10),
      ]);
      setLgpdRules(rulesRes?.rules || rulesRes?.grouped?.lgpd || []);
      setOptIns(optInRes.data || []);
      setOptOuts(optOutRes.data || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const cards = [
    { title: "DPO", desc: "Nomear encarregado de dados", icon: "🛡️" },
    { title: "Opt-ins Ativos", desc: `${optIns.length} registros recentes`, icon: "✅" },
    { title: "Retenção", desc: "Política de retenção de dados", icon: "📦" },
    { title: "Direitos", desc: "Canal de acesso/exclusão", icon: "🔐" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map(c => (
          <Card key={c.title}>
            <CardContent className="py-4 text-center space-y-1">
              <span className="text-2xl">{c.icon}</span>
              <p className="text-sm font-semibold">{c.title}</p>
              <p className="text-xs text-muted-foreground">{c.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* LGPD Rules */}
      {lgpdRules.length > 0 && (
        <Accordion type="multiple" className="space-y-2">
          {lgpdRules.map((rule: any, i: number) => (
            <AccordionItem key={i} value={`lgpd-${i}`} className="border rounded-lg px-1">
              <AccordionTrigger className="hover:no-underline px-3 text-sm">
                <span className="flex items-center gap-2">
                  <SeverityBadge severity={rule.severity} />
                  {rule.title}
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3 text-sm text-muted-foreground">
                {rule.description}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Opt-in Audit */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Opt-in Audit (últimos 20)</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 pr-3">Telefone</th>
                  <th className="text-left py-2 pr-3">Nome</th>
                  <th className="text-left py-2 pr-3">Origem</th>
                  <th className="text-left py-2 pr-3">Prova</th>
                  <th className="text-left py-2">Data</th>
                </tr>
              </thead>
              <tbody>
                {optIns.map((o, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-mono">{o.phone_number}</td>
                    <td className="py-2 pr-3">{o.contact_name || "—"}</td>
                    <td className="py-2 pr-3"><Badge variant="outline" className="text-[9px]">{o.opt_in_source || "—"}</Badge></td>
                    <td className="py-2 pr-3">{o.opt_in_proof_type || "—"}</td>
                    <td className="py-2 text-muted-foreground">{o.opt_in_at ? new Date(o.opt_in_at).toLocaleDateString("pt-BR") : "—"}</td>
                  </tr>
                ))}
                {optIns.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">Nenhum opt-in encontrado</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Opt-outs */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Opt-outs Recentes</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 pr-3">Telefone</th>
                  <th className="text-left py-2 pr-3">Data</th>
                  <th className="text-left py-2">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {optOuts.map((o, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-mono">{o.phone_number}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{o.opt_out_at ? new Date(o.opt_out_at).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="py-2">{o.opt_out_reason || "—"}</td>
                  </tr>
                ))}
                {optOuts.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-muted-foreground">Nenhum opt-out</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════ MAIN ═══════════════════
export default function MetaRules() {
  const companyId = useCompanyId();

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        <PageHeader title="Regras Meta WhatsApp" subtitle="Central de Compliance e Validação de Templates" />
        <Tabs defaultValue="regras">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="regras">📋 Regras</TabsTrigger>
            <TabsTrigger value="validar">✅ Validar Template</TabsTrigger>
            <TabsTrigger value="lgpd">🔒 LGPD</TabsTrigger>
          </TabsList>
          <TabsContent value="regras"><TabRegras companyId={companyId} /></TabsContent>
          <TabsContent value="validar"><TabValidar companyId={companyId} /></TabsContent>
          <TabsContent value="lgpd"><TabLGPD companyId={companyId} /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
