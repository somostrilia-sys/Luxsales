import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Zap, Users, Send, MessageCircle, TrendingUp, Loader2, Play } from "lucide-react";

interface ConsultantPoolStatus {
  collaborator_id: string;
  name: string;
  company: string;
  pending: number;
  sent: number;
  responded: number;
  converted: number;
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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://ecaduzwautlpzpvjognr.supabase.co";

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
  const [assignOpen, setAssignOpen] = useState(false);
  const [distributeOpen, setDistributeOpen] = useState(false);
  const [selectedConsultant, setSelectedConsultant] = useState<string>("");

  // All collaborators for select
  const [allCollaborators, setAllCollaborators] = useState<{ id: string; name: string }[]>([]);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/lead-pool`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
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

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={<Users className="h-5 w-5" />} label="Consultores c/ Pool" value={status?.total_consultants ?? 0} />
        <SummaryCard icon={<TrendingUp className="h-5 w-5" />} label="Leads Atribuídos" value={status?.total_assigned ?? 0} />
        <SummaryCard icon={<Send className="h-5 w-5" />} label="Enviados" value={status?.total_sent ?? 0} />
        <SummaryCard icon={<MessageCircle className="h-5 w-5" />} label="Responderam" value={status?.total_responded ?? 0} />
      </div>

      {/* Consultants Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Consultores com Pool</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => fetchStatus()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
            </Button>
            <Button size="sm" onClick={() => setDistributeOpen(true)}>
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
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum consultor com pool</TableCell></TableRow>
              ) : (
                consultants.map((c) => (
                  <TableRow key={c.collaborator_id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.company}</TableCell>
                    <TableCell className="text-center"><Badge variant="secondary">{c.pending}</Badge></TableCell>
                    <TableCell className="text-center">{c.sent}</TableCell>
                    <TableCell className="text-center">{c.responded}</TableCell>
                    <TableCell className="text-center">{c.converted}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => { setSelectedConsultant(c.collaborator_id); setAssignOpen(true); }}>
                        Atribuir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Assign Modal */}
      <AssignModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        collaborators={allCollaborators}
        preselected={selectedConsultant}
        onSuccess={fetchStatus}
      />

      {/* Distribute Modal */}
      <DistributeModal
        open={distributeOpen}
        onClose={() => setDistributeOpen(false)}
        onSuccess={fetchStatus}
      />
    </>
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

  const fetchData = useCallback(async () => {
    if (!collaboratorId) return;
    setLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      };

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
      const session = (await supabase.auth.getSession()).data.session;
      // First get latest blast job for this consultant
      const statusRes = await fetch(`${SUPABASE_URL}/functions/v1/lead-pool`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: "status", collaborator_id: collaboratorId }),
      });
      const statusData = await statusRes.json();
      const jobId = statusData.latest_job_id;

      if (!jobId) {
        toast.error("Nenhum job de disparo encontrado. Peça ao gestor para atribuir leads.");
        return;
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/blast-engine`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: "start", job_id: jobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao iniciar disparo");
      toast.success("Disparo iniciado com sucesso!");
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
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum lead pendente</TableCell></TableRow>
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
// ASSIGN MODAL
// ═══════════════════════════════════════════

function AssignModal({
  open, onClose, collaborators, preselected, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  collaborators: { id: string; name: string }[];
  preselected: string;
  onSuccess: () => void;
}) {
  const [collaboratorId, setCollaboratorId] = useState(preselected);
  const [ddd, setDdd] = useState("");
  const [city, setCity] = useState("");
  const [count, setCount] = useState("500");
  const [campaignTag, setCampaignTag] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setCollaboratorId(preselected); }, [preselected]);

  const handleSubmit = async () => {
    if (!collaboratorId) { toast.error("Selecione um colaborador"); return; }
    setSaving(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/lead-pool`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          action: "assign",
          collaborator_id: collaboratorId,
          ddd: ddd || undefined,
          city: city || undefined,
          count: parseInt(count) || 500,
          campaign_tag: campaignTag || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao atribuir");
      toast.success(`${data.assigned || 0} leads atribuídos!`);
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
          <DialogTitle>Atribuir Leads</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Colaborador</Label>
            <Select value={collaboratorId} onValueChange={setCollaboratorId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {collaborators.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>DDD</Label>
              <Input placeholder="Ex: 11" value={ddd} onChange={(e) => setDdd(e.target.value)} />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input placeholder="Ex: São Paulo" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantidade</Label>
              <Input type="number" value={count} onChange={(e) => setCount(e.target.value)} />
            </div>
            <div>
              <Label>Tag Campanha</Label>
              <Input placeholder="Ex: jan-2026" value={campaignTag} onChange={(e) => setCampaignTag(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════
// DISTRIBUTE MODAL
// ═══════════════════════════════════════════

function DistributeModal({
  open, onClose, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [ddd, setDdd] = useState("");
  const [city, setCity] = useState("");
  const [leadsPerConsultant, setLeadsPerConsultant] = useState("500");
  const [campaignTag, setCampaignTag] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/blast-engine`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          action: "distribute",
          ddd_filter: ddd || undefined,
          city_filter: city || undefined,
          campaign_tag: campaignTag || undefined,
          leads_per_consultant: parseInt(leadsPerConsultant) || 500,
          daily_limit: 100,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao distribuir");
      toast.success(`Distribuição iniciada! ${data.total_distributed || 0} leads distribuídos.`);
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
          <DialogTitle>Distribuir para Todos</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>DDD</Label>
              <Input placeholder="Ex: 11" value={ddd} onChange={(e) => setDdd(e.target.value)} />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input placeholder="Ex: São Paulo" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Qtd por Consultor</Label>
              <Input type="number" value={leadsPerConsultant} onChange={(e) => setLeadsPerConsultant(e.target.value)} />
            </div>
            <div>
              <Label>Tag Campanha</Label>
              <Input placeholder="Ex: jan-2026" value={campaignTag} onChange={(e) => setCampaignTag(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
            Distribuir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
