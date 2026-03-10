import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { toast } from "sonner";
import { Download, Trash2, Users, Loader2 } from "lucide-react";

interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  tipo_pessoa: string;
  city: string | null;
  region: string | null;
  category: string | null;
  source: string | null;
  score: number | null;
  status: string;
  created_at: string;
  company_target: string | null;
}

export default function BaseDados() {
  const { selectedCompanyId } = useCompanyFilter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({ total: 0, pf: 0, pj: 0, email: 0, phone: 0 });
  const [distributeOpen, setDistributeOpen] = useState(false);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [assignTo, setAssignTo] = useState("");

  const perPage = 100;

  useEffect(() => { loadLeads(); }, [selectedCompanyId, filterType, filterSource, filterStatus, search, page]);

  const loadLeads = async () => {
    setLoading(true);
    let query = supabase.from("contact_leads").select("*", { count: "exact" });

    if (selectedCompanyId !== "all") query = query.eq("company_target", selectedCompanyId);
    if (filterType !== "all") query = query.eq("tipo_pessoa", filterType);
    if (filterSource !== "all") query = query.eq("source", filterSource);
    if (filterStatus !== "all") query = query.eq("status", filterStatus);
    if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);

    const { data, count } = await query
      .order("created_at", { ascending: false })
      .range(page * perPage, (page + 1) * perPage - 1);

    setLeads((data || []) as Lead[]);
    setTotal(count || 0);

    // Stats
    let statsQuery = supabase.from("contact_leads").select("tipo_pessoa, email, phone");
    if (selectedCompanyId !== "all") statsQuery = statsQuery.eq("company_target", selectedCompanyId);
    const { data: allData } = await statsQuery;
    const all = allData || [];
    setStats({
      total: all.length,
      pf: all.filter(l => l.tipo_pessoa === "PF").length,
      pj: all.filter(l => l.tipo_pessoa === "PJ").length,
      email: all.filter(l => l.email).length,
      phone: all.filter(l => l.phone).length,
    });

    setLoading(false);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const sourceBadge = (source: string | null) => {
    const colors: Record<string, string> = {
      receita: "bg-primary text-primary-foreground",
      google_maps: "bg-success text-success-foreground",
      olx: "bg-warning text-warning-foreground",
      instagram: "bg-purple-600 text-white",
      pj_base: "bg-primary text-primary-foreground",
    };
    const s = source || "—";
    return <Badge className={colors[s] || "bg-muted text-muted-foreground"}>{s}</Badge>;
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-muted text-muted-foreground",
      contacted: "bg-primary/20 text-primary",
      interested: "bg-success/20 text-success",
      not_interested: "bg-destructive/20 text-destructive",
      converted: "bg-success text-success-foreground",
    };
    const labels: Record<string, string> = {
      pending: "Pendente", contacted: "Contatado", interested: "Interessado",
      not_interested: "Sem Interesse", converted: "Convertido",
    };
    return <Badge className={colors[status] || "bg-muted"}>{labels[status] || status}</Badge>;
  };

  const exportCSV = () => {
    const items = selected.size > 0 ? leads.filter(l => selected.has(l.id)) : leads;
    const header = "Nome,Telefone,Email,Tipo,Cidade,UF,Categoria,Fonte,Score,Status\n";
    const rows = items.map(l =>
      `"${l.name}","${l.phone}","${l.email || ""}","${l.tipo_pessoa}","${l.city || ""}","${l.region || ""}","${l.category || ""}","${l.source || ""}","${l.score || ""}","${l.status}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "base-dados.csv"; a.click();
  };

  const bulkStatus = async (status: string) => {
    if (selected.size === 0) return;
    await supabase.from("contact_leads").update({ status }).in("id", Array.from(selected));
    toast.success(`${selected.size} leads atualizados`);
    setSelected(new Set());
    loadLeads();
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    await supabase.from("contact_leads").delete().in("id", Array.from(selected));
    toast.success(`${selected.size} leads excluídos`);
    setSelected(new Set());
    loadLeads();
  };

  const openDistribute = async () => {
    if (selected.size === 0) { toast.error("Selecione leads"); return; }
    const { data } = await supabase.from("collaborators").select("id, name").eq("is_active", true).order("name");
    setCollaborators(data || []);
    setDistributeOpen(true);
  };

  const distribute = async () => {
    if (!assignTo) return;
    const inserts = Array.from(selected).map(lead_id => ({ lead_id, collaborator_id: assignTo }));
    await supabase.from("lead_distributions").insert(inserts);
    await supabase.from("contact_leads").update({ assigned_to: assignTo }).in("id", Array.from(selected));
    toast.success(`${selected.size} leads distribuídos`);
    setDistributeOpen(false);
    setSelected(new Set());
    loadLeads();
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Base de Dados</h1>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: "Total", value: stats.total },
            { label: "PF", value: stats.pf },
            { label: "PJ", value: stats.pj },
            { label: "Com Email", value: stats.email },
            { label: "Com Telefone", value: stats.phone },
          ].map(s => (
            <Card key={s.label} className="shadow-sm">
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Input placeholder="Buscar nome/telefone..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="w-64" />
          <Select value={filterType} onValueChange={v => { setFilterType(v); setPage(0); }}>
            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="PF">PF</SelectItem>
              <SelectItem value="PJ">PJ</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterSource} onValueChange={v => { setFilterSource(v); setPage(0); }}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Fonte" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Fontes</SelectItem>
              <SelectItem value="pj_base">PJ Base</SelectItem>
              <SelectItem value="google_maps">Google Maps</SelectItem>
              <SelectItem value="olx">OLX</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(0); }}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="contacted">Contatado</SelectItem>
              <SelectItem value="interested">Interessado</SelectItem>
              <SelectItem value="not_interested">Sem Interesse</SelectItem>
              <SelectItem value="converted">Convertido</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selected.size > 0 && (
          <div className="flex gap-2 items-center">
            <span className="text-sm text-muted-foreground">{selected.size} selecionados</span>
            <Button variant="outline" size="sm" onClick={openDistribute}><Users className="h-4 w-4 mr-1" /> Distribuir</Button>
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" /> CSV</Button>
            <Select onValueChange={bulkStatus}>
              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Mudar Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contacted">Contatado</SelectItem>
                <SelectItem value="interested">Interessado</SelectItem>
                <SelectItem value="not_interested">Sem Interesse</SelectItem>
                <SelectItem value="converted">Convertido</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="destructive" size="sm" onClick={bulkDelete}><Trash2 className="h-4 w-4 mr-1" /> Excluir</Button>
          </div>
        )}

        <Card className="shadow-sm">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selected.size === leads.length && leads.length > 0}
                        onCheckedChange={() => {
                          if (selected.size === leads.length) setSelected(new Set());
                          else setSelected(new Set(leads.map(l => l.id)));
                        }}
                      />
                    </TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Fonte</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map(lead => (
                    <TableRow key={lead.id} className="table-row-hover">
                      <TableCell><Checkbox checked={selected.has(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} /></TableCell>
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell>{lead.phone}</TableCell>
                      <TableCell>{lead.email || "—"}</TableCell>
                      <TableCell><Badge variant={lead.tipo_pessoa === "PJ" ? "default" : "secondary"}>{lead.tipo_pessoa}</Badge></TableCell>
                      <TableCell>{[lead.city, lead.region].filter(Boolean).join("/") || "—"}</TableCell>
                      <TableCell>{lead.category || "—"}</TableCell>
                      <TableCell>{sourceBadge(lead.source)}</TableCell>
                      <TableCell>
                        {lead.score != null ? (
                          lead.score >= 80 ? <Badge className="bg-success text-success-foreground">{lead.score}</Badge> :
                          lead.score >= 60 ? <Badge className="bg-warning text-warning-foreground">{lead.score}</Badge> :
                          <Badge variant="secondary">{lead.score}</Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell>{statusBadge(lead.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
            <span className="text-sm text-muted-foreground">{page + 1} de {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Próxima</Button>
          </div>
        )}

        {!selected.size && !loading && (
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" /> Exportar Tudo CSV</Button>
        )}
      </div>

      <Dialog open={distributeOpen} onOpenChange={setDistributeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Distribuir Leads</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{selected.size} leads selecionados</p>
          <Select value={assignTo} onValueChange={setAssignTo}>
            <SelectTrigger><SelectValue placeholder="Selecione o consultor" /></SelectTrigger>
            <SelectContent>
              {collaborators.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDistributeOpen(false)}>Cancelar</Button>
            <Button onClick={distribute} disabled={!assignTo}>Distribuir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
