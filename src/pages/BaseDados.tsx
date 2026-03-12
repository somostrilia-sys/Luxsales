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
import { Download, Trash2, Users, Loader2, Building2, Briefcase, Car, MapPin, Database } from "lucide-react";

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

const getDestino = (lead: Lead): string => {
  if (lead.category === "objetivo-transporte" || lead.category === "objetivo-geral") return "Objetivo Auto & Truck";
  if (lead.category === "trilia-consultoria") return "Trilia";
  if (lead.source === "olx") return "OLX - Veículos PF";
  if (lead.source === "google_maps") return "Google Maps";
  return "Outros";
};

const destinoConfig = [
  { key: "objetivo", label: "Objetivo Auto & Truck", icon: Building2, color: "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  { key: "trilia", label: "Trilia", icon: Briefcase, color: "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  { key: "olx", label: "OLX - Veículos PF", icon: Car, color: "border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-300" },
  { key: "google", label: "Google Maps", icon: MapPin, color: "border-red-500 bg-red-500/10 text-red-700 dark:text-red-300" },
  { key: "all", label: "TOTAL", icon: Database, color: "border-primary bg-primary/10 text-primary" },
];

export default function BaseDados() {
  const { selectedCompanyId } = useCompanyFilter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDestino, setFilterDestino] = useState("all");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({ total: 0, pf: 0, pj: 0, email: 0, phone: 0 });
  const [destinoCounts, setDestinoCounts] = useState<Record<string, number>>({ objetivo: 0, trilia: 0, olx: 0, google: 0, all: 0 });
  const [distributeOpen, setDistributeOpen] = useState(false);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [assignTo, setAssignTo] = useState("");

  const perPage = 100;

  useEffect(() => { loadLeads(); }, [selectedCompanyId, filterType, filterSource, filterStatus, filterDestino, search, page]);

  const loadLeads = async () => {
    setLoading(true);
    let query = supabase.from("contact_leads").select("*", { count: "exact" });

    if (selectedCompanyId !== "all") query = query.eq("company_target", selectedCompanyId);
    if (filterType !== "all") query = query.eq("tipo_pessoa", filterType);
    if (filterSource !== "all") query = query.eq("source", filterSource);
    if (filterStatus !== "all") query = query.eq("status", filterStatus);
    if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);

    if (filterDestino !== "all") {
      if (filterDestino === "objetivo") query = query.or("category.eq.objetivo-transporte,category.eq.objetivo-geral");
      else if (filterDestino === "trilia") query = query.eq("category", "trilia-consultoria");
      else if (filterDestino === "olx") query = query.eq("source", "olx");
      else if (filterDestino === "google") query = query.eq("source", "google_maps");
    }

    const { data, count } = await query
      .order("created_at", { ascending: false })
      .range(page * perPage, (page + 1) * perPage - 1);

    setLeads((data || []) as Lead[]);
    setTotal(count || 0);

    // Stats & destination counts using head:true count queries
    const companyFilter = selectedCompanyId !== "all" ? selectedCompanyId : null;
    const buildQ = () => {
      let q = supabase.from("contact_leads").select("*", { count: "exact", head: true });
      if (companyFilter) q = q.eq("company_target", companyFilter);
      return q;
    };

    const [
      { count: cTotal },
      { count: cPF },
      { count: cPJ },
      { count: cEmail },
      { count: cPhone },
      { count: cObjetivo },
      { count: cTrilia },
      { count: cOlx },
      { count: cGoogle },
    ] = await Promise.all([
      buildQ(),
      buildQ().eq("tipo_pessoa", "PF"),
      buildQ().eq("tipo_pessoa", "PJ"),
      buildQ().not("email", "is", null),
      buildQ().not("phone", "is", null),
      buildQ().or("category.eq.objetivo-transporte,category.eq.objetivo-geral"),
      buildQ().eq("category", "trilia-consultoria"),
      buildQ().eq("source", "olx"),
      buildQ().eq("source", "google_maps"),
    ]);

    setStats({
      total: cTotal || 0,
      pf: cPF || 0,
      pj: cPJ || 0,
      email: cEmail || 0,
      phone: cPhone || 0,
    });
    setDestinoCounts({
      objetivo: cObjetivo || 0,
      trilia: cTrilia || 0,
      olx: cOlx || 0,
      google: cGoogle || 0,
      all: cTotal || 0,
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

  const destinoBadge = (lead: Lead) => {
    const d = getDestino(lead);
    const colors: Record<string, string> = {
      "Objetivo Auto & Truck": "bg-blue-500/20 text-blue-700 dark:text-blue-300",
      "Trilia": "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
      "OLX - Veículos PF": "bg-orange-500/20 text-orange-700 dark:text-orange-300",
      "Google Maps": "bg-red-500/20 text-red-700 dark:text-red-300",
      "Outros": "bg-muted text-muted-foreground",
    };
    return <Badge className={colors[d] || "bg-muted text-muted-foreground"}>{d}</Badge>;
  };

  const exportCSV = () => {
    const items = selected.size > 0 ? leads.filter(l => selected.has(l.id)) : leads;
    const header = "Nome,Telefone,Email,Tipo,Cidade,UF,Categoria,Fonte,Destino,Score,Status\n";
    const rows = items.map(l =>
      `"${l.name}","${l.phone}","${l.email || ""}","${l.tipo_pessoa}","${l.city || ""}","${l.region || ""}","${l.category || ""}","${l.source || ""}","${getDestino(l)}","${l.score || ""}","${l.status}"`
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
    const { data } = await supabase.from("collaborators").select("id, name").eq("active", true).order("name");
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

  const handleDestinoClick = (key: string) => {
    setFilterDestino(prev => prev === key ? "all" : key === "all" ? "all" : key);
    setPage(0);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Base de Dados</h1>

        {/* Destination company cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {destinoConfig.map(d => {
            const Icon = d.icon;
            const isActive = filterDestino === d.key;
            return (
              <Card
                key={d.key}
                className={`cursor-pointer transition-all border-2 ${isActive ? d.color + " ring-2 ring-offset-2 ring-primary/30" : "border-transparent hover:border-muted-foreground/20"}`}
                onClick={() => handleDestinoClick(d.key)}
              >
                <CardContent className="pt-4 pb-3 text-center">
                  <Icon className={`h-5 w-5 mx-auto mb-1 ${isActive ? "" : "text-muted-foreground"}`} />
                  <p className="text-xs font-medium truncate">{d.label}</p>
                  <p className="text-2xl font-bold">{destinoCounts[d.key]}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Existing stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: "Total", value: stats.total },
            { label: "PF", value: stats.pf },
            { label: "PJ", value: stats.pj },
            { label: "Com Email", value: stats.email },
            { label: "Com Telefone", value: stats.phone },
          ].map(s => (
            <Card key={s.label}>
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

        <Card>
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
                    <TableHead>Destino</TableHead>
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
                      <TableCell>{destinoBadge(lead)}</TableCell>
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
            <Button onClick={distribute} disabled={!assignTo} className="btn-modern">Distribuir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}