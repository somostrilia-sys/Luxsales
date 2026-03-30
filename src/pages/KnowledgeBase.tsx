import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Loader2, Save, Brain, MessageSquare, ShieldAlert, Target,
  Mic, BookOpen, Plus, X, Sparkles,
} from "lucide-react";

const FALLBACK_COMPANY_ID = "d33b6a84-8f72-4441-b2eb-dd151a31ac12";

interface Objection {
  trigger: string;
  response: string;
}

export default function KnowledgeBase() {
  const { collaborator } = useCollaborator();
  const { selectedCompanyId } = useCompanyFilter();
  const companyId = (selectedCompanyId && selectedCompanyId !== "all") ? selectedCompanyId : (collaborator?.company_id || FALLBACK_COMPANY_ID);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scriptId, setScriptId] = useState<string | null>(null);

  // Fields
  const [knowledgeBase, setKnowledgeBase] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [personality, setPersonality] = useState("");
  const [tone, setTone] = useState("");
  const [forbiddenWords, setForbiddenWords] = useState<string[]>([]);
  const [forbiddenInput, setForbiddenInput] = useState("");
  const [objections, setObjections] = useState<Objection[]>([]);
  const [salesTechniques, setSalesTechniques] = useState("");
  const [qualificationCriteria, setQualificationCriteria] = useState("");
  const [openingMessage, setOpeningMessage] = useState("");
  const [closingMessage, setClosingMessage] = useState("");

  const loadScript = useCallback(async () => {
    setLoading(true);
    // Try to find a script with knowledge_base first, then fall back to most recent
    let { data } = await supabase
      .from("ai_call_scripts")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .not("knowledge_base", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fallback: get any active script for company
    if (!data) {
      ({ data } = await supabase
        .from("ai_call_scripts")
        .select("*")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle());
    }

    if (data) {
      setScriptId(data.id);
      setKnowledgeBase(data.knowledge_base || "");
      setSystemPrompt(data.system_prompt || "");
      setPersonality(data.personality || "");
      setTone(data.tone || "");
      setForbiddenWords(data.forbidden_words || []);
      setSalesTechniques(data.sales_techniques || "");
      setOpeningMessage(data.opening_message || "");
      setClosingMessage(data.closing_message || "");

      // Parse objections
      const handlers = data.objection_handlers || {};
      setObjections(Object.entries(handlers).map(([trigger, response]) => ({
        trigger,
        response: response as string,
      })));

      // Parse qualification
      const qc = data.qualification_criteria;
      if (qc && typeof qc === "object" && qc.criteria) {
        setQualificationCriteria((qc.criteria as string[]).join("\n"));
      } else if (typeof qc === "string") {
        setQualificationCriteria(qc);
      }
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => { loadScript(); }, [loadScript]);

  const handleSave = async () => {
    setSaving(true);

    const objectionHandlers: Record<string, string> = {};
    objections.forEach(o => { if (o.trigger.trim()) objectionHandlers[o.trigger.trim()] = o.response; });

    const payload: Record<string, any> = {
      company_id: companyId,
      knowledge_base: knowledgeBase,
      system_prompt: systemPrompt,
      personality,
      tone,
      forbidden_words: forbiddenWords,
      objection_handlers: objectionHandlers,
      sales_techniques: salesTechniques,
      opening_message: openingMessage,
      closing_message: closingMessage,
      qualification_criteria: {
        criteria: qualificationCriteria.split("\n").filter(l => l.trim()),
        min_score: 3,
      },
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (scriptId) {
      ({ error } = await supabase.from("ai_call_scripts").update(payload).eq("id", scriptId));
    } else {
      payload.name = "Script Principal";
      payload.description = "Script de vendas configurado via Base de Conhecimento";
      payload.script_type = "outbound";
      ({ error } = await supabase.from("ai_call_scripts").insert(payload));
    }

    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Base de conhecimento salva");
      loadScript();
    }
    setSaving(false);
  };

  const addForbidden = () => {
    const w = forbiddenInput.trim();
    if (w && !forbiddenWords.includes(w)) setForbiddenWords([...forbiddenWords, w]);
    setForbiddenInput("");
  };

  const addObjection = () => setObjections([...objections, { trigger: "", response: "" }]);
  const updateObjection = (idx: number, field: "trigger" | "response", val: string) => {
    setObjections(prev => prev.map((o, i) => i === idx ? { ...o, [field]: val } : o));
  };
  const removeObjection = (idx: number) => setObjections(prev => prev.filter((_, i) => i !== idx));

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
      <PageHeader
        title="Base de Conhecimento"
        subtitle="Configure o contexto e comportamento do Lucas para vendas"
      />

      <Tabs defaultValue="context" className="space-y-4">
        <TabsList>
          <TabsTrigger value="context" className="gap-1.5"><Brain className="h-3.5 w-3.5" /> Contexto</TabsTrigger>
          <TabsTrigger value="scripts" className="gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Scripts</TabsTrigger>
          <TabsTrigger value="objections" className="gap-1.5"><ShieldAlert className="h-3.5 w-3.5" /> Objeções</TabsTrigger>
          <TabsTrigger value="sales" className="gap-1.5"><Target className="h-3.5 w-3.5" /> Vendas</TabsTrigger>
        </TabsList>

        {/* CONTEXTO */}
        <TabsContent value="context" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BookOpen className="h-4 w-4" /> Base de Conhecimento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Tudo que o Lucas precisa saber sobre seu produto/serviço. Quanto mais detalhado, melhor ele vende.
              </p>
              <Textarea
                value={knowledgeBase}
                onChange={(e) => setKnowledgeBase(e.target.value)}
                placeholder={`Ex:\n- Proteção veicular com cobertura nacional\n- Sem análise de perfil ou consulta SPC/Serasa\n- Planos a partir de R$89/mês\n- Assistência 24h em todo Brasil\n- Cobre roubo, furto, colisão, incêndio, enchente\n- Diferente de seguro: sem burocracia, aprovação imediata\n- 15 anos no mercado, 50 mil associados`}
                rows={10}
              />
              <p className="text-xs text-muted-foreground text-right">{knowledgeBase.length} caracteres</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Prompt do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Instrução principal que define quem é o Lucas e como ele deve se comportar.
              </p>
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Você é Lucas, vendedor IA da Objetivo Proteção Veicular. Seu objetivo é qualificar o lead, entender suas necessidades e agendar uma reunião com um consultor humano."
                rows={4}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Mic className="h-4 w-4" /> Personalidade
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  placeholder="Simpático, confiante, direto ao ponto. Fala como mineiro. Usa humor leve quando apropriado."
                  rows={3}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Tom de Voz</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  placeholder="Ex: Natural e confiante, semi-formal"
                />
                <div className="space-y-2">
                  <Label className="text-xs">Palavras proibidas</Label>
                  <div className="flex gap-2">
                    <Input
                      value={forbiddenInput}
                      onChange={(e) => setForbiddenInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addForbidden(); } }}
                      placeholder="Ex: seguro, apólice"
                      className="flex-1"
                    />
                    <Button variant="outline" size="sm" onClick={addForbidden} disabled={!forbiddenInput.trim()}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {forbiddenWords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {forbiddenWords.map(w => (
                        <Badge key={w} variant="destructive" className="gap-1 pr-1 text-xs">
                          {w}
                          <button onClick={() => setForbiddenWords(forbiddenWords.filter(x => x !== w))} className="hover:text-white">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* SCRIPTS */}
        <TabsContent value="scripts" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Abertura da Ligação</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={openingMessage}
                onChange={(e) => setOpeningMessage(e.target.value)}
                placeholder="Olá! Aqui é o Lucas da Objetivo Proteção Veicular. Tudo bem? Estou ligando porque vi que você demonstrou interesse em proteção para seu veículo."
                rows={3}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Fechamento</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={closingMessage}
                onChange={(e) => setClosingMessage(e.target.value)}
                placeholder="Perfeito! Vou agendar uma conversa com nosso consultor para finalizar os detalhes. Muito obrigado pela atenção!"
                rows={3}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* OBJEÇÕES */}
        <TabsContent value="objections" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" /> Objeções e Respostas
                </CardTitle>
                <Button variant="outline" size="sm" onClick={addObjection} className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Quando o lead falar algo parecido com o gatilho, o Lucas responde com a resposta configurada.
              </p>
              {objections.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma objeção configurada</p>
              ) : (
                objections.map((o, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start">
                    <div>
                      <Label className="text-xs text-muted-foreground">Gatilho</Label>
                      <Input
                        value={o.trigger}
                        onChange={(e) => updateObjection(idx, "trigger", e.target.value)}
                        placeholder="Ex: não tenho interesse"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Resposta</Label>
                      <Input
                        value={o.response}
                        onChange={(e) => updateObjection(idx, "response", e.target.value)}
                        placeholder="Ex: Sem problemas! Em 30 segundos explico..."
                      />
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeObjection(idx)} className="mt-5">
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* VENDAS */}
        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4" /> Técnicas de Venda
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={salesTechniques}
                onChange={(e) => setSalesTechniques(e.target.value)}
                placeholder={`Ex:\n- Usar escassez: "Essa condição é por tempo limitado"\n- Usar prova social: "Temos 50 mil associados"\n- Perguntas abertas: "Qual veículo você tem?"\n- Ancoragem de preço: mencionar valor cheio antes do desconto`}
                rows={6}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Critérios de Qualificação</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-2">Um critério por linha. O lead precisa atender pelo menos 3 para ser qualificado.</p>
              <Textarea
                value={qualificationCriteria}
                onChange={(e) => setQualificationCriteria(e.target.value)}
                placeholder={`tem_necessidade\ntem_budget\ntem_autoridade\ntem_urgencia`}
                rows={4}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end mt-6">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Base de Conhecimento
        </Button>
      </div>
    </DashboardLayout>
  );
}
