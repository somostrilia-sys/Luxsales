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
  Phone, MessageSquare, FileText, CheckCircle, XCircle,
} from "lucide-react";

const PAGE_SIZE = 50;

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  assigned:    { label: "Atribuído",  cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  in_progress: { label: "Em contato", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  contacted:   { label: "Contatado",  cls: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  follow_up:   { label: "Follow-up",  cls: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  converted:   { label: "Convertido", cls: "bg-green-500/15 text-green-400 border-green-500/30" },
  lost:        { label: "Perdido",    cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  returned:    { label: "Retornado",  cls: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
};

const TEMP_MAP: Record<string, string> = { hot: "🔥 Hot", warm: "☀️ Warm", cold: "❄️ Cold" };

interface LeadRow {
  poolId: string | null;
  leadId: string;
  name: string | null;
  phone: string | null;
  score: number | null;
  temperature: string | null;
  status: string | null;
  lastContact: string | null;
  notes: string | null;
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

  const [notesOpen, setNotesOpen] = useState(false);
  const [notesTarget, setNotesTarget] = useState<{ poolId: string; current: string } | null>(null);
  const [notesText, setNotesText] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 600);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(0); }, [debouncedSearch, statusFilter, selectedCompanyId]);

  const fetchLeads = useCallback(async () => {
    if (!collaborator) return;
    setLoading(true);
    try {
      {
        // Count (without search — search is client-side for joined tables)
        let cq = supabase
          .from("consultant_lead_pool")
          .select("*", { count: "exact", head: true })
          .eq("collaborator_id", collaborator.id);
        if (statusFilter !== "all") cq = cq.eq("status", statusFilter);
        const { count } = await cq;
        setTotal(count ?? 0);

        // Data
        let dq = supabase
          .from("consultant_lead_pool")
          .select("id, status, notes, last_contact_at, priority, lead:leads_master(id, lead_name, phone_number, lead_score, lead_temperature)")
          .eq("collaborator_id", collaborator.id);
        if (statusFilter !== "all") dq = dq.eq("status", statusFilter);
        const { data, error } = await dq
          .order("priority", { ascending: false })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (error) throw error;

        const rawItems: LeadRow[] = (data ?? []).map((r: any) => ({
          poolId: r.id,
          leadId: r.lead?.id ?? r.id,
          name: r.lead?.lead_name ?? null,
          phone: r.lead?.phone_number ?? null,
          score: r.lead?.lead_score ?? null,
          temperature: r.lead?.lead_temperature ?? null,
          status: r.status,
          lastContact: r.last_contact_at,
          notes: r.notes,
        }));

        // Deduplicação por lead_id (mantém o primeiro, que tem maior priority)
        const seenLeadIds = new Set<string>();
        let items: LeadRow[] = rawItems.filter((r) => {
          if (seenLeadIds.has(r.leadId)) return false;
          seenLeadIds.add(r.leadId);
          return true;
        });

        if (debouncedSearch.length >= 2) {
          const s = debouncedSearch.toLowerCase();
          items = items.filter(
            r => (r.name ?? "").toLowerCase().includes(s) || (r.phone ?? "").includes(s)
          );
          setTotal(items.length);
        }

        setRows(items);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao buscar leads");
    } finally {
      setLoading(false);
    }
  }, [collaborator, selectedCompanyId, statusFilter, debouncedSearch, page]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const updatePoolStatus = async (poolId: string, status: string) => {
    const { error } = await supabase
      .from("consultant_lead_pool")
      .update({ status, last_contact_at: new Date().toISOString() })
      .eq("id", poolId);
    if (error) { toast.error("Erro ao atualizar status"); return; }
    toast.success("Status atualizado");
    fetchLeads();
  };

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

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <DashboardLayout>
      <PageHeader
        title="Meus Leads"
        subtitle={`${total.toLocaleString("pt-BR")} leads`}
      />

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
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="assigned">Atribuído</SelectItem>
            <SelectItem value="in_progress">Em contato</SelectItem>
            <SelectItem value="contacted">Contatado</SelectItem>
            <SelectItem value="follow_up">Follow-up</SelectItem>
            <SelectItem value="converted">Convertido</SelectItem>
            <SelectItem value="lost">Perdido</SelectItem>
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
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Temperatura</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último Contato</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => {
                    const st = row.status
                      ? (STATUS_MAP[row.status] ?? { label: row.status, cls: "bg-muted text-muted-foreground border-border" })
                      : null;
                    return (
                      <TableRow key={row.poolId ?? row.leadId}>
                        <TableCell className="font-medium">{row.name ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{row.phone ?? "—"}</TableCell>
                        <TableCell>
                          {row.score != null ? (
                            <span className={`text-xs font-bold ${row.score >= 70 ? "text-green-400" : row.score >= 40 ? "text-yellow-400" : "text-red-400"}`}>
                              {row.score}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.temperature
                            ? (TEMP_MAP[row.temperature] ?? row.temperature)
                            : "—"}
                        </TableCell>
                          <TableCell>
                            {st ? (
                              <Badge variant="outline" className={`text-xs ${st.cls}`}>
                                {st.label}
                              </Badge>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {row.lastContact
                              ? new Date(row.lastContact).toLocaleDateString("pt-BR")
                              : "—"}
                          </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7" title="Ligar"
                              onClick={() => navigate(`/voice/dialer?phone=${encodeURIComponent(row.phone ?? "")}`)}
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
                              <>
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7" title="Notas"
                                  onClick={() => openNotes(row.poolId!, row.notes)}
                                >
                                  <FileText className="h-3.5 w-3.5 text-blue-400" />
                                </Button>
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7" title="Marcar como convertido"
                                  onClick={() => updatePoolStatus(row.poolId!, "converted")}
                                >
                                  <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                                </Button>
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7" title="Marcar como perdido"
                                  onClick={() => updatePoolStatus(row.poolId!, "lost")}
                                >
                                  <XCircle className="h-3.5 w-3.5 text-red-400" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
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
    </DashboardLayout>
  );
}
