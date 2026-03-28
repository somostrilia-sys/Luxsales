import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useCompany } from "@/contexts/CompanyContext";
import { EDGE_BASE, SUPABASE_ANON_KEY } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Users, Flame, Thermometer, Snowflake, RefreshCw,
  ChevronLeft, ChevronRight, Phone, Send, UserPlus,
  Pencil, Loader2, Upload, ListPlus, BarChart3,
  CheckCircle, XCircle, Clock, Star,
} from "lucide-react";

// ── helpers ──
async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return { "Content-Type": "application/json", Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY };
}

async function callEdge(fn: string, body: Record<string, unknown>) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${EDGE_BASE}/${fn}`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Erro");
  return res.json();
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return iso; }
}

const statusLabels: Record<string, { label: string; cls: string }> = {
  new: { label: "Novo", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  queued_call: { label: "Na Fila", cls: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  called: { label: "Chamado", cls: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30" },
  opted_in: { label: "Opt-in", cls: "bg-green-500/15 text-green-400 border-green-500/30" },
  dispatched: { label: "Disparado", cls: "bg-primary/15 text-primary border-primary/30" },
  engaged: { label: "Engajado", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  converted: { label: "Convertido", cls: "bg-green-600/15 text-green-300 border-green-600/30" },
  lost: { label: "Perdido", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  dnc: { label: "DNC", cls: "bg-muted text-muted-foreground border-border" },
  invalid: { label: "Inválido", cls: "bg-muted text-muted-foreground border-border" },
};

const tempEmoji: Record<string, string> = { hot: "🔥", warm: "🌡️", cold: "❄️", dead: "💀" };

// ── types ──
interface Lead {
  phone: string; name: string; status: string; lead_score: number; temperature: string;
  segment: string; call_count: number; last_contact_at: string | null;
  email?: string; tags?: string[]; extra_data?: Record<string, unknown>;
}
interface Stats {
  total: number; new: number; queued_call: number; called: number; opted_in: number;
  dispatched: number; engaged: number; converted: number; lost: number;
  hot: number; warm: number; cold: number; avg_score: number;
}

const defaultStats: Stats = { total: 0, new: 0, queued_call: 0, called: 0, opted_in: 0, dispatched: 0, engaged: 0, converted: 0, lost: 0, hot: 0, warm: 0, cold: 0, avg_score: 0 };

// ── component ──
export default function LeadsMaster() {
  const { company_id, user_role } = useCompany();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats>(defaultStats);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(0);

  // filters
  const [fStatus, setFStatus] = useState("all");
  const [fTemp, setFTemp] = useState("all");
  const [fSegment, setFSegment] = useState("all");
  const [fSearch, setFSearch] = useState("");
  const [fSort, setFSort] = useState("created_at");
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // detail drawer
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [detailHistory, setDetailHistory] = useState<{ calls: any[]; dispatches: any[]; lifecycle: any } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // modals
  const [distributeOpen, setDistributeOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [distributeCollab, setDistributeCollab] = useState("");
  const [priorityValue, setPriorityValue] = useState([5]);
  const [actionLoading, setActionLoading] = useState(false);
  const [collabs, setCollabs] = useState<{ id: string; name: string }[]>([]);

  const base = { company_id, requester_role: user_role || "ceo" };
  const PAGE_SIZE = 50;

  const fetchLeads = useCallback(async (silent = false) => {
    if (!company_id) return;
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const body: Record<string, unknown> = {
        action: "list-master", ...base, limit: PAGE_SIZE, offset: page * PAGE_SIZE,
        sort_by: fSort,
      };
      if (fStatus !== "all") body.status = fStatus;
      if (fTemp !== "all") body.temperature = fTemp;
      if (fSegment !== "all") body.segment = fSegment;
      if (fSearch.length >= 3) body.search = fSearch;

      const data = await callEdge("lead-distributor", body);
      setLeads(data.leads || []);
      setTotalRows(data.total || 0);
      if (data.stats) setStats({ ...defaultStats, ...data.stats });
    } catch {
      if (!silent) toast.error("Erro ao carregar leads");
    }
    setLoading(false);
    setRefreshing(false);
  }, [company_id, user_role, page, fStatus, fTemp, fSegment, fSearch, fSort]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // debounced search
  const handleSearch = (val: string) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setFSearch(val); setPage(0); }, 600);
  };

  // select helpers
  const toggleSelect = (phone: string) => {
    setSelected(prev => { const s = new Set(prev); s.has(phone) ? s.delete(phone) : s.add(phone); return s; });
  };
  const toggleAll = () => {
    if (selected.size === leads.length) setSelected(new Set());
    else setSelected(new Set(leads.map(l => l.phone)));
  };
  const selectedPhones = Array.from(selected);

  // bulk actions
  const bulkAction = async (action: string, extra: Record<string, unknown> = {}) => {
    setActionLoading(true);
    try {
      await callEdge("lead-distributor", { action, ...base, phone_numbers: selectedPhones, ...extra });
      toast.success("Ação executada com sucesso");
      setSelected(new Set());
      fetchLeads(true);
    } catch (e: any) {
      toast.error(e.message || "Erro na ação");
    }
    setActionLoading(false);
  };

  // detail drawer
  const openDetail = async (lead: Lead) => {
    setDetailLead(lead);
    setDetailLoading(true);
    setDetailHistory(null);
    try {
      const data = await callEdge("lead-distributor", { action: "lead-detail", ...base, phone_number: lead.phone });
      setDetailHistory(data);
    } catch { /* silent */ }
    setDetailLoading(false);
  };

  // load collabs for distribute modal
  const openDistribute = async () => {
    setDistributeOpen(true);
    if (collabs.length === 0) {
      try {
        const data = await callEdge("dispatch-permissions", { action: "list", ...base });
        setCollabs((data.permissions || []).map((p: any) => ({ id: p.collaborator_id, name: p.name || p.collaborator_id })));
      } catch { /* silent */ }
    }
  };

  // single lead actions
  const singleCall = async (phone: string) => {
    try {
      await callEdge("make-call", { action: "dial", ...base, phone_number: phone });
      toast.success("Ligação iniciada");
    } catch (e: any) { toast.error(e.message || "Erro ao ligar"); }
  };

  const singleDispatch = async (phone: string) => {
    try {
      await callEdge("smart-dispatcher", { action: "send", ...base, phone_number: phone });
      toast.success("Disparo enviado");
    } catch (e: any) { toast.error(e.message || "Erro ao disparar"); }
  };

  // ── stat cards ──
  const statCards = [
    { label: "Total", value: stats.total, color: "text-foreground" },
    { label: "Novos", value: stats.new, color: "text-blue-400" },
    { label: "Na Fila", value: stats.queued_call, color: "text-purple-400" },
    { label: "Chamados", value: stats.called, color: "text-cyan-400" },
    { label: "Opt-in", value: stats.opted_in, color: "text-green-400" },
    { label: "Disparados", value: stats.dispatched, color: "text-primary" },
    { label: "Engajados", value: stats.engaged, color: "text-emerald-400" },
    { label: "Convertidos", value: stats.converted, color: "text-green-300" },
    { label: "Perdidos", value: stats.lost, color: "text-red-400" },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-56" />
          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
            {Array.from({ length: 9 }).map((_, i) => <Card key={i}><CardContent className="pt-4"><Skeleton className="h-8 w-full" /></CardContent></Card>)}
          </div>
          <Skeleton className="h-10 w-full" />
          <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <PageHeader title="Leads Master" subtitle={`${stats.total.toLocaleString("pt-BR")} leads na base`} />
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => navigate("/leads-discador")}>
              <Upload className="h-4 w-4 mr-1.5" /> Importar
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/call-campaigns")}>
              <Phone className="h-4 w-4 mr-1.5" /> Fila de Ligação
            </Button>
            <Button variant="outline" size="sm" onClick={() => fetchLeads(true)} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
          {statCards.map(c => (
            <Card key={c.label} className="cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => { if (c.label !== "Total") { setFStatus(c.label === "Novos" ? "new" : c.label === "Na Fila" ? "queued_call" : c.label === "Chamados" ? "called" : c.label === "Opt-in" ? "opted_in" : c.label === "Disparados" ? "dispatched" : c.label === "Engajados" ? "engaged" : c.label === "Convertidos" ? "converted" : c.label === "Perdidos" ? "lost" : "all"); setPage(0); } }}>
              <CardContent className="pt-3 pb-2 text-center">
                <p className={`text-lg font-bold ${c.color}`}>{c.value.toLocaleString("pt-BR")}</p>
                <p className="text-[10px] text-muted-foreground">{c.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Temp + Score */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Hot", value: stats.hot, emoji: "🔥", bg: "bg-red-500/10 border-red-500/20", icon: Flame, color: "text-red-400" },
            { label: "Warm", value: stats.warm, emoji: "🌡️", bg: "bg-yellow-500/10 border-yellow-500/20", icon: Thermometer, color: "text-yellow-400" },
            { label: "Cold", value: stats.cold, emoji: "❄️", bg: "bg-blue-500/10 border-blue-500/20", icon: Snowflake, color: "text-blue-400" },
            { label: "Score Médio", value: stats.avg_score, emoji: "⭐", bg: "bg-primary/10 border-primary/20", icon: Star, color: "text-primary" },
          ].map(c => (
            <Card key={c.label} className={c.bg}>
              <CardContent className="pt-3 pb-2 text-center">
                <span className="text-lg">{c.emoji}</span>
                <p className={`text-xl font-bold ${c.color}`}>{typeof c.value === "number" ? c.value.toLocaleString("pt-BR") : c.value}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={fStatus} onValueChange={v => { setFStatus(v); setPage(0); }}>
            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fTemp} onValueChange={v => { setFTemp(v); setPage(0); }}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Temp" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Temps</SelectItem>
              <SelectItem value="hot">🔥 Hot</SelectItem>
              <SelectItem value="warm">🌡️ Warm</SelectItem>
              <SelectItem value="cold">❄️ Cold</SelectItem>
              <SelectItem value="dead">💀 Dead</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fSegment} onValueChange={v => { setFSegment(v); setPage(0); }}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Segmento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Segmentos</SelectItem>
              <SelectItem value="protecao_veicular">Proteção Veicular</SelectItem>
              <SelectItem value="clinica">Clínica</SelectItem>
              <SelectItem value="imobiliaria">Imobiliária</SelectItem>
              <SelectItem value="ecommerce">E-commerce</SelectItem>
              <SelectItem value="saas">SaaS</SelectItem>
              <SelectItem value="educacao">Educação</SelectItem>
              <SelectItem value="financeiro">Financeiro</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fSort} onValueChange={v => { setFSort(v); setPage(0); }}>
            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Mais recente</SelectItem>
              <SelectItem value="priority">Prioridade</SelectItem>
              <SelectItem value="lead_score">Score</SelectItem>
            </SelectContent>
          </Select>
          <Input
            ref={searchRef}
            type="search"
            autoComplete="new-password"
            name="leads-search-global"
            placeholder="Buscar telefone ou nome (min 3 chars)..."
            className="h-8 text-xs w-[220px]"
            onChange={e => handleSearch(e.target.value)}
          />
        </div>

        {/* Bulk Actions Bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30">
            <span className="text-sm font-medium">{selected.size} selecionado(s)</span>
            <div className="flex-1" />
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={actionLoading}
              onClick={() => bulkAction("queue-for-call")}>
              <Phone className="h-3 w-3 mr-1" /> Enfileirar Ligação
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={actionLoading}
              onClick={() => bulkAction("queue-for-dispatch")}>
              <Send className="h-3 w-3 mr-1" /> Enfileirar Disparo
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={actionLoading}
              onClick={openDistribute}>
              <UserPlus className="h-3 w-3 mr-1" /> Distribuir
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={actionLoading}
              onClick={() => setPriorityOpen(true)}>
              <Star className="h-3 w-3 mr-1" /> Prioridade
            </Button>
            {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        )}

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {leads.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum lead encontrado</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => { setFStatus("all"); setFTemp("all"); setFSegment("all"); setFSearch(""); setPage(0); }}>
                  Limpar filtros
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="py-2 px-3 w-8">
                        <Checkbox checked={selected.size === leads.length && leads.length > 0} onCheckedChange={toggleAll} />
                      </th>
                      <th className="text-left py-2 px-2">Status</th>
                      <th className="text-left py-2 px-2">Telefone</th>
                      <th className="text-left py-2 px-2">Nome</th>
                      <th className="text-center py-2 px-2">Score</th>
                      <th className="text-center py-2 px-2">Temp</th>
                      <th className="text-left py-2 px-2">Segmento</th>
                      <th className="text-center py-2 px-2">Lig.</th>
                      <th className="text-left py-2 px-2">Último</th>
                      <th className="text-right py-2 px-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((l) => {
                      const st = statusLabels[l.status] || { label: l.status, cls: "bg-muted text-muted-foreground border-border" };
                      return (
                        <tr key={l.phone} className="border-b border-border/50 hover:bg-muted/20 cursor-pointer" onClick={() => openDetail(l)}>
                          <td className="py-2 px-3" onClick={e => e.stopPropagation()}>
                            <Checkbox checked={selected.has(l.phone)} onCheckedChange={() => toggleSelect(l.phone)} />
                          </td>
                          <td className="py-2 px-2"><Badge variant="outline" className={`text-xs ${st.cls}`}>{st.label}</Badge></td>
                          <td className="py-2 px-2 font-mono text-xs">{l.phone}</td>
                          <td className="py-2 px-2">{l.name || "—"}</td>
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-1.5 justify-center">
                              <Progress value={l.lead_score} className="w-12 h-1.5" />
                              <span className="text-xs text-muted-foreground w-6">{l.lead_score}</span>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-center text-base">{tempEmoji[l.temperature] || "—"}</td>
                          <td className="py-2 px-2 text-xs">{l.segment || "—"}</td>
                          <td className="py-2 px-2 text-center text-xs">{l.call_count}</td>
                          <td className="py-2 px-2 text-xs">{fmtDate(l.last_contact_at)}</td>
                          <td className="py-2 px-3 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Ligar" onClick={() => singleCall(l.phone)}>
                                <Phone className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Disparar" onClick={() => singleDispatch(l.phone)}>
                                <Send className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalRows > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {(page * PAGE_SIZE + 1).toLocaleString("pt-BR")}–{Math.min((page + 1) * PAGE_SIZE, totalRows).toLocaleString("pt-BR")} de {totalRows.toLocaleString("pt-BR")}
            </p>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs flex items-center px-2">Pg {page + 1}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={(page + 1) * PAGE_SIZE >= totalRows} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Lead Detail Drawer ═══ */}
      <Sheet open={!!detailLead} onOpenChange={() => setDetailLead(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {detailLead && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs ${(statusLabels[detailLead.status] || { cls: "" }).cls}`}>
                    {(statusLabels[detailLead.status] || { label: detailLead.status }).label}
                  </Badge>
                  {detailLead.name || detailLead.phone}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                {/* Basic Info */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">Dados</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Telefone:</span> <span className="font-mono">{detailLead.phone}</span></div>
                    <div><span className="text-muted-foreground">Nome:</span> {detailLead.name || "—"}</div>
                    <div><span className="text-muted-foreground">Email:</span> {detailLead.email || "—"}</div>
                    <div><span className="text-muted-foreground">Score:</span> {detailLead.lead_score}</div>
                    <div><span className="text-muted-foreground">Temp:</span> {tempEmoji[detailLead.temperature]} {detailLead.temperature}</div>
                    <div><span className="text-muted-foreground">Segmento:</span> {detailLead.segment || "—"}</div>
                  </div>
                  {detailLead.tags && detailLead.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {detailLead.tags.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                    </div>
                  )}
                </div>

                {/* Timeline */}
                {detailLoading ? (
                  <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : detailHistory ? (
                  <>
                    {/* Calls */}
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase">Ligações</h4>
                      {(detailHistory.calls || []).length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhuma ligação</p>
                      ) : (
                        <div className="space-y-1">
                          {detailHistory.calls.slice(0, 5).map((c: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-xs p-2 rounded bg-muted/30 border border-border/50">
                              <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span>{fmtDate(c.date || c.created_at)}</span>
                              <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                              {c.duration_sec && <span>{Math.floor(c.duration_sec / 60)}m{c.duration_sec % 60}s</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Dispatches */}
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase">Disparos</h4>
                      {(detailHistory.dispatches || []).length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhum disparo</p>
                      ) : (
                        <div className="space-y-1">
                          {detailHistory.dispatches.slice(0, 5).map((d: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-xs p-2 rounded bg-muted/30 border border-border/50">
                              <Send className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span>{fmtDate(d.sent_at || d.created_at)}</span>
                              <Badge variant="outline" className="text-[10px]">{d.status}</Badge>
                              {d.template_name && <span className="text-muted-foreground">{d.template_name}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Lifecycle */}
                    {detailHistory.lifecycle && (
                      <div className="space-y-1">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase">Lifecycle WhatsApp</h4>
                        <div className="text-xs space-y-1">
                          <p>Janela: {detailHistory.lifecycle.window_open ? "✅ Aberta" : "❌ Fechada"}</p>
                          <p>Mensagens enviadas: {detailHistory.lifecycle.messages_sent || 0}</p>
                          <p>Mensagens recebidas: {detailHistory.lifecycle.messages_received || 0}</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : null}

                {/* Quick actions */}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={() => singleCall(detailLead.phone)}>
                    <Phone className="h-3.5 w-3.5 mr-1.5" /> Ligar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => singleDispatch(detailLead.phone)}>
                    <Send className="h-3.5 w-3.5 mr-1.5" /> Disparar
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ═══ Distribute Modal ═══ */}
      <Dialog open={distributeOpen} onOpenChange={setDistributeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Distribuir para Colaborador</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Colaborador</Label>
            <Select value={distributeCollab} onValueChange={setDistributeCollab}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {collabs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{selectedPhones.length} lead(s) selecionado(s)</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDistributeOpen(false)}>Cancelar</Button>
            <Button disabled={!distributeCollab || actionLoading}
              onClick={async () => {
                await bulkAction("distribute", { collaborator_id: distributeCollab });
                setDistributeOpen(false);
              }}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Distribuir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Priority Modal ═══ */}
      <Dialog open={priorityOpen} onOpenChange={setPriorityOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Alterar Prioridade</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Label>Prioridade: {priorityValue[0]}</Label>
            <Slider value={priorityValue} onValueChange={setPriorityValue} min={1} max={10} step={1} />
            <p className="text-xs text-muted-foreground">{selectedPhones.length} lead(s) selecionado(s)</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriorityOpen(false)}>Cancelar</Button>
            <Button disabled={actionLoading}
              onClick={async () => {
                await bulkAction("update-priority", { priority: priorityValue[0] });
                setPriorityOpen(false);
              }}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
