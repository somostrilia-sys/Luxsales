import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useDispatch } from "@/contexts/DispatchContext";
import { EDGE_BASE } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  MessageSquare, Send, Phone, Search, Loader2, Clock, CircleDot,
  ArrowLeft, Smile, Meh, Frown, Sparkles, RotateCcw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LeadLifecycle {
  stage: string;
  window_open: boolean;
  window_expires_at: string | null;
  last_inbound_at: string | null;
  last_template_sent_at: string | null;
  sentiment: string | null;
  conversation_summary: string | null;
  messages_sent: number;
  messages_received: number;
}

interface Lead {
  phone_number: string;
  lead_name: string;
  status: string;
  lead_whatsapp_lifecycle: LeadLifecycle;
}

interface Template {
  name: string;
  body: string;
  score?: number;
  response_rate?: number;
}

const stageLabels: Record<string, string> = {
  opted_in: "Opt-in",
  first_contact: "1º Contato",
  engaged: "Engajado",
  proposal_sent: "Proposta Enviada",
  negotiating: "Negociando",
};

const sentimentConfig: Record<string, { icon: any; color: string; label: string }> = {
  positive: { icon: Smile, color: "text-green-400", label: "Positivo" },
  neutral: { icon: Meh, color: "text-yellow-400", label: "Neutro" },
  negative: { icon: Frown, color: "text-red-400", label: "Negativo" },
  interested: { icon: Sparkles, color: "text-blue-400", label: "Interessado" },
};

export default function MyLeads() {
  const { collaborator } = useCollaborator();
  const { permission } = useDispatch();
  const navigate = useNavigate();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [windowFilter, setWindowFilter] = useState("all");
  const [templateModal, setTemplateModal] = useState<Lead | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState<string | null>(null);

  const fetchLeads = async () => {
    if (!collaborator) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${EDGE_BASE}/lead-distributor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: "list-my-leads",
          company_id: collaborator.company_id,
          collaborator_id: collaborator.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setLeads(data.leads || []);
      } else {
        toast.error(data.error || "Erro ao buscar leads");
      }
    } catch {
      toast.error("Erro de conexão");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLeads();
  }, [collaborator]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchSearch =
        !search ||
        lead.lead_name?.toLowerCase().includes(search.toLowerCase()) ||
        lead.phone_number?.includes(search);
      const matchStage =
        stageFilter === "all" || lead.lead_whatsapp_lifecycle?.stage === stageFilter;
      const matchWindow =
        windowFilter === "all" ||
        (windowFilter === "open" && lead.lead_whatsapp_lifecycle?.window_open) ||
        (windowFilter === "closed" && !lead.lead_whatsapp_lifecycle?.window_open);
      return matchSearch && matchStage && matchWindow;
    });
  }, [leads, search, stageFilter, windowFilter]);

  const openTemplateModal = async (lead: Lead) => {
    setTemplateModal(lead);
    setTemplatesLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${EDGE_BASE}/template-intelligence`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: "list-approved",
          company_id: collaborator?.company_id,
          collaborator_id: collaborator?.id,
        }),
      });
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch {
      toast.error("Erro ao buscar templates");
    }
    setTemplatesLoading(false);
  };

  const sendTemplate = async (templateName: string) => {
    if (!templateModal || !collaborator) return;
    setSendingTemplate(templateName);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${EDGE_BASE}/smart-dispatcher`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: "send",
          company_id: collaborator.company_id,
          collaborator_id: collaborator.id,
          phone_number: templateModal.phone_number,
          template_name: templateName,
          template_params: { body_params: [templateModal.lead_name] },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Template enviado com sucesso!");
        setTemplateModal(null);
        fetchLeads();
      } else {
        toast.error(data.error || "Erro ao enviar template");
      }
    } catch {
      toast.error("Erro de conexão");
    }
    setSendingTemplate(null);
  };

  const requestCall = async (lead: Lead) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${EDGE_BASE}/lead-distributor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: "return",
          company_id: collaborator?.company_id,
          collaborator_id: collaborator?.id,
          phone_number: lead.phone_number,
          reason: "Solicitar ligação",
        }),
      });
      if (res.ok) {
        toast.success("Ligação solicitada!");
        fetchLeads();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erro");
      }
    } catch {
      toast.error("Erro de conexão");
    }
  };

  const returnLead = async (lead: Lead) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${EDGE_BASE}/lead-distributor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: "return",
          company_id: collaborator?.company_id,
          collaborator_id: collaborator?.id,
          phone_number: lead.phone_number,
        }),
      });
      if (res.ok) {
        toast.success("Lead devolvido");
        fetchLeads();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erro");
      }
    } catch {
      toast.error("Erro de conexão");
    }
  };

  const getWindowInfo = (lc: LeadLifecycle) => {
    if (!lc) return { color: "text-muted-foreground", label: "Sem dados" };
    if (lc.window_open && lc.window_expires_at) {
      const expires = new Date(lc.window_expires_at);
      const hoursLeft = Math.max(0, Math.round((expires.getTime() - Date.now()) / 3600000));
      return { color: "text-green-400", label: `ABERTA (${hoursLeft}h restantes)` };
    }
    if (lc.last_inbound_at) {
      const last = new Date(lc.last_inbound_at);
      const daysSince = Math.round((Date.now() - last.getTime()) / 86400000);
      if (daysSince >= 3) return { color: "text-red-400", label: `Sem resposta há ${daysSince} dias` };
    }
    return { color: "text-yellow-400", label: "FECHADA (só template)" };
  };

  return (
    <DashboardLayout>
      <PageHeader title="Meus Leads" subtitle="Leads distribuídos para você" />

      {/* Counter */}
      <div className="flex items-center justify-between mb-4 px-1">
        <Badge variant="outline" className="text-sm px-3 py-1 border-primary/30">
          Disparos hoje: {permission?.dispatches_today ?? 0}/{permission?.daily_limit ?? 30}
        </Badge>
        <Button variant="ghost" size="sm" onClick={fetchLeads}>
          <RotateCcw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os stages</SelectItem>
            {Object.entries(stageLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={windowFilter} onValueChange={setWindowFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Janela" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="open">Aberta</SelectItem>
            <SelectItem value="closed">Fechada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Leads List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredLeads.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum lead encontrado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredLeads.map((lead) => {
            const lc = lead.lead_whatsapp_lifecycle;
            const windowInfo = getWindowInfo(lc);
            const sentimentInfo = lc?.sentiment ? sentimentConfig[lc.sentiment] : null;
            const SentimentIcon = sentimentInfo?.icon;

            return (
              <Card key={lead.phone_number} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {lead.lead_name || "Sem nome"} — {lead.phone_number}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                        {lc?.stage && (
                          <Badge variant="secondary" className="text-xs">
                            {stageLabels[lc.stage] || lc.stage}
                          </Badge>
                        )}
                        {sentimentInfo && SentimentIcon && (
                          <span className={`flex items-center gap-1 ${sentimentInfo.color}`}>
                            <SentimentIcon className="h-3.5 w-3.5" />
                            {sentimentInfo.label}
                          </span>
                        )}
                        {lc?.last_inbound_at && (
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Último contato:{" "}
                            {formatDistanceToNow(new Date(lc.last_inbound_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                    <CircleDot className={`h-4 w-4 shrink-0 ${windowInfo.color}`} />
                  </div>

                  {/* Window */}
                  <p className={`text-xs font-medium ${windowInfo.color}`}>
                    Janela: {windowInfo.label}
                  </p>

                  {/* Summary */}
                  {lc?.conversation_summary && (
                    <p className="text-sm text-muted-foreground bg-muted/30 p-2 rounded-lg">
                      "{lc.conversation_summary}"
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => navigate(`/conversations/${encodeURIComponent(lead.phone_number)}`)}
                    >
                      <MessageSquare className="h-3.5 w-3.5 mr-1" /> Conversar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openTemplateModal(lead)}
                    >
                      <Send className="h-3.5 w-3.5 mr-1" /> Enviar Template
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => requestCall(lead)}>
                      <Phone className="h-3.5 w-3.5 mr-1" /> Pedir Ligação
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive ml-auto"
                      onClick={() => returnLead(lead)}
                    >
                      <ArrowLeft className="h-3 w-3 mr-1" /> Devolver
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Template Modal */}
      <Dialog open={!!templateModal} onOpenChange={() => setTemplateModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar Template</DialogTitle>
            <DialogDescription>
              Para {templateModal?.lead_name} ({templateModal?.phone_number})
            </DialogDescription>
          </DialogHeader>
          {templatesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : templates.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Nenhum template aprovado.</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {templates.map((t) => (
                <Card key={t.name} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{t.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t.body?.replace(/\{\{1\}\}/g, templateModal?.lead_name || "Nome")}
                        </p>
                        {(t.score || t.response_rate) && (
                          <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                            {t.score && <span>Score: {t.score}</span>}
                            {t.response_rate && <span>Taxa de resposta: {(t.response_rate * 100).toFixed(0)}%</span>}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        disabled={sendingTemplate === t.name}
                        onClick={() => sendTemplate(t.name)}
                      >
                        {sendingTemplate === t.name ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Enviar"
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
