// rebuild v2
// Motor de Leads v4.0 — Reescrito do zero
import { useState, useEffect, useRef, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
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
  Zap, TrendingUp, History, Clock, Play, Pause, Radio, Timer
} from "lucide-react";

// Slugs elegíveis para receber leads por empresa:
// Objetivo → gestor-comercial + consultor-comercial APENAS
// Trilia   → consultor-trilia APENAS
const ELIGIBLE_SLUGS_BY_COMPANY: Record<string, string[]> = {
  objetivo: ["gestor-comercial", "consultor-comercial"],
  trilia:   ["consultor-trilia"],
};

/** Resolve companyId: "all" means null (for RPCs) or fallback to collaborator's company */
function resolveCompanyId(selectedCompanyId: string, fallback?: string | null, isCeo?: boolean): string | null {
  if (selectedCompanyId && selectedCompanyId !== "all") return selectedCompanyId;
  // CEO com "Todas Empresas" → null (ver todos), outros usam sua própria empresa
  if (isCeo) return null;
  return fallback || null;
}



// ── Countdown component for next send ──────────────────────────
function NextSendCountdown({ nextSendAt, status, statusReason, statusMessage }: { nextSendAt?: string | null; status?: string; statusReason?: string; statusMessage?: string }) {
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!nextSendAt || status !== "running") { setSeconds(null); return; }
    const calc = () => {
      const diff = Math.max(0, Math.floor((new Date(nextSendAt).getTime() - Date.now()) / 1000));
      setSeconds(diff);
    };
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [nextSendAt, status]);

  if (status !== "running") {
    if (statusReason === "daily_limit_reached") return <p className="text-sm font-bold text-orange-400">Limite diário</p>;
    if (statusReason === "outside_schedule") return <p className="text-sm font-bold text-yellow-400">Fora do horário</p>;
    return <p className="text-xl font-bold text-yellow-400">⏸</p>;
  }
  if (statusReason === "daily_limit_reached") return <p className="text-sm font-bold text-orange-400">Limite diário atingido</p>;
  if (statusReason === "outside_schedule") return <p className="text-sm font-bold text-yellow-400">Retoma 08:00</p>;
  if (seconds === null || seconds <= 0) return <p className="text-xl font-bold text-green-400 animate-pulse">Enviando...</p>;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (statusReason === "offline_cycle") {
    return <p className="text-xl font-bold text-orange-400 tabular-nums">⏳ {m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`}</p>;
  }
  return <p className="text-xl font-bold text-primary tabular-nums">{m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`}</p>;
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
        <PageHeader
          title="Motor de Leads"
          subtitle={isAdmin ? "Upload, distribuição e acompanhamento de leads" : "Seus leads para prospecção"}
          badge={<div className="p-2 rounded-lg bg-primary/10"><Rocket className="h-6 w-6 text-primary" /></div>}
        />
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
  const [forcingRefill, setForcingRefill] = useState(false);
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
        setLeadPoolStats({ objetivo: (d.objetivo_transporte ?? 0) + (d.objetivo_geral ?? 0), trilia: d.trilia ?? 0 });
      }
    };
    if (distCompanyId) loadStats();
  }, [distCompanyId]);

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

      const companyNameLower = allCompanies.find(c => c.id === distCompanyId)?.name?.toLowerCase() || "";
      const eligibleSlugs = ELIGIBLE_SLUGS_BY_COMPANY[
        companyNameLower.includes("objetivo") ? "objetivo" :
        companyNameLower.includes("trilia")   ? "trilia"   : ""
      ] || [];

      const { data: roles } = await supabase
        .from("roles").select("id,slug,level").gte("level", 2).eq("active", true);
      const commercialRoleIds = (roles || [])
        .filter(r => r.slug && eligibleSlugs.includes(r.slug))
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

  useEffect(() => { if (distCompanyId) loadFilterOptions(); }, [distCompanyId]);
  useEffect(() => { countAvailable(); }, [countAvailable, filterCity, filterDDD, distCompanyId]);

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

  const handleForceRefill = async () => {
    setForcingRefill(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";
      const res = await fetch("https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/blast-engine", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "force_refill", refill_count: 500 }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error || "Nenhum job ativo. Crie jobs no Motor de Disparo.");
      } else {
        toast.success(`${data.total_assigned} leads distribuídos para ${data.jobs_processed} consultores!`);
      }
    } catch (e: any) { toast.error("Erro: " + e.message); }
    finally { setForcingRefill(false); }
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
            {leadPoolStats && (
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="text-xs">Objetivo: {leadPoolStats.objetivo.toLocaleString("pt-BR")} leads</Badge>
                <Badge variant="outline" className="text-xs">Trilia: {leadPoolStats.trilia.toLocaleString("pt-BR")} leads</Badge>
              </div>
            )}
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
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={handleDistributeAll} disabled={distributingAll || availableCount === 0 || commercialCollabs.length === 0} variant="outline" className="gap-2 flex-1">
                {distributingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                Distribuir para Todos ({commercialCollabs.length} Consultores da {selectedCompanyName}) — {quantity} cada
              </Button>
              <Button onClick={handleForceRefill} disabled={forcingRefill} variant="default" className="gap-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold">
                {forcingRefill ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Forçar Distribuição Agora
              </Button>
            </div>
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
  const { collaborator, roleLevel } = useCollaborator();
  const { selectedCompanyId } = useCompanyFilter();
  const [loading, setLoading] = useState(true);
  const [autoRefill, setAutoRefill] = useState(false);
  const [togglingRefill, setTogglingRefill] = useState(false);
  const [stats, setStats] = useState<any[]>([]);

  const companyId = resolveCompanyId(selectedCompanyId, collaborator?.company_id, roleLevel <= 1);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      // Auto-refill config
      const { data: cfg } = await supabase
        .from("system_configs").select("value").eq("key", "auto_refill_enabled").maybeSingle();
      setAutoRefill(cfg?.value === "true");

      // Stats via RPC — try the dedicated function first
      const { data, error } = await supabase.rpc("get_lead_stats_by_collaborator", {
        p_company_id: companyId || null,
      });

      if (error) {
        console.error("RPC get_lead_stats_by_collaborator error:", error);
        // Fallback: query consultant_lead_pool directly with join to collaborators
        const query = supabase
          .from("consultant_lead_pool")
          .select("collaborator_id, status, collaborator:collaborator_id(name, role_id)");

        if (companyId) {
          // Filter by company through collaborators join
          const { data: collabs } = await supabase
            .from("collaborators")
            .select("id")
            .eq("company_id", companyId);
          const collabIds = (collabs || []).map(c => c.id);
          if (collabIds.length > 0) {
            query.in("collaborator_id", collabIds);
          }
        }

        const { data: rawLeads, error: fallbackError } = await query;
        if (fallbackError) throw fallbackError;

        // Aggregate manually
        const grouped: Record<string, any> = {};
        (rawLeads || []).forEach((lead: any) => {
          const cid = lead.collaborator_id;
          if (!grouped[cid]) {
            grouped[cid] = {
              collaborator_id: cid,
              collaborator_name: lead.collaborator?.name || "—",
              role_slug: "",
              total_atribuidos: 0,
              total_pendentes: 0,
              total_enviados: 0,
              total_responderam: 0,
              total_convertidos: 0,
            };
          }
          grouped[cid].total_atribuidos++;
          if (lead.status === "pending" || lead.status === "available") grouped[cid].total_pendentes++;
          else if (lead.status === "sent") grouped[cid].total_enviados++;
          else if (lead.status === "responded") grouped[cid].total_responderam++;
          else if (lead.status === "converted") grouped[cid].total_convertidos++;
        });

        setStats(Object.values(grouped));
        return;
      }

      setStats(data || []);
    } catch (e: any) {
      console.error("Dashboard load error:", e);
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
                const total = (c.total_enviados || 0) + (c.total_responderam || 0) + (c.total_convertidos || 0);
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

  useEffect(() => { loadHistory(); }, [companyId]);

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

// Bug #006 fix: accept selectedLeadIds from ConsultorView
function BlastSection({ selectedLeadIds = [] }: { selectedLeadIds?: string[] }) {
  const { collaborator } = useCollaborator();
  const [messageTemplates, setMessageTemplates] = useState([
    "Olá {nome}! Vi que você atua nessa área e quero apresentar uma solução que pode proteger seus veículos com muito mais segurança e custo acessível. Posso te mostrar em 5 minutos?",
    "",
    "",
    "",
    "",
  ]);
  const [dailyLimit, setDailyLimit] = useState(100);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [job, setJob] = useState<any>(null);
  const [loadingJob, setLoadingJob] = useState(true);
  // Bug #002 fix: use timeout ref + consecutive error counter instead of fixed interval
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consecutiveErrorsRef = useRef(0);

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
      // Merge server data without overwriting locally-tracked counters during active sending
      setJob((prev: any) => {
        const serverJob = data?.job || null;
        if (!serverJob) return null;
        if (!prev || prev.id !== serverJob.id) return serverJob;
        // If autoSend is active (timeoutRef exists), preserve local counters that may be ahead of DB
        if (timeoutRef.current) {
          return {
            ...serverJob,
            sent_count: Math.max(serverJob.sent_count || 0, prev.sent_count || 0),
            sent_today: Math.max(serverJob.sent_today || 0, prev.sent_today || 0),
            pending_leads: prev.pending_leads ?? serverJob.pending_leads,
          };
        }
        return serverJob;
      });
      // Load template into editable state when job is paused
      if (data?.job?.status === "paused" && data?.job?.message_template) {
        setMessageTemplates(prev => {
          if (prev[0] === "" || prev[0] === undefined) {
            const templates = [...prev];
            templates[0] = data.job.message_template;
            return templates;
          }
          return prev;
        });
      }
    } catch {
      setJob(null);
    } finally {
      setLoadingJob(false);
    }
  }, [collaborator?.id]);

  useEffect(() => {
    fetchJob();
    // Auto-refresh job status every 15s to update countdown + stats
    const refreshIv = setInterval(() => { fetchJob(); }, 15000);
    return () => { clearInterval(refreshIv); if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [fetchJob]);

  // Bug #002 fix: recursive timeout using next_delay_ms from blast-engine response
  // Stops only when remaining=0, daily_limit reached, or 3 consecutive errors
  const startAutoSend = useCallback((jobId: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    consecutiveErrorsRef.current = 0;

    const scheduleSend = (delayMs: number) => {
      timeoutRef.current = setTimeout(async () => {
        try {
          const data = await callBlast({ action: "send_batch", job_id: jobId, batch_size: 1 });
          consecutiveErrorsRef.current = 0;

          // Update counters from send_batch response
          const nextDelay = data?.next_delay_ms ?? 30000;
          const nextSendTime = new Date(Date.now() + nextDelay).toISOString();
          setJob((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              sent_count: data?.job?.sent_count ?? ((prev.sent_count || 0) + (data?.sent || 0)),
              sent_today: data?.sent_today ?? ((prev.sent_today || 0) + (data?.sent || 0)),
              pending_leads: data?.remaining ?? prev.pending_leads,
              next_send_at: nextSendTime,
            };
          });

          // Stop conditions
          if (data?.remaining === 0 || data?.reason === "total_reached") {
            toast.info(data?.message || "Disparo finalizado! Todos os leads foram enviados.");
            timeoutRef.current = null;
            fetchJob();
            return;
          }
          if (data?.ok === false && data?.reason === "daily_limit_reached") {
            setJob((prev: any) => prev ? { ...prev, next_send_at: null, status_reason: "daily_limit_reached", status_message: data?.message } : prev);
            toast.warning(data?.message || "Limite diário atingido. Disparo continuará amanhã.");
            timeoutRef.current = null;
            return;
          }
          if (data?.ok === false && data?.reason === "offline_cycle") {
            setJob((prev: any) => prev ? { ...prev, next_send_at: nextSendTime, status_reason: "offline_cycle", status_message: data?.message } : prev);
          }
          if (data?.ok === false && data?.reason === "outside_schedule") {
            setJob((prev: any) => prev ? { ...prev, next_send_at: null, status_reason: "outside_schedule", status_message: data?.message } : prev);
            toast.warning(data?.message || "Fora do horário de disparo (08:00–20:00)");
            timeoutRef.current = null;
            return;
          }

          // Schedule next send using blast-engine recommended delay
          scheduleSend(nextDelay);

        } catch (e: any) {
          consecutiveErrorsRef.current++;
          console.error("send_batch error:", e);
          if (consecutiveErrorsRef.current >= 3) {
            toast.error("Disparo pausado após 3 falhas consecutivas. Clique 'Enviar Lote' para retomar.");
            timeoutRef.current = null;
            return;
          }
          // Retry after 30s on transient error
          scheduleSend(30000);
        }
      }, delayMs);
    };

    scheduleSend(1000); // start after 1s to let UI settle
  }, [collaborator?.id, fetchJob]);

  // Bug #008 fix: auto-start loop when page loads with existing running job
  // (or when job transitions to running after resume)
  useEffect(() => {
    if (job?.status === "running" && job?.id && !timeoutRef.current) {
      startAutoSend(job.id);
    }
  }, [job?.id, job?.status, startAutoSend]);

  const handleCreate = async () => {
    if (!collaborator?.id) return;
    const activeTemplates = messageTemplates.filter(t => t.trim().length > 0);
    if (activeTemplates.length === 0) { toast.error("Preencha pelo menos um template de mensagem"); return; }
    setCreating(true);
    try {
      const data = await callBlast({
        action: "create_job",
        collaborator_id: collaborator.id,
        message_template: activeTemplates[0],
        message_templates: activeTemplates,
        daily_limit: dailyLimit,
        // Bug #004 fix: pass selected lead IDs so job only covers selected leads
        lead_ids: selectedLeadIds.length > 0 ? selectedLeadIds : undefined,
      });

      if (!data?.ok) {
        toast.error("Erro ao criar job: " + (data?.error || "Erro desconhecido"));
        return;
      }

      toast.success("Job de disparo criado!");
      const jobId = data?.job_id || data?.job?.id;

      if (jobId) {
        // Bug #001 + #005 fix: set job state DIRECTLY from response — no fetchJob spinner dance
        const newJob = data?.job ?? {
          id: jobId,
          status: "running",
          sent_count: 0,
          total_leads: data?.total_leads || 0,
          sent_today: 0,
          pending_leads: data?.total_leads || 0,
          daily_limit: dailyLimit,
        };
        setJob(newJob);
        setLoadingJob(false);
        // Start auto-send loop immediately
        startAutoSend(jobId);
        // Background refresh after 3s (no spinner)
        setTimeout(() => {
          if (collaborator?.id) {
            callBlast({ action: "my_job", collaborator_id: collaborator.id })
              .then(d => { if (d?.job) setJob(d.job); })
              .catch(() => {});
          }
        }, 3000);
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
      const data = await callBlast({ action: "send_batch", job_id: job.id, batch_size: 1 });

      // Bug #003 fix: handle ok=false reasons before treating as success
      if (data?.ok === false) {
        if (data?.reason === "outside_schedule") {
          toast.warning(data.message || "Fora do horário de disparo (08:00–18:00)");
        } else if (data?.reason === "offline_cycle") {
          toast.warning(data.message || "Ciclo offline ativo (pausa anti-ban)");
        } else if (data?.reason === "daily_limit_reached") {
          toast.warning(data.message || "Limite diário atingido");
        } else {
          toast.error("Erro: " + (data?.error || data?.reason || "Erro ao enviar"));
        }
        return;
      }

      // Update job counters from response (bug fix: use data.sent, not data?.job?.sent_count)
      setJob((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          sent_count: (prev.sent_count || 0) + (data?.sent || 0),
          sent_today: data?.sent_today ?? ((prev.sent_today || 0) + (data?.sent || 0)),
          pending_leads: data?.remaining ?? prev.pending_leads,
        };
      });

      if (data?.sent > 0) {
        toast.success(`Mensagem enviada! Total: ${(job.sent_count || 0) + (data?.sent || 0)} enviadas`);
      } else {
        toast.info("Nenhuma mensagem enviada agora (verifique horário e leads pendentes)");
      }

      // Restart auto-send loop if it was stopped
      if (!timeoutRef.current && data?.remaining > 0) {
        startAutoSend(job.id);
      }
    } catch (e: any) {
      toast.error("Erro ao enviar: " + e.message);
    } finally {
      setSending(false);
    }
  };

  const handlePause = async () => {
    if (!job?.id) return;
    setPausing(true);
    try {
      if (job.status === "paused") {
        await callBlast({ action: "resume", job_id: job.id });
        toast.success("Disparo retomado");
        setJob((prev: any) => prev ? { ...prev, status: "running" } : prev);
        startAutoSend(job.id);
      } else {
        await callBlast({ action: "pause", job_id: job.id });
        toast.success("Disparo pausado");
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
        setJob((prev: any) => prev ? { ...prev, status: "paused" } : prev);
      }
    } catch (e: any) {
      toast.error("Erro: " + e.message);
      fetchJob();
    } finally {
      setPausing(false);
    }
  };

  const [resetting, setResetting] = useState(false);

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
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Próx. Envio</p>
              <NextSendCountdown nextSendAt={job.next_send_at} status={job.status} statusReason={job.status_reason} statusMessage={job.status_message} />
            </div>
          </div>
          {job.status === "running" && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-green-500/10 border border-green-500/30 text-xs text-green-400">
              <Timer className="h-3.5 w-3.5 shrink-0" />
              <span>Anti-ban ativo: envios alternados 30s/90s • pausa 3-5min a cada 30 msgs • rotação de chips • horário 08:00-20:00</span>
            </div>
          )}
          {job.status === "paused" && (
            <div className="space-y-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <p className="text-sm font-medium text-yellow-400">✏️ Editar mensagem de disparo</p>
              <Textarea
                placeholder="Olá {nome}! Apresento uma solução..."
                value={messageTemplates[0] || job.message_template || ""}
                onChange={e => {
                  const updated = [...messageTemplates];
                  updated[0] = e.target.value;
                  setMessageTemplates(updated);
                }}
                rows={3}
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={async () => {
                  const activeTemplates = messageTemplates.filter(t => t.trim().length > 0);
                  if (activeTemplates.length === 0) { toast.error("Preencha a mensagem"); return; }
                  try {
                    await callBlast({ action: "update_job", job_id: job.id, message_template: activeTemplates[0], message_templates: activeTemplates });
                    toast.success("Mensagem atualizada!");
                    fetchJob();
                  } catch { toast.error("Erro ao atualizar"); }
                }}
              >
                Salvar mensagem
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={handleManualBatch} disabled={sending || job.status === "paused"} className="gap-1.5" variant="outline">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar Lote
            </Button>
            <Button onClick={handlePause} disabled={pausing}
              variant={job?.status === "paused" ? "default" : "destructive"}
              className={`gap-1.5 ${job?.status === "paused" ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}>
              {pausing ? <Loader2 className="h-4 w-4 animate-spin" /> : job?.status === "paused" ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {job?.status === "paused" ? "Retomar" : "Pausar"}
            </Button>
            <Button onClick={async () => { setResetting(true); try { if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; } await callBlast({ action: "reset_job", job_id: job.id }); toast.success("Disparo resetado e pausado. Edite as mensagens e clique Retomar."); setJob((prev: any) => prev ? { ...prev, status: "paused", error_count: 0, next_send_at: null } : prev); fetchJob(); } catch { toast.error("Erro ao resetar"); } finally { setResetting(false); } }} disabled={resetting} variant="outline" className="gap-1.5 border-orange-500/50 text-orange-400 hover:bg-orange-500/10"><RefreshCw className={`h-4 w-4 ${resetting ? "animate-spin" : ""}`} />Resetar</Button>
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
        {/* Bug #004 fix: show selected leads count when leads are selected in table */}
        {selectedLeadIds.length > 0 ? (
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-green-500/10 border border-green-500/30 text-sm text-green-700 dark:text-green-400">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span><strong>{selectedLeadIds.length.toLocaleString("pt-BR")}</strong> leads selecionados para este disparo</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/50 text-xs text-muted-foreground">
            <MessageCircle className="h-4 w-4 shrink-0" />
            <span>Nenhum lead selecionado — o disparo usará todos os seus leads pendentes. Selecione leads na tabela abaixo para disparar apenas para eles.</span>
          </div>
        )}
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">Templates de mensagem</Label>
            <p className="text-xs text-muted-foreground mt-0.5">O sistema alterna automaticamente entre os templates a cada envio. Use {"{nome}"} para o nome do lead.</p>
          </div>
          {messageTemplates.map((tmpl, idx) => (
            <div key={idx} className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Template {idx + 1}{idx === 0 ? " (obrigatório)" : " (opcional)"}
              </Label>
              <Textarea
                placeholder={idx === 0 ? "Olá {nome}! Apresento uma solução..." : `Variação ${idx + 1}...`}
                value={tmpl}
                onChange={e => {
                  const updated = [...messageTemplates];
                  updated[idx] = e.target.value;
                  setMessageTemplates(updated);
                }}
                rows={3}
              />
            </div>
          ))}
        </div>
        <div className="space-y-2 max-w-xs">
          <Label>Limite diário total (somado entre todos os chips de disparo)</Label>
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
          {selectedLeadIds.length > 0
            ? `Iniciar Disparo (${selectedLeadIds.length.toLocaleString("pt-BR")} leads)`
            : "Iniciar Disparo"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════
// CONSULTOR VIEW — Meus Leads (consultant_lead_pool + Realtime)
// ═══════════════════════════════════════════
function ConsultorView() {
  const { collaborator } = useCollaborator();
  const [leads, setLeads] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [markingAll, setMarkingAll] = useState(false);

  const fetchLeads = useCallback(async () => {
    if (!collaborator?.id) return;
    setLoading(true);
    try {
      // Buscar total real (COUNT) e primeiros 200 registros em paralelo
      // Include both 'pending' and 'available' statuses (distribute_leads may use either)
      const [countRes, dataRes] = await Promise.all([
        supabase
          .from("consultant_lead_pool")
          .select("id", { count: "exact", head: true })
          .eq("collaborator_id", collaborator.id)
          .in("status", ["pending", "available"]),
        supabase
          .from("consultant_lead_pool")
          .select("id, lead_name, phone, lead_city, lead_category, status, assigned_at")
          .eq("collaborator_id", collaborator.id)
          .in("status", ["pending", "available"])
          .order("assigned_at", { ascending: true })
          .limit(200),
      ]);
      if (dataRes.error) throw dataRes.error;
      setTotalCount(countRes.count ?? 0);
      // Normaliza campos para compatibilidade com a UI existente
      setLeads((dataRes.data || []).map(l => ({
        id: l.id,
        nome: l.lead_name,
        telefone: l.phone,
        cidade: l.lead_city,
        ddd: l.phone ? l.phone.replace(/\D/g, "").slice(0, 2) : "",
        status: l.status,
        assigned_at: l.assigned_at,
      })));
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
        table: "consultant_lead_pool",
        filter: `collaborator_id=eq.${collaborator.id}`,
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
        .from("consultant_lead_pool")
        .update({ status: "sent", sent_at: new Date().toISOString() })
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
          .from("consultant_lead_pool")
          .update({ status: "sent", sent_at: new Date().toISOString() })
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

  return (
    <>
      {/* Motor de Disparo — Bug #006 fix: pass selected IDs so BlastSection can use them */}
      <BlastSection selectedLeadIds={Array.from(selected)} />

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard icon={<Package className="h-5 w-5" />} label="Leads Pendentes" value={totalCount} color="warning" />
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
        {totalCount > leads.length && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Mostrando {leads.length.toLocaleString("pt-BR")} de {totalCount.toLocaleString("pt-BR")}
          </span>
        )}
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
