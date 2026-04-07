import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { toast } from "sonner";
import {
  Search, Loader2, ChevronLeft, ChevronRight, Users,
  Phone, MessageSquare, FileText, Trash2, History, ChevronDown, ChevronUp, Send,
} from "lucide-react";
import { EDGE_BASE } from "@/lib/constants";

const PAGE_SIZE = 50;

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending:     { label: "Pendente",     cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  new:         { label: "Novo",         cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  unknown:     { label: "Pendente",     cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  no_answer:   { label: "Sem resposta", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  scheduled:   { label: "Agendado",     cls: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  interested:  { label: "Interessado",  cls: "bg-green-500/15 text-green-400 border-green-500/30" },
  discarded:   { label: "Descartado",   cls: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const INTEREST_MAP: Record<string, { label: string; cls: string }> = {
  hot:     { label: "Quente",   cls: "text-red-400" },
  warm:    { label: "Morno",    cls: "text-yellow-400" },
  cold:    { label: "Frio",     cls: "text-blue-400" },
  unknown: { label: "Novo",     cls: "text-muted-foreground" },
  pending: { label: "Pendente", cls: "text-muted-foreground" },
  not_interested_1: { label: "1a Recusa", cls: "text-orange-400" },
  not_interested_2: { label: "2a Recusa", cls: "text-red-400" },
  interested: { label: "Interesse", cls: "text-green-400" },
};

interface LeadRow {
  poolId: string | null;
  leadId: string;
  name: string | null;
  phone: string | null;
  phoneNormalized: string | null;
  ddd: string | null;
  city: string | null;
  category: string | null;
  status: string | null;
  interestStatus: string | null;
  callAttempts: number;
  lastCallAt: string | null;
  lastContact: string | null;
  notes: string | null;
}

interface CallHistoryEntry {
  id: string;
  created_at: string;
  status: string;
  duration_seconds: number | null;
  call_summary: string | null;
  sentiment: string | null;
  interest_detected: boolean | null;
  transcript: string | null;
}

export default function MyLeads() {
  const navigate = useNavigate();
  const { collaborator, isCEO } = useCollaborator();
  const { selectedCompanyId } = useCompanyFilter();

  const [rows, setRows] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const [counters, setCounters] = useState({ total: 0, pending: 0, hot: 0, noAnswer: 0 });

  const [notesOpen, setNotesOpen] = useState(false);
  const [notesTarget, setNotesTarget] = useState<{ poolId: string; current: string } | null>(null);
  const [notesText, setNotesText] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Histórico expandido
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ poolId: string; name: string } | null>(null);

  // GIA integration
  const [giaLoading, setGiaLoading] = useState<string | null>(null);
  const [giaDialog, setGiaDialog] = useState<{ row: LeadRow; placa: string } | null>(null);
  const [giaPlaca, setGiaPlaca] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 600);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(0); }, [debouncedSearch, statusFilter, selectedCompanyId]);

  const fetchCounters = useCallback(async () => {
    if (!collaborator) return;
    const make = () =>
      supabase.from("consultant_lead_pool")
        .select("*", { count: "exact", head: true })
        .eq("collaborator_id", collaborator.id)
        .not("interest_status", "in", "(discarded,not_interested_2)");
    const [all, pending, hot, noAnswer] = await Promise.all([
      make(),
      make().in("interest_status", ["pending", "unknown"]),
      make().in("interest_status", ["interested", "hot", "warm"]),
      make().in("interest_status", ["not_interested_1"]),
    ]);
    setCounters({
      total: all.count ?? 0,
      pending: pending.count ?? 0,
      hot: hot.count ?? 0,
      noAnswer: noAnswer.count ?? 0,
    });
  }, [collaborator]);

  useEffect(() => { fetchCounters(); }, [fetchCounters]);

  const fetchLeads = useCallback(async () => {
    if (!collaborator) return;
    setLoading(true);
    try {
      let cq = supabase
        .from("consultant_lead_pool")
        .select("*", { count: "exact", head: true })
        .eq("collaborator_id", collaborator.id)
        .not("interest_status", "in", "(discarded,not_interested_2)");
      if (statusFilter !== "all") {
        if (statusFilter === "hot") cq = cq.in("interest_status", ["interested", "hot", "warm"]);
        else if (statusFilter === "no_answer") cq = cq.in("interest_status", ["not_interested_1"]);
        else cq = cq.in("interest_status", ["pending", "unknown"]);
      }
      const { count } = await cq;
      setTotal(count ?? 0);

      let dq = supabase
        .from("consultant_lead_pool")
        .select("id, status, notes, last_contact_at, last_call_at, priority, call_attempts, interest_status, phone_normalized, phone, lead_name, lead_city, lead_category, lead_ddd, lead_id")
        .eq("collaborator_id", collaborator.id)
        .not("interest_status", "in", "(discarded,not_interested_2)");
      if (statusFilter !== "all") {
        if (statusFilter === "hot") dq = dq.in("interest_status", ["interested", "hot", "warm"]);
        else if (statusFilter === "no_answer") dq = dq.in("interest_status", ["not_interested_1"]);
        else dq = dq.in("interest_status", ["pending", "unknown"]);
      }
      const { data, error } = await dq
        .order("last_call_at", { ascending: true, nullsFirst: true })
        .order("priority", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;

      let items: LeadRow[] = (data ?? []).map((r: any) => ({
        poolId: r.id,
        leadId: r.lead_id ?? r.id,
        name: r.lead_name ?? null,
        phone: r.phone ?? null,
        phoneNormalized: r.phone_normalized ?? null,
        ddd: r.lead_ddd ?? null,
        city: r.lead_city ?? null,
        category: r.lead_category ?? null,
        status: r.status,
        interestStatus: r.interest_status ?? null,
        callAttempts: r.call_attempts ?? 0,
        lastCallAt: r.last_call_at ?? null,
        lastContact: r.last_contact_at,
        notes: r.notes,
      }));

      if (debouncedSearch.length >= 2) {
        const s = debouncedSearch.toLowerCase();
        items = items.filter(
          r => (r.name ?? "").toLowerCase().includes(s) || (r.phone ?? "").includes(s) || (r.phoneNormalized ?? "").includes(s)
        );
        setTotal(items.length);
      }

      setRows(items);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao buscar leads");
    } finally {
      setLoading(false);
    }
  }, [collaborator, selectedCompanyId, statusFilter, debouncedSearch, page]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const openNotes = (poolId: string, current: string | null) => {
    setNotesTarget({ poolId, current: current ?? "" });
    setNotesText(current ?? "");
    setNotesOpen(true);
  };

  const saveNotes = async () => {
    if (!notesTarget) return;
    setSavingNotes(true);
    const { error } = await supabase
      .from("consultant_lead_pool")
      .update({ notes: notesText })
      .eq("id", notesTarget.poolId);
    setSavingNotes(false);
    if (error) { toast.error("Erro ao salvar notas"); return; }
    toast.success("Notas salvas");
    setNotesOpen(false);
    fetchLeads();
  };

  const deleteLead = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("consultant_lead_pool")
      .update({ interest_status: "discarded" })
      .eq("id", deleteTarget.poolId);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success(`${deleteTarget.name ?? "Lead"} removido da lista`);
    setDeleteTarget(null);
    fetchLeads();
    fetchCounters();
  };

  const openGiaDialog = (row: LeadRow) => {
    setGiaPlaca("");
    setGiaDialog({ row, placa: "" });
  };

  const sendToGIA = async () => {
    if (!giaDialog) return;
    const { row } = giaDialog;
    setGiaLoading(row.poolId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(`${EDGE_BASE}/luxsales-to-gia`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "",
        },
        body: JSON.stringify({
          action: "criar-lead",
          lead_name: row.name || "Lead",
          phone: row.phoneNormalized ?? row.phone,
          placa: giaPlaca || null,
          luxsales_lead_id: row.leadId,
          collaborator_id: collaborator?.id,
        }),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        toast.success(`Enviado para GIA! ${result.veiculo?.marca ? `${result.veiculo.marca} ${result.veiculo.modelo}` : ""}`.trim());
        if (result.cotacao_url) {
          window.open(result.cotacao_url, "_blank");
        }
      } else {
        toast.error(result.error || "Erro ao enviar para GIA");
      }
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setGiaLoading(null);
      setGiaDialog(null);
    }
  };

  const toggleHistory = async (row: LeadRow) => {
    if (expandedLead === row.poolId) {
      setExpandedLead(null);
      return;
    }
    setExpandedLead(row.poolId);
    setLoadingHistory(true);
    try {
      const phone = row.phoneNormalized ?? row.phone;
      if (!phone) { setCallHistory([]); return; }
      let q = supabase
        .from("calls")
        .select("id, created_at, status, duration_seconds, call_summary, sentiment, interest_detected, transcript")
        .eq("destination_number", phone)
        .order("created_at", { ascending: false })
        .limit(10);
      if (collaborator && !isCEO) {
        q = q.eq("collaborator_id", collaborator.id);
      }
      const { data } = await q;
      setCallHistory(data ?? []);
    } catch {
      setCallHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <DashboardLayout>
      <PageHeader
        title="Meus Leads"
        subtitle={`${total.toLocaleString("pt-BR")} leads ativos`}
      />

      {/* Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total na fila", value: counters.total, cls: "text-foreground" },
          { label: "Aguardando contato", value: counters.pending, cls: "text-blue-400" },
          { label: "Com interesse", value: counters.hot, cls: "text-green-400" },
          { label: "1a Recusa", value: counters.noAnswer, cls: "text-orange-400" },
        ].map(c => (
          <div key={c.label} className="rounded-lg border border-border bg-card/60 px-4 py-3 text-center">
            <p className={`text-xl font-bold ${c.cls}`}>{c.value.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            className="pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Aguardando</SelectItem>
            <SelectItem value="no_answer">1a Recusa</SelectItem>
            <SelectItem value="hot">Com interesse</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-sm">
                Nenhum lead atribuído. Peça ao gestor para distribuir leads.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>DDD</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Interesse</TableHead>
                    <TableHead>Tentativas</TableHead>
                    <TableHead>Última lig.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => {
                    const st = row.interestStatus
                      ? (STATUS_MAP[row.interestStatus] ?? STATUS_MAP[row.status ?? ""] ?? { label: row.interestStatus, cls: "bg-muted text-muted-foreground border-border" })
                      : null;
                    const isExpanded = expandedLead === row.poolId;
                    return (
                      <>
                        <TableRow key={row.poolId ?? row.leadId} className={isExpanded ? "border-b-0" : ""}>
                          <TableCell className="w-8 pr-0">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleHistory(row)}>
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium">{row.name ?? "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{row.phoneNormalized ?? row.phone ?? "—"}</TableCell>
                          <TableCell className="text-xs text-center">{row.ddd ?? "—"}</TableCell>
                          <TableCell className="text-xs">{row.city ?? "—"}</TableCell>
                          <TableCell>
                            {row.interestStatus ? (
                              <span className={`text-xs font-semibold ${INTEREST_MAP[row.interestStatus]?.cls ?? "text-muted-foreground"}`}>
                                {INTEREST_MAP[row.interestStatus]?.label ?? row.interestStatus}
                              </span>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-center font-mono">{row.callAttempts}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(row.lastCallAt)}</TableCell>
                          <TableCell>
                            {st ? (
                              <Badge variant="outline" className={`text-xs ${st.cls}`}>
                                {st.label}
                              </Badge>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7" title="Ligar"
                                onClick={() => navigate(`/ligacoes?phone=${encodeURIComponent(row.phoneNormalized ?? row.phone ?? "")}`)}
                              >
                                <Phone className="h-3.5 w-3.5 text-green-400" />
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7" title="WhatsApp"
                                onClick={() => navigate(`/conversations?phone=${encodeURIComponent(row.phone ?? "")}`)}
                              >
                                <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                              </Button>
                              {row.poolId && (
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7" title="Notas"
                                  onClick={() => openNotes(row.poolId!, row.notes)}
                                >
                                  <FileText className="h-3.5 w-3.5 text-blue-400" />
                                </Button>
                              )}
                              {row.poolId && (
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7" title="Enviar para GIA"
                                  disabled={giaLoading === row.poolId}
                                  onClick={() => openGiaDialog(row)}
                                >
                                  {giaLoading === row.poolId
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Send className="h-3.5 w-3.5 text-orange-400" />
                                  }
                                </Button>
                              )}
                              {row.poolId && (
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7" title="Excluir da lista"
                                  onClick={() => setDeleteTarget({ poolId: row.poolId!, name: row.name ?? "Lead" })}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${row.poolId}-history`}>
                            <TableCell colSpan={10} className="bg-muted/30 p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <History className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs font-semibold text-muted-foreground">Histórico de Ligações</span>
                              </div>
                              {loadingHistory ? (
                                <div className="flex items-center gap-2 py-2">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  <span className="text-xs text-muted-foreground">Carregando...</span>
                                </div>
                              ) : callHistory.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-2">Nenhuma ligação registrada.</p>
                              ) : (
                                <div className="space-y-2">
                                  {callHistory.map(ch => (
                                    <div key={ch.id}>
                                      <div className="flex items-start gap-3 text-xs border-l-2 border-border pl-3 py-1">
                                        <span className="text-muted-foreground whitespace-nowrap">{formatDate(ch.created_at)}</span>
                                        <Badge variant="outline" className={`text-[10px] ${
                                          ch.status === "completed" ? "border-green-500/30 text-green-400" :
                                          ch.status === "answered" ? "border-blue-500/30 text-blue-400" :
                                          "border-border text-muted-foreground"
                                        }`}>
                                          {ch.status}
                                        </Badge>
                                        {ch.duration_seconds != null && (
                                          <span className="text-muted-foreground">{Math.floor(ch.duration_seconds / 60)}:{(ch.duration_seconds % 60).toString().padStart(2, "0")}</span>
                                        )}
                                        {ch.interest_detected && (
                                          <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[10px]">Interesse</Badge>
                                        )}
                                        {ch.sentiment && (
                                          <span className={`${ch.sentiment === "positive" ? "text-green-400" : ch.sentiment === "negative" ? "text-red-400" : "text-muted-foreground"}`}>
                                            {ch.sentiment}
                                          </span>
                                        )}
                                        {ch.call_summary && (
                                          <span className="text-muted-foreground truncate max-w-[300px]">{ch.call_summary}</span>
                                        )}
                                      </div>
                                      {ch.transcript && (
                                        <div className="ml-3 mt-1 text-[11px] text-muted-foreground/70 bg-muted/20 rounded p-2 max-h-24 overflow-y-auto whitespace-pre-wrap">
                                          {ch.transcript}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>{from}–{to} de {total.toLocaleString("pt-BR")}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="flex items-center px-3 text-xs">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Notes Dialog */}
      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notas do Lead</DialogTitle>
          </DialogHeader>
          <Textarea
            className="min-h-[140px]"
            placeholder="Escreva suas notas aqui..."
            value={notesText}
            onChange={e => setNotesText(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesOpen(false)}>Cancelar</Button>
            <Button onClick={saveNotes} disabled={savingNotes}>
              {savingNotes && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GIA Dialog */}
      <Dialog open={!!giaDialog} onOpenChange={() => setGiaDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar para GIA Objetivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Lead: <strong>{giaDialog?.row.name || "Lead"}</strong> — {giaDialog?.row.phoneNormalized ?? giaDialog?.row.phone}
            </p>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Placa do veículo (opcional)</p>
              <Input
                placeholder="ABC1D23 ou ABC1234"
                value={giaPlaca}
                onChange={e => setGiaPlaca(e.target.value.toUpperCase())}
                maxLength={7}
                className="font-mono uppercase"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Se informada, busca automática de marca/modelo/ano/FIPE
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGiaDialog(null)}>Cancelar</Button>
            <Button onClick={sendToGIA} disabled={!!giaLoading} className="bg-orange-600 hover:bg-orange-700">
              {giaLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar para GIA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Lead</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja remover <strong>{deleteTarget?.name}</strong> da sua lista?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={deleteLead}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
