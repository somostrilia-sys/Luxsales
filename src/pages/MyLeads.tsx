import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Search, Loader2, ChevronLeft, ChevronRight, Users } from "lucide-react";

const PAGE_SIZE = 20;

const statusLabels: Record<string, { label: string; className: string }> = {
  novo: { label: "Novo", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  contatado: { label: "Contatado", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  respondeu: { label: "Respondeu", className: "bg-green-500/15 text-green-400 border-green-500/30" },
  convertido: { label: "Convertido", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  perdido: { label: "Perdido", className: "bg-red-500/15 text-red-400 border-red-500/30" },
  pending: { label: "Pendente", className: "bg-muted text-muted-foreground border-border" },
};

export default function MyLeads() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 600);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [debouncedSearch, statusFilter]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("leads")
        .select("id, name, phone, email, status, source, city, category, created_at", { count: "exact" });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (debouncedSearch.length >= 3) {
        query = query.or(`name.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`);
      }

      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      setLeads(data || []);
      setTotal(count || 0);
    } catch (e: any) {
      toast.error(e.message || "Erro ao buscar leads");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const from = page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, total);

  const getStatus = (s: string | null) => {
    const cfg = statusLabels[s || ""] || { label: s || "—", className: "bg-muted text-muted-foreground border-border" };
    return cfg;
  };

  return (
    <DashboardLayout>
      <PageHeader title="Meus Leads" subtitle={`${total.toLocaleString("pt-BR")} leads no total`} />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone (min 3 caracteres)..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="novo">Novo</SelectItem>
            <SelectItem value="contatado">Contatado</SelectItem>
            <SelectItem value="respondeu">Respondeu</SelectItem>
            <SelectItem value="convertido">Convertido</SelectItem>
            <SelectItem value="perdido">Perdido</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : leads.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Nenhum lead encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Categoria</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead, i) => {
                    const st = getStatus(lead.status);
                    return (
                      <TableRow key={lead.id}>
                        <TableCell className="text-muted-foreground text-xs">{from + i}</TableCell>
                        <TableCell className="font-medium">{lead.name || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{lead.phone || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[180px]">{lead.email || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${st.className}`}>
                            {st.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{lead.source || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{lead.city || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{lead.category || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>{from}–{to} de {total.toLocaleString("pt-BR")}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="flex items-center px-3 text-xs">
              {page + 1} / {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
