import { useEffect, useState, useCallback, useMemo } from "react";
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
import { Phone, Download, Eye, CalendarIcon, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { EDGE_BASE } from "@/lib/constants";

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjYWR1endhdXRscHpwdmpvZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMDQ1MTcsImV4cCI6MjA4ODU4MDUxN30.pF2XU3pFDc98GSJzA1xyf7d4pHbkrxf3sRDX1jh5Vrg";
const PAGE_SIZE = 20;

type CallRecord = {
  id: string;
  lead_name?: string;
  lead_phone: string;
  status: string;
  duration_sec?: number;
  created_at: string;
  result?: string;
  sentiment_overall?: string;
  transcript?: any;
  goal_achieved?: boolean;
  lead_temperature?: string;
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

export default function VoiceCalls() {
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
        company_id: "objetivo",
        requester_role: "ceo",
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };
      if (statusFilter !== "all") body.status_filter = statusFilter;
      if (search.trim()) body.search = search.trim();
      if (dateRange.from) body.date_from = format(dateRange.from, "yyyy-MM-dd");
      if (dateRange.to) body.date_to = format(dateRange.to, "yyyy-MM-dd");

      const res = await fetch(`${EDGE_BASE}/dashboard-calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
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
  }, [page, statusFilter, search, dateRange]);

  useEffect(() => { fetchCalls(); }, [fetchCalls]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const exportCSV = () => {
    if (!calls.length) return;
    const header = "ID,Lead,Telefone,Status,Duração,Data\n";
    const rows = calls.map(c =>
      `${c.id},"${c.lead_name || "—"}",${c.lead_phone},${c.status},${fmtDuration(c.duration_sec)},${c.created_at}`
    ).join("\n");
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
                <TableHead className="w-12">#</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : !calls.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    Nenhuma chamada encontrada
                  </TableCell>
                </TableRow>
              ) : (
                calls.map((c, i) => {
                  const st = statusMap[c.status] ?? statusMap["failed"];
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-muted-foreground">{page * PAGE_SIZE + i + 1}</TableCell>
                      <TableCell className="font-medium">{c.lead_name || "—"}</TableCell>
                      <TableCell className="font-mono text-sm">{c.lead_phone}</TableCell>
                      <TableCell><Badge className={st.cls}>{st.label}</Badge></TableCell>
                      <TableCell>{fmtDuration(c.duration_sec)}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(c.created_at), "dd/MM HH:mm", { locale: ptBR })}
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
                  <p className="font-mono">{selected.lead_phone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Duração</p>
                  <p>{fmtDuration(selected.duration_sec)}</p>
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
                  <p className="text-muted-foreground">WA Autorizado?</p>
                  <p>{selected.goal_achieved ? "✅ Sim" : "❌ Não"}</p>
                </div>
              </div>
              {selected.result && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Resumo</p>
                  <p className="text-sm bg-muted/50 rounded-lg p-3">{selected.result}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
