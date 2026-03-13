import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Users, Send, MessageSquare, RefreshCw, Play, Pause, Trash2, AlertTriangle, Search, Phone, MapPin, Tag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useCollaborator } from "@/contexts/CollaboratorContext";

interface ConsultantRow {
  collaborator_id: string;
  name: string;
  company: string;
  pending: number;
  sent: number;
  responded: number;
  converted: number;
  status?: string;
}

interface LeadRow {
  id: string;
  phone: string;
  lead_name?: string;
  city?: string;
  campaign_tag?: string;
  status: string;
  assigned_at: string;
}

interface Summary {
  total_consultants: number;
  total_assigned: number;
  total_sent: number;
  total_responded: number;
}

const LEAD_POOL_URL = "https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/lead-pool";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjYWR1endhdXRscHpwdmpvZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMDQ1MTcsImV4cCI6MjA4ODU4MDUxN30.LinR7PIoK7n79hWjbSJ3EgDwA_y6uN-HfQnOk7GgYi4";

async function callLeadPool(action: string, params: Record<string, any> = {}) {
  const res = await fetch(LEAD_POOL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": ANON_KEY, "Authorization": `Bearer ${ANON_KEY}` },
    body: JSON.stringify({ action, ...params }),
  });
  return res.json();
}

export default function MotorDisparo() {
  const { collaborator } = useCollaborator();
  const roleLevel = (collaborator as any)?.roles?.level ?? (collaborator as any)?.role_level ?? 99;
  const isAdmin = roleLevel <= 1; // CEO ou Diretor
  const isGestor = roleLevel === 2;
  const isConsultor = roleLevel >= 3;

  // ── Estado Admin/Gestor ─────────────────────────────────────
  const [summary, setSummary] = useState<Summary | null>(null);
  const [consultants, setConsultants] = useState<ConsultantRow[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // ── Estado Consultor (Meus Leads) ───────────────────────────
  const [myLeads, setMyLeads] = useState<LeadRow[]>([]);
  const [myStats, setMyStats] = useState({ pending: 0, sent: 0, responded: 0, converted: 0 });
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 20;

  // ── Modals ──────────────────────────────────────────────────
  const [deleteModal, setDeleteModal] = useState<ConsultantRow | null>(null);
  const [deleteAllModal, setDeleteAllModal] = useState(false);
  const [distributeModal, setDistributeModal] = useState(false);
  const [assignModal, setAssignModal] = useState<ConsultantRow | null>(null);
  const [assignCount, setAssignCount] = useState("500");
  const [assignDDD, setAssignDDD] = useState("");
  const [loadingAction, setLoadingAction] = useState(false);

  // ── Load Status (Admin/Gestor) ───────────────────────────────
  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const data = await callLeadPool("status");
      if (data.ok) {
        setSummary(data.summary || null);
        setConsultants(data.consultants || []);
      } else {
        toast.error("Erro ao carregar status: " + (data.error || ""));
      }
    } catch (e: any) {
      toast.error("Erro de conexão");
    }
    setLoadingStatus(false);
  }, []);

  // ── Load Leads (Consultor) ───────────────────────────────────
  const loadMyLeads = useCallback(async () => {
    if (!collaborator?.id) return;
    setLoadingLeads(true);
    try {
      const data = await callLeadPool("status", { collaborator_id: collaborator.id });
      if (data.ok) {
        setMyStats({
          pending: data.pending || 0,
          sent: data.sent || 0,
          responded: data.responded || 0,
          converted: data.converted || 0,
        });
      }

      const listData = await callLeadPool("list_pending", {
        collaborator_id: collaborator.id,
        limit: PAGE_SIZE,
        offset: currentPage * PAGE_SIZE,
        status_filter: statusFilter !== "all" ? statusFilter : undefined,
      });
      if (listData.ok) {
        setMyLeads(listData.leads || []);
      }
    } catch (e: any) {
      toast.error("Erro ao carregar seus leads");
    }
    setLoadingLeads(false);
  }, [collaborator?.id, currentPage, statusFilter]);

  useEffect(() => {
    if (isConsultor || isGestor) {
      loadMyLeads();
    } else {
      loadStatus();
    }
  }, [isConsultor, isGestor, loadMyLeads, loadStatus]);

  // ── Ações Admin ──────────────────────────────────────────────
  const handleDistributeAll = async () => {
    setLoadingAction(true);
    setDistributeModal(false);
    try {
      const data = await callLeadPool("auto_refill", { min_threshold: 0, target_count: 500 });
      if (data.ok) {
        toast.success(`Leads distribuídos: ${data.total_assigned || 0} leads para ${data.consultors_updated || 0} consultores`);
        await loadStatus();
      } else {
        toast.error("Erro: " + (data.error || ""));
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    setLoadingAction(false);
  };

  const handleAssignOne = async () => {
    if (!assignModal) return;
    setLoadingAction(true);
    try {
      const data = await callLeadPool("assign", {
        collaborator_id: assignModal.collaborator_id,
        count: parseInt(assignCount) || 500,
        ddd: assignDDD || undefined,
      });
      if (data.ok) {
        toast.success(`${data.assigned || 0} leads atribuídos para ${assignModal.name}`);
        setAssignModal(null);
        await loadStatus();
      } else {
        toast.error("Erro: " + (data.error || ""));
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    setLoadingAction(false);
  };

  const handleDeleteOne = async () => {
    if (!deleteModal) return;
    setLoadingAction(true);
    try {
      const data = await callLeadPool("delete_distribution", {
        collaborator_id: deleteModal.collaborator_id,
      });
      if (data.ok) {
        toast.success(`${data.deleted || 0} leads removidos de ${deleteModal.name}`);
        setDeleteModal(null);
        await loadStatus();
      } else {
        toast.error("Erro: " + (data.error || ""));
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    setLoadingAction(false);
  };

  const handleDeleteAll = async () => {
    setLoadingAction(true);
    setDeleteAllModal(false);
    try {
      const data = await callLeadPool("delete_all_distributions", {});
      if (data.ok) {
        toast.success(`${data.deleted || 0} leads removidos de todos os consultores`);
        await loadStatus();
      } else {
        toast.error("Erro: " + (data.error || ""));
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    setLoadingAction(false);
  };

  const filteredLeads = myLeads.filter(l =>
    !searchTerm ||
    l.phone?.includes(searchTerm) ||
    l.lead_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      pending: "bg-yellow-500/20 text-yellow-400",
      sent: "bg-blue-500/20 text-blue-400",
      responded: "bg-green-500/20 text-green-400",
      converted: "bg-emerald-500/20 text-emerald-400",
      failed: "bg-red-500/20 text-red-400",
    };
    return map[s] || "bg-gray-500/20 text-gray-400";
  };

  // ══════════════════════════════════════════════════════════
  // VIEW: CONSULTOR — Meus Leads
  // ══════════════════════════════════════════════════════════
  if (isConsultor) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Meus Leads</h1>
            </div>
            <Button onClick={loadMyLeads} disabled={loadingLeads} variant="outline" size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingLeads ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>

          {/* Cards de métricas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Pendentes", value: myStats.pending, icon: <Users className="h-5 w-5" />, color: "text-yellow-400" },
              { label: "Enviados", value: myStats.sent, icon: <Send className="h-5 w-5" />, color: "text-blue-400" },
              { label: "Responderam", value: myStats.responded, icon: <MessageSquare className="h-5 w-5" />, color: "text-green-400" },
              { label: "Convertidos", value: myStats.converted, icon: <Zap className="h-5 w-5" />, color: "text-emerald-400" },
            ].map(({ label, value, icon, color }) => (
              <Card key={label}>
                <CardContent className="pt-6 pb-4">
                  <div className={`flex items-center gap-2 mb-1 ${color}`}>{icon}</div>
                  <div className="text-2xl font-bold">{value.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filtros */}
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por telefone, nome ou cidade..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPage(0); }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="sent">Enviados</SelectItem>
                <SelectItem value="responded">Responderam</SelectItem>
                <SelectItem value="converted">Convertidos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabela de leads */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Recebido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingLeads ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : filteredLeads.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum lead encontrado</TableCell></TableRow>
                  ) : filteredLeads.map(lead => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-mono text-sm">{lead.phone}</span>
                        </div>
                      </TableCell>
                      <TableCell>{lead.lead_name || "—"}</TableCell>
                      <TableCell>
                        {lead.city ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            {lead.city}
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {lead.campaign_tag ? (
                          <div className="flex items-center gap-1">
                            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs">{lead.campaign_tag}</span>
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(lead.status)}`}>
                          {lead.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {lead.assigned_at ? new Date(lead.assigned_at).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Paginação */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Mostrando {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, myStats.pending + myStats.sent + myStats.responded + myStats.converted)} de {myStats.pending + myStats.sent + myStats.responded + myStats.converted}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setCurrentPage(p => p - 1)}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={filteredLeads.length < PAGE_SIZE} onClick={() => setCurrentPage(p => p + 1)}>
                Próxima
              </Button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ══════════════════════════════════════════════════════════
  // VIEW: GESTOR — Meus Leads + Equipe (mesma view do consultor mas com contexto de gestor)
  // ══════════════════════════════════════════════════════════
  if (isGestor) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Motor de Leads</h1>
            </div>
            <Button onClick={loadMyLeads} disabled={loadingLeads} variant="outline" size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingLeads ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Pendentes", value: myStats.pending, color: "text-yellow-400" },
              { label: "Enviados", value: myStats.sent, color: "text-blue-400" },
              { label: "Responderam", value: myStats.responded, color: "text-green-400" },
              { label: "Convertidos", value: myStats.converted, color: "text-emerald-400" },
            ].map(({ label, value, color }) => (
              <Card key={label}><CardContent className="pt-6 pb-4">
                <div className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </CardContent></Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Seus leads recebidos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingLeads ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : myLeads.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Nenhum lead recebido</TableCell></TableRow>
                  ) : myLeads.slice(0, 50).map(lead => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-mono text-sm">{lead.phone}</TableCell>
                      <TableCell>{lead.lead_name || "—"}</TableCell>
                      <TableCell>{lead.city || "—"}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${statusBadge(lead.status)}`}>
                          {lead.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // ══════════════════════════════════════════════════════════
  // VIEW: CEO / DIRETOR — Gestão completa de distribuição
  // ══════════════════════════════════════════════════════════
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Motor de Disparo</h1>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadStatus} disabled={loadingStatus} variant="outline" size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingStatus ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            {isAdmin && (
              <Button onClick={() => setDeleteAllModal(true)} variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar Tudo
              </Button>
            )}
            <Button onClick={() => setDistributeModal(true)} disabled={loadingAction} className="btn-modern" size="sm">
              <Zap className="h-4 w-4 mr-2" />
              Distribuir Leads (500 por consultor)
            </Button>
          </div>
        </div>

        {/* Cards de métricas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Consultores c/ Pool", value: summary?.total_consultants ?? consultants.length, icon: <Users className="h-5 w-5" /> },
            { label: "Leads Atribuídos", value: summary?.total_assigned ?? 0, icon: <Zap className="h-5 w-5" /> },
            { label: "Enviados", value: summary?.total_sent ?? 0, icon: <Send className="h-5 w-5" /> },
            { label: "Responderam", value: summary?.total_responded ?? 0, icon: <MessageSquare className="h-5 w-5" /> },
          ].map(({ label, value, icon }) => (
            <Card key={label}>
              <CardContent className="pt-6 pb-4">
                <div className="flex items-center gap-2 mb-2 text-primary">{icon}</div>
                <div className="text-2xl font-bold">{(value || 0).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabela de consultores */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Consultores com Pool ({consultants.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="text-right">Pendentes</TableHead>
                  <TableHead className="text-right">Enviados</TableHead>
                  <TableHead className="text-right">Responderam</TableHead>
                  <TableHead className="text-right">Convertidos</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingStatus ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : consultants.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum consultor com pool ativo. Clique em "Distribuir para Todos".</TableCell></TableRow>
                ) : consultants.map(c => (
                  <TableRow key={c.collaborator_id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{c.company}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="text-yellow-400 border-yellow-400/30">{c.pending}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="text-blue-400 border-blue-400/30">{c.sent}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="text-green-400 border-green-400/30">{c.responded}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">{c.converted}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="outline" onClick={() => setAssignModal(c)}>
                          <Zap className="h-3.5 w-3.5 mr-1" /> Atribuir
                        </Button>
                        {isAdmin && (
                          <Button size="sm" variant="destructive" onClick={() => setDeleteModal(c)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Modal: Distribuir para Todos */}
      <Dialog open={distributeModal} onOpenChange={setDistributeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Distribuir Leads para Todos</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Distribui automaticamente 500 leads para cada consultor com pool abaixo do mínimo.
            Consultores que já têm leads não serão afetados.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDistributeModal(false)}>Cancelar</Button>
            <Button onClick={handleDistributeAll} disabled={loadingAction} className="btn-modern">
              {loadingAction ? "Distribuindo..." : "Confirmar Distribuição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Atribuir para um consultor */}
      <Dialog open={!!assignModal} onOpenChange={() => setAssignModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir Leads — {assignModal?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Quantidade de leads</label>
              <Input value={assignCount} onChange={e => setAssignCount(e.target.value)} type="number" min="1" max="5000" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">DDD (opcional)</label>
              <Input value={assignDDD} onChange={e => setAssignDDD(e.target.value)} placeholder="Ex: 31, 11, 21" className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">Filtrar leads de um DDD específico</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignModal(null)}>Cancelar</Button>
            <Button onClick={handleAssignOne} disabled={loadingAction} className="btn-modern">
              {loadingAction ? "Atribuindo..." : `Atribuir ${assignCount} leads`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Excluir distribuição de um consultor */}
      <Dialog open={!!deleteModal} onOpenChange={() => setDeleteModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Excluir Leads de {deleteModal?.name}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Isso removerá <strong>{deleteModal?.pending} leads pendentes</strong> do pool de {deleteModal?.name}.
            Leads já enviados <strong>não</strong> serão afetados.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModal(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteOne} disabled={loadingAction}>
              {loadingAction ? "Excluindo..." : "Confirmar Exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Limpar tudo */}
      <Dialog open={deleteAllModal} onOpenChange={setDeleteAllModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Limpar Todos os Pools
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Isso removerá <strong>todos os leads pendentes</strong> de todos os consultores.
            Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAllModal(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteAll} disabled={loadingAction}>
              {loadingAction ? "Limpando..." : "Confirmar — Limpar Tudo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
