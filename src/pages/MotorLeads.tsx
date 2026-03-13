/**
 * Motor de Leads — Distribuição (CEO) e Meus Leads (Consultor)
 */
import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Zap, TrendingUp, Send, MessageCircle, CheckCircle, Loader2,
  Search, RefreshCw, Users, Play, MapPin, Phone, ArrowRight, Shuffle
} from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://lqsxmrxbakotigfzqytk.supabase.co";

interface Lead {
  id: string;
  phone: string;
  lead_name: string | null;
  city: string | null;
  source: string | null;
  status: "pending" | "sent" | "responded" | "converted" | "failed";
  campaign_tag: string | null;
  assigned_at: string;
  sent_at: string | null;
}

interface PoolSummary {
  pending: number;
  sent: number;
  responded: number;
  converted: number;
}

interface GestorConsultor {
  collaborator_id: string;
  name: string;
  company: string;
  pending: number;
  sent: number;
  responded: number;
  converted: number;
}

interface Collaborator {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  status: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  sent: "Enviado",
  responded: "Respondeu",
  converted: "Convertido",
  failed: "Falhou",
};

const STATUS_COLORS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  sent: "outline",
  responded: "default",
  converted: "default",
  failed: "destructive",
};

async function getAuthHeaders() {
  const session = (await supabase.auth.getSession()).data.session;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token}`,
  };
}

export default function MotorLeads() {
  const { collaborator, roleLevel } = useCollaborator();
  const isCeo = roleLevel <= 1;

  if (isCeo) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Zap className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Motor de Leads</h1>
              <p className="text-muted-foreground text-sm">Distribua leads da base para consultores</p>
            </div>
          </div>
          <CeoDistributionView />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Zap className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Meus Leads</h1>
            <p className="text-muted-foreground text-sm">Leads distribuídos para você</p>
          </div>
        </div>
        <ConsultorView collaboratorId={collaborator?.id || ""} />
      </div>
    </DashboardLayout>
  );
}

// ═══════════════════════════════════════════
// CEO DISTRIBUTION VIEW
// ═══════════════════════════════════════════
function CeoDistributionView() {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [consultores, setConsultores] = useState<GestorConsultor[]>([]);
  const [loading, setLoading] = useState(true);
  const [distributing, setDistributing] = useState(false);
  const [selectedConsultor, setSelectedConsultor] = useState<string | null>(null);
  const [summary, setSummary] = useState({ total_consultants: 0, total_assigned: 0, total_sent: 0, total_responded: 0 });

  // Distribution form
  const [showDistribute, setShowDistribute] = useState(false);
  const [distCity, setDistCity] = useState("");
  const [distDDD, setDistDDD] = useState("");
  const [distTarget, setDistTarget] = useState("all"); // "all" or collaborator ID
  const [distQty, setDistQty] = useState(500);
  const [distSource, setDistSource] = useState("all");

  // Available cities/DDDs for quick stats
  const [availableLeads, setAvailableLeads] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [headers, collabRes] = await Promise.all([
        getAuthHeaders(),
        supabase.from("collaborators").select("id,name,email,role,status").eq("status", "active"),
      ]);
      setCollaborators(collabRes.data || []);

      const res = await fetch(`${SUPABASE_URL}/functions/v1/lead-pool`, {
        method: "POST", headers,
        body: JSON.stringify({ action: "status" }),
      });
      const data = await res.json();
      setConsultores(data.consultants || []);
      setSummary(data.summary || { total_consultants: 0, total_assigned: 0, total_sent: 0, total_responded: 0 });

      // Count available leads in contact_leads
      const { count } = await supabase.from("contact_leads").select("id", { count: "exact", head: true }).not("phone", "is", null);
      setAvailableLeads(count || 0);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDistribute = async () => {
    setDistributing(true);
    try {
      const headers = await getAuthHeaders();

      // Build query to get leads from contact_leads
      let query = supabase.from("contact_leads")
        .select("id,name,phone,city,source")
        .not("phone", "is", null)
        .eq("status", "pending");

      if (distCity.trim()) query = query.ilike("city", `%${distCity.trim()}%`);
      if (distDDD.trim() && distDDD.length === 2) query = query.like("phone", `(${distDDD})%`);
      if (distSource !== "all") query = query.eq("source", distSource);

      const { data: leadsToAssign } = await query.limit(distQty);

      if (!leadsToAssign || leadsToAssign.length === 0) {
        toast.error("Nenhum lead encontrado com os filtros selecionados");
        setDistributing(false);
        return;
      }

      // Determine target collaborators
      let targetCollabs: string[] = [];
      if (distTarget === "all") {
        targetCollabs = collaborators.map(c => c.id);
      } else {
        targetCollabs = [distTarget];
      }

      if (targetCollabs.length === 0) {
        toast.error("Nenhum colaborador selecionado");
        setDistributing(false);
        return;
      }

      // Distribute leads evenly among targets
      const perCollab = Math.ceil(leadsToAssign.length / targetCollabs.length);
      let distributed = 0;

      for (let i = 0; i < targetCollabs.length; i++) {
        const collabLeads = leadsToAssign.slice(i * perCollab, (i + 1) * perCollab);
        if (collabLeads.length === 0) continue;

        // Call lead-pool assign
        const res = await fetch(`${SUPABASE_URL}/functions/v1/lead-pool`, {
          method: "POST", headers,
          body: JSON.stringify({
            action: "assign",
            collaborator_id: targetCollabs[i],
            leads: collabLeads.map(l => ({
              phone: l.phone,
              lead_name: l.name,
              city: l.city,
              source: l.source,
            })),
          }),
        });
        const result = await res.json();
        if (result.error) {
          toast.error(`Erro ao distribuir para colaborador: ${result.error}`);
        } else {
          distributed += collabLeads.length;
        }
      }

      // Mark distributed leads as "distributed" in contact_leads
      const distributedIds = leadsToAssign.slice(0, distributed).map(l => l.id);
      if (distributedIds.length > 0) {
        await supabase.from("contact_leads").update({ status: "contacted" }).in("id", distributedIds);
      }

      toast.success(`${distributed} leads distribuídos para ${distTarget === "all" ? "todos" : "1"} colaborador(es)`);
      setShowDistribute(false);
      fetchData();
    } catch (e: any) {
      toast.error("Erro na distribuição: " + e.message);
    } finally {
      setDistributing(false);
    }
  };

  if (selectedConsultor) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setSelectedConsultor(null)} className="mb-2">
          ← Voltar
        </Button>
        <ConsultorView collaboratorId={selectedConsultor} />
      </>
    );
  }

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <SummaryCard icon={<MapPin className="h-5 w-5" />} label="Na Base" value={availableLeads} />
        <SummaryCard icon={<Users className="h-5 w-5" />} label="Consultores c/ Leads" value={summary.total_consultants} />
        <SummaryCard icon={<TrendingUp className="h-5 w-5" />} label="Atribuídos" value={summary.total_assigned} />
        <SummaryCard icon={<Send className="h-5 w-5" />} label="Enviados" value={summary.total_sent} />
        <SummaryCard icon={<MessageCircle className="h-5 w-5" />} label="Responderam" value={summary.total_responded} color="green" />
      </div>

      {/* Distribution Action */}
      <Card className="border-primary/30">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Shuffle className="h-5 w-5 text-primary" />
            Distribuir Leads
          </CardTitle>
          <Button onClick={() => setShowDistribute(true)} className="gap-2">
            <ArrowRight className="h-4 w-4" />
            Nova Distribuição
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Selecione filtros de cidade ou DDD e distribua leads da base para consultores específicos ou para todos.
          </p>
        </CardContent>
      </Card>

      {/* Distribution Dialog */}
      <Dialog open={showDistribute} onOpenChange={setShowDistribute}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shuffle className="h-5 w-5 text-primary" />
              Distribuir Leads
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Cidade
                </Label>
                <Input
                  placeholder="Ex: São Paulo"
                  value={distCity}
                  onChange={e => setDistCity(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Phone className="h-3 w-3" /> DDD
                </Label>
                <Input
                  placeholder="Ex: 11"
                  value={distDDD}
                  onChange={e => setDistDDD(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  maxLength={2}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Fonte</Label>
                <Select value={distSource} onValueChange={setDistSource}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="receita">Receita Federal</SelectItem>
                    <SelectItem value="google_maps">Google Maps</SelectItem>
                    <SelectItem value="olx">OLX</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Quantidade</Label>
                <Input
                  type="number"
                  min={10}
                  max={5000}
                  value={distQty}
                  onChange={e => setDistQty(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Target */}
            <div>
              <Label className="text-xs">Distribuir Para</Label>
              <Select value={distTarget} onValueChange={setDistTarget}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Colaboradores ({collaborators.length})</SelectItem>
                  {collaborators.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="text-muted-foreground">
                {distTarget === "all"
                  ? `~${Math.ceil(distQty / (collaborators.length || 1))} leads por colaborador`
                  : `${distQty} leads para o colaborador selecionado`}
              </p>
              {(distCity || distDDD) && (
                <p className="text-xs text-muted-foreground mt-1">
                  Filtro: {distCity && `Cidade "${distCity}"`} {distCity && distDDD && " + "} {distDDD && `DDD ${distDDD}`}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDistribute(false)}>Cancelar</Button>
            <Button onClick={handleDistribute} disabled={distributing} className="gap-2">
              {distributing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {distributing ? "Distribuindo..." : "Distribuir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Team Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Equipe</CardTitle>
          <Button size="sm" variant="outline" onClick={fetchData} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consultor</TableHead>
                <TableHead className="text-center">Pendentes</TableHead>
                <TableHead className="text-center">Enviados</TableHead>
                <TableHead className="text-center">Responderam</TableHead>
                <TableHead className="text-center">Convertidos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consultores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {loading ? "Carregando..." : "Nenhum consultor com leads atribuídos"}
                  </TableCell>
                </TableRow>
              ) : consultores.map((c) => (
                <TableRow key={c.collaborator_id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{c.pending}</Badge>
                  </TableCell>
                  <TableCell className="text-center">{c.sent}</TableCell>
                  <TableCell className="text-center">
                    {c.responded > 0 && <Badge variant="default" className="bg-green-500">{c.responded}</Badge>}
                    {c.responded === 0 && "0"}
                  </TableCell>
                  <TableCell className="text-center">{c.converted}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setSelectedConsultor(c.collaborator_id)}>
                      Ver Leads
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

// ═══════════════════════════════════════════
// CONSULTOR VIEW — seus próprios leads
// ═══════════════════════════════════════════
function ConsultorView({ collaboratorId }: { collaboratorId: string }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [summary, setSummary] = useState<PoolSummary>({ pending: 0, sent: 0, responded: 0, converted: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [blasting, setBlasting] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 100;

  const fetchData = useCallback(async () => {
    if (!collaboratorId) return;
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const [sumRes, leadsRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/functions/v1/lead-pool`, {
          method: "POST", headers,
          body: JSON.stringify({ action: "status", collaborator_id: collaboratorId }),
        }),
        fetch(`${SUPABASE_URL}/functions/v1/lead-pool`, {
          method: "POST", headers,
          body: JSON.stringify({ action: "list_pending", collaborator_id: collaboratorId, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
        }),
      ]);
      const sumData = await sumRes.json();
      const leadsData = await leadsRes.json();
      setSummary({
        pending: sumData.pending ?? 0,
        sent: sumData.sent ?? 0,
        responded: sumData.responded ?? 0,
        converted: sumData.converted ?? 0,
      });
      setLeads(leadsData.leads || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [collaboratorId, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStartBlast = async () => {
    setBlasting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/blast-engine`, {
        method: "POST", headers,
        body: JSON.stringify({ action: "status", collaborator_id: collaboratorId }),
      });
      const data = await res.json();
      const jobId = data.jobs?.[0]?.id;
      if (!jobId) {
        toast.error("Nenhum disparo configurado. Aguarde o gestor iniciar uma campanha.");
        return;
      }
      const startRes = await fetch(`${SUPABASE_URL}/functions/v1/blast-engine`, {
        method: "POST", headers,
        body: JSON.stringify({ action: "start", job_id: jobId }),
      });
      const startData = await startRes.json();
      if (!startData.ok) throw new Error(startData.error);
      toast.success("Disparo iniciado! As mensagens serão enviadas automaticamente.");
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBlasting(false);
    }
  };

  const filtered = leads.filter((l) => {
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || (l.lead_name || "").toLowerCase().includes(q) || l.phone.includes(q) || (l.city || "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const totalPages = Math.ceil((summary.pending + summary.sent) / PAGE_SIZE);

  return (
    <>
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={<TrendingUp className="h-5 w-5" />} label="Pendentes" value={summary.pending} color="yellow" />
        <SummaryCard icon={<Send className="h-5 w-5" />} label="Enviados" value={summary.sent} />
        <SummaryCard icon={<MessageCircle className="h-5 w-5" />} label="Responderam" value={summary.responded} color="green" />
        <SummaryCard icon={<CheckCircle className="h-5 w-5" />} label="Convertidos" value={summary.converted} color="green" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">Meus Leads ({summary.pending + summary.sent})</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nome, telefone, cidade..."
                className="pl-8 h-9 w-56"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="sent">Enviados</SelectItem>
                <SelectItem value="responded">Responderam</SelectItem>
                <SelectItem value="converted">Convertidos</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={fetchData} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button size="sm" onClick={handleStartBlast} disabled={blasting || summary.pending === 0}>
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
                <TableHead>Campanha</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {loading ? "Carregando..." : "Nenhum lead encontrado"}
                  </TableCell>
                </TableRow>
              ) : filtered.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.lead_name || "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{l.phone}</TableCell>
                  <TableCell>{l.city || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{l.campaign_tag || "—"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_COLORS[l.status] || "secondary"}>
                      {STATUS_LABELS[l.status] || l.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {page + 1} de {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                Próxima
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function SummaryCard({
  icon, label, value, color,
}: {
  icon: React.ReactNode; label: string; value: number; color?: "green" | "yellow";
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color === "green" ? "bg-green-500/10 text-green-500" : color === "yellow" ? "bg-yellow-500/10 text-yellow-500" : "bg-primary/10 text-primary"}`}>
            {icon}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value.toLocaleString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
