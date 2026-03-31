import { useEffect, useState, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Download, Eye, CalendarIcon, Loader2, ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useCompany } from "@/contexts/CompanyContext";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { EDGE_BASE } from "@/lib/constants";

const API_URL = `${EDGE_BASE}/dashboard-calls`;
const AUTH_HEADER = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjYWR1endhdXRscHpwdmpvZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMDQ1MTcsImV4cCI6MjA4ODU4MDUxN30.LinR7PIoK7n79hWjbSJ3EgDwA_y6uN-HfQnOk7GgYi4";
const PAGE_SIZE = 20;

type CallRecord = {
  id: string;
  lead_name?: string;
  destination_number?: string;
  lead_phone?: string;
  status: string;
  result?: string;
  duration_seconds?: number;
  duration_sec?: number;
  whatsapp_sent?: boolean;
  started_at?: string;
  created_at?: string;
  transcript?: any;
  sentiment_overall?: string;
  goal_achieved?: boolean;
};

const statusMap: Record<string, { label: string; cls: string }> = {
  simulated:  { label: "Simulado",    cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  completed:  { label: "Concluída",   cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  failed:     { label: "Falhou",      cls: "bg-destructive/15 text-destructive border-destructive/30" },
  no_answer:  { label: "Não Atendeu", cls: "bg-muted text-muted-foreground border-border" },
  calling:    { label: "Chamando",    cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30 animate-pulse" },
};

const sentimentEmoji: Record<string, string> = { positive: "😊", neutral: "😐", negative: "😞" };

function fmtDuration(s?: number) {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function getTranscriptSummary(transcript: any): string {
  if (!transcript) return "—";
  if (typeof transcript === "string") return transcript.slice(0, 80) + (transcript.length > 80 ? "…" : "");
  if (Array.isArray(transcript)) {
    const first = transcript.slice(0, 2).map((t: any) => t.text || t.content || "").join(" ");
    return first.slice(0, 80) + (first.length > 80 ? "…" : "");
  }
  if (transcript.summary) return String(transcript.summary).slice(0, 80);
  return "Ver detalhes";
}

export default function VoiceCalls() {
  const { company_id: selectedCompanyId } = useCompany();
  const { collaborator } = useCollaborator();
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [selected, setSelected] = useState<CallRecord | null>(null);

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    try {
      const body: any = {
        action: "call-history",
        company_id: (selectedCompanyId && selectedCompanyId !== "all") ? selectedCompanyId : (collaborator?.company_id || "70967469-9a9b-4e29-a744-410e41eb47a5"),
        requester_role: "ceo",
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };
      if (statusFilter !== "all") body.status_filter = statusFilter;
      if (search.trim()) body.search = search.trim();
      if (dateRange.from) body.date_from = format(dateRange.from, "yyyy-MM-dd");
      if (dateRange.to) body.date_to = format(dateRange.to, "yyyy-MM-dd");

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": AUTH_HEADER,
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      setCalls(json.calls || json.data || []);
      setTotal(json.total ?? json.count ?? 0);
    } catch {
      toast.error("Erro ao carregar chamadas");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search, dateRange, selectedCompanyId, collaborator]);

  useEffect(() => { fetchCalls(); }, [fetchCalls]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const exportCSV = () => {
    if (!calls.length) return;
    const header = "Lead,Telefone,Status,Resultado,Duração,WhatsApp,Data\n";
    const rows = calls.map(c => {
      const phone = c.destination_number || c.lead_phone || "";
      const dur = fmtDuration(c.duration_seconds ?? c.duration_sec);
      const dt = c.started_at || c.created_at || "";
      return `"${c.lead_name || "—"}",${phone},${c.status},"${c.result || "—"}",${dur},${c.whatsapp_sent ? "Sim" : "Não"},${dt}`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chamadas_${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <PageHeader title="Chamadas">
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={!calls.length}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="simulated">Simulado</SelectItem>
            <SelectItem value="completed">Concluída</SelectItem>
            <SelectItem value="failed">Falhou</SelectItem>
            <SelectItem value="no_answer">Não Atendeu</SelectItem>
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              {format(dateRange.from, "dd/MM", { locale: ptBR })} – {format(dateRange.to, "dd/MM", { locale: ptBR })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(r: any) => { if (r?.from && r?.to) { setDateRange(r); setPage(0); } }}
              numberOfMonths={1}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        <Input
          placeholder="Buscar telefone..."
          className="w-[200px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { setPage(0); fetchCalls(); } }}
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Resumo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : !calls.length ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                    Nenhuma chamada encontrada
                  </TableCell>
                </TableRow>
              ) : (
                calls.map((c) => {
                  const st = statusMap[c.status] ?? statusMap["failed"];
                  const phone = c.destination_number || c.lead_phone || "—";
                  const dur = c.duration_seconds ?? c.duration_sec;
                  const dt = c.started_at || c.created_at;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.lead_name || "—"}</TableCell>
                      <TableCell className="font-mono text-sm">{phone}</TableCell>
                      <TableCell><Badge className={st.cls}>{st.label}</Badge></TableCell>
                      <TableCell className="text-sm max-w-[120px] truncate">{c.result || "—"}</TableCell>
                      <TableCell>{fmtDuration(dur)}</TableCell>
                      <TableCell>
                        {c.whatsapp_sent ? (
                          <Badge variant="outline" className="text-green-500 border-green-500/30 text-xs gap-1">
                            <MessageSquare className="h-3 w-3" /> Sim
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">Não</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {dt ? format(new Date(dt), "dd/MM HH:mm", { locale: ptBR }) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                        {getTranscriptSummary(c.transcript)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setSelected(c)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <span className="text-sm text-muted-foreground">{total} chamadas</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">Página {page + 1} de {totalPages}</span>
          <Button variant="outline" size="icon" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Resumo da Chamada</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Lead</p>
                  <p className="font-medium">{selected.lead_name || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Telefone</p>
                  <p className="font-mono">{selected.destination_number || selected.lead_phone || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Duração</p>
                  <p>{fmtDuration(selected.duration_seconds ?? selected.duration_sec)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge className={statusMap[selected.status]?.cls ?? ""}>
                    {statusMap[selected.status]?.label ?? selected.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Sentimento</p>
                  <p className="text-xl">{sentimentEmoji[selected.sentiment_overall ?? ""] ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">WhatsApp Enviado</p>
                  <p>{selected.whatsapp_sent ? "✅ Sim" : "❌ Não"}</p>
                </div>
              </div>
              {selected.result && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Resultado</p>
                  <p className="text-sm bg-muted/50 rounded-lg p-3">{selected.result}</p>
                </div>
              )}
              {selected.transcript && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Transcrição</p>
                  <div className="text-sm bg-muted/50 rounded-lg p-3 max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                    {typeof selected.transcript === "string"
                      ? selected.transcript
                      : Array.isArray(selected.transcript)
                        ? selected.transcript.map((t: any, i: number) => (
                            <p key={i} className="mb-1">
                              <span className="font-medium text-primary">{t.role || t.speaker || ""}:</span> {t.text || t.content || ""}
                            </p>
                          ))
                        : JSON.stringify(selected.transcript, null, 2)}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
