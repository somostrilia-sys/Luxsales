import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Zap, TrendingUp, Send, MessageCircle, CheckCircle, Loader2, Search, RefreshCw, Users } from "lucide-react";

const LEAD_POOL_URL = "https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/lead-pool";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjYWR1endhdXRscHpwdmpvZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMDQ1MTcsImV4cCI6MjA4ODU4MDUxN30.LinR7PIoK7n79hWjbSJ3EgDwA_y6uN-HfQnOk7GgYi4";

async function callLeadPool(action: string, params: Record<string, any> = {}) {
  const session = (await supabase.auth.getSession()).data.session;
  const token = session?.access_token || ANON_KEY;
  const res = await fetch(LEAD_POOL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, "apikey": ANON_KEY },
    body: JSON.stringify({ action, ...params }),
  });
  return res.json();
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente", sent: "Enviado", responded: "Respondeu",
  converted: "Convertido", failed: "Falhou",
};

export default function MotorLeads() {
  const { collaborator, roleLevel } = useCollaborator();
  const isCeoOrDiretor = roleLevel <= 1;
  const isGestor = roleLevel === 2;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Motor de Leads</h1>
            <p className="text-muted-foreground text-sm">
              {isCeoOrDiretor ? "Visão geral dos pools de leads" : "Leads distribuídos para você"}
            </p>
          </div>
        </div>

        {isCeoOrDiretor || isGestor ? (
          <AdminView roleLevel={roleLevel} />
        ) : (
          <ConsultorView collaboratorId={collaborator?.id || ""} />
        )}
      </div>
    </DashboardLayout>
  );
}

// ══ Admin/CEO/Gestor: resumo por consultor ══
function AdminView({ roleLevel }: { roleLevel: number }) {
  const [consultants, setConsultants] = useState<any[]>([]);
  const [summary, setSummary] = useState({ total_consultants: 0, total_assigned: 0, total_sent: 0, total_responded: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callLeadPool("status");
      if (data.ok) {
        setConsultants(data.consultants || []);
        setSummary(data.summary || { total_consultants: 0, total_assigned: 0, total_sent: 0, total_responded: 0 });
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (selected) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setSelected(null)}>← Voltar</Button>
        <ConsultorView collaboratorId={selected} />
      </>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Users className="h-5 w-5" />} label="Consultores" value={summary.total_consultants} />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Total Atribuídos" value={summary.total_assigned} />
        <StatCard icon={<Send className="h-5 w-5" />} label="Enviados" value={summary.total_sent} />
        <StatCard icon={<MessageCircle className="h-5 w-5" />} label="Responderam" value={summary.total_responded} color="green" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Consultores com Pool</CardTitle>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consultor</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead className="text-center">Pendentes</TableHead>
                <TableHead className="text-center">Enviados</TableHead>
                <TableHead className="text-center">Responderam</TableHead>
                <TableHead className="text-center">Convertidos</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : consultants.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum consultor com leads atribuídos</TableCell></TableRow>
              ) : consultants.map((c) => (
                <TableRow key={c.collaborator_id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{c.company}</TableCell>
                  <TableCell className="text-center"><Badge variant="secondary">{c.pending}</Badge></TableCell>
                  <TableCell className="text-center">{c.sent}</TableCell>
                  <TableCell className="text-center">
                    {c.responded > 0 ? <Badge className="bg-green-500 text-white">{c.responded}</Badge> : "0"}
                  </TableCell>
                  <TableCell className="text-center">{c.converted}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setSelected(c.collaborator_id)}>
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

// ══ Consultor: seus próprios leads ══
function ConsultorView({ collaboratorId }: { collaboratorId: string }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [summary, setSummary] = useState({ pending: 0, sent: 0, responded: 0, converted: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const load = useCallback(async () => {
    if (!collaboratorId) return;
    setLoading(true);
    try {
      const [statRes, listRes] = await Promise.all([
        callLeadPool("status", { collaborator_id: collaboratorId }),
        callLeadPool("list_pending", { collaborator_id: collaboratorId, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
      ]);
      if (statRes.ok) {
        setSummary({
          pending: statRes.pending || 0,
          sent: statRes.sent || 0,
          responded: statRes.responded || 0,
          converted: statRes.converted || 0,
        });
      }
      if (listRes.ok) setLeads(listRes.leads || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [collaboratorId, page]);

  useEffect(() => { load(); }, [load]);

  const filtered = leads.filter((l) => {
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || (l.lead_name || "").toLowerCase().includes(q) || l.phone.includes(q) || (l.city || "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Pendentes" value={summary.pending} color="yellow" />
        <StatCard icon={<Send className="h-5 w-5" />} label="Enviados" value={summary.sent} />
        <StatCard icon={<MessageCircle className="h-5 w-5" />} label="Responderam" value={summary.responded} color="green" />
        <StatCard icon={<CheckCircle className="h-5 w-5" />} label="Convertidos" value={summary.converted} color="green" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">Meus Leads ({summary.pending + summary.sent})</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." className="pl-8 h-9 w-48" value={search} onChange={(e) => setSearch(e.target.value)} />
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
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
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
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum lead encontrado</TableCell></TableRow>
              ) : filtered.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-sm">{l.phone}</TableCell>
                  <TableCell>{l.lead_name || "—"}</TableCell>
                  <TableCell>{l.city || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{l.campaign_tag || "—"}</Badge></TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      l.status === "pending" ? "bg-yellow-500/20 text-yellow-400" :
                      l.status === "sent" ? "bg-blue-500/20 text-blue-400" :
                      l.status === "responded" ? "bg-green-500/20 text-green-400" :
                      l.status === "converted" ? "bg-emerald-500/20 text-emerald-400" :
                      "bg-gray-500/20 text-gray-400"
                    }`}>{STATUS_LABELS[l.status] || l.status}</span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {l.assigned_at ? new Date(l.assigned_at).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {(summary.pending + summary.sent) > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-3 p-4">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <span className="text-sm text-muted-foreground">Página {page + 1}</span>
              <Button variant="outline" size="sm" disabled={filtered.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>Próxima</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color?: "green" | "yellow" }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color === "green" ? "bg-green-500/10 text-green-500" : color === "yellow" ? "bg-yellow-500/10 text-yellow-500" : "bg-primary/10 text-primary"}`}>
            {icon}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value.toLocaleString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
