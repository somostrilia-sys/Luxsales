/**
 * Motor de Leads — Distribuição, Acompanhamento em Tempo Real, Histórico e Redistribuição
 */
import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Zap, TrendingUp, Send, MessageCircle, CheckCircle, Loader2,
  Search, RefreshCw, Users, Play, MapPin, Phone, ArrowRight, Shuffle,
  History, ArrowLeftRight, Package, Eye, Undo2, ChevronLeft
} from "lucide-react";

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════
interface LeadItem {
  id: string;
  batch_id: string | null;
  name: string | null;
  phone: string;
  city: string | null;
  state: string | null;
  ddd: string | null;
  assigned_to: string | null;
  status: string;
  dispatched_at: string | null;
  created_at: string | null;
}

interface LeadBatch {
  id: string;
  company_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
  filters: any;
  total_leads: number | null;
  sent_leads: number | null;
  status: string;
  created_at: string | null;
}

interface Collaborator {
  id: string;
  name: string;
  email: string | null;
  company_id: string | null;
  unit_id: string | null;
  unit_ids: any;
  active: boolean | null;
}

interface Company {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  name: string;
  company_id: string | null;
}

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export default function MotorLeads() {
  const { collaborator, roleLevel } = useCollaborator();
  const isCeo = roleLevel <= 1;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Motor de Leads</h1>
            <p className="text-muted-foreground text-sm">
              {isCeo ? "Distribua, acompanhe e redistribua leads" : "Leads distribuídos para você"}
            </p>
          </div>
        </div>

        {isCeo ? <CeoView /> : <ConsultorView collaboratorId={collaborator?.id || ""} />}
      </div>
    </DashboardLayout>
  );
}

// ═══════════════════════════════════════════
// CEO VIEW — Tabs: Distribuição | Acompanhamento | Histórico
// ═══════════════════════════════════════════
function CeoView() {
  const [activeTab, setActiveTab] = useState("distribute");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="grid grid-cols-3 w-full max-w-lg">
        <TabsTrigger value="distribute" className="gap-1.5">
          <Shuffle className="h-4 w-4" /> Distribuição
        </TabsTrigger>
        <TabsTrigger value="tracking" className="gap-1.5">
          <Eye className="h-4 w-4" /> Acompanhamento
        </TabsTrigger>
        <TabsTrigger value="history" className="gap-1.5">
          <History className="h-4 w-4" /> Histórico
        </TabsTrigger>
      </TabsList>

      <TabsContent value="distribute" className="space-y-4 mt-4">
        <DistributionTab />
      </TabsContent>
      <TabsContent value="tracking" className="space-y-4 mt-4">
        <TrackingTab />
      </TabsContent>
      <TabsContent value="history" className="space-y-4 mt-4">
        <HistoryTab />
      </TabsContent>
    </Tabs>
  );
}

// ═══════════════════════════════════════════
// DISTRIBUTION TAB
// ═══════════════════════════════════════════
function DistributionTab() {
  const { collaborator: currentCollab } = useCollaborator();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [distributing, setDistributing] = useState(false);

  // Filters
  const [companyId, setCompanyId] = useState("");
  const [unitId, setUnitId] = useState("all");
  const [distCity, setDistCity] = useState("");
  const [distDDD, setDistDDD] = useState("");
  const [distSource, setDistSource] = useState("all");
  const [distQty, setDistQty] = useState(500);
  const [distTarget, setDistTarget] = useState("all");

  // Stats
  const [availableCount, setAvailableCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    if (companyId) {
      loadCollaborators();
    }
  }, [companyId, unitId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (companyId) countAvailableLeads();
    }, 400);
    return () => clearTimeout(timer);
  }, [distCity, distDDD, distSource]);

  const loadBaseData = async () => {
    setLoading(true);
    const [compRes, unitRes] = await Promise.all([
      supabase.from("companies").select("id,name").order("name"),
      supabase.from("units").select("id,name,company_id").eq("active", true).order("name"),
    ]);
    setCompanies(compRes.data || []);
    setUnits(unitRes.data || []);
    setLoading(false);
  };

  const loadCollaborators = async () => {
    let query = supabase.from("collaborators")
      .select("id,name,email,company_id,unit_id,unit_ids,active")
      .eq("active", true);

    if (companyId) query = query.eq("company_id", companyId);

    const { data } = await query.order("name");
    let collabs = data || [];

    // Filter by unit
    if (unitId !== "all") {
      collabs = collabs.filter(c => {
        if (c.unit_id === unitId) return true;
        if (Array.isArray(c.unit_ids) && c.unit_ids.includes(unitId)) return true;
        return false;
      });
    }

    setCollaborators(collabs);
  };

  const countAvailableLeads = async () => {
    setPreviewLoading(true);
    let query = supabase.from("contact_leads")
      .select("id", { count: "exact", head: true })
      .not("phone", "is", null)
      .eq("status", "pending");

    if (distCity.trim()) query = query.ilike("city", `%${distCity.trim()}%`);
    if (distDDD.trim() && distDDD.length === 2) query = query.like("phone", `(${distDDD})%`);
    if (distSource !== "all") query = query.eq("source", distSource);

    const { count } = await query;
    setAvailableCount(count);
    setPreviewLoading(false);
  };

  const handleDistribute = async () => {
    if (!companyId) { toast.error("Selecione uma empresa"); return; }

    const targetCollabs = distTarget === "all"
      ? collaborators.map(c => c.id)
      : [distTarget];

    if (targetCollabs.length === 0) {
      toast.error("Nenhum colaborador disponível");
      return;
    }

    setDistributing(true);
    try {
      // Fetch leads
      let query = supabase.from("contact_leads")
        .select("id,name,phone,city,state,source")
        .not("phone", "is", null)
        .eq("status", "pending");

      if (distCity.trim()) query = query.ilike("city", `%${distCity.trim()}%`);
      if (distDDD.trim() && distDDD.length === 2) query = query.like("phone", `(${distDDD})%`);
      if (distSource !== "all") query = query.eq("source", distSource);

      const { data: leadsRaw, error: leadsErr } = await query.limit(distQty);
      if (leadsErr) throw leadsErr;
      if (!leadsRaw || leadsRaw.length === 0) {
        toast.error("Nenhum lead encontrado com os filtros selecionados");
        return;
      }

      const perCollab = Math.ceil(leadsRaw.length / targetCollabs.length);

      // Create batch + items per collaborator
      for (let i = 0; i < targetCollabs.length; i++) {
        const slice = leadsRaw.slice(i * perCollab, (i + 1) * perCollab);
        if (slice.length === 0) continue;

        // Create batch
        const { data: batch, error: batchErr } = await supabase.from("lead_batches").insert({
          company_id: companyId,
          assigned_to: targetCollabs[i],
          created_by: currentCollab?.id || null,
          filters: { city: distCity || null, ddd: distDDD || null, source: distSource, unit: unitId },
          total_leads: slice.length,
          status: "pending",
        }).select("id").single();

        if (batchErr) throw batchErr;

        // Create items
        const items = slice.map(l => ({
          batch_id: batch.id,
          phone: l.phone,
          name: l.name,
          city: l.city,
          state: l.state,
          ddd: l.phone?.match(/\((\d{2})\)/)?.[1] || null,
          assigned_to: targetCollabs[i],
          status: "pending",
        }));

        const { error: itemsErr } = await supabase.from("lead_items").insert(items);
        if (itemsErr) throw itemsErr;
      }

      // Mark contact_leads as distributed
      const distributedIds = leadsRaw.map(l => l.id);
      // Update in chunks of 500 to avoid query limits
      for (let i = 0; i < distributedIds.length; i += 500) {
        const chunk = distributedIds.slice(i, i + 500);
        await supabase.from("contact_leads").update({ status: "contacted" }).in("id", chunk);
      }

      toast.success(`${leadsRaw.length} leads distribuídos para ${targetCollabs.length} colaborador(es)!`);
      countAvailableLeads();
    } catch (e: any) {
      toast.error("Erro na distribuição: " + e.message);
    } finally {
      setDistributing(false);
    }
  };

  const filteredUnits = units.filter(u => u.company_id === companyId);

  return (
    <>
      <Card variant="gradient" className="card-accent-top">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shuffle className="h-5 w-5 text-primary" />
            Nova Distribuição de Leads
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Step 1: Company & Unit */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">1. Empresa e Unidade</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Empresa *</Label>
                <Select value={companyId} onValueChange={v => { setCompanyId(v); setUnitId("all"); setDistTarget("all"); }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                  <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Unidade</Label>
                <Select value={unitId} onValueChange={setUnitId} disabled={!companyId}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as unidades</SelectItem>
                    {filteredUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Step 2: Lead Filters */}
          {companyId && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">2. Filtros de Leads</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> Cidade</Label>
                  <Input placeholder="Ex: São Paulo" value={distCity} onChange={e => setDistCity(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> DDD</Label>
                  <Input placeholder="Ex: 11" value={distDDD} onChange={e => setDistDDD(e.target.value.replace(/\D/g, "").slice(0, 2))} maxLength={2} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Fonte</Label>
                  <Select value={distSource} onValueChange={setDistSource}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="receita">Receita Federal</SelectItem>
                      <SelectItem value="google_maps">Google Maps</SelectItem>
                      <SelectItem value="olx">OLX</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Quantidade</Label>
                  <Input type="number" min={10} max={5000} value={distQty} onChange={e => setDistQty(Number(e.target.value))} className="mt-1" />
                </div>
              </div>
              {availableCount !== null && (
                <p className="text-xs text-muted-foreground mt-2">
                  {previewLoading ? "Contando..." : `${availableCount.toLocaleString("pt-BR")} leads disponíveis com esses filtros`}
                </p>
              )}
            </div>
          )}

          {/* Step 3: Target */}
          {companyId && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">3. Distribuir Para</p>
              <Select value={distTarget} onValueChange={setDistTarget}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toda equipe ({collaborators.length} colaboradores) — distribuição uniforme</SelectItem>
                  {collaborators.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>

              {distTarget === "all" && collaborators.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  ~{Math.ceil(distQty / collaborators.length)} leads por colaborador
                </p>
              )}
            </div>
          )}

          {/* Action */}
          {companyId && (
            <Button onClick={handleDistribute} disabled={distributing || !companyId} className="w-full sm:w-auto gap-2 btn-modern">
              {distributing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {distributing ? "Distribuindo..." : "Distribuir Leads"}
            </Button>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ═══════════════════════════════════════════
// TRACKING TAB — Realtime Status
// ═══════════════════════════════════════════
function TrackingTab() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [companyId, setCompanyId] = useState("all");
  const [summary, setSummary] = useState<{ collab_id: string; name: string; pending: number; sent: number; responded: number; converted: number; failed: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCollab, setSelectedCollab] = useState<string | null>(null);

  useEffect(() => { loadData(); }, [companyId]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("lead_items_realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "lead_items" }, () => {
        // Refresh summary on any lead_item status change
        loadData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [companyId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [compRes, collabRes] = await Promise.all([
        supabase.from("companies").select("id,name").order("name"),
        companyId === "all"
          ? supabase.from("collaborators").select("id,name,company_id,unit_id,unit_ids,active,email").eq("active", true).order("name")
          : supabase.from("collaborators").select("id,name,company_id,unit_id,unit_ids,active,email").eq("active", true).eq("company_id", companyId).order("name"),
      ]);
      setCompanies(compRes.data || []);
      const collabs = collabRes.data || [];
      setCollaborators(collabs);

      // Load lead_items counts per collaborator
      const collabIds = collabs.map(c => c.id);
      if (collabIds.length === 0) {
        setSummary([]);
        setLoading(false);
        return;
      }

      const { data: items } = await supabase.from("lead_items")
        .select("assigned_to,status")
        .in("assigned_to", collabIds);

      // Aggregate
      const map = new Map<string, { pending: number; sent: number; responded: number; converted: number; failed: number }>();
      collabs.forEach(c => map.set(c.id, { pending: 0, sent: 0, responded: 0, converted: 0, failed: 0 }));

      (items || []).forEach(item => {
        const entry = map.get(item.assigned_to);
        if (entry) {
          const s = item.status as keyof typeof entry;
          if (s in entry) entry[s]++;
        }
      });

      const result = collabs
        .map(c => {
          const counts = map.get(c.id)!;
          const total = counts.pending + counts.sent + counts.responded + counts.converted + counts.failed;
          return { collab_id: c.id, name: c.name, ...counts, total };
        })
        .filter(r => r.total > 0)
        .sort((a, b) => b.total - a.total);

      setSummary(result);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (selectedCollab) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setSelectedCollab(null)} className="gap-1.5">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Button>
        <CollabLeadDetail collaboratorId={selectedCollab} collaborators={collaborators} onRefresh={loadData} />
      </>
    );
  }

  const totalPending = summary.reduce((s, r) => s + r.pending, 0);
  const totalSent = summary.reduce((s, r) => s + r.sent, 0);
  const totalResponded = summary.reduce((s, r) => s + r.responded, 0);
  const totalConverted = summary.reduce((s, r) => s + r.converted, 0);

  return (
    <>
      {/* Global Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard icon={<Users className="h-5 w-5" />} label="Consultores" value={summary.length} />
        <SummaryCard icon={<Package className="h-5 w-5" />} label="Pendentes" value={totalPending} color="yellow" />
        <SummaryCard icon={<Send className="h-5 w-5" />} label="Enviados" value={totalSent} />
        <SummaryCard icon={<MessageCircle className="h-5 w-5" />} label="Responderam" value={totalResponded} color="green" />
        <SummaryCard icon={<CheckCircle className="h-5 w-5" />} label="Convertidos" value={totalConverted} color="green" />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={companyId} onValueChange={setCompanyId}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Empresas</SelectItem>
            {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={loadData} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
        <Badge variant="outline" className="text-xs">
          <span className="animate-pulse mr-1 inline-block h-2 w-2 rounded-full bg-green-500" />
          Realtime
        </Badge>
      </div>

      {/* Team Table */}
      <Card variant="gradient">
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
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {loading ? "Carregando..." : "Nenhum colaborador com leads distribuídos"}
                  </TableCell>
                </TableRow>
              ) : summary.map(r => {
                const total = r.sent + r.responded + r.converted;
                const rate = total > 0 ? Math.round(((r.responded + r.converted) / total) * 100) : 0;
                return (
                  <TableRow key={r.collab_id} className="table-row-hover">
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-center">
                      {r.pending > 0 ? <Badge variant="secondary">{r.pending}</Badge> : "0"}
                    </TableCell>
                    <TableCell className="text-center">{r.sent}</TableCell>
                    <TableCell className="text-center">
                      {r.responded > 0 ? <Badge className="bg-success/20 text-success">{r.responded}</Badge> : "0"}
                    </TableCell>
                    <TableCell className="text-center">
                      {r.converted > 0 ? <Badge className="bg-success/20 text-success">{r.converted}</Badge> : "0"}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={rate > 10 ? "text-success font-semibold" : "text-muted-foreground"}>{rate}%</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setSelectedCollab(r.collab_id)} className="gap-1">
                        <Eye className="h-3.5 w-3.5" /> Ver
                      </Button>
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
// COLLABORATOR LEAD DETAIL + REDISTRIBUTION
// ═══════════════════════════════════════════
function CollabLeadDetail({ collaboratorId, collaborators, onRefresh }: {
  collaboratorId: string;
  collaborators: Collaborator[];
  onRefresh: () => void;
}) {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [redistributeOpen, setRedistributeOpen] = useState(false);
  const [redistributeTarget, setRedistributeTarget] = useState("");
  const [redistributing, setRedistributing] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const collabName = collaborators.find(c => c.id === collaboratorId)?.name || "Colaborador";

  useEffect(() => { fetchLeads(); }, [collaboratorId, page]);

  const fetchLeads = async () => {
    setLoading(true);
    const { data } = await supabase.from("lead_items")
      .select("*")
      .eq("assigned_to", collaboratorId)
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    setLeads(data || []);
    setLoading(false);
  };

  const filtered = leads.filter(l => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    const q = search.toLowerCase();
    if (q && !(l.name || "").toLowerCase().includes(q) && !l.phone.includes(q) && !(l.city || "").toLowerCase().includes(q)) return false;
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(l => l.id)));
    }
  };

  const handleRedistribute = async () => {
    if (!redistributeTarget || selected.size === 0) return;
    setRedistributing(true);
    try {
      const ids = Array.from(selected);
      // Update in chunks
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const { error } = await supabase.from("lead_items")
          .update({ assigned_to: redistributeTarget })
          .in("id", chunk);
        if (error) throw error;
      }
      toast.success(`${ids.length} leads redistribuídos com sucesso!`);
      setSelected(new Set());
      setRedistributeOpen(false);
      fetchLeads();
      onRefresh();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setRedistributing(false);
    }
  };

  const handleReturnToPool = async () => {
    if (selected.size === 0) return;
    setRedistributing(true);
    try {
      const ids = Array.from(selected);
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        await supabase.from("lead_items")
          .update({ assigned_to: null, status: "pending" })
          .in("id", chunk);
      }
      toast.success(`${ids.length} leads devolvidos à base`);
      setSelected(new Set());
      fetchLeads();
      onRefresh();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setRedistributing(false);
    }
  };

  const otherCollabs = collaborators.filter(c => c.id !== collaboratorId);

  return (
    <>
      <Card variant="gradient">
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">Leads de {collabName} ({leads.length})</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." className="pl-8 h-9 w-44" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="sent">Enviados</SelectItem>
                <SelectItem value="responded">Responderam</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={fetchLeads} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>

        {selected.size > 0 && (
          <div className="mx-6 mb-2 p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-medium">{selected.size} lead(s) selecionado(s)</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setRedistributeOpen(true)} className="gap-1.5">
                <ArrowLeftRight className="h-3.5 w-3.5" /> Redistribuir
              </Button>
              <Button size="sm" variant="outline" onClick={handleReturnToPool} disabled={redistributing} className="gap-1.5">
                <Undo2 className="h-3.5 w-3.5" /> Devolver à Base
              </Button>
            </div>
          </div>
        )}

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={selectAllFiltered} />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>DDD</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {loading ? "Carregando..." : "Nenhum lead"}
                  </TableCell>
                </TableRow>
              ) : filtered.map(l => (
                <TableRow key={l.id} className="table-row-hover">
                  <TableCell>
                    <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggleSelect(l.id)} />
                  </TableCell>
                  <TableCell className="font-medium">{l.name || "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{l.phone}</TableCell>
                  <TableCell>{l.city || "—"}</TableCell>
                  <TableCell>{l.ddd || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={
                      l.status === "pending" ? "secondary" :
                      l.status === "sent" ? "outline" :
                      l.status === "responded" ? "default" :
                      l.status === "converted" ? "default" : "destructive"
                    } className={
                      l.status === "responded" || l.status === "converted" ? "bg-success/20 text-success" : ""
                    }>
                      {l.status === "pending" ? "Pendente" : l.status === "sent" ? "Enviado" : l.status === "responded" ? "Respondeu" : l.status === "converted" ? "Convertido" : l.status}
                    </Badge>
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

      {/* Redistribute Dialog */}
      <Dialog open={redistributeOpen} onOpenChange={setRedistributeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
              Redistribuir {selected.size} Lead(s)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Mover para</Label>
              <Select value={redistributeTarget} onValueChange={setRedistributeTarget}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o colaborador destino" /></SelectTrigger>
                <SelectContent>
                  {otherCollabs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRedistributeOpen(false)}>Cancelar</Button>
            <Button onClick={handleRedistribute} disabled={redistributing || !redistributeTarget} className="gap-2">
              {redistributing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
              Redistribuir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ═══════════════════════════════════════════
// HISTORY TAB — Distribution Log
// ═══════════════════════════════════════════
function HistoryTab() {
  const [batches, setBatches] = useState<(LeadBatch & { collab_name?: string; company_name?: string; creator_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filterCompany, setFilterCompany] = useState("all");

  useEffect(() => { loadHistory(); }, [filterCompany]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      let query = supabase.from("lead_batches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (filterCompany !== "all") query = query.eq("company_id", filterCompany);

      const [batchRes, compRes, collabRes] = await Promise.all([
        query,
        supabase.from("companies").select("id,name").order("name"),
        supabase.from("collaborators").select("id,name").limit(1000),
      ]);

      setCompanies(compRes.data || []);
      const collabMap = new Map((collabRes.data || []).map(c => [c.id, c.name]));
      const compMap = new Map((compRes.data || []).map(c => [c.id, c.name]));

      const enriched = (batchRes.data || []).map(b => ({
        ...b,
        collab_name: b.assigned_to ? collabMap.get(b.assigned_to) || "—" : "—",
        company_name: b.company_id ? compMap.get(b.company_id) || "—" : "—",
        creator_name: b.created_by ? collabMap.get(b.created_by) || "—" : "Sistema",
      }));

      setBatches(enriched);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const getFiltersSummary = (filters: any) => {
    if (!filters) return "—";
    const parts: string[] = [];
    if (filters.city) parts.push(`Cidade: ${filters.city}`);
    if (filters.ddd) parts.push(`DDD: ${filters.ddd}`);
    if (filters.source && filters.source !== "all") parts.push(`Fonte: ${filters.source}`);
    return parts.length > 0 ? parts.join(", ") : "Sem filtros";
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <Select value={filterCompany} onValueChange={setFilterCompany}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Empresas</SelectItem>
            {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={loadHistory} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      <Card variant="gradient">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Distribuído Para</TableHead>
                <TableHead>Criado Por</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">Enviados</TableHead>
                <TableHead>Filtros</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {loading ? "Carregando..." : "Nenhuma distribuição encontrada"}
                  </TableCell>
                </TableRow>
              ) : batches.map(b => (
                <TableRow key={b.id} className="table-row-hover">
                  <TableCell className="text-sm">{b.created_at ? format(new Date(b.created_at), "dd/MM/yy HH:mm") : "—"}</TableCell>
                  <TableCell className="font-medium">{b.company_name}</TableCell>
                  <TableCell>{b.collab_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{b.creator_name}</TableCell>
                  <TableCell className="text-center font-semibold">{b.total_leads ?? 0}</TableCell>
                  <TableCell className="text-center">{b.sent_leads ?? 0}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{getFiltersSummary(b.filters)}</TableCell>
                  <TableCell>
                    <Badge variant={b.status === "completed" ? "default" : b.status === "pending" ? "secondary" : "outline"}
                      className={b.status === "completed" ? "bg-success/20 text-success" : ""}>
                      {b.status === "pending" ? "Pendente" : b.status === "completed" ? "Concluído" : b.status}
                    </Badge>
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
// CONSULTOR VIEW — Seus leads distribuídos
// ═══════════════════════════════════════════
function ConsultorView({ collaboratorId }: { collaboratorId: string }) {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const [counts, setCounts] = useState({ pending: 0, sent: 0, responded: 0, converted: 0 });

  useEffect(() => { if (collaboratorId) fetchData(); }, [collaboratorId, page]);

  // Realtime
  useEffect(() => {
    if (!collaboratorId) return;
    const channel = supabase
      .channel("my_leads_realtime")
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
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1),
      supabase.from("lead_items")
        .select("status")
        .eq("assigned_to", collaboratorId),
    ]);

    setLeads(leadsRes.data || []);

    // Count statuses
    const c = { pending: 0, sent: 0, responded: 0, converted: 0 };
    (countRes.data || []).forEach(item => {
      const s = item.status as keyof typeof c;
      if (s in c) c[s]++;
    });
    setCounts(c);
    setLoading(false);
  };

  const filtered = leads.filter(l => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    const q = search.toLowerCase();
    if (q && !(l.name || "").toLowerCase().includes(q) && !l.phone.includes(q) && !(l.city || "").toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon={<Package className="h-5 w-5" />} label="Pendentes" value={counts.pending} color="yellow" />
        <SummaryCard icon={<Send className="h-5 w-5" />} label="Enviados" value={counts.sent} />
        <SummaryCard icon={<MessageCircle className="h-5 w-5" />} label="Responderam" value={counts.responded} color="green" />
        <SummaryCard icon={<CheckCircle className="h-5 w-5" />} label="Convertidos" value={counts.converted} color="green" />
      </div>

      <Card variant="gradient">
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">Meus Leads ({counts.pending + counts.sent + counts.responded + counts.converted})</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." className="pl-8 h-9 w-44" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="sent">Enviados</SelectItem>
                <SelectItem value="responded">Responderam</SelectItem>
                <SelectItem value="converted">Convertidos</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={fetchData} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Badge variant="outline" className="text-xs">
              <span className="animate-pulse mr-1 inline-block h-2 w-2 rounded-full bg-green-500" />
              Realtime
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>DDD</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {loading ? "Carregando..." : "Nenhum lead encontrado"}
                  </TableCell>
                </TableRow>
              ) : filtered.map(l => (
                <TableRow key={l.id} className="table-row-hover">
                  <TableCell className="font-medium">{l.name || "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{l.phone}</TableCell>
                  <TableCell>{l.city || "—"}</TableCell>
                  <TableCell>{l.ddd || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={
                      l.status === "pending" ? "secondary" :
                      l.status === "sent" ? "outline" :
                      l.status === "responded" || l.status === "converted" ? "default" : "destructive"
                    } className={
                      l.status === "responded" || l.status === "converted" ? "bg-success/20 text-success" : ""
                    }>
                      {l.status === "pending" ? "Pendente" : l.status === "sent" ? "Enviado" : l.status === "responded" ? "Respondeu" : l.status === "converted" ? "Convertido" : l.status}
                    </Badge>
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
// SHARED COMPONENTS
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
