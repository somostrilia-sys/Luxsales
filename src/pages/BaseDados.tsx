import { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Search, Download, Upload, Send, Loader2 } from "lucide-react";

const statusOptions = ["novo", "contatado", "qualificado", "convertido", "perdido"];
const statusColors: Record<string, "default" | "secondary" | "destructive"> = {
  novo: "secondary",
  contatado: "default",
  qualificado: "default",
  convertido: "default",
  perdido: "destructive",
};

export default function BaseDados() {
  const { collaborator, isCEO } = useCollaborator();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [distDialogOpen, setDistDialogOpen] = useState(false);
  const [collabs, setCollabs] = useState<any[]>([]);
  const [distTarget, setDistTarget] = useState("");
  const [distributing, setDistributing] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [filterCompany, setFilterCompany] = useState("all");

  useEffect(() => { loadLeads(); loadCompanies(); }, [collaborator]);

  const loadCompanies = async () => {
    const { data } = await supabase.from("companies").select("id, name").order("name");
    setCompanies(data || []);
  };

  const loadLeads = async () => {
    if (!collaborator) return;
    setLoading(true);
    const { data } = await supabase.from("contact_leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setLeads(data || []);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    return leads.filter(l => {
      const matchSearch = !search ||
        (l.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.email || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.city || "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === "all" || l.status === filterStatus;
      const matchCompany = filterCompany === "all" || l.company_target === filterCompany;
      return matchSearch && matchStatus && matchCompany;
    });
  }, [leads, search, filterStatus, filterCompany]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(l => l.id)));
  };

  const openDistribute = async () => {
    if (selectedIds.size === 0) { toast.error("Selecione leads para distribuir"); return; }
    const { data } = await supabase.from("collaborators")
      .select("id, name")
      .eq("company_id", collaborator!.company_id)
      .eq("is_active", true)
      .order("name");
    setCollabs(data || []);
    setDistDialogOpen(true);
  };

  const handleDistribute = async () => {
    if (!distTarget) { toast.error("Selecione um colaborador"); return; }
    setDistributing(true);
    const inserts = Array.from(selectedIds).map(leadId => ({
      lead_id: leadId,
      collaborator_id: distTarget,
      distributed_by: collaborator!.id,
    }));
    const { error } = await supabase.from("lead_distributions").insert(inserts);
    if (error) toast.error("Erro ao distribuir", { description: error.message });
    else {
      // Update lead status
      await supabase.from("contact_leads").update({ status: "contatado", assigned_to: distTarget }).in("id", Array.from(selectedIds));
      toast.success(`${selectedIds.size} leads distribuídos!`);
      setSelectedIds(new Set());
      setDistDialogOpen(false);
      loadLeads();
    }
    setDistributing(false);
  };

  const exportCSV = () => {
    const headers = ["Nome", "Email", "Telefone", "Cidade", "Estado", "Status", "Tipo Pessoa"];
    const rows = filtered.map(l => [l.name, l.email, l.phone, l.city, l.state, l.status, l.person_type].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "leads.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Base de Dados</h1>
            <p className="text-muted-foreground text-sm">{filtered.length} leads encontrados</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" />Exportar CSV</Button>
            {isCEO && (
              <Button onClick={openDistribute}><Send className="h-4 w-4 mr-2" />Distribuir ({selectedIds.size})</Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-10" placeholder="Buscar nome, email, cidade..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              {statusOptions.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterCompany} onValueChange={setFilterCompany}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Empresas</SelectItem>
              {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {isCEO && (
                      <TableHead className="w-10">
                        <Checkbox checked={selectedIds.size === filtered.length && filtered.length > 0} onCheckedChange={selectAll} />
                      </TableHead>
                    )}
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(l => (
                    <TableRow key={l.id} className="table-row-hover">
                      {isCEO && (
                        <TableCell>
                          <Checkbox checked={selectedIds.has(l.id)} onCheckedChange={() => toggleSelect(l.id)} />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{l.name || "—"}</TableCell>
                      <TableCell className="text-sm">{l.email || "—"}</TableCell>
                      <TableCell className="text-sm">{l.phone || "—"}</TableCell>
                      <TableCell className="text-sm">{[l.city, l.state].filter(Boolean).join("/") || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statusColors[l.status] || "secondary"} className="capitalize">{l.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm capitalize">{l.person_type || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum lead encontrado</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Distribute Dialog */}
      <Dialog open={distDialogOpen} onOpenChange={setDistDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Distribuir {selectedIds.size} leads</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select value={distTarget} onValueChange={setDistTarget}>
                <SelectTrigger><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger>
                <SelectContent>{collabs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={handleDistribute} disabled={distributing} className="w-full">
              {distributing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Confirmar Distribuição
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
