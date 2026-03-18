import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import Papa from "papaparse";
import {
  Users, Upload, Plus, Search, Download,
  Flame, Sun, Snowflake, Loader2,
  ChevronLeft, ChevronRight, FileSpreadsheet, UserPlus,
} from "lucide-react";

const statusLabels: Record<string, { label: string; color: string }> = {
  new: { label: "Novo", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  queued: { label: "Na Fila", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  calling: { label: "Ligando", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 animate-pulse" },
  answered: { label: "Atendeu", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  no_answer: { label: "Não Atendeu", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  busy: { label: "Ocupado", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  qualified: { label: "Qualificado", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  converted: { label: "Convertido", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  blacklist: { label: "Blacklist", color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

const qualBadge = (q: string | null) => {
  if (q === "hot") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><Flame className="h-3 w-3 mr-1" />HOT</Badge>;
  if (q === "warm") return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Sun className="h-3 w-3 mr-1" />WARM</Badge>;
  if (q === "cold") return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><Snowflake className="h-3 w-3 mr-1" />COLD</Badge>;
  return <span className="text-muted-foreground text-xs">—</span>;
};

const formatPhone = (p: string) => {
  const d = p.replace(/\D/g, "");
  if (d.length >= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
  return p;
};
const formatDate = (d: string | null) => d ? new Date(d).toLocaleString("pt-BR") : "—";

export default function LeadsDiscador() {
  const { collaborator } = useCollaborator();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [qualFilter, setQualFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [page, setPage] = useState(0);
  const pageSize = 25;

  // Import
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [importCampaign, setImportCampaign] = useState("");

  // Add lead
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", phone: "", email: "" });
  const [addSaving, setAddSaving] = useState(false);

  useEffect(() => { loadCampaigns(); loadLeads(); }, [collaborator]);

  const loadCampaigns = async () => {
    const companyId = collaborator?.company_id;
    if (!companyId) return;
    const { data } = await supabase.from("campaigns").select("id, name").eq("company_id", companyId);
    setCampaigns((data ?? []).map((c: any) => ({ id: c.id, name: c.name })));
  };

  const loadLeads = async () => {
    setLoading(true);
    const companyId = collaborator?.company_id;
    if (!companyId) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("leads" as any)
      .select("id, name, phone, email, status, qualification, qualification_notes, attempts, max_attempts, last_attempt_at, campaign_id, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) { console.error(error); toast.error("Erro ao carregar leads."); }
    setLeads(data ?? []);
    setLoading(false);
  };

  const filtered = leads.filter(l => {
    const matchSearch = !searchTerm || (l.name ?? "").toLowerCase().includes(searchTerm.toLowerCase()) || (l.phone ?? "").includes(searchTerm);
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    const matchQual = qualFilter === "all" || l.qualification === qualFilter;
    const matchCampaign = campaignFilter === "all" || l.campaign_id === campaignFilter;
    return matchSearch && matchStatus && matchQual && matchCampaign;
  });
  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data.map((r: any) => ({
          name: r.nome || r.name || r.Nome || "",
          phone: r.telefone || r.phone || r.Telefone || r.Phone || "",
          email: r.email || r.Email || "",
        })).filter((r: any) => r.phone);
        setCsvPreview(rows);
      },
    });
  };

  const importLeads = async () => {
    if (!csvPreview.length || !importCampaign) { toast.error("Selecione uma campanha."); return; }
    setImporting(true);
    const records = csvPreview.map(r => ({
      company_id: collaborator?.company_id,
      campaign_id: importCampaign,
      name: r.name || null,
      phone: r.phone,
      email: r.email || null,
      status: "new",
    }));
    const { error } = await supabase.from("leads" as any).insert(records);
    if (error) { console.error(error); toast.error("Erro ao importar."); }
    else { toast.success(`${csvPreview.length} leads importados!`); setCsvPreview([]); setImportOpen(false); await loadLeads(); }
    setImporting(false);
  };

  const addLead = async () => {
    if (!addForm.phone) { toast.error("Telefone é obrigatório."); return; }
    setAddSaving(true);
    const { error } = await supabase.from("leads" as any).insert({
      company_id: collaborator?.company_id,
      name: addForm.name || null,
      phone: addForm.phone,
      email: addForm.email || null,
      status: "new",
    });
    if (error) { console.error(error); toast.error("Erro ao adicionar lead."); }
    else { toast.success("Lead adicionado!"); setAddForm({ name: "", phone: "", email: "" }); setAddOpen(false); await loadLeads(); }
    setAddSaving(false);
  };

  const exportCSV = () => {
    const headers = "Nome,Telefone,Email,Status,Qualificação,Tentativas,Última Tentativa\n";
    const rows = filtered.map(l => `"${l.name ?? ""}","${l.phone}","${l.email ?? ""}","${l.status}","${l.qualification ?? ""}","${l.attempts ?? 0}","${formatDate(l.last_attempt_at)}"`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const stats = [
    { label: "Total", value: leads.length, icon: Users, color: "text-primary" },
    { label: "Novos", value: leads.filter(l => l.status === "new").length, icon: Plus, color: "text-blue-400" },
    { label: "HOT", value: leads.filter(l => l.qualification === "hot").length, icon: Flame, color: "text-red-400" },
    { label: "Convertidos", value: leads.filter(l => l.status === "converted").length, icon: UserPlus, color: "text-emerald-400" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader title="Leads do Discador" subtitle="Gerencie e importe leads para campanhas de voz">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1.5" />CSV</Button>
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogTrigger asChild><Button variant="outline" size="sm"><Upload className="h-4 w-4 mr-1.5" />Importar</Button></DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Importar Leads via CSV</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Campanha</Label>
                    <Select value={importCampaign} onValueChange={setImportCampaign}>
                      <SelectTrigger><SelectValue placeholder="Selecionar campanha" /></SelectTrigger>
                      <SelectContent>{campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Arquivo CSV (colunas: nome/name, telefone/phone, email)</Label>
                    <Input type="file" accept=".csv,.txt" onChange={handleCSVUpload} />
                  </div>
                  {csvPreview.length > 0 && (
                    <>
                      <p className="text-sm text-muted-foreground"><FileSpreadsheet className="inline h-4 w-4 mr-1" />{csvPreview.length} leads encontrados</p>
                      <div className="max-h-[200px] overflow-y-auto">
                        <Table>
                          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Telefone</TableHead><TableHead>Email</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {csvPreview.slice(0, 10).map((r, i) => <TableRow key={i}><TableCell>{r.name || "—"}</TableCell><TableCell>{r.phone}</TableCell><TableCell>{r.email || "—"}</TableCell></TableRow>)}
                            {csvPreview.length > 10 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">... e mais {csvPreview.length - 10}</TableCell></TableRow>}
                          </TableBody>
                        </Table>
                      </div>
                      <Button onClick={importLeads} disabled={importing || !importCampaign} className="w-full">
                        {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}Importar {csvPreview.length} Leads
                      </Button>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild><Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white"><Plus className="h-4 w-4 mr-1.5" />Adicionar</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Adicionar Lead</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2"><Label>Nome</Label><Input value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Telefone *</Label><Input value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })} placeholder="(XX) XXXXX-XXXX" /></div>
                  <div className="space-y-2"><Label>Email</Label><Input value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} /></div>
                  <Button onClick={addLead} disabled={addSaving} className="w-full">
                    {addSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}Adicionar Lead
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </PageHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map(s => (
            <Card key={s.label} className="bg-card border-border/60"><CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center"><s.icon className={`h-5 w-5 ${s.color}`} /></div>
                <div><p className="text-2xl font-bold text-foreground">{s.value.toLocaleString("pt-BR")}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
              </div>
            </CardContent></Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="border-border/60 bg-card"><CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(0); }} className="pl-9" />
            </div>
            <Select value={campaignFilter} onValueChange={v => { setCampaignFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Campanha" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas</SelectItem>{campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="new">Novo</SelectItem><SelectItem value="answered">Atendeu</SelectItem><SelectItem value="no_answer">Não Atendeu</SelectItem><SelectItem value="qualified">Qualificado</SelectItem></SelectContent>
            </Select>
            <Select value={qualFilter} onValueChange={v => { setQualFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[120px]"><SelectValue placeholder="Qualif." /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="hot">HOT</SelectItem><SelectItem value="warm">WARM</SelectItem><SelectItem value="cold">COLD</SelectItem></SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{filtered.length} resultados</p>
          </div>
        </CardContent></Card>

        {/* Table */}
        <Card className="border-border/60 bg-card"><CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Nome</TableHead><TableHead>Telefone</TableHead><TableHead>Status</TableHead><TableHead>Qualificação</TableHead><TableHead>Tentativas</TableHead><TableHead>Última Tentativa</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {paginated.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">Nenhum lead encontrado.</TableCell></TableRow>
                  ) : paginated.map(l => {
                    const st = statusLabels[l.status] ?? { label: l.status, color: "bg-muted text-muted-foreground" };
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium text-foreground">{l.name ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{formatPhone(l.phone)}</TableCell>
                        <TableCell><Badge variant="outline" className={st.color}>{st.label}</Badge></TableCell>
                        <TableCell>{qualBadge(l.qualification)}</TableCell>
                        <TableCell className="text-muted-foreground">{l.attempts ?? 0}/{l.max_attempts ?? 3}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{formatDate(l.last_attempt_at)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
                  <p className="text-xs text-muted-foreground">Página {page + 1} de {totalPages}</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent></Card>
      </div>
    </DashboardLayout>
  );
}
