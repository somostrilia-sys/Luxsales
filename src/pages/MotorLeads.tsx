/**
 * Motor de Leads — Upload, Distribuição, Acompanhamento
 * Admin (level<=1): Upload CSV, Distribuição manual, Dashboard
 * Consultor (level>=2): Meus Leads, Resumo
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import Papa from "papaparse";
import {
  Rocket, Upload, Send, Loader2, RefreshCw, Users, MapPin, Phone,
  ArrowRight, Shuffle, Package, Eye, CheckCircle, MessageCircle,
  Copy, ExternalLink, Zap, TrendingUp
} from "lucide-react";

// Commercial role slugs
const COMMERCIAL_SLUGS = ["comercial", "consultor", "gestor-comercial", "gestor-trilia", "gestora-essencia", "gestor-digitallux"];

export default function MotorLeads() {
  const { collaborator, roleLevel } = useCollaborator();
  const isAdmin = roleLevel <= 1 || collaborator?.is_super_admin;

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
              {isAdmin ? "Upload, distribuição e acompanhamento de leads" : "Leads distribuídos para você"}
            </p>
          </div>
        </div>
        {isAdmin ? <AdminView /> : <ConsultorView collaboratorId={collaborator?.id || ""} />}
      </div>
    </DashboardLayout>
  );
}

// ═══════════════════════════════════════════
// ADMIN VIEW
// ═══════════════════════════════════════════
function AdminView() {
  const [activeTab, setActiveTab] = useState("distribute");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="grid grid-cols-3 w-full max-w-lg">
        <TabsTrigger value="upload" className="gap-1.5">
          <Upload className="h-4 w-4" /> Upload
        </TabsTrigger>
        <TabsTrigger value="distribute" className="gap-1.5">
          <Shuffle className="h-4 w-4" /> Distribuição
        </TabsTrigger>
        <TabsTrigger value="dashboard" className="gap-1.5">
          <Eye className="h-4 w-4" /> Dashboard
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upload" className="space-y-4 mt-4"><UploadTab /></TabsContent>
      <TabsContent value="distribute" className="space-y-4 mt-4"><DistributeTab /></TabsContent>
      <TabsContent value="dashboard" className="space-y-4 mt-4"><DashboardTab /></TabsContent>
    </Tabs>
  );
}

// ═══════════════════════════════════════════
// UPLOAD TAB — Import CSV/XLSX
// ═══════════════════════════════════════════
function UploadTab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [totalPending, setTotalPending] = useState<number | null>(null);

  useEffect(() => { countPending(); }, []);

  const countPending = async () => {
    const { count } = await supabase.from("lead_items").select("id", { count: "exact", head: true }).eq("status", "pending").is("assigned_to", null);
    setTotalPending(count);
  };

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
        if (rows.length === 0) {
          toast.error("Arquivo vazio ou formato inválido");
          return;
        }
        importLeads(rows);
      },
      error: (err) => toast.error("Erro ao ler arquivo: " + err.message),
    });
  };

  const importLeads = async (rows: any[]) => {
    setImporting(true);
    try {
      // Map columns flexibly
      const items = rows
        .filter(r => r.telefone || r.phone || r.tel)
        .map(r => ({
          phone: (r.telefone || r.phone || r.tel || "").toString().trim(),
          name: (r.nome || r.name || r.Name || "").toString().trim() || null,
          city: (r.cidade || r.city || "").toString().trim() || null,
          state: (r.estado || r.state || r.uf || "").toString().trim() || null,
          ddd: (r.ddd || "").toString().trim() || (r.telefone || r.phone || "").toString().match(/\((\d{2})\)/)?.[1] || null,
          status: "pending",
        }));

      if (items.length === 0) {
        toast.error("Nenhum lead com telefone válido encontrado");
        return;
      }

      // Insert in batches of 500
      let inserted = 0;
      for (let i = 0; i < items.length; i += 500) {
        const chunk = items.slice(i, i + 500);
        const { error } = await supabase.from("lead_items").insert(chunk);
        if (error) throw error;
        inserted += chunk.length;
      }

      toast.success(`${inserted.toLocaleString("pt-BR")} leads importados com sucesso!`);
      setPreview([]);
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      countPending();
    } catch (e: any) {
      toast.error("Erro na importação: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      {totalPending !== null && (
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10 text-warning">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Leads pendentes (não distribuídos)</p>
                <p className="text-2xl font-bold text-foreground">{totalPending.toLocaleString("pt-BR")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card variant="gradient" className="card-accent-top">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Importar Leads (CSV)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Envie um arquivo CSV com as colunas: <span className="font-mono text-xs text-foreground">nome, telefone, cidade, estado, ddd</span>
          </p>

          <div className="flex gap-3 items-center">
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
            <Button onClick={() => fileRef.current?.click()} disabled={importing} className="gap-2 btn-modern">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importing ? "Importando..." : "Selecionar Arquivo"}
            </Button>
            {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
          </div>

          {preview.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <p className="text-xs text-muted-foreground p-2 bg-muted/30">Prévia (primeiras 5 linhas)</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.keys(preview[0]).slice(0, 5).map(k => (
                      <TableHead key={k} className="text-xs">{k}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, i) => (
                    <TableRow key={i}>
                      {Object.values(row).slice(0, 5).map((v, j) => (
                        <TableCell key={j} className="text-xs">{String(v || "—")}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ═══════════════════════════════════════════
// DISTRIBUTE TAB — Manual Distribution
// ═══════════════════════════════════════════
function DistributeTab() {
  const { collaborator: currentCollab } = useCollaborator();
  const [loading, setLoading] = useState(true);
  const [distributing, setDistributing] = useState(false);
  const [distributingAll, setDistributingAll] = useState(false);

  // Filters
  const [filterCity, setFilterCity] = useState("all");
  const [filterDDD, setFilterDDD] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [targetCollab, setTargetCollab] = useState("");

  // Data
  const [cities, setCities] = useState<string[]>([]);
  const [ddds, setDDDs] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [commercialCollabs, setCommercialCollabs] = useState<{ id: string; name: string }[]>([]);
  const [availableCount, setAvailableCount] = useState(0);
  const [totalPending, setTotalPending] = useState(0);

  useEffect(() => { loadFilterOptions(); }, []);
  useEffect(() => { countAvailable(); }, [filterCity, filterDDD, filterSource]);

  const loadFilterOptions = async () => {
    setLoading(true);
    try {
      // Get unique cities, DDDs from pending lead_items
      const { data: items } = await supabase.from("lead_items")
        .select("city,ddd")
        .eq("status", "pending")
        .is("assigned_to", null)
        .limit(1000);

      const citySet = new Set<string>();
      const dddSet = new Set<string>();
      (items || []).forEach(item => {
        if (item.city) citySet.add(item.city);
        if (item.ddd) dddSet.add(item.ddd);
      });
      setCities(Array.from(citySet).sort());
      setDDDs(Array.from(dddSet).sort());

      // Get commercial collaborators (roles with commercial slugs)
      const { data: roles } = await supabase.from("roles")
        .select("id,slug,level")
        .gte("level", 2)
        .eq("active", true);

      const commercialRoleIds = (roles || [])
        .filter(r => r.slug && COMMERCIAL_SLUGS.some(s => r.slug.includes(s)))
        .map(r => r.id);

      if (commercialRoleIds.length > 0) {
        const { data: collabs } = await supabase.from("collaborators")
          .select("id,name,role_id")
          .in("role_id", commercialRoleIds)
          .eq("active", true)
          .order("name");
        setCommercialCollabs(collabs || []);
      } else {
        // Fallback: all active collaborators with level >= 2
        const { data: allRoles } = await supabase.from("roles").select("id").gte("level", 2).eq("active", true);
        const roleIds = (allRoles || []).map(r => r.id);
        if (roleIds.length > 0) {
          const { data: collabs } = await supabase.from("collaborators")
            .select("id,name,role_id")
            .in("role_id", roleIds)
            .eq("active", true)
            .order("name");
          setCommercialCollabs(collabs || []);
        }
      }

      // Total pending count
      const { count } = await supabase.from("lead_items").select("id", { count: "exact", head: true }).eq("status", "pending").is("assigned_to", null);
      setTotalPending(count || 0);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const countAvailable = async () => {
    let query = supabase.from("lead_items").select("id", { count: "exact", head: true }).eq("status", "pending").is("assigned_to", null);
    if (filterCity !== "all") query = query.eq("city", filterCity);
    if (filterDDD !== "all") query = query.eq("ddd", filterDDD);
    const { count } = await query;
    setAvailableCount(count || 0);
  };

  const buildFilteredQuery = () => {
    let query = supabase.from("lead_items").select("id").eq("status", "pending").is("assigned_to", null);
    if (filterCity !== "all") query = query.eq("city", filterCity);
    if (filterDDD !== "all") query = query.eq("ddd", filterDDD);
    return query;
  };

  const handleSendBatch = async () => {
    if (!targetCollab) { toast.error("Selecione um consultor"); return; }
    setDistributing(true);
    try {
      const { data: leads, error: fetchErr } = await buildFilteredQuery().limit(500);
      if (fetchErr) throw fetchErr;
      if (!leads || leads.length === 0) { toast.error("Nenhum lead disponível"); return; }

      // Create batch
      const { data: batch, error: batchErr } = await supabase.from("lead_batches").insert({
        created_by: currentCollab?.id || null,
        assigned_to: targetCollab,
        total_leads: leads.length,
        status: "pending",
        filters: { city: filterCity, ddd: filterDDD, source: filterSource },
      }).select("id").single();
      if (batchErr) throw batchErr;

      // Update lead_items
      const ids = leads.map(l => l.id);
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        await supabase.from("lead_items").update({
          assigned_to: targetCollab,
          batch_id: batch.id,
          status: "distributed",
        }).in("id", chunk);
      }

      const collabName = commercialCollabs.find(c => c.id === targetCollab)?.name || "";
      toast.success(`${leads.length} leads enviados para ${collabName}!`);
      countAvailable();
      loadFilterOptions();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setDistributing(false);
    }
  };

  const handleDistributeAll = async () => {
    if (commercialCollabs.length === 0) { toast.error("Nenhum consultor comercial encontrado"); return; }
    setDistributingAll(true);
    try {
      // Fetch all pending leads (up to max per collab * collab count)
      const batchSize = 500;
      const totalToDistribute = batchSize * commercialCollabs.length;

      const { data: leads, error: fetchErr } = await buildFilteredQuery().limit(totalToDistribute);
      if (fetchErr) throw fetchErr;
      if (!leads || leads.length === 0) { toast.error("Nenhum lead disponível"); return; }

      const perCollab = Math.ceil(leads.length / commercialCollabs.length);

      for (let i = 0; i < commercialCollabs.length; i++) {
        const slice = leads.slice(i * perCollab, (i + 1) * perCollab);
        if (slice.length === 0) continue;

        const { data: batch, error: batchErr } = await supabase.from("lead_batches").insert({
          created_by: currentCollab?.id || null,
          assigned_to: commercialCollabs[i].id,
          total_leads: slice.length,
          status: "pending",
          filters: { city: filterCity, ddd: filterDDD, source: filterSource },
        }).select("id").single();
        if (batchErr) throw batchErr;

        const ids = slice.map(l => l.id);
        for (let j = 0; j < ids.length; j += 500) {
          const chunk = ids.slice(j, j + 500);
          await supabase.from("lead_items").update({
            assigned_to: commercialCollabs[i].id,
            batch_id: batch.id,
            status: "distributed",
          }).in("id", chunk);
        }
      }

      toast.success(`${leads.length} leads distribuídos para ${commercialCollabs.length} consultores!`);
      countAvailable();
      loadFilterOptions();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setDistributingAll(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <>
      {/* Pending count */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary"><Package className="h-5 w-5" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Total pendentes na base</p>
              <p className="text-2xl font-bold text-foreground">{totalPending.toLocaleString("pt-BR")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card variant="gradient" className="card-accent-top">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shuffle className="h-5 w-5 text-primary" />
            Distribuição Manual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Filters */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Filtros</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> Cidade</Label>
                <Select value={filterCity} onValueChange={setFilterCity}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas ({totalPending})</SelectItem>
                    {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> DDD</Label>
                <Select value={filterDDD} onValueChange={setFilterDDD}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {ddds.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Badge variant="outline" className="h-10 px-4 text-sm font-medium w-full justify-center">
                  {availableCount.toLocaleString("pt-BR")} leads disponíveis
                </Badge>
              </div>
            </div>
          </div>

          {/* Target */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Destinatário</p>
            <Select value={targetCollab} onValueChange={setTargetCollab}>
              <SelectTrigger><SelectValue placeholder="Selecione o consultor/gestor" /></SelectTrigger>
              <SelectContent>
                {commercialCollabs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSendBatch} disabled={distributing || !targetCollab || availableCount === 0} className="gap-2 btn-modern">
              {distributing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar Lote (500 leads)
            </Button>
            <Button onClick={handleDistributeAll} disabled={distributingAll || availableCount === 0 || commercialCollabs.length === 0} variant="outline" className="gap-2">
              {distributingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              Distribuir para Todos ({commercialCollabs.length})
            </Button>
          </div>

          {commercialCollabs.length > 0 && (
            <p className="text-xs text-muted-foreground">
              "Distribuir para Todos" envia ~{Math.ceil(Math.min(availableCount, 500 * commercialCollabs.length) / commercialCollabs.length)} leads por consultor (lotes de 500)
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ═══════════════════════════════════════════
// DASHBOARD TAB — Overview + Auto-refill toggle
// ═══════════════════════════════════════════
function DashboardTab() {
  const [loading, setLoading] = useState(true);
  const [autoRefill, setAutoRefill] = useState(false);
  const [togglingRefill, setTogglingRefill] = useState(false);
  const [stats, setStats] = useState({ pending: 0, distributed: 0, dispatched: 0, total: 0 });
  const [collabStats, setCollabStats] = useState<{ id: string; name: string; distributed: number; dispatched: number }[]>([]);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      // Auto-refill config
      const { data: cfg } = await supabase.from("system_configs").select("value").eq("key", "auto_refill_enabled").single();
      setAutoRefill(cfg?.value === "true");

      // Lead item counts
      const { data: items } = await supabase.from("lead_items").select("status,assigned_to").limit(50000);
      const allItems = items || [];
      const pending = allItems.filter(i => i.status === "pending" && !i.assigned_to).length;
      const distributed = allItems.filter(i => i.status === "distributed").length;
      const dispatched = allItems.filter(i => i.status === "dispatched").length;
      setStats({ pending, distributed, dispatched, total: allItems.length });

      // Per-collaborator stats
      const collabMap = new Map<string, { distributed: number; dispatched: number }>();
      allItems.forEach(item => {
        if (!item.assigned_to) return;
        if (!collabMap.has(item.assigned_to)) collabMap.set(item.assigned_to, { distributed: 0, dispatched: 0 });
        const entry = collabMap.get(item.assigned_to)!;
        if (item.status === "distributed") entry.distributed++;
        if (item.status === "dispatched") entry.dispatched++;
      });

      // Get names
      const collabIds = Array.from(collabMap.keys());
      if (collabIds.length > 0) {
        const { data: collabs } = await supabase.from("collaborators").select("id,name").in("id", collabIds);
        const nameMap = new Map((collabs || []).map(c => [c.id, c.name]));
        setCollabStats(
          collabIds
            .map(id => ({ id, name: nameMap.get(id) || "—", ...collabMap.get(id)! }))
            .filter(c => c.distributed + c.dispatched > 0)
            .sort((a, b) => (b.distributed + b.dispatched) - (a.distributed + a.dispatched))
        );
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

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
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setTogglingRefill(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <>
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon={<Package className="h-5 w-5" />} label="Pendentes" value={stats.pending} color="yellow" />
        <SummaryCard icon={<Send className="h-5 w-5" />} label="Distribuídos" value={stats.distributed} />
        <SummaryCard icon={<CheckCircle className="h-5 w-5" />} label="Disparados" value={stats.dispatched} color="green" />
        <SummaryCard icon={<TrendingUp className="h-5 w-5" />} label="Total" value={stats.total} />
      </div>

      {/* Auto-refill toggle */}
      <Card variant="gradient">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-foreground">Reposição Automática (Bolt)</p>
                <p className="text-xs text-muted-foreground">
                  Quando ativado, o Bolt repõe automaticamente leads quando o estoque cai abaixo do threshold
                </p>
              </div>
            </div>
            <Switch
              checked={autoRefill}
              onCheckedChange={toggleAutoRefill}
              disabled={togglingRefill}
            />
          </div>
        </CardContent>
      </Card>

      {/* Per-collaborator table */}
      <Card variant="gradient">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Leads por Colaborador</CardTitle>
          <Button size="sm" variant="outline" onClick={loadDashboard} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead className="text-center">Distribuídos</TableHead>
                <TableHead className="text-center">Disparados</TableHead>
                <TableHead className="text-center">Taxa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collabStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhum colaborador com leads
                  </TableCell>
                </TableRow>
              ) : collabStats.map(c => {
                const total = c.distributed + c.dispatched;
                const rate = total > 0 ? Math.round((c.dispatched / total) * 100) : 0;
                return (
                  <TableRow key={c.id} className="table-row-hover">
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{c.distributed}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {c.dispatched > 0 ? <Badge className="bg-success/20 text-success">{c.dispatched}</Badge> : "0"}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={rate > 50 ? "text-success font-semibold" : "text-muted-foreground"}>{rate}%</span>
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
// CONSULTOR VIEW — Meus Leads + Resumo
// ═══════════════════════════════════════════
function ConsultorView({ collaboratorId }: { collaboratorId: string }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [markingAll, setMarkingAll] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const [counts, setCounts] = useState({ distributed: 0, dispatched: 0, total: 0 });

  useEffect(() => { if (collaboratorId) fetchData(); }, [collaboratorId, page]);

  // Realtime
  useEffect(() => {
    if (!collaboratorId) return;
    const channel = supabase
      .channel("my_leads_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_items", filter: `assigned_to=eq.${collaboratorId}` }, () => {
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [collaboratorId]);

  const fetchData = async () => {
    setLoading(true);
    const [leadsRes, countRes] = await Promise.all([
      supabase.from("lead_items")
        .select("*")
        .eq("assigned_to", collaboratorId)
        .in("status", ["distributed", "dispatched"])
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1),
      supabase.from("lead_items")
        .select("status")
        .eq("assigned_to", collaboratorId)
        .in("status", ["distributed", "dispatched"]),
    ]);
    setLeads(leadsRes.data || []);
    const c = { distributed: 0, dispatched: 0, total: 0 };
    (countRes.data || []).forEach(item => {
      if (item.status === "distributed") c.distributed++;
      if (item.status === "dispatched") c.dispatched++;
      c.total++;
    });
    setCounts(c);
    setLoading(false);
  };

  const filtered = leads.filter(l => {
    const q = search.toLowerCase();
    if (q && !(l.name || "").toLowerCase().includes(q) && !l.phone.includes(q) && !(l.city || "").toLowerCase().includes(q)) return false;
    return true;
  });

  const markAsDispatched = async (id: string) => {
    const { error } = await supabase.from("lead_items").update({ status: "dispatched", dispatched_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    else fetchData();
  };

  const markSelectedAsDispatched = async () => {
    if (selected.size === 0) return;
    setMarkingAll(true);
    try {
      const ids = Array.from(selected);
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        await supabase.from("lead_items").update({ status: "dispatched", dispatched_at: new Date().toISOString() }).in("id", chunk);
      }
      toast.success(`${ids.length} leads marcados como enviados`);
      setSelected(new Set());
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setMarkingAll(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const selectAllDistributed = () => {
    const distributedIds = filtered.filter(l => l.status === "distributed").map(l => l.id);
    if (selected.size === distributedIds.length) setSelected(new Set());
    else setSelected(new Set(distributedIds));
  };

  const copyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    toast.success("Telefone copiado!");
  };

  const openWhatsApp = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    const num = digits.startsWith("55") ? digits : `55${digits}`;
    window.open(`https://wa.me/${num}`, "_blank");
  };

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard icon={<Package className="h-5 w-5" />} label="Pendentes" value={counts.distributed} color="yellow" />
        <SummaryCard icon={<CheckCircle className="h-5 w-5" />} label="Enviados" value={counts.dispatched} color="green" />
        <SummaryCard icon={<TrendingUp className="h-5 w-5" />} label="Total" value={counts.total} />
      </div>

      {/* Leads Table */}
      <Card variant="gradient">
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">Meus Leads</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar nome, telefone, cidade..." className="pl-8 h-9 w-52" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Button size="sm" variant="outline" onClick={fetchData} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>

        {selected.size > 0 && (
          <div className="mx-6 mb-2 p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-medium">{selected.size} lead(s) selecionado(s)</span>
            <Button size="sm" onClick={markSelectedAsDispatched} disabled={markingAll} className="gap-1.5 btn-modern">
              {markingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
              Marcar Todos como Enviados
            </Button>
          </div>
        )}

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selected.size > 0 && selected.size === filtered.filter(l => l.status === "distributed").length}
                    onCheckedChange={selectAllDistributed}
                  />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>DDD</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {loading ? "Carregando..." : "Nenhum lead encontrado"}
                  </TableCell>
                </TableRow>
              ) : filtered.map(l => (
                <TableRow key={l.id} className="table-row-hover">
                  <TableCell>
                    {l.status === "distributed" && (
                      <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggleSelect(l.id)} />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{l.name || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sm">{l.phone}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyPhone(l.phone)} title="Copiar">
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-success" onClick={() => openWhatsApp(l.phone)} title="WhatsApp">
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>{l.city || "—"}</TableCell>
                  <TableCell>{l.ddd || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={l.status === "distributed" ? "secondary" : "default"}
                      className={l.status === "dispatched" ? "bg-success/20 text-success" : ""}>
                      {l.status === "distributed" ? "Pendente" : "Enviado"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {l.status === "distributed" && (
                      <Button size="sm" variant="outline" onClick={() => markAsDispatched(l.id)} className="gap-1 text-xs">
                        <CheckCircle className="h-3.5 w-3.5" /> Enviado
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {leads.length === PAGE_SIZE && (
            <div className="flex items-center justify-center gap-3 p-4">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <span className="text-sm text-muted-foreground">Página {page + 1}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)}>Próxima</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ═══════════════════════════════════════════
// SHARED
// ═══════════════════════════════════════════
function SummaryCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: number; color?: "green" | "yellow";
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            color === "green" ? "bg-success/10 text-success" :
            color === "yellow" ? "bg-warning/10 text-warning" :
            "bg-primary/10 text-primary"
          }`}>
            {icon}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value.toLocaleString("pt-BR")}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
