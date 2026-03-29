import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCollaborator } from "@/contexts/CollaboratorContext";
  const { selectedCompanyId } = useCompanyFilter();import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Loader2, Search, UserCheck, UserX, Phone, Inbox,
  BarChart3, ShieldCheck,
} from "lucide-react";

interface OptIn {
  name: string;
  phone: string;
  origin: string;
  date: string;
  status: string;
}

interface OptInStats {
  total_active: number;
  opt_outs_this_month: number;
  opt_out_rate: number;
  by_origin: Record<string, number>;
}

const originIcons: Record<string, string> = {
  ai_call: "🤖",
  inbound: "📥",
  landing_page: "🌐",
  manual: "✍️",
  click_to_wa: "💬",
};

export default function OptIns() {
  const { collaborator } = useCollaborator();
  const { selectedCompanyId } = useCompanyFilter();  const [optIns, setOptIns] = useState<OptIn[]>([]);
  const [stats, setStats] = useState<OptInStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [originFilter, setOriginFilter] = useState("all");
  const [revoking, setRevoking] = useState<OptIn | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeSaving, setRevokeSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!collaborator) return;
    setLoading(true);
    try {
      // Busca direto do Supabase — lead_whatsapp_lifecycle tem opt_in_id preenchido = opt-in ativo
      let query = supabase
        .from("lead_whatsapp_lifecycle")
        .select("id, phone_number, lead_name, stage, created_at, updated_at, opt_in_id, window_open")
        .not("opt_in_id", "is", null)
        .order("created_at", { ascending: false });

      // CEO vê todos; outros colaboradores veem só da própria empresa
      if (collaborator.role.level < 5) {
        query = query.eq("company_id", ((selectedCompanyId && selectedCompanyId !== "all") ? selectedCompanyId : collaborator?.company_id));
      }

      if (statusFilter === "active") {
        query = query.not("stage", "eq", "opted_out");
      } else if (statusFilter === "inactive") {
        query = query.eq("stage", "opted_out");
      }

      const { data, error } = await query.limit(200);
      if (error) throw error;

      const mapped: OptIn[] = (data || []).map((row) => ({
        name: row.lead_name && row.lead_name !== row.phone_number ? row.lead_name : "",
        phone: row.phone_number ?? "",
        origin: "ai_call",
        date: row.created_at ?? "",
        status: row.stage === "opted_out" ? "inactive" : "active",
      }));
      setOptIns(mapped);

      // Stats calculados localmente
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);
      const optOuts = (data || []).filter(r => r.stage === "opted_out").length;
      const total = mapped.filter(o => o.status === "active").length;
      setStats({
        total_active: total,
        opt_outs_this_month: optOuts,
        opt_out_rate: total > 0 ? Math.round((optOuts / (total + optOuts)) * 100) : 0,
        by_origin: { ai_call: total },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao buscar dados";
      toast.error(msg);
    }
    setLoading(false);
  }, [collaborator, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRevoke = async () => {
    if (!revoking || !collaborator) return;
    setRevokeSaving(true);
    try {
      const { error } = await supabase
        .from("lead_whatsapp_lifecycle")
        .update({ stage: "opted_out", window_open: false })
        .eq("phone_number", revoking.phone);
      if (!error) {
        toast.success("Opt-in revogado com sucesso");
        setRevoking(null);
        setRevokeReason("");
        fetchData();
      } else {
        toast.error(error.message || "Erro ao revogar");
      }
    } catch {
      toast.error("Erro de conexão");
    }
    setRevokeSaving(false);
  };

  const filtered = optIns.filter((o) => {
    if (originFilter !== "all" && o.origin !== originFilter) return false;
    if (search && !o.name?.toLowerCase().includes(search.toLowerCase()) && !o.phone.includes(search)) return false;
    return true;
  });

  const maxOrigin = stats?.by_origin ? Math.max(...Object.values(stats.by_origin), 1) : 1;

  return (
    <DashboardLayout>
      <PageHeader title="Opt-ins" subtitle="Gerenciamento de consentimentos WhatsApp" />

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <Card>
              <CardContent className="pt-4 text-center">
                <UserCheck className="h-5 w-5 mx-auto mb-1 text-green-400" />
                <p className="text-2xl font-bold">{stats?.total_active ?? 0}</p>
                <p className="text-xs text-muted-foreground">Total ativos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <UserX className="h-5 w-5 mx-auto mb-1 text-red-400" />
                <p className="text-2xl font-bold">{stats?.opt_outs_this_month ?? 0}</p>
                <p className="text-xs text-muted-foreground">
                  Opt-outs este mês ({((stats?.opt_out_rate ?? 0) * 100).toFixed(1)}%)
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs flex items-center gap-1">
                  <BarChart3 className="h-3.5 w-3.5" /> Por origem
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {stats?.by_origin && Object.entries(stats.by_origin).map(([origin, count]) => (
                  <div key={origin} className="flex items-center gap-2 text-xs">
                    <span className="w-20 truncate">{originIcons[origin] || ""} {origin}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(count / maxOrigin) * 100}%` }} />
                    </div>
                    <span className="text-muted-foreground w-8 text-right">{count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou telefone..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="opted_out">Opted Out</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={originFilter} onValueChange={setOriginFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas origens</SelectItem>
            <SelectItem value="ai_call">AI Call</SelectItem>
            <SelectItem value="inbound">Inbound</SelectItem>
            <SelectItem value="landing_page">Landing Page</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="click_to_wa">Click to WA</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Inbox className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Nenhum opt-in encontrado</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Ajuste os filtros ou aguarde novos consentimentos</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left p-3">Nome</th>
                    <th className="text-left p-3">Telefone</th>
                    <th className="text-left p-3">Origem</th>
                    <th className="text-left p-3">Data</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-right p-3">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o, i) => (
                    <tr key={`${o.phone}-${i}`} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="p-3 font-medium">{o.name || "—"}</td>
                      <td className="p-3 font-mono text-xs">{o.phone}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">
                          {originIcons[o.origin] || ""} {o.origin}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{o.date}</td>
                      <td className="p-3">
                        {o.status === "active" ? (
                          <Badge variant="outline" className="text-green-400 text-xs">
                            <UserCheck className="h-3 w-3 mr-1" /> Ativo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-400 text-xs">
                            <UserX className="h-3 w-3 mr-1" /> Opted out
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {o.status === "active" && (
                          <Button size="sm" variant="ghost" className="text-xs text-red-400 hover:text-red-300" onClick={() => setRevoking(o)}>
                            Revogar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revoke Dialog */}
      <Dialog open={!!revoking} onOpenChange={() => setRevoking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revogar Opt-in</DialogTitle>
            <DialogDescription>
              Revogar o consentimento de {revoking?.name || revoking?.phone}? Essa ação impedirá envios futuros.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Motivo</Label>
            <Textarea placeholder="Motivo da revogação..." value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevoking(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={revokeSaving}>
              {revokeSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Revogar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
