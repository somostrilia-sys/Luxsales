import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Zap, Users, Send, MessageCircle, TrendingUp, Loader2,
  Play, Pause, FlaskConical, ChevronDown, ChevronUp, Settings2,
} from "lucide-react";

interface ConsultantPoolStatus {
  collaborator_id: string;
  name: string;
  company: string;
  pending: number;
  sent: number;
  responded: number;
  converted: number;
  active_job_id?: string;
  job_status?: string;
}

interface PendingLead {
  id: string;
  name: string | null;
  phone: string;
  city: string | null;
  source: string | null;
  status: string;
}

interface StatusSummary {
  total_consultants: number;
  total_assigned: number;
  total_sent: number;
  total_responded: number;
  pending?: number;
  sent?: number;
  responded?: number;
  converted?: number;
}

interface TestResult {
  phone: string;
  status: string;
  error?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://ecaduzwautlpzpvjognr.supabase.co";

async function getAuthHeaders() {
  const session = (await supabase.auth.getSession()).data.session;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token}`,
  };
}

async function callBlastEngine(body: Record<string, unknown>) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/blast-engine`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro na API");
  return data;
}

// ─── Global campaign config state (shared across modals)
interface CampaignConfig {
  messageTemplate: string;
  dddFilter: string;
  campaignTag: string;
  leadsPerConsultant: string;
  dailyLimit: string;
}

export default function MotorDisparo() {
  const { collaborator, roleLevel } = useCollaborator();
  const isCeoOrDirector = roleLevel <= 1;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Zap className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Motor de Disparo</h1>
        </div>
        {isCeoOrDirector ? (
          <CeoView />
        ) : (
          <ConsultorView collaboratorId={collaborator?.id || ""} />
        )}
      </div>
    </DashboardLayout>
  );
}

// ═══════════════════════════════════════════
// CEO / DIRETORES VIEW
// ═══════════════════════════════════════════

function CeoView() {
  const [status, setStatus] = useState<StatusSummary | null>(null);
  const [consultants, setConsultants] = useState<ConsultantPoolStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [configOpen, setConfigOpen] = useState(true);

  // Campaign config
  const [campaign, setCampaign] = useState<CampaignConfig>({
    messageTemplate: "Oi {nome}, tudo bem? Sou consultor de proteção veicular e gostaria de apresentar uma solução para o seu veículo. Posso te enviar mais informações?",
    dddFilter: "",
    campaignTag: "campanha-marco-2026",
    leadsPerConsultant: "500",
    dailyLimit: "100",
  });

  // Modals
  const [assignOpen, setAssignOpen] = useState(false);
  const [distributeOpen, setDistributeOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [selectedConsultant, setSelectedConsultant] = useState<ConsultantPoolStatus | null>(null);

  const [allCollaborators, setAllCollaborators] = useState<{ id: string; name: string }[]>([]);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/lead-pool`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "status" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao buscar status");
      setStatus(data.summary || { total_consultants: 0, total_assigned: 0, total_sent: 0, total_responded: 0 });
      setConsultants(data.consultants || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    supabase.from("collaborators").select("id, name").eq("active", true).then(({ data }) => {
      if (data) setAllCollaborators(data as any);
    });
  }, [fetchStatus]);

  const handleDistributeAll = async () => {
    if (!campaign.messageTemplate.trim()) {
      toast.error("Preencha a mensagem da campanha antes de distribuir");
      setConfigOpen(true);
      return;
    }
    setDistributeOpen(true);
  };

  const handleStartJob = async (c: ConsultantPoolStatus) => {
    if (c.job_status === "running") {
      // Pause
      try {
        await callBlastEngine({ action: "pause", job_id: c.active_job_id });
        toast.success("Disparo pausado");
        fetchStatus();
      } catch (e: any) { toast.error(e.message); }
    } else if (c.active_job_id) {
      // Resume/start existing job
      try {
        await callBlastEngine({ action: "start", job_id: c.active_job_id });
        toast.success("Disparo iniciado!");
        fetchStatus();
      } catch (e: any) { toast.error(e.message); }
    } else {
      // No job yet — auto-create with campaign config
      if (!campaign.messageTemplate.trim()) {
        toast.error("Configure a mensagem da campanha antes de iniciar");
        setConfigOpen(true);
        return;
      }
      try {
        const data = await callBlastEngine({
          action: "assign_one",
          collaborator_id: c.collaborator_id,
          ddd: campaign.dddFilter || undefined,
          count: parseInt(campaign.leadsPerConsultant) || 500,
          campaign_tag: campaign.campaignTag,
          message_template: campaign.messageTemplate,
          daily_limit: parseInt(campaign.dailyLimit) || 100,
          auto_start: true,
        });
        toast.success(`${data.assigned || 0} leads atribuídos — disparo iniciado!`);
        fetchStatus();
      } catch (e: any) { toast.error(e.message); }
    }
  };

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={<Users className="h-5 w-5" />} label="Consultores c/ Pool" value={status?.total_consultants ?? 0} />
        <SummaryCard icon={<TrendingUp className="h-5 w-5" />} label="Leads Atribuídos" value={status?.total_assigned ?? 0} />
        <SummaryCard icon={<Send className="h-5 w-5" />} label="Enviados" value={status?.total_sent ?? 0} />
        <SummaryCard icon={<MessageCircle className="h-5 w-5" />} label="Responderam" value={status?.total_responded ?? 0} />
      </div>

      {/* Campaign Config */}
      <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-muted/30 rounded-t-lg transition-colors">
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Configurar Campanha</CardTitle>
              </div>
              {configOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-5">
              <div className="space-y-4">
                <div>
                  <Label>Mensagem <span className="text-muted-foreground text-xs ml-1">use {"{nome}"} para personalizar</span></Label>
                  <Textarea
                    rows={3}
                    placeholder="Oi {nome}, tudo bem? Sou consultor de proteção veicular..."
                    value={campaign.messageTemplate}
                    onChange={(e) => setCampaign(p => ({ ...p, messageTemplate: e.target.value }))}
                    className="mt-1 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label>DDD filtro</Label>
                    <Input placeholder="Ex: 31" value={campaign.dddFilter} onChange={(e) => setCampaign(p => ({ ...p, dddFilter: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Tag campanha</Label>
                    <Input placeholder="campanha-marco-2026" value={campaign.campaignTag} onChange={(e) => setCampaign(p => ({ ...p, campaignTag: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Qtd por consultor</Label>
                    <Input type="number" value={campaign.leadsPerConsultant} onChange={(e) => setCampaign(p => ({ ...p, leadsPerConsultant: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Limite diário</Label>
                    <Input type="number" value={campaign.dailyLimit} onChange={(e) => setCampaign(p => ({ ...p, dailyLimit: e.target.value }))} />
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Consultants Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Consultores com Pool</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => fetchStatus()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
            </Button>
            <Button size="sm" onClick={handleDistributeAll}>
              <Zap className="h-4 w-4 mr-1" /> Distribuir para Todos
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead className="text-center">Pendentes</TableHead>
                <TableHead className="text-center">Enviados</TableHead>
                <TableHead className="text-center">Responderam</TableHead>
                <TableHead className="text-center">Convertidos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consultants.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum consultor com pool
                  </TableCell>
                </TableRow>
              ) : (
                consultants.map((c) => (
                  <ConsultantRow
                    key={c.collaborator_id}
                    consultant={c}
                    onAssign={() => { setSelectedConsultant(c); setAssignOpen(true); }}
                    onTest={() => { setSelectedConsultant(c); setTestOpen(true); }}
                    onStartPause={() => handleStartJob(c)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Assign Modal */}
      <AssignModal
        open={assignOpen}
        onClose={() => { setAssignOpen(false); setSelectedConsultant(null); }}
        consultant={selectedConsultant}
        campaign={campaign}
        onSuccess={fetchStatus}
      />

      {/* Test Modal */}
      <TestModal
        open={testOpen}
        onClose={() => { setTestOpen(false); setSelectedConsultant(null); }}
        consultant={selectedConsultant}
        defaultMessage={campaign.messageTemplate}
      />

      {/* Distribute Modal */}
      <DistributeModal
        open={distributeOpen}
        onClose={() => setDistributeOpen(false)}
        campaign={campaign}
        onSuccess={fetchStatus}
      />
    </>
  );
}

// Row component to keep state per row (loading)
function ConsultantRow({
  consultant: c, onAssign, onTest, onStartPause,
}: {
  consultant: ConsultantPoolStatus;
  onAssign: () => void;
  onTest: () => void;
  onStartPause: () => void;
}) {
  const [startLoading, setStartLoading] = useState(false);
  const isRunning = c.job_status === "running";

  const handleStartPause = async () => {
    setStartLoading(true);
    await onStartPause();
    setStartLoading(false);
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{c.name}</TableCell>
      <TableCell className="text-muted-foreground text-sm">{c.company}</TableCell>
      <TableCell className="text-center"><Badge variant="secondary">{c.pending}</Badge></TableCell>
      <TableCell className="text-center">{c.sent}</TableCell>
      <TableCell className="text-center">{c.responded}</TableCell>
      <TableCell className="text-center">{c.converted}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {/* Atribuir */}
          <Button size="icon" variant="outline" title="Atribuir leads" onClick={onAssign} className="h-8 w-8">
            <Users className="h-3.5 w-3.5" />
          </Button>
          {/* Testar */}
          <Button size="icon" variant="outline" title="Testar disparo" onClick={onTest} className="h-8 w-8">
            <FlaskConical className="h-3.5 w-3.5" />
          </Button>
          {/* Iniciar / Pausar */}
          <Button
            size="icon"
            variant={isRunning ? "secondary" : "default"}
            title={isRunning ? "Pausar disparo" : "Iniciar disparo"}
            onClick={handleStartPause}
            disabled={startLoading}
            className="h-8 w-8"
          >
            {startLoading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : isRunning
                ? <Pause className="h-3.5 w-3.5" />
                : <Play className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ═══════════════════════════════════════════
// CONSULTOR VIEW
// ═══════════════════════════════════════════

function ConsultorView({ collaboratorId }: { collaboratorId: string }) {
  const [status, setStatus] = useState<StatusSummary | null>(null);
  const [leads, setLeads] = useState<PendingLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [blasting, setBlasting] = useState(false);
  const [testOpen, setTestOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!collaboratorId) return;
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const [statusRes, leadsRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/functions/v1/lead-pool`, {
          method: "POST", headers,
          body: JSON.stringify({ action: "status", collaborator_id: collaboratorId }),
        }),
        fetch(`${SUPABASE_URL}/functions/v1/lead-pool`, {
          method: "POST", headers,
          body: JSON.stringify({ action: "list_pending", collaborator_id: collaboratorId, limit: 50 }),
        }),
      ]);
      const statusData = await statusRes.json();
      const leadsData = await leadsRes.json();
      setStatus(statusData.summary || statusData);
      setLeads(leadsData.leads || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [collaboratorId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStartBlast = async () => {
    setBlasting(true);
    try {
      const data = await callBlastEngine({ action: "status", collaborator_id: collaboratorId });
      const jobId = data.jobs?.[0]?.id;
      if (!jobId) {
        toast.error("Nenhum job encontrado. Aguarde o gestor atribuir leads.");
        return;
      }
      await callBlastEngine({ action: "start", job_id: jobId });
      toast.success("Disparo iniciado!");
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBlasting(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={<TrendingUp className="h-5 w-5" />} label="Pendentes" value={status?.pending ?? 0} />
        <SummaryCard icon={<Send className="h-5 w-5" />} label="Enviados" value={status?.sent ?? 0} />
        <SummaryCard icon={<MessageCircle className="h-5 w-5" />} label="Responderam" value={status?.responded ?? 0} />
        <SummaryCard icon={<Zap className="h-5 w-5" />} label="Convertidos" value={status?.converted ?? 0} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Leads Pendentes</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={fetchData} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setTestOpen(true)}>
              <FlaskConical className="h-4 w-4 mr-1" /> Testar
            </Button>
            <Button size="sm" onClick={handleStartBlast} disabled={blasting || leads.length === 0}>
              {blasting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
              Iniciar Disparo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum lead pendente
                  </TableCell>
                </TableRow>
              ) : (
                leads.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.name || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{l.phone}</TableCell>
                    <TableCell>{l.city || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{l.source || "—"}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{l.status}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TestModal
        open={testOpen}
        onClose={() => setTestOpen(false)}
        consultant={{ collaborator_id: collaboratorId, name: "Você", company: "", pending: 0, sent: 0, responded: 0, converted: 0 }}
        defaultMessage="Oi {nome}, tudo bem? Sou consultor de proteção veicular e gostaria de apresentar uma solução para o seu veículo. Posso te enviar mais informações?"
      />
    </>
  );
}

// ═══════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value.toLocaleString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════
// ASSIGN MODAL (atribuir leads a UM consultor)
// ═══════════════════════════════════════════

function AssignModal({
  open, onClose, consultant, campaign, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  consultant: ConsultantPoolStatus | null;
  campaign: CampaignConfig;
  onSuccess: () => void;
}) {
  const [ddd, setDdd] = useState(campaign.dddFilter);
  const [city, setCity] = useState("");
  const [count, setCount] = useState(campaign.leadsPerConsultant);
  const [campaignTag, setCampaignTag] = useState(campaign.campaignTag);
  const [autoStart, setAutoStart] = useState(false);
  const [messageTemplate, setMessageTemplate] = useState(campaign.messageTemplate);
  const [saving, setSaving] = useState(false);

  // Sync with campaign config when modal opens
  useEffect(() => {
    if (open) {
      setDdd(campaign.dddFilter);
      setCount(campaign.leadsPerConsultant);
      setCampaignTag(campaign.campaignTag);
      setMessageTemplate(campaign.messageTemplate);
    }
  }, [open, campaign]);

  const handleSubmit = async () => {
    if (!consultant) return;
    if (autoStart && !messageTemplate.trim()) {
      toast.error("Preencha a mensagem para auto-iniciar");
      return;
    }
    setSaving(true);
    try {
      const data = await callBlastEngine({
        action: "assign_one",
        collaborator_id: consultant.collaborator_id,
        ddd: ddd || undefined,
        city: city || undefined,
        count: parseInt(count) || 500,
        campaign_tag: campaignTag || "campanha-marco-2026",
        auto_start: autoStart,
        message_template: autoStart ? messageTemplate : undefined,
      });
      toast.success(`${data.assigned || 0} leads atribuídos a ${data.collaborator_name || consultant.name}${data.auto_started ? " — disparo iniciado!" : "!"}`);
      onClose();
      onSuccess();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atribuir Leads — {consultant?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>DDD</Label>
              <Input placeholder="Ex: 31" value={ddd} onChange={(e) => setDdd(e.target.value)} />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input placeholder="Ex: Belo Horizonte" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantidade</Label>
              <Input type="number" value={count} onChange={(e) => setCount(e.target.value)} />
            </div>
            <div>
              <Label>Tag Campanha</Label>
              <Input placeholder="campanha-marco-2026" value={campaignTag} onChange={(e) => setCampaignTag(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="auto-start"
              checked={autoStart}
              onCheckedChange={(v) => setAutoStart(!!v)}
            />
            <label htmlFor="auto-start" className="text-sm font-medium cursor-pointer">
              Auto-iniciar disparo após atribuir
            </label>
          </div>
          {autoStart && (
            <div>
              <Label>Mensagem <span className="text-muted-foreground text-xs ml-1">use {"{nome}"}</span></Label>
              <Textarea
                rows={3}
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                className="mt-1 resize-none"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Users className="h-4 w-4 mr-1" />}
            {autoStart ? "Atribuir e Iniciar" : "Atribuir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════
// TEST MODAL (testar disparo com 3-5 leads)
// ═══════════════════════════════════════════

function TestModal({
  open, onClose, consultant, defaultMessage,
}: {
  open: boolean;
  onClose: () => void;
  consultant: ConsultantPoolStatus | null;
  defaultMessage: string;
}) {
  const [messageTemplate, setMessageTemplate] = useState(defaultMessage);
  const [testCount, setTestCount] = useState("3");
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[] | null>(null);

  useEffect(() => {
    if (open) {
      setMessageTemplate(defaultMessage);
      setResults(null);
    }
  }, [open, defaultMessage]);

  const handleTest = async () => {
    if (!consultant) return;
    if (!messageTemplate.trim()) { toast.error("Preencha a mensagem"); return; }
    setTesting(true);
    setResults(null);
    try {
      const data = await callBlastEngine({
        action: "test_blast",
        collaborator_id: consultant.collaborator_id,
        message_template: messageTemplate,
        test_count: parseInt(testCount) || 3,
      });
      setResults(data.test_results || []);
      const sent = data.sent ?? 0;
      const total = data.total ?? 0;
      if (sent > 0) {
        toast.success(`${sent}/${total} mensagens enviadas com sucesso!`);
      } else {
        toast.error(data.error || "Nenhuma mensagem enviada");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setTesting(false);
    }
  };

  const sentCount = results?.filter(r => r.status === "sent").length ?? 0;
  const failCount = results?.filter(r => r.status !== "sent").length ?? 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Testar Disparo — {consultant?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Mensagem <span className="text-muted-foreground text-xs ml-1">use {"{nome}"}</span></Label>
            <Textarea
              rows={3}
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              className="mt-1 resize-none"
            />
          </div>
          <div className="w-32">
            <Label>Qtd. de teste (máx. 5)</Label>
            <Input
              type="number"
              min={1}
              max={5}
              value={testCount}
              onChange={(e) => setTestCount(e.target.value)}
            />
          </div>

          {/* Results */}
          {results && (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex gap-4 text-sm font-medium">
                <span className="text-green-500">✓ Enviados: {sentCount}</span>
                <span className="text-destructive">✗ Falhou: {failCount}</span>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {results.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{r.status === "sent" ? "✅" : "❌"}</span>
                    <span className="font-mono">{r.phone}</span>
                    {r.error && <span className="text-destructive">{r.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FlaskConical className="h-4 w-4 mr-1" />}
            {results ? "Testar Novamente" : "Enviar Teste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════
// DISTRIBUTE MODAL (todos os consultores)
// ═══════════════════════════════════════════

function DistributeModal({
  open, onClose, campaign, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  campaign: CampaignConfig;
  onSuccess: () => void;
}) {
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const data = await callBlastEngine({
        action: "distribute",
        message_template: campaign.messageTemplate,
        ddd_filter: campaign.dddFilter || undefined,
        campaign_tag: campaign.campaignTag || "campanha-marco-2026",
        leads_per_consultant: parseInt(campaign.leadsPerConsultant) || 500,
        daily_limit: parseInt(campaign.dailyLimit) || 100,
      });
      if (!data.ok) throw new Error(data.error || "Erro ao distribuir");
      toast.success(`${data.total_distributed || 0} leads distribuídos para ${data.consultants_reached || 0} consultores!`);
      onClose();
      onSuccess();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirmar Distribuição</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Distribui leads para <strong className="text-foreground">todos os consultores elegíveis</strong> usando a configuração atual:</p>
          <ul className="space-y-1 list-none">
            <li>📌 Tag: <strong className="text-foreground">{campaign.campaignTag || "campanha-marco-2026"}</strong></li>
            <li>🎯 DDD filtro: <strong className="text-foreground">{campaign.dddFilter || "Todos"}</strong></li>
            <li>📦 Qtd por consultor: <strong className="text-foreground">{campaign.leadsPerConsultant}</strong></li>
            <li>📅 Limite diário: <strong className="text-foreground">{campaign.dailyLimit}</strong></li>
          </ul>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
            Confirmar e Distribuir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
