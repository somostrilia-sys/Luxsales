import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Users, Upload, Plus, Search, Filter, Download,
  Phone, Flame, Sun, Snowflake, Loader2, Trash2,
  ChevronLeft, ChevronRight, FileSpreadsheet,
} from "lucide-react";

type Lead = {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  status: string;
  qualification: string | null;
  attempts: number;
  max_attempts: number;
  last_attempt_at: string | null;
  source: string | null;
  campaign_name?: string;
  custom_fields?: Record<string, string>;
  created_at: string;
};

const statusLabels: Record<string, { label: string; color: string }> = {
  new: { label: "Novo", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  queued: { label: "Na Fila", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  calling: { label: "Ligando", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 animate-pulse" },
  answered: { label: "Atendeu", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  no_answer: { label: "Não Atendeu", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  busy: { label: "Ocupado", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  qualified: { label: "Qualificado", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  not_qualified: { label: "Não Qualif.", color: "bg-muted text-muted-foreground" },
  converted: { label: "Convertido", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  blacklist: { label: "Blacklist", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  invalid: { label: "Inválido", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  whatsapp_sent: { label: "WhatsApp Enviado", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
};

const qualificationBadge = (q: string | null) => {
  if (q === "hot") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><Flame className="h-3 w-3 mr-1" />HOT</Badge>;
  if (q === "warm") return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Sun className="h-3 w-3 mr-1" />WARM</Badge>;
  if (q === "cold") return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><Snowflake className="h-3 w-3 mr-1" />COLD</Badge>;
  return <span className="text-muted-foreground text-xs">—</span>;
};

const formatDate = (d: string | null) => d ? new Date(d).toLocaleString("pt-BR") : "—";
const formatPhone = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  if (d.length >= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
  return phone;
};

export default function LeadsDiscador() {
  const { collaborator, roleLevel } = useCollaborator();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [qualFilter, setQualFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [csvPreview, setCsvPreview] = useState<{ name: string; phone: string; email: string }[]>([]);
  const pageSize = 25;

  // Stats
  const totalLeads = leads.length;
  const hotLeads = leads.filter((l) => l.qualification === "hot").length;
  const newLeads = leads.filter((l) => l.status === "new").length;
  const convertedLeads = leads.filter((l) => l.status === "converted").length;

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    setLoading(true);
    // Load from contact_leads as existing table
    const { data, error } = await supabase.from("contact_leads").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) {
      console.error(error);
      toast.error("Erro ao carregar leads.");
    }
    const mapped = (data ?? []).map((l: any) => ({
      id: l.id,
      name: l.name ?? l.lead_name ?? null,
      phone: l.phone ?? l.lead_phone ?? "",
      email: l.email ?? null,
      status: l.status ?? "new",
      qualification: l.qualification ?? null,
      attempts: l.attempts ?? 0,
      max_attempts: l.max_attempts ?? 3,
      last_attempt_at: l.last_attempt_at ?? null,
      source: l.source ?? null,
      custom_fields: l.custom_fields ?? {},
      created_at: l.created_at ?? new Date().toISOString(),
    }));
    setLeads(mapped);
    setLoading(false);
  };

  const filteredLeads = leads.filter((l) => {
    const matchSearch = !searchTerm ||
      (l.name ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.phone.includes(searchTerm);
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    const matchQual = qualFilter === "all" || l.qualification === qualFilter;
    return matchSearch && matchStatus && matchQual;
  });

  const paginatedLeads = filteredLeads.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filteredLeads.length / pageSize);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(Boolean);
      const parsed = lines.slice(1).map((line) => {
        const cols = line.split(",").map((c) => c.trim().replace(/"/g, ""));
        return { name: cols[0] ?? "", phone: cols[1] ?? "", email: cols[2] ?? "" };
      }).filter((r) => r.phone);
      setCsvPreview(parsed);
    };
    reader.readAsText(file);
  };

  const importLeads = async () => {
    if (csvPreview.length === 0) return;
    setImporting(true);

    const records = csvPreview.map((r) => ({
      name: r.name || null,
      phone: r.phone,
      email: r.email || null,
      status: "new",
      source: "csv_import",
    }));

    const { error } = await supabase.from("contact_leads").insert(records as never[]);
    if (error) {
      console.error(error);
      toast.error("Erro ao importar leads.");
    } else {
      toast.success(`${csvPreview.length} leads importados com sucesso!`);
      setCsvPreview([]);
      setImportOpen(false);
      await loadLeads();
    }
    setImporting(false);
  };

  const exportCSV = () => {
    const headers = "Nome,Telefone,Email,Status,Qualificação,Tentativas,Última Tentativa\n";
    const rows = filteredLeads.map((l) =>
      `"${l.name ?? ""}","${l.phone}","${l.email ?? ""}","${l.status}","${l.qualification ?? ""}","${l.attempts}","${formatDate(l.last_attempt_at)}"`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Leads do Discador"
          subtitle="Gerencie, importe e acompanhe seus leads de campanhas de voz"
        >
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1.5" />Exportar CSV
            </Button>
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-1.5" />Importar CSV
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Importar Leads via CSV</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Arquivo CSV (colunas: nome, telefone, email)</Label>
                    <Input type="file" accept=".csv,.txt" onChange={handleFileUpload} />
                  </div>
                  {csvPreview.length > 0 && (
                    <>
                      <p className="text-sm text-muted-foreground">
                        <FileSpreadsheet className="inline h-4 w-4 mr-1" />
                        {csvPreview.length} leads encontrados
                      </p>
                      <div className="max-h-[200px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow><TableHead>Nome</TableHead><TableHead>Telefone</TableHead><TableHead>Email</TableHead></TableRow>
                          </TableHeader>
                          <TableBody>
                            {csvPreview.slice(0, 10).map((r, i) => (
                              <TableRow key={i}>
                                <TableCell>{r.name || "—"}</TableCell>
                                <TableCell>{r.phone}</TableCell>
                                <TableCell>{r.email || "—"}</TableCell>
                              </TableRow>
                            ))}
                            {csvPreview.length > 10 && (
                              <TableRow>
                                <TableCell colSpan={3} className="text-center text-muted-foreground">
                                  ... e mais {csvPreview.length - 10} leads
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      <Button onClick={importLeads} disabled={importing} className="w-full">
                        {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                        Importar {csvPreview.length} Leads
                      </Button>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="h-4 w-4 mr-1.5" />Adicionar Lead
            </Button>
          </div>
        </PageHeader>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Leads", value: totalLeads, icon: Users, color: "text-primary" },
            { label: "Novos", value: newLeads, icon: Plus, color: "text-blue-400" },
            { label: "HOT", value: hotLeads, icon: Flame, color: "text-red-400" },
            { label: "Convertidos", value: convertedLeads, icon: Phone, color: "text-emerald-400" },
          ].map((s) => (
            <Card key={s.label} className="bg-card border-border/60">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center">
                    <s.icon className={`h-5 w-5 ${s.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{s.value.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filtros */}
        <Card className="border-border/60 bg-card">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou telefone..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="new">Novo</SelectItem>
                  <SelectItem value="queued">Na Fila</SelectItem>
                  <SelectItem value="answered">Atendeu</SelectItem>
                  <SelectItem value="no_answer">Não Atendeu</SelectItem>
                  <SelectItem value="qualified">Qualificado</SelectItem>
                  <SelectItem value="converted">Convertido</SelectItem>
                  <SelectItem value="blacklist">Blacklist</SelectItem>
                </SelectContent>
              </Select>
              <Select value={qualFilter} onValueChange={(v) => { setQualFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Qualificação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="hot">HOT</SelectItem>
                  <SelectItem value="warm">WARM</SelectItem>
                  <SelectItem value="cold">COLD</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{filteredLeads.length} resultados</p>
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card className="border-border/60 bg-card">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Qualificação</TableHead>
                      <TableHead>Tentativas</TableHead>
                      <TableHead>Última Tentativa</TableHead>
                      <TableHead>Origem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLeads.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-12">Nenhum lead encontrado.</TableCell>
                      </TableRow>
                    ) : paginatedLeads.map((lead) => {
                      const st = statusLabels[lead.status] ?? { label: lead.status, color: "bg-muted text-muted-foreground" };
                      return (
                        <TableRow key={lead.id} className="hover:bg-secondary/30">
                          <TableCell className="font-medium text-foreground">{lead.name ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{formatPhone(lead.phone)}</TableCell>
                          <TableCell><Badge variant="outline" className={st.color}>{st.label}</Badge></TableCell>
                          <TableCell>{qualificationBadge(lead.qualification)}</TableCell>
                          <TableCell className="text-muted-foreground">{lead.attempts}/{lead.max_attempts}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{formatDate(lead.last_attempt_at)}</TableCell>
                          <TableCell><Badge variant="secondary" className="text-xs">{lead.source ?? "manual"}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
                    <p className="text-xs text-muted-foreground">Página {page + 1} de {totalPages}</p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
