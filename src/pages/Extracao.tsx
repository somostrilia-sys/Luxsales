import { useState, useEffect, useCallback, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { Search, Download, Loader2, Filter } from "lucide-react";

const ESTADOS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

interface Lead {
  id?: string;
  name: string;
  phone: string;
  email?: string;
  tipo_pessoa: string;
  city?: string;
  state?: string;
  category?: string;
  source: string;
  score: number;
  status?: string;
}

export default function Extracao() {
  const { companies } = useCompanyFilter();

  // Extraction form
  const [cep, setCep] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [bairro, setBairro] = useState("");
  const [companyTarget, setCompanyTarget] = useState("all");
  const [sources, setSources] = useState<string[]>(["pj_base"]);
  const [radius, setRadius] = useState([10]);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState(0);

  // Leads listing (from DB)
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Filters
  const [filterCity, setFilterCity] = useState("");
  const [filterState, setFilterState] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchName, setSearchName] = useState("");

  // Debounced filter values
  const [debouncedSearchName, setDebouncedSearchName] = useState("");
  const [debouncedFilterCity, setDebouncedFilterCity] = useState("");

  const perPage = 50;
  const nameInputRef = useRef<HTMLInputElement>(null);
  const cityInputRef = useRef<HTMLInputElement>(null);

  // Clear autofill on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (nameInputRef.current) nameInputRef.current.value = "";
      if (cityInputRef.current) cityInputRef.current.value = "";
      setSearchName("");
      setFilterCity("");
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Debounce search fields (600ms, min 3 chars)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchName(searchName.length >= 3 ? searchName : "");
    }, 600);
    return () => clearTimeout(timer);
  }, [searchName]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilterCity(filterCity.length >= 3 ? filterCity : "");
    }, 600);
    return () => clearTimeout(timer);
  }, [filterCity]);

  const formatCep = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 8);
    if (digits.length > 5) return digits.slice(0, 5) + "-" + digits.slice(5);
    return digits;
  };

  const handleCepChange = async (val: string) => {
    const formatted = formatCep(val);
    setCep(formatted);
    const digits = formatted.replace("-", "");
    if (digits.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setCity(data.localidade || "");
          setState(data.uf || "");
          setBairro(data.bairro || "");
        }
      } catch {}
    }
  };

  const toggleSource = (s: string) => {
    setSources(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  // Load leads from contact_leads table
  const loadLeads = useCallback(async () => {
    setLoadingLeads(true);
    try {
      let query = supabase.from("contact_leads").select("id,name,phone,email,tipo_pessoa,city,state,category,source,score,status");

      if (debouncedFilterCity) query = query.ilike("city", `%${debouncedFilterCity}%`);
      if (filterState !== "all") query = query.eq("state", filterState);
      if (filterType !== "all") query = query.eq("tipo_pessoa", filterType);
      if (filterStatus !== "all") query = query.eq("status", filterStatus);
      if (debouncedSearchName) query = query.ilike("name", `%${debouncedSearchName}%`);

      const { data, error } = await query
        .range(page * perPage, (page + 1) * perPage - 1)
        .limit(perPage);

      if (error) throw error;
      setLeads((data || []).map((d: any) => ({
        id: d.id,
        name: d.name || d.nome || "—",
        phone: d.phone || d.telefone || "—",
        email: d.email,
        tipo_pessoa: d.tipo_pessoa || "PJ",
        city: d.city || d.cidade || "",
        state: d.state || d.estado || "",
        category: d.category || d.categoria || "",
        source: d.source || d.fonte || "pj_base",
        score: d.score || 0,
        status: d.status || "novo",
      })));

      // Use RPC for count instead of HEAD query
      try {
        const { data: statsData } = await supabase.rpc('get_contact_leads_stats');
        if (statsData) setTotalLeads(statsData.total || 0);
      } catch { /* ignore count error */ }
    } catch (e: any) {
      toast.error("Erro ao carregar leads: " + e.message);
    } finally {
      setLoadingLeads(false);
    }
  }, [page, debouncedFilterCity, filterState, filterType, filterStatus, debouncedSearchName]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [debouncedFilterCity, filterState, filterType, filterStatus, debouncedSearchName]);

  // Supabase Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("leads-realtime")
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "contact_leads" },
        (payload: any) => {
          const d = payload.new;
          const newLead: Lead = {
            id: d.id,
            name: d.name || "—",
            phone: d.phone || "—",
            email: d.email,
            tipo_pessoa: d.tipo_pessoa || "PJ",
            city: d.city || "",
            state: d.state || "",
            category: d.category || "",
            source: d.source || "pj_base",
            score: d.score || 0,
            status: d.status || "novo",
          };
          setLeads(prev => [newLead, ...prev].slice(0, 50));
          setTotalLeads(p => p + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleExtract = async () => {
    const digits = cep.replace("-", "");
    if (digits.length !== 8) { toast.error("CEP inválido"); return; }
    if (sources.length === 0) { toast.error("Selecione ao menos uma fonte"); return; }

    setExtracting(true);
    setProgress(10);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      setProgress(30);

      const res = await fetch(`https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/unified-extract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          cep: digits,
          sources,
          company_target: companyTarget === "all" ? null : companyTarget,
          radius_km: radius[0],
        }),
      });

      setProgress(80);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na extração");

      setProgress(100);
      toast.success(`${(data.leads || []).length} leads extraídos!`);
      // Reload the listing to show new leads
      await loadLeads();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setExtracting(false);
    }
  };

  const toggleSelect = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === leads.length) setSelected(new Set());
    else setSelected(new Set(leads.map((_, i) => i)));
  };

  const exportCSV = () => {
    const items = selected.size > 0 ? Array.from(selected).map(i => leads[i]) : leads;
    const header = "Nome,Telefone,Email,Tipo,Cidade,Estado,Categoria,Fonte,Status,Score\n";
    const rows = items.map(l => `"${l.name}","${l.phone}","${l.email || ""}","${l.tipo_pessoa}","${l.city || ""}","${l.state || ""}","${l.category || ""}","${l.source}","${l.status || ""}","${l.score}"`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "leads.csv"; a.click();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      novo: "bg-primary text-primary-foreground",
      em_contato: "bg-warning text-warning-foreground",
      convertido: "bg-success text-success-foreground",
    };
    const labels: Record<string, string> = { novo: "Novo", em_contato: "Em contato", convertido: "Convertido" };
    return <Badge className={map[status] || "bg-muted text-muted-foreground"}>{labels[status] || status}</Badge>;
  };

  const totalPages = Math.ceil(totalLeads / perPage);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Extração de Leads</h1>

        <Tabs defaultValue="leads" className="space-y-4">
          <TabsList>
            <TabsTrigger value="leads">Leads ({totalLeads})</TabsTrigger>
            <TabsTrigger value="extract">Nova Extração</TabsTrigger>
          </TabsList>

          {/* LEADS LISTING TAB */}
          <TabsContent value="leads" className="space-y-4">
            {/* Filters */}
            <Card className="shadow-sm">
              <CardContent className="pt-4 pb-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div>
                    <Label className="text-xs">Buscar nome</Label>
                    <Input ref={nameInputRef} type="search" autoComplete="new-password" name="search_lead_name_xyz" placeholder="Nome do lead (min 3 chars)..." value={searchName} onChange={e => setSearchName(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">Cidade</Label>
                    <Input ref={cityInputRef} type="search" autoComplete="new-password" name="search_lead_city_xyz" placeholder="Filtrar cidade (min 3 chars)..." value={filterCity} onChange={e => setFilterCity(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">Estado</Label>
                    <Select value={filterState} onValueChange={setFilterState}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {ESTADOS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Tipo</Label>
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="PJ">PJ</SelectItem>
                        <SelectItem value="PF">PF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Status</Label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="novo">Novo</SelectItem>
                        <SelectItem value="em_contato">Em contato</SelectItem>
                        <SelectItem value="convertido">Convertido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Counter + Export */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <span className="font-bold text-foreground text-lg">{totalLeads}</span> leads encontrados
              </p>
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <Download className="h-4 w-4 mr-1" /> Exportar CSV
              </Button>
            </div>

            {/* Table */}
            <Card className="shadow-sm">
              <CardContent className="p-0">
                {loadingLeads ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : leads.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum lead encontrado</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox checked={selected.size === leads.length && leads.length > 0} onCheckedChange={toggleAll} />
                        </TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Cidade</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.map((lead, i) => (
                        <TableRow key={lead.id || i}>
                          <TableCell><Checkbox checked={selected.has(i)} onCheckedChange={() => toggleSelect(i)} /></TableCell>
                          <TableCell className="font-medium">{lead.name}</TableCell>
                          <TableCell>{lead.city || "—"}</TableCell>
                          <TableCell>{lead.state || "—"}</TableCell>
                          <TableCell><Badge variant={lead.tipo_pessoa === "PJ" ? "default" : "secondary"}>{lead.tipo_pessoa}</Badge></TableCell>
                          <TableCell>{lead.category || "—"}</TableCell>
                          <TableCell>{lead.phone}</TableCell>
                          <TableCell>{lead.email || "—"}</TableCell>
                          <TableCell>{statusBadge(lead.status || "novo")}</TableCell>
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
          </TabsContent>

          {/* EXTRACTION TAB */}
          <TabsContent value="extract" className="space-y-4">
            <Card className="shadow-sm">
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>CEP</Label>
                    <Input placeholder="00000-000" value={cep} onChange={e => handleCepChange(e.target.value)} />
                    {city && <p className="text-xs text-muted-foreground mt-1">{bairro && `${bairro}, `}{city}/{state}</p>}
                  </div>
                  <div>
                    <Label>Empresa Alvo</Label>
                    <Select value={companyTarget} onValueChange={setCompanyTarget}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Raio: {radius[0]} km</Label>
                    <Slider value={radius} onValueChange={setRadius} min={5} max={50} step={5} className="mt-2" />
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block">Fontes</Label>
                  <div className="flex flex-wrap gap-4">
                    {[
                      { id: "pj_base", label: "PJ Base" },
                      { id: "google_maps", label: "Google Maps" },
                      { id: "olx", label: "OLX" },
                      { id: "instagram", label: "Instagram" },
                    ].map(s => (
                      <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={sources.includes(s.id)} onCheckedChange={() => toggleSource(s.id)} />
                        <span className="text-sm">{s.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Button onClick={handleExtract} disabled={extracting} className="w-full md:w-auto" size="lg">
                  {extracting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                  Extrair Leads
                </Button>

                {extracting && <Progress value={progress} className="h-2" />}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
