import { useEffect, useState, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Download, Upload, Trash2, Users, Building2, Briefcase, Car, MapPin, Database, Radio } from "lucide-react";
import Papa from "papaparse";

interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  tipo_pessoa: string;
  city: string | null;
  region: string | null;
  category: string | null;
  subcategory: string | null;
  source: string | null;
  score: number | null;
  status: string;
  created_at: string;
}

const fmt = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

const getDestino = (lead: Lead): string => {
  if (lead.category === "objetivo-transporte" || lead.category === "objetivo-geral") return "Objetivo Auto & Truck";
  if (lead.category === "trilia-consultoria") return "Trilia";
  if (lead.source === "olx") return "OLX - Veículos PF";
  if (lead.source === "google_maps") return "Google Maps";
  return "Outros";
};

const destinoConfig = [
  { key: "objetivo-transporte", label: "Objetivo Auto & Truck", icon: Building2, color: "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  { key: "objetivo-geral", label: "Objetivo Geral", icon: Building2, color: "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" },
  { key: "trilia", label: "Trilia", icon: Briefcase, color: "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  { key: "olx", label: "OLX", icon: Car, color: "border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-300" },
  { key: "google", label: "Google Maps", icon: MapPin, color: "border-red-500 bg-red-500/10 text-red-700 dark:text-red-300" },
  { key: "all", label: "TOTAL", icon: Database, color: "border-primary bg-primary/10 text-primary" },
];

const tabConfig = [
  { key: "all", label: "Todos" },
  { key: "objetivo-transporte", label: "Motoristas / Transporte" },
  { key: "motorista-app", label: "Motoristas de App" },
  { key: "trilia-consultoria", label: "Empresas / Consultoria" },
  { key: "objetivo-geral", label: "Objetivo Geral" },
  { key: "olx", label: "OLX" },
  { key: "google_maps", label: "Google Maps" },
];

const IMPORT_FIELDS = ["name", "phone", "email", "document", "city", "state"] as const;
type ImportField = typeof IMPORT_FIELDS[number];

export default function BaseDados() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [dddFilter, setDddFilter] = useState("");
  const [includeNoPhone, setIncludeNoPhone] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [activeTab, setActiveTab] = useState("all");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pf: 0, pj: 0, email: 0, phone: 0 });
  const [destinoCounts, setDestinoCounts] = useState<Record<string, number>>({
    "objetivo-transporte": 0, "objetivo-geral": 0, trilia: 0, olx: 0, google: 0, all: 0,
  });
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({});
  const [distributeOpen, setDistributeOpen] = useState(false);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [assignTo, setAssignTo] = useState("");
  const [isLive, setIsLive] = useState(false);

  // Import CSV state
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<string[][]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importMapping, setImportMapping] = useState<Record<string, ImportField | "">>({}); 
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const perPage = 50;

  // Load counts via RPC (independent from table)
  const loadCounts = useCallback(async () => {
    setStatsLoading(true);
    const { data: s, error } = await supabase.rpc('get_contact_leads_stats');
    if (error) { console.error("Stats RPC error:", error); setStatsLoading(false); return; }

    setStats({ total: s.total ?? 0, pf: s.pf ?? 0, pj: s.pj ?? 0, email: s.com_email ?? 0, phone: s.com_telefone ?? 0 });
    setDestinoCounts({
      "objetivo-transporte": s.objetivo_transporte ?? 0,
      "objetivo-geral": s.objetivo_geral ?? 0,
      trilia: s.trilia ?? 0,
      olx: s.olx ?? 0,
      google: s.google_maps ?? 0,
      all: s.total ?? 0,
    });
    setTabCounts({
      all: s.total ?? 0,
      "objetivo-transporte": s.objetivo_transporte ?? 0,
      "motorista-app": s.motorista_app ?? (s.objetivo_transporte ?? 0),
      "trilia-consultoria": s.trilia ?? 0,
      "objetivo-geral": s.objetivo_geral ?? 0,
      olx: s.olx ?? 0,
      google_maps: s.google_maps ?? 0,
    });
    setStatsLoading(false);
  }, []);

  // Load table data
  const loadLeads = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("contact_leads").select("*", { count: "exact" });

    // Default: only leads with phone
    if (!includeNoPhone) query = query.not("phone", "is", null);

    // Tab filter
    if (activeTab === "objetivo-transporte") query = query.eq("category", "objetivo-transporte");
    else if (activeTab === "motorista-app") query = query.eq("subcategory", "motorista-aplicativo");
    else if (activeTab === "trilia-consultoria") query = query.eq("category", "trilia-consultoria");
    else if (activeTab === "objetivo-geral") query = query.eq("category", "objetivo-geral");
    else if (activeTab === "olx") query = query.eq("source", "olx");
    else if (activeTab === "google_maps") query = query.eq("source", "google_maps");

    if (filterType !== "all") query = query.eq("tipo_pessoa", filterType);
    if (filterStatus !== "all") query = query.eq("status", filterStatus);
    if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    if (citySearch) query = query.ilike("city", `%${citySearch}%`);
    if (dddFilter && dddFilter.length === 2) query = query.like("phone", `${dddFilter}%`);

    const { data, count } = await query
      .range(page * perPage, (page + 1) * perPage - 1);

    setLeads((data || []) as Lead[]);
    setTotal(count || 0);
    setLoading(false);
  }, [activeTab, filterType, filterStatus, search, citySearch, dddFilter, includeNoPhone, page]);

  useEffect(() => { loadCounts(); }, [loadCounts]);
  useEffect(() => { loadLeads(); }, [loadLeads]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("contact_leads_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "contact_leads" }, () => {
        setStats(prev => ({ ...prev, total: prev.total + 1 }));
        setDestinoCounts(prev => ({ ...prev, all: prev.all + 1 }));
        setTabCounts(prev => ({ ...prev, all: (prev.all ?? 0) + 1 }));
      })
      .subscribe((status) => {
        setIsLive(status === "SUBSCRIBED");
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

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
      google_maps: "bg-green-600/20 text-green-700 dark:text-green-300",
      olx: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
      instagram: "bg-purple-600/20 text-purple-700 dark:text-purple-300",
      pj_base: "bg-primary/20 text-primary",
    };
    const s = source || "—";
    return <Badge className={colors[s] || "bg-muted text-muted-foreground"}>{s}</Badge>;
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-muted text-muted-foreground",
      contacted: "bg-primary/20 text-primary",
      interested: "bg-green-500/20 text-green-700 dark:text-green-300",
      not_interested: "bg-destructive/20 text-destructive",
      converted: "bg-green-600 text-white",
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

  const exportCSV = async () => {
    toast.info("Preparando exportação...");
    let query = supabase.from("contact_leads").select("*");

    if (activeTab === "objetivo-transporte") query = query.eq("category", "objetivo-transporte");
    else if (activeTab === "motorista-app") query = query.eq("subcategory", "motorista-aplicativo");
    else if (activeTab === "trilia-consultoria") query = query.eq("category", "trilia-consultoria");
    else if (activeTab === "objetivo-geral") query = query.eq("category", "objetivo-geral");
    else if (activeTab === "olx") query = query.eq("source", "olx");
    else if (activeTab === "google_maps") query = query.eq("source", "google_maps");

    if (!includeNoPhone) query = query.not("phone", "is", null);
    if (filterType !== "all") query = query.eq("tipo_pessoa", filterType);
    if (filterStatus !== "all") query = query.eq("status", filterStatus);
    if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    if (citySearch) query = query.ilike("city", `%${citySearch}%`);
    if (dddFilter && dddFilter.length === 2) query = query.like("phone", `${dddFilter}%`);

    const { data } = await query.limit(10000);
    const items = data || [];

    const header = "Nome,Telefone,Email,Tipo,Cidade,UF,Categoria,Fonte,Destino,Score,Status\n";
    const rows = items.map((l: any) =>
      `"${l.name}","${l.phone}","${l.email || ""}","${l.tipo_pessoa}","${l.city || ""}","${l.region || ""}","${l.category || ""}","${l.source || ""}","${getDestino(l)}","${l.score || ""}","${l.status}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "base-dados.csv"; a.click();
    toast.success(`${fmt(items.length)} leads exportados`);
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

  // --- Import CSV logic ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      preview: 100, // parse enough to show preview
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as string[][];
        if (rows.length < 2) { toast.error("Arquivo vazio ou inválido"); return; }
        setImportHeaders(rows[0]);
        setImportRows(rows.slice(1));
        // Auto-map by header name
        const autoMap: Record<string, ImportField | ""> = {};
        rows[0].forEach((h) => {
          const lower = h.toLowerCase().trim();
          if (lower.includes("nome") || lower === "name") autoMap[h] = "name";
          else if (lower.includes("telefone") || lower.includes("phone") || lower === "celular") autoMap[h] = "phone";
          else if (lower.includes("email") || lower === "e-mail") autoMap[h] = "email";
          else if (lower.includes("cpf") || lower.includes("cnpj") || lower === "document" || lower === "documento") autoMap[h] = "document";
          else if (lower.includes("cidade") || lower === "city") autoMap[h] = "city";
          else if (lower.includes("estado") || lower === "uf" || lower === "state") autoMap[h] = "state";
          else autoMap[h] = "";
        });
        setImportMapping(autoMap);
        setImportOpen(true);
      },
      error: () => toast.error("Erro ao ler arquivo"),
    });
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const runImport = async () => {
    const mappedFields = Object.entries(importMapping).filter(([, v]) => v !== "");
    if (!mappedFields.some(([, v]) => v === "name" || v === "phone")) {
      toast.error("Mapeie pelo menos 'name' ou 'phone'");
      return;
    }

    setImporting(true);
    const allRows = importRows;
    const batchSize = 200;
    let done = 0;
    setImportProgress({ done: 0, total: allRows.length });

    for (let i = 0; i < allRows.length; i += batchSize) {
      const batch = allRows.slice(i, i + batchSize).map(row => {
        const record: Record<string, string> = {};
        importHeaders.forEach((h, idx) => {
          const field = importMapping[h];
          if (field && row[idx]) {
            if (field === "state") record["region"] = row[idx];
            else record[field] = row[idx];
          }
        });
        // defaults
        if (!record.status) record.status = "pending";
        if (!record.tipo_pessoa) record.tipo_pessoa = "PF";
        return record;
      });

      const { error } = await supabase.from("contact_leads").upsert(batch, { onConflict: "document" });
      if (error) console.error("Import batch error:", error);
      done += batch.length;
      setImportProgress({ done, total: allRows.length });
    }

    toast.success(`${fmt(done)} leads importados`);
    setImporting(false);
    setImportOpen(false);
    setImportRows([]);
    setImportHeaders([]);
    loadLeads();
    loadCounts();
  };

  const totalPages = Math.ceil(total / perPage);

  const handleDestinoClick = (key: string) => {
    const cardToTab: Record<string, string> = {
      "objetivo-transporte": "objetivo-transporte",
      "objetivo-geral": "objetivo-geral",
      trilia: "trilia-consultoria",
      olx: "olx",
      google: "google_maps",
      all: "all",
    };
    const tab = cardToTab[key] || "all";
    setActiveTab(tab);
    setPage(0);
  };

  const SkeletonRows = () => (
    <>
      {Array.from({ length: 10 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-4" /></TableCell>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell><Skeleton className="h-4 w-36" /></TableCell>
          <TableCell><Skeleton className="h-4 w-10" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-10" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        </TableRow>
      ))}
    </>
  );

  const SkeletonCard = () => (
    <Card>
      <CardContent className="pt-4 pb-3 text-center">
        <Skeleton className="h-5 w-5 mx-auto mb-1 rounded" />
        <Skeleton className="h-3 w-16 mx-auto mb-1" />
        <Skeleton className="h-7 w-20 mx-auto" />
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Base de Dados</h1>
          {isLive && (
            <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 animate-pulse gap-1">
              <Radio className="h-3 w-3" /> Ao vivo
            </Badge>
          )}
        </div>

        {/* Destination company cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {destinoConfig.map(d => {
            const Icon = d.icon;
            const count = destinoCounts[d.key] ?? 0;
            const isActive =
              (d.key === "objetivo-transporte" && activeTab === "objetivo-transporte") ||
              (d.key === "objetivo-geral" && activeTab === "objetivo-geral") ||
              (d.key === "trilia" && activeTab === "trilia-consultoria") ||
              (d.key === "olx" && activeTab === "olx") ||
              (d.key === "google" && activeTab === "google_maps") ||
              (d.key === "all" && activeTab === "all");
            return (
              <Card
                key={d.key}
                className={`cursor-pointer transition-all border-2 ${isActive ? d.color + " ring-2 ring-offset-2 ring-primary/30" : "border-transparent hover:border-muted-foreground/20"}`}
                onClick={() => handleDestinoClick(d.key)}
              >
                <CardContent className="pt-4 pb-3 text-center">
                  {statsLoading ? (
                    <>
                      <Skeleton className="h-5 w-5 mx-auto mb-1 rounded" />
                      <Skeleton className="h-3 w-16 mx-auto mb-1" />
                      <Skeleton className="h-7 w-20 mx-auto" />
                    </>
                  ) : (
                    <>
                      <Icon className={`h-5 w-5 mx-auto mb-1 ${isActive ? "" : "text-muted-foreground"}`} />
                      <p className="text-xs font-medium truncate">{d.label}</p>
                      <p className="text-2xl font-bold">{fmt(count)}</p>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
                {statsLoading ? <Skeleton className="h-6 w-20 mx-auto mt-1" /> : <p className="text-xl font-bold">{fmt(s.value)}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Category tabs */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPage(0); }}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            {tabConfig.map(t => (
              <TabsTrigger key={t.key} value={t.key} className="text-xs">
                {t.label} {tabCounts[t.key] != null ? `(${fmt(tabCounts[t.key])})` : ""}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <Input placeholder="Buscar nome/telefone..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="w-64" />
          <Input placeholder="Buscar cidade..." value={citySearch} onChange={e => { setCitySearch(e.target.value); setPage(0); }} className="w-44" />
          <Input placeholder="DDD (ex: 11)" value={dddFilter} onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 2); setDddFilter(v); setPage(0); }} className="w-24" maxLength={2} />
          <Select value={filterType} onValueChange={v => { setFilterType(v); setPage(0); }}>
            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="PF">PF</SelectItem>
              <SelectItem value="PJ">PJ</SelectItem>
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
          <div className="flex items-center gap-2">
            <Switch checked={includeNoPhone} onCheckedChange={(v) => { setIncludeNoPhone(v); setPage(0); }} id="no-phone" />
            <Label htmlFor="no-phone" className="text-xs whitespace-nowrap cursor-pointer">Incluir sem telefone</Label>
          </div>
        </div>

        {/* Bulk actions */}
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

        {/* Table */}
        <Card>
          <CardContent className="p-0">
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
                {loading ? <SkeletonRows /> : leads.map(lead => (
                  <TableRow key={lead.id}>
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
                        lead.score >= 80 ? <Badge className="bg-green-600 text-white">{lead.score}</Badge> :
                        lead.score >= 60 ? <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-300">{lead.score}</Badge> :
                        <Badge variant="secondary">{lead.score}</Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{statusBadge(lead.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
            <span className="text-sm text-muted-foreground">Página {page + 1} de {fmt(totalPages)} ({fmt(total)} resultados)</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Próxima</Button>
          </div>
        )}

        {!selected.size && !loading && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" /> Exportar CSV (máx 10.000)</Button>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={handleFileSelect} />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4 mr-1" /> Importar CSV</Button>
          </div>
        )}
      </div>

      {/* Distribute Dialog */}
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

      {/* Import CSV Dialog */}
      <Dialog open={importOpen} onOpenChange={(o) => { if (!importing) setImportOpen(o); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Importar CSV</DialogTitle></DialogHeader>

          {importing ? (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground text-center">
                Importando... {fmt(importProgress.done)} de {fmt(importProgress.total)}
              </p>
              <Progress value={importProgress.total ? (importProgress.done / importProgress.total) * 100 : 0} />
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{fmt(importRows.length)} linhas encontradas. Mapeie as colunas:</p>

              {/* Column mapping */}
              <div className="grid grid-cols-2 gap-2">
                {importHeaders.map(h => (
                  <div key={h} className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate w-28" title={h}>{h}</span>
                    <Select value={importMapping[h] || ""} onValueChange={v => setImportMapping(prev => ({ ...prev, [h]: v as ImportField | "" }))}>
                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Ignorar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Ignorar</SelectItem>
                        {IMPORT_FIELDS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {/* Preview */}
              {importRows.length > 0 && (
                <div className="overflow-x-auto border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {importHeaders.map(h => <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importRows.slice(0, 3).map((row, i) => (
                        <TableRow key={i}>
                          {row.map((cell, j) => <TableCell key={j} className="text-xs whitespace-nowrap">{cell}</TableCell>)}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
                <Button onClick={runImport}>Importar {fmt(importRows.length)} leads</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
