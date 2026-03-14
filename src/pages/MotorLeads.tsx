// Motor de Leads v4.0 — Reescrito do zero
import { useState, useEffect, useRef, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import Papa from "papaparse";
import {
  Rocket, Upload, Send, Loader2, RefreshCw, Users, MapPin, Phone,
  Shuffle, Package, Eye, CheckCircle, MessageCircle, Copy, ExternalLink,
  Zap, TrendingUp, History, Clock, Play, Pause, Radio
} from "lucide-react";

const COMMERCIAL_SLUGS = ["comercial", "consultor", "gestor-comercial", "gestor-trilia", "gestora-essencia", "gestor-digitallux"];

/** Resolve companyId: "all" means null (for RPCs) or fallback to collaborator's company */
function resolveCompanyId(selectedCompanyId: string, fallback?: string | null): string | null {
  if (selectedCompanyId && selectedCompanyId !== "all") return selectedCompanyId;
  return fallback || null;
}



// ═══════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════
export default function MotorLeads() {
  const { collaborator, roleLevel } = useCollaborator();
  const isAdmin = roleLevel <= 1;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Rocket className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Motor de Leads</h1>
            <p className="text-muted-foreground text-sm">
              {isAdmin ? "Upload, distribuição e acompanhamento de leads" : "Seus leads para prospecção"}
            </p>
          </div>
        </div>
        {isAdmin ? <AdminView /> : <ConsultorView />}
      </div>
    </DashboardLayout>
  );
}

// ═══════════════════════════════════════════
// ADMIN VIEW — Tabs: Upload, Distribuição, Dashboard, Histórico
// ═══════════════════════════════════════════
function AdminView() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="grid grid-cols-4 w-full max-w-2xl">
        <TabsTrigger value="dashboard" className="gap-1.5">
          <Eye className="h-4 w-4" /> Dashboard
        </TabsTrigger>
        <TabsTrigger value="upload" className="gap-1.5">
          <Upload className="h-4 w-4" /> Upload
        </TabsTrigger>
        <TabsTrigger value="distribute" className="gap-1.5">
          <Shuffle className="h-4 w-4" /> Distribuição
        </TabsTrigger>
        <TabsTrigger value="history" className="gap-1.5">
          <History className="h-4 w-4" /> Histórico
        </TabsTrigger>
      </TabsList>

      <TabsContent value="dashboard" className="space-y-4 mt-4"><DashboardTab /></TabsContent>
      <TabsContent value="upload" className="space-y-4 mt-4"><UploadTab /></TabsContent>
      <TabsContent value="distribute" className="space-y-4 mt-4"><DistributeTab /></TabsContent>
      <TabsContent value="history" className="space-y-4 mt-4"><HistoryTab /></TabsContent>
    </Tabs>
  );
}

// ═══════════════════════════════════════════
// UPLOAD TAB — Import CSV into lead_items
// ═══════════════════════════════════════════
function UploadTab() {
  const { collaborator } = useCollaborator();
  const { selectedCompanyId } = useCompanyFilter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [totalRows, setTotalRows] = useState(0);
  const [counts, setCounts] = useState<{ disponiveis: number; naoImportados: number } | null>(null);

  const companyId = resolveCompanyId(selectedCompanyId, collaborator?.company_id);

  const loadCounts = useCallback(async () => {
    const { data, error } = await supabase.rpc("count_available_leads", { p_company_id: companyId || null });
    if (error) { console.error(error); return; }
    const d = data as any;
    setCounts({
      disponiveis: d?.lead_items_disponiveis ?? 0,
      naoImportados: (d?.contact_leads_nao_importados ?? 0) + (d?.leads_nao_importados ?? 0),
    });
  }, [companyId]);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  const handleSync = useCallback(async () => {
    if (!companyId) { toast.error("Empresa não encontrada"); return; }
    setSyncing(true);
    try {
      const { data, error } = await supabase.rpc("sync_leads_from_base", { p_company_id: companyId, p_limit: 50000 });
      if (error) throw error;
      const r = data as any;
      const totalImported = r?.total ?? 0;
      await loadCounts();
      const remaining = counts?.naoImportados ?? 0;
      if (remaining > 0 && totalImported > 0) {
        toast.success(`Sincronizados ${totalImported.toLocaleString("pt-BR")} leads. Ainda restam ${remaining.toLocaleString("pt-BR")} na base.`);
      } else if (totalImported > 0) {
        toast.success(`Sincronizado! ${totalImported.toLocaleString("pt-BR")} novos leads importados`);
      } else {
        toast.info("Base já está sincronizada. Nenhum lead novo.");
      }
    } catch (e: any) { toast.error("Erro: " + e.message); }
    finally { setSyncing(false); }
  }, [companyId, loadCounts]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as any[];
        setPreview(rows.slice(0, 5));
        setTotalRows(rows.length);
        if (rows.length === 0) { toast.error("Arquivo vazio"); return; }
      },
      error: (err) => toast.error("Erro ao ler arquivo: " + err.message),
    });
  };

  const handleImport = async () => {
    if (preview.length === 0 || totalRows === 0) return;
    if (!companyId) { toast.error("Empresa não encontrada"); return; }
    setImporting(true);
    try {
      const file = fileRef.current?.files?.[0];
      if (!file) { toast.error("Selecione o arquivo novamente"); setImporting(false); return; }
      const parseResult = await new Promise<any[]>((resolve, reject) => {
        Papa.parse(file, { header: true, skipEmptyLines: true, complete: (r) => resolve(r.data as any[]), error: (e) => reject(e) });
      });
      const items = parseResult
        .filter(r => r.telefone || r.phone || r.tel)
        .map(r => ({
          telefone: (r.telefone || r.phone || r.tel || "").toString().trim(),
          nome: (r.nome || r.name || "Sem nome").toString().trim(),
          cidade: (r.cidade || r.city || "").toString().trim() || null,
          estado: (r.estado || r.state || r.uf || "").toString().trim() || null,
          ddd: (r.ddd || "").toString().trim() || null,
          fonte: (r.fonte || r.source || "").toString().trim() || null,
          status: "disponivel",
          company_id: companyId,
        }));
      if (items.length === 0) { toast.error("Nenhum lead com telefone válido"); setImporting(false); return; }
      let inserted = 0;
      for (let i = 0; i < items.length; i += 500) {
        const chunk = items.slice(i, i + 500);
        const { error } = await supabase.from("lead_items").insert(chunk);
        if (error) throw error;
        inserted += chunk.length;
      }
      toast.success(`${inserted.toLocaleString("pt-BR")} leads importados!`);
      setPreview([]); setFileName(""); setTotalRows(0);
      if (fileRef.current) fileRef.current.value = "";
      loadCounts();
    } catch (e: any) { toast.error("Erro: " + e.message); }
    finally { setImporting(false); }
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary"><Package className="h-5 w-5" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Disponíveis (lead_items)</p>
                <p className="text-2xl font-bold text-foreground">{counts?.disponiveis?.toLocaleString("pt-BR") ?? "..."}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/20 text-accent-foreground"><TrendingUp className="h-5 w-5" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Na base (não importados)</p>
                <p className="text-2xl font-bold text-foreground">{counts?.naoImportados?.toLocaleString("pt-BR") ?? "..."}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 flex items-center justify-center">
            <Button onClick={handleSync} disabled={syncing} variant="outline" className="gap-2 w-full">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {syncing ? "Sincronizando..." : "Sincronizar Base"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" /> Importar Leads (CSV)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Colunas aceitas: <span className="font-mono text-xs text-foreground">nome, telefone, cidade, estado, ddd, fonte</span>
          </p>
          <div className="flex gap-3 items-center">
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
            <Button onClick={() => fileRef.current?.click()} disabled={importing} variant="outline" className="gap-2">
              <Upload className="h-4 w-4" /> Selecionar Arquivo
            </Button>
            {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
          </div>
          {preview.length > 0 && (
            <>
              <div className="border rounded-lg overflow-hidden border-border">
                <p className="text-xs text-muted-foreground p-2 bg-muted/30">
                  Prévia — {totalRows.toLocaleString("pt-BR")} linhas no total
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(preview[0]).slice(0, 6).map(k => (
                        <TableHead key={k} className="text-xs">{k}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, i) => (
                      <TableRow key={i}>
                        {Object.values(row).slice(0, 6).map((v, j) => (
                          <TableCell key={j} className="text-xs">{String(v || "—")}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button onClick={handleImport} disabled={importing} className="gap-2">
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                {importing ? "Importando..." : `Confirmar importação de ${totalRows.toLocaleString("pt-BR")} leads`}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ═══════════════════════════════════════════
// DISTRIBUTE TAB — RPC distribute_leads
// ═══════════════════════════════════════════
function DistributeTab() {
  const { collaborator, isCEO } = useCollaborator();
  const [loading, setLoading] = useState(true);
  const [distributing, setDistributing] = useState(false);
  const [distributingAll, setDistributingAll] = useState(false);
  const [filterCity, setFilterCity] = useState("");
  const [filterDDD, setFilterDDD] = useState("");
  const [quantity, setQuantity] = useState("500");
  const [targetCollab, setTargetCollab] = useState("");
  const [selectedCollabs, setSelectedCollabs] = useState<Set<string>>(new Set());
  const [cities, setCities] = useState<string[]>([]);
  const [ddds, setDDDs] = useState<string[]>([]);
  const [commercialCollabs, setCommercialCollabs] = useState<{ id: string; name: string }[]>([]);
  const [availableCount, setAvailableCount] = useState(0);
  const [countDetails, setCountDetails] = useState<{ disponiveis: number; naoImportados: number } | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Company selector (local state, independent from global filter)
  const [allCompanies, setAllCompanies] = useState<{ id: string; name: string }[]>([]);
  const [distCompanyId, setDistCompanyId] = useState<string | null>(null);

  // Lead pool stats (Objetivo / Trilia counts from contact_leads)
  const [leadPoolStats, setLeadPoolStats] = useState<{ objetivo: number; trilia: number } | null>(null);

  // Load all companies on mount and auto-select first (only Objetivo/Trilia)
  useEffect(() => {
    const loadCompanies = async () => {
      const { data } = await supabase.from("companies").select("id, name").order("name");
      const list = (data || []).filter(c => c.name.includes("Objetivo") || c.name.includes("Trilia"));
      setAllCompanies(list);
      if (list.length > 0 && !distCompanyId) {
        setDistCompanyId(list[0].id);
      }
    };
    loadCompanies();
  }, []);

  // Load lead pool stats when distCompanyId changes
  useEffect(() => {
    const loadStats = async () => {
      const { data } = await supabase.rpc("get_contact_leads_stats");
      if (data) {
        const d = data as any;
        setLeadPoolStats({ objetivo: d.objetivo_transporte ?? 0, trilia: d.trilia ?? 0 });
      }
    };
    if (distCompanyId) loadStats();
  }, [distCompanyId]);

  useEffect(() => { if (distCompanyId) loadFilterOptions(); }, [distCompanyId]);
  useEffect(() => { countAvailable(); }, [filterCity, filterDDD, distCompanyId]);

  const selectedCompanyName = allCompanies.find(c => c.id === distCompanyId)?.name || "";

  const loadFilterOptions = async () => {
    if (!distCompanyId) return;
    setLoading(true);
    setSelectedCollabs(new Set());
    setTargetCollab("");
    try {
      const { data: cityData } = await supabase
        .from("lead_items")
        .select("cidade")
        .eq("company_id", distCompanyId)
        .eq("status", "disponivel")
        .is("assigned_to", null)
        .not("cidade", "is", null)
        .limit(1000);

      const { data: dddData } = await supabase
        .from("lead_items")
        .select("ddd")
        .eq("company_id", distCompanyId)
        .eq("status", "disponivel")
        .is("assigned_to", null)
        .not("ddd", "is", null)
        .limit(1000);

      const citySet = new Set<string>();
      (cityData || []).forEach(item => { if (item.cidade) citySet.add(item.cidade); });
      setCities(Array.from(citySet).sort());

      const dddSet = new Set<string>();
      (dddData || []).forEach(item => { if (item.ddd) dddSet.add(item.ddd); });
      setDDDs(Array.from(dddSet).sort());

      // Load commercial collaborators filtered by selected company
      const { data: roles } = await supabase
        .from("roles").select("id,slug,level").gte("level", 2).eq("active", true);
      const commercialRoleIds = (roles || [])
        .filter(r => r.slug && COMMERCIAL_SLUGS.some(s => (r.slug || "").includes(s)))
        .map(r => r.id);

      if (commercialRoleIds.length > 0) {
        const { data: collabs } = await supabase
          .from("collaborators")
          .select("id,name,role_id")
          .in("role_id", commercialRoleIds)
          .eq("active", true)
          .eq("company_id", distCompanyId)
          .order("name");
        setCommercialCollabs(collabs || []);
      } else {
        setCommercialCollabs([]);
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const countAvailable = useCallback(async () => {
    const cid = distCompanyId || null;
    try {
      const { data, error } = await supabase.rpc("count_available_leads", { p_company_id: cid });
      if (error) { console.error("count_available_leads error:", error); setAvailableCount(0); setCountDetails(null); return; }
      const d = data as any;
      const disponiveis = d?.lead_items_disponiveis ?? 0;
      const naoImportados = (d?.contact_leads_nao_importados ?? 0) + (d?.leads_nao_importados ?? 0);
      setCountDetails({ disponiveis, naoImportados });
      setAvailableCount(disponiveis + naoImportados);
    } catch (e) {
      console.error("countAvailable error:", e);
      setAvailableCount(0);
    }
  }, [distCompanyId]);

  const handleSyncBeforeDistribute = useCallback(async () => {
    if (!distCompanyId) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.rpc("sync_leads_from_base", { p_company_id: distCompanyId, p_limit: 50000 });
      if (error) throw error;
      const r = data as any;
      const totalImported = r?.total ?? 0;
      await countAvailable();
      const remaining = countDetails?.naoImportados ?? 0;
      if (remaining > 0 && totalImported > 0) {
        toast.success(`Sincronizados ${totalImported.toLocaleString("pt-BR")} leads. Ainda restam ${remaining.toLocaleString("pt-BR")} na base.`);
      } else if (totalImported > 0) {
        toast.success(`Sincronizado! ${totalImported.toLocaleString("pt-BR")} novos leads importados`);
      } else {
        toast.info("Base já está sincronizada. Nenhum lead novo.");
      }
    } catch (e: any) { toast.error("Erro ao sincronizar: " + e.message); }
    finally { setSyncing(false); }
  }, [distCompanyId, countAvailable]);

  const handleDistribute = async () => {
    if (!targetCollab || !distCompanyId || !collaborator?.id) { toast.error("Selecione um consultor"); return; }
    setDistributing(true);
    try {
      const { data, error } = await supabase.rpc("distribute_leads", {
        p_assigned_to: targetCollab,
        p_company_id: distCompanyId,
        p_assigned_by: collaborator.id,
        p_quantidade: parseInt(quantity) || 500,
        p_filtro_cidade: filterCity || null,
        p_filtro_ddd: filterDDD || null,
      });
      if (error) throw error;
      const result = data as any;
      const collabName = commercialCollabs.find(c => c.id === targetCollab)?.name || "";
      toast.success(`${result.leads_distribuidos || 0} leads distribuídos para ${collabName}!`);
      countAvailable();
    } catch (e: any) { toast.error("Erro: " + e.message); }
    finally { setDistributing(false); }
  };

  const handleDistributeAll = async () => {
    if (!distCompanyId || !collaborator?.id) return;
    const targets = selectedCollabs.size > 0
      ? commercialCollabs.filter(c => selectedCollabs.has(c.id))
      : commercialCollabs;
    if (targets.length === 0) { toast.error("Nenhum consultor selecionado"); return; }

    setDistributingAll(true);
    try {
      let totalDist = 0;
      for (const collab of targets) {
        const { data, error } = await supabase.rpc("distribute_leads", {
          p_assigned_to: collab.id,
          p_company_id: distCompanyId,
          p_assigned_by: collaborator.id,
          p_quantidade: parseInt(quantity) || 500,
          p_filtro_cidade: filterCity || null,
          p_filtro_ddd: filterDDD || null,
        });
        if (error) throw error;
        totalDist += (data as any)?.leads_distribuidos || 0;
      }
      toast.success(`${totalDist} leads distribuídos para ${targets.length} consultores!`);
      countAvailable();
    } catch (e: any) { toast.error("Erro: " + e.message); }
    finally { setDistributingAll(false); }
  };

  const toggleCollabSelection = (id: string) => {
    setSelectedCollabs(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  if (!distCompanyId && allCompanies.length === 0) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (loading && allCompanies.length > 0 && distCompanyId) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary"><Package className="h-5 w-5" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total disponível para distribuição</p>
                <p className="text-2xl font-bold text-foreground">{availableCount.toLocaleString("pt-BR")}</p>
                {countDetails && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {countDetails.disponiveis.toLocaleString("pt-BR")} prontos · {countDetails.naoImportados.toLocaleString("pt-BR")} na base (auto-sync)
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 flex items-center justify-center">
            <Button onClick={handleSyncBeforeDistribute} disabled={syncing} variant="outline" className="gap-2 w-full">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {syncing ? "Sincronizando..." : "Sincronizar Base Agora"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 flex items-center justify-center">
            <Button onClick={() => countAvailable()} variant="ghost" className="gap-2 w-full">
              <RefreshCw className="h-4 w-4" /> Atualizar Contadores
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shuffle className="h-5 w-5 text-primary" /> Distribuição Manual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Company Selector */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Empresa</p>
            <Select value={distCompanyId || ""} onValueChange={(v) => setDistCompanyId(v)}>
              <SelectTrigger className="w-full sm:w-[280px]"><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
              <SelectContent>
                {allCompanies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Filters */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Filtros</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> Cidade</Label>
                <Select value={filterCity || "all"} onValueChange={v => setFilterCity(v === "all" ? "" : v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> DDD</Label>
                <Select value={filterDDD || "all"} onValueChange={v => setFilterDDD(v === "all" ? "" : v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {ddds.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Quantidade por consultor</Label>
                <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min="1" max="5000" className="mt-1" />
              </div>
            </div>
          </div>

          {/* Single target */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Distribuir para um consultor</p>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Select value={targetCollab} onValueChange={setTargetCollab}>
                  <SelectTrigger><SelectValue placeholder="Selecione o consultor" /></SelectTrigger>
                  <SelectContent>
                    {commercialCollabs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleDistribute} disabled={distributing || !targetCollab || availableCount === 0} className="gap-2">
                {distributing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Distribuir Lote
              </Button>
            </div>
          </div>

          {/* Distribute to all / selected */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Distribuir para todos ({selectedCollabs.size > 0 ? `${selectedCollabs.size} selecionados` : `${commercialCollabs.length} consultores da ${selectedCompanyName}`})
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-3">
              {commercialCollabs.map(c => (
                <label key={c.id} className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors text-sm">
                  <Checkbox checked={selectedCollabs.has(c.id)} onCheckedChange={() => toggleCollabSelection(c.id)} />
                  <span className="truncate">{c.name}</span>
                </label>
              ))}
              {commercialCollabs.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-full">Nenhum consultor comercial encontrado para {selectedCompanyName}</p>
              )}
            </div>
            <Button onClick={handleDistributeAll} disabled={distributingAll || availableCount === 0 || commercialCollabs.length === 0} variant="outline" className="gap-2">
              {distributingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              Distribuir para Todos ({commercialCollabs.length} Consultores da {selectedCompanyName}) — {quantity} cada
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ═══════════════════════════════════════════
// DASHBOARD TAB — RPC get_lead_stats_by_collaborator + Realtime
// ═══════════════════════════════════════════
function DashboardTab() {
  const { collaborator } = useCollaborator();
  const { selectedCompanyId } = useCompanyFilter();
  const [loading, setLoading] = useState(true);
  const [autoRefill, setAutoRefill] = useState(false);
  const [togglingRefill, setTogglingRefill] = useState(false);
  const [stats, setStats] = useState<any[]>([]);

  const companyId = resolveCompanyId(selectedCompanyId, collaborator?.company_id);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      // Auto-refill config
      const { data: cfg } = await supabase
        .from("system_configs").select("value").eq("key", "auto_refill_enabled").single();
      setAutoRefill(cfg?.value === "true");

      // Stats via RPC
      const { data, error } = await supabase.rpc("get_lead_stats_by_collaborator", {
        p_company_id: companyId || null,
      });
      if (error) throw error;
      setStats(data || []);
    } catch (e: any) {
      toast.error("Erro ao carregar dashboard: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  // Realtime subscription on lead_items
  useEffect(() => {
    const channel = supabase
      .channel("lead_items_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_items" }, () => {
        loadDashboard();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadDashboard]);

  const toggleAutoRefill = async (enabled: boolean) => {
    setTogglingRefill(true);
    try {
      const { error } = await supabase.from("system_configs").upsert(
        { key: "auto_refill_enabled", value: enabled ? "true" : "false", updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
      if (error) throw error;
      setAutoRefill(enabled);
      toast.success(enabled ? "Reposição automática ativada" : "Reposição automática desativada");
    } catch (e: any) { toast.error(e.message); }
    finally { setTogglingRefill(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const totals = stats.reduce((acc, s) => ({
    atribuidos: acc.atribuidos + (s.total_atribuidos || 0),
    enviados: acc.enviados + (s.total_enviados || 0),
    pendentes: acc.pendentes + (s.total_pendentes || 0),
    responderam: acc.responderam + (s.total_responderam || 0),
    convertidos: acc.convertidos + (s.total_convertidos || 0),
  }), { atribuidos: 0, enviados: 0, pendentes: 0, responderam: 0, convertidos: 0 });

  return (
    <>
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard icon={<Users className="h-5 w-5" />} label="Atribuídos" value={totals.atribuidos} />
        <SummaryCard icon={<Package className="h-5 w-5" />} label="Pendentes" value={totals.pendentes} color="warning" />
        <SummaryCard icon={<Send className="h-5 w-5" />} label="Enviados" value={totals.enviados} />
        <SummaryCard icon={<MessageCircle className="h-5 w-5" />} label="Responderam" value={totals.responderam} color="success" />
        <SummaryCard icon={<CheckCircle className="h-5 w-5" />} label="Convertidos" value={totals.convertidos} color="success" />
      </div>

      {/* Auto-refill toggle */}
      <Card className="border-border">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary"><Zap className="h-5 w-5" /></div>
              <div>
                <p className="font-medium text-foreground">Reposição Automática (Bolt)</p>
                <p className="text-xs text-muted-foreground">Repõe leads automaticamente quando estoque cai abaixo do threshold</p>
              </div>
            </div>
            <Switch checked={autoRefill} onCheckedChange={toggleAutoRefill} disabled={togglingRefill} />
          </div>
        </CardContent>
      </Card>

      {/* Per-collaborator table */}
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Performance por Colaborador</CardTitle>
          <Button size="sm" variant="outline" onClick={loadDashboard} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead className="text-center">Pendentes</TableHead>
                <TableHead className="text-center">Enviados</TableHead>
                <TableHead className="text-center">Responderam</TableHead>
                <TableHead className="text-center">Convertidos</TableHead>
                <TableHead className="text-center">Taxa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum colaborador com leads distribuídos
                  </TableCell>
                </TableRow>
              ) : stats.map((c: any) => {
                const total = (c.total_atribuidos || 0);
                const rate = total > 0 ? Math.round(((c.total_responderam + c.total_convertidos) / total) * 100) : 0;
                return (
                  <TableRow key={c.collaborator_id}>
                    <TableCell className="font-medium">{c.collaborator_name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{c.total_pendentes}</Badge>
                    </TableCell>
                    <TableCell className="text-center">{c.total_enviados}</TableCell>
                    <TableCell className="text-center">
                      {c.total_responderam > 0
                        ? <Badge className="bg-primary/20 text-primary border-0">{c.total_responderam}</Badge>
                        : "0"}
                    </TableCell>
                    <TableCell className="text-center">
                      {c.total_convertidos > 0
                        ? <Badge className="bg-accent/20 text-accent border-0">{c.total_convertidos}</Badge>
                        : "0"}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={rate > 30 ? "text-accent font-semibold" : "text-muted-foreground"}>{rate}%</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

// ═══════════════════════════════════════════
// HISTORY TAB — lead_batches
// ═══════════════════════════════════════════
function HistoryTab() {
  const { collaborator } = useCollaborator();
  const { selectedCompanyId } = useCompanyFilter();
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<any[]>([]);

  const companyId = resolveCompanyId(selectedCompanyId, collaborator?.company_id);

  useEffect(() => { loadHistory(); }, [companyId]);

  const loadHistory = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("lead_batches")
        .select("*, collaborator:assigned_to(name), creator:created_by(name)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setBatches(data || []);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-5 w-5 text-primary" /> Histórico de Distribuições
        </CardTitle>
        <Button size="sm" variant="outline" onClick={loadHistory}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Destinatário</TableHead>
              <TableHead>Criado por</TableHead>
              <TableHead className="text-center">Quantidade</TableHead>
              <TableHead>Filtros</TableHead>
              <TableHead>Tipo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhuma distribuição registrada
                </TableCell>
              </TableRow>
            ) : batches.map(b => (
              <TableRow key={b.id}>
                <TableCell className="text-sm">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    {new Date(b.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </TableCell>
                <TableCell className="font-medium">{(b.collaborator as any)?.name || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{(b.creator as any)?.name || "—"}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{b.quantidade}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {[b.filtro_cidade, b.filtro_ddd && `DDD ${b.filtro_ddd}`].filter(Boolean).join(", ") || "Sem filtro"}
                </TableCell>
                <TableCell>
                  {b.is_auto_refill
                    ? <Badge className="bg-accent/20 text-accent border-0 text-xs">Auto (Bolt)</Badge>
                    : <Badge variant="outline" className="text-xs">Manual</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════
// BLAST SECTION — Motor de Disparo (Consultor)
// ═══════════════════════════════════════════
const EDGE_BASE = "https://ecaduzwautlpzpvjognr.supabase.co/functions/v1";

function BlastSection() {
  const { collaborator } = useCollaborator();
  const [messageTemplate, setMessageTemplate] = useState("Olá {nome}! Vi que você atua com imóveis...");
  const [dailyLimit, setDailyLimit] = useState(100);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [job, setJob] = useState<any>(null);
  const [loadingJob, setLoadingJob] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  };

  const callBlast = async (body: Record<string, any>) => {
    const token = await getToken();
    const res = await fetch(`${EDGE_BASE}/blast-engine`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    return res.json();
  };

  const fetchJob = useCallback(async () => {
    if (!collaborator?.id) return;
    setLoadingJob(true);
    try {
      const data = await callBlast({ action: "my_job", collaborator_id: collaborator.id });
      setJob(data?.job || null);
    } catch {
      setJob(null);
    } finally {
      setLoadingJob(false);
    }
  }, [collaborator?.id]);

  useEffect(() => {
    fetchJob();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchJob]);

  const startAutoSend = (jobId: string) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(async () => {
      try {
        const data = await callBlast({ action: "send_batch", job_id: jobId, batch_size: 10 });
        setJob((prev: any) => prev ? { ...prev, ...data?.job } : prev);
        if (data?.job?.status !== "running") {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          toast.info("Disparo finalizado!");
          fetchJob();
        }
      } catch (e: any) {
        console.error("send_batch error:", e);
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 5000);
  };

  const handleCreate = async () => {
    if (!collaborator?.id) return;
    if (!messageTemplate.trim()) { toast.error("Preencha o template da mensagem"); return; }
    setCreating(true);
    try {
      const data = await callBlast({
        action: "create_job",
        collaborator_id: collaborator.id,
        message_template: messageTemplate,
        daily_limit: dailyLimit,
      });
      toast.success("Job de disparo criado!");
      const jobId = data?.job_id || data?.job?.id;
      if (jobId) {
        await fetchJob();
        startAutoSend(jobId);
      }
    } catch (e: any) {
      toast.error("Erro ao criar job: " + e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleManualBatch = async () => {
    if (!job?.id) return;
    setSending(true);
    try {
      const data = await callBlast({ action: "send_batch", job_id: job.id, batch_size: 10 });
      setJob((prev: any) => prev ? { ...prev, ...data?.job } : prev);
      toast.success(`Lote enviado! ${data?.job?.sent_count ?? "?"} total enviados`);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSending(false);
    }
  };

  const handlePause = async () => {
    if (!job?.id) return;
    setPausing(true);
    try {
      await callBlast({ action: "pause", job_id: job.id });
      toast.success("Job pausado");
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      fetchJob();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setPausing(false);
    }
  };

  if (loadingJob) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // Active job view
  if (job && (job.status === "running" || job.status === "paused")) {
    return (
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            Motor de Disparo
            <Badge className={job.status === "running" ? "bg-green-500/20 text-green-400 border-0" : "bg-yellow-500/20 text-yellow-400 border-0"}>
              {job.status === "running" ? "Rodando" : "Pausado"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Enviados</p>
              <p className="text-xl font-bold text-foreground">{job.sent_count ?? 0}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Total Leads</p>
              <p className="text-xl font-bold text-foreground">{job.total_leads ?? 0}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Enviados Hoje</p>
              <p className="text-xl font-bold text-foreground">{job.sent_today ?? 0}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Pendentes</p>
              <p className="text-xl font-bold text-foreground">{job.pending_leads ?? 0}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleManualBatch} disabled={sending} className="gap-1.5" variant="outline">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar Lote
            </Button>
            <Button onClick={handlePause} disabled={pausing} variant="destructive" className="gap-1.5">
              {pausing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
              Pausar
            </Button>
            <Button onClick={fetchJob} variant="ghost" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No active job — create form
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Radio className="h-5 w-5 text-primary" /> Motor de Disparo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {job === null && !loadingJob && (
          <p className="text-sm text-muted-foreground">Nenhum job ativo. Configure e inicie um novo disparo.</p>
        )}
        <div className="space-y-2">
          <Label>Template da mensagem</Label>
          <Textarea
            placeholder="Olá {nome}! Vi que você atua com imóveis..."
            value={messageTemplate}
            onChange={e => setMessageTemplate(e.target.value)}
            rows={4}
          />
          <p className="text-xs text-muted-foreground">Use {"{{nome}}"} para inserir o nome do lead.</p>
        </div>
        <div className="space-y-2 max-w-xs">
          <Label>Limite diário</Label>
          <Input
            type="number"
            value={dailyLimit}
            onChange={e => setDailyLimit(Math.max(10, Math.min(500, Number(e.target.value) || 100)))}
            min={10}
            max={500}
          />
        </div>
        <Button onClick={handleCreate} disabled={creating} className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Iniciar Disparo
        </Button>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════
// CONSULTOR VIEW — Meus Leads (lead_items + Realtime)
// ═══════════════════════════════════════════
function ConsultorView() {
  const { collaborator } = useCollaborator();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [markingAll, setMarkingAll] = useState(false);

  const fetchLeads = useCallback(async () => {
    if (!collaborator?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("lead_items")
        .select("id, nome, telefone, cidade, ddd, status, assigned_at")
        .eq("assigned_to", collaborator.id)
        .eq("status", "atribuido")
        .limit(200);
      if (error) throw error;
      setLeads(data || []);
    } catch (e: any) {
      toast.error("Erro ao carregar leads: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [collaborator?.id]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Realtime — new leads arriving
  useEffect(() => {
    if (!collaborator?.id) return;
    const channel = supabase
      .channel("my_leads_realtime")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "lead_items",
        filter: `assigned_to=eq.${collaborator.id}`,
      }, () => {
        fetchLeads();
        toast.info("Novos leads recebidos!");
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [collaborator?.id, fetchLeads]);

  const filtered = leads.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (l.nome || "").toLowerCase().includes(q)
      || (l.telefone || "").includes(q)
      || (l.cidade || "").toLowerCase().includes(q);
  });

  const markAsSent = async (id: string) => {
    try {
      const { error } = await supabase
        .from("lead_items")
        .update({ status: "enviado", dispatched_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      setLeads(prev => prev.filter(l => l.id !== id));
      toast.success("Marcado como enviado");
    } catch (e: any) { toast.error(e.message); }
  };

  const markSelectedAsSent = async () => {
    if (selected.size === 0) return;
    setMarkingAll(true);
    try {
      const ids = Array.from(selected);
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const { error } = await supabase
          .from("lead_items")
          .update({ status: "enviado", dispatched_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .in("id", chunk);
        if (error) throw error;
      }
      toast.success(`${ids.length} leads marcados como enviados`);
      setSelected(new Set());
      fetchLeads();
    } catch (e: any) { toast.error(e.message); }
    finally { setMarkingAll(false); }
  };

  const openWhatsApp = (phone: string, id: string) => {
    const digits = phone.replace(/\D/g, "");
    const full = digits.startsWith("55") ? digits : `55${digits}`;
    window.open(`https://wa.me/${full}`, "_blank");
    markAsSent(id);
  };

  const copyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    toast.success("Telefone copiado!");
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(l => l.id)));
  };

  // Count stats from all assigned leads (not just filtered)
  const totalPending = leads.length;

  return (
    <>
      {/* Motor de Disparo */}
      <BlastSection />

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard icon={<Package className="h-5 w-5" />} label="Leads Pendentes" value={totalPending} color="warning" />
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary"><TrendingUp className="h-5 w-5" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Selecionados</p>
                <p className="text-2xl font-bold text-foreground">{selected.size}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nome, telefone, cidade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button size="sm" variant="outline" onClick={fetchLeads} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
        {selected.size > 0 && (
          <Button size="sm" onClick={markSelectedAsSent} disabled={markingAll} className="gap-1.5">
            {markingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
            Marcar {selected.size} como Enviados
          </Button>
        )}
      </div>

      {/* Table */}
      <Card className="border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={filtered.length > 0 && selected.size === filtered.length}
                    onCheckedChange={selectAll}
                  />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>DDD</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {search ? "Nenhum lead encontrado para esta busca" : "Nenhum lead pendente. Aguarde a distribuição!"}
                  </TableCell>
                </TableRow>
              ) : filtered.map(l => (
                <TableRow key={l.id}>
                  <TableCell>
                    <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggleSelect(l.id)} />
                  </TableCell>
                  <TableCell className="font-medium">{l.nome || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sm">{l.telefone}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyPhone(l.telefone)} title="Copiar">
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>{l.cidade || "—"}</TableCell>
                  <TableCell>{l.ddd || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="outline" onClick={() => openWhatsApp(l.telefone, l.id)} className="gap-1 text-accent">
                        <ExternalLink className="h-3.5 w-3.5" /> WhatsApp
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => markAsSent(l.id)} title="Marcar como enviado">
                        <CheckCircle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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
// SHARED: SummaryCard
// ═══════════════════════════════════════════
function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color?: string }) {
  const colorClass = color === "warning"
    ? "text-warning"
    : color === "success"
      ? "text-accent"
      : "text-primary";

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-primary/10 ${colorClass}`}>{icon}</div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value.toLocaleString("pt-BR")}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
