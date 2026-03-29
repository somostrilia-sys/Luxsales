import { useState, useEffect, useCallback } from "react";
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
  AlertTriangle, Users, Send, History,
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

export default function Templates() {
  const { collaborator } = useCollaborator();
  const { selectedCompanyId } = useCompanyFilter();
  const effectiveCompanyId = (selectedCompanyId && selectedCompanyId !== "all") ? selectedCompanyId : collaborator?.company_id;  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("approved");

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

  // Rejection history
  const [rejections, setRejections] = useState<Rejection[]>([]);
  const [rejectionsLoading, setRejectionsLoading] = useState(false);

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

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    if (tab === "pending") fetchRejections();
  }, [tab, fetchRejections]);

  const approved = templates.filter((t) => t.status === "APPROVED" && (!search || t.name.toLowerCase().includes(search.toLowerCase())));
  const pending = templates.filter((t) => (t.status === "PENDING" || t.status === "REJECTED") && (!search || t.name.toLowerCase().includes(search.toLowerCase())));

  const handleGenerate = async () => {
    if (!objective.trim()) return;
    setGenerating(true);
    setGenerated([]);
    try {
      const res = await fetch("https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/generate-template", {
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
        setGenerated(data.templates || []);
      } else {
        toast.error(data.error || "Erro ao gerar");
      }
    } catch {
      toast.error("Erro de conexão");
    }
    setGenerating(false);
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
    const { data } = await supabase
      .from("dispatch_permissions")
      .select("id, collaborator_id, role")
      .eq("active", true);
    setSellers((data || []).map((d: any) => ({
      id: d.collaborator_id,
      name: d.collaborator_id.slice(0, 8) + "...",
      role: d.role,
    })));
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

  const TemplateCard = ({ t, showAssign }: { t: Template; showAssign?: boolean }) => {
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
          {showAssign && (
            <Button size="sm" variant="outline" onClick={() => openAssignModal(t)} className="mt-2">
              <Users className="h-3.5 w-3.5 mr-1" /> Atribuir a vendedores
            </Button>
          )}
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
            <TabsTrigger value="pending">Pendentes</TabsTrigger>
            <TabsTrigger value="create">Criar Novo</TabsTrigger>
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
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : approved.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum template aprovado.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {approved.map((t) => <TemplateCard key={t.name} t={t} showAssign />)}
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
              {pending.map((t) => <TemplateCard key={t.name} t={t} />)}
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

        {/* CREATE TAB */}
        <TabsContent value="create" className="space-y-6">
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
                return (
                  <Card key={idx} className="hover:border-primary/30 transition-colors">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm">{g.name}</CardTitle>
                        <div className="flex gap-1">
                          {g.category && (
                            <Badge variant="outline" className={`text-xs ${catColor}`}>
                              {g.category.toUpperCase()}
                            </Badge>
                          )}
                          {sb && <Badge variant="outline" className={`text-xs ${sb.color}`}>{sb.label}</Badge>}
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
                        <Button size="sm" disabled={submitting === g.name} onClick={() => handleSubmitTemplate(g)}>
                          {submitting === g.name ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                          Submeter à Meta
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
