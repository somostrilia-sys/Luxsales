import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { EDGE_BASE } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Loader2, Search, Send, Users, ChevronDown, ChevronUp,
  UserCheck, Clock, TrendingUp, AlertTriangle, Inbox,
} from "lucide-react";

interface AvailableLead {
  phone: string;
  name: string;
  origin: string;
  opt_in_at: string;
  interest: string;
}

interface SellerStats {
  name: string;
  collaborator_id: string;
  total: number;
  pending: number;
  dispatched: number;
  responded: number;
  converted: number;
  returned: number;
  leads?: { phone: string; name: string; status: string }[];
}

interface SellerOption {
  id: string;
  name: string;
}

export default function LeadDistribution() {
  const { collaborator } = useCollaborator();
  const [tab, setTab] = useState("distribute");

  // Distribute tab
  const [leads, setLeads] = useState<AvailableLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sellers, setSellers] = useState<SellerOption[]>([]);
  const [targetSeller, setTargetSeller] = useState("");
  const [dailyLimit, setDailyLimit] = useState(30);
  const [distributing, setDistributing] = useState(false);

  // Stats tab
  const [stats, setStats] = useState<SellerStats[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    };
  }, []);

  const fetchLeads = useCallback(async () => {
    if (!collaborator) return;
    setLoading(true);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${EDGE_BASE}/lead-distributor`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "list-available",
          company_id: collaborator.company_id,
          requester_role: "ceo",
        }),
      });
      const data = await res.json();
      if (res.ok) setLeads(data.leads || []);
      else toast.error(data.error || "Erro ao buscar leads");
    } catch {
      toast.error("Erro de conexão");
    }
    setLoading(false);
  }, [collaborator, getHeaders]);

  const fetchSellers = useCallback(async () => {
    const { data } = await supabase
      .from("dispatch_permissions")
      .select("collaborator_id, role")
      .eq("active", true);
    setSellers((data || []).map((d: any) => ({
      id: d.collaborator_id,
      name: d.collaborator_id.slice(0, 8) + "...",
    })));
  }, []);

  const fetchStats = useCallback(async () => {
    if (!collaborator) return;
    setStatsLoading(true);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${EDGE_BASE}/lead-distributor`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "stats",
          company_id: collaborator.company_id,
          requester_role: "ceo",
        }),
      });
      const data = await res.json();
      if (res.ok) setStats(data.sellers || []);
    } catch {}
    setStatsLoading(false);
  }, [collaborator, getHeaders]);

  useEffect(() => {
    fetchLeads();
    fetchSellers();
  }, [fetchLeads, fetchSellers]);

  useEffect(() => {
    if (tab === "distributed") fetchStats();
  }, [tab, fetchStats]);

  const toggleSelect = (phone: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(phone) ? next.delete(phone) : next.add(phone);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((l) => l.phone)));
  };

  const handleDistribute = async () => {
    if (!targetSeller || selected.size === 0 || !collaborator) return;
    setDistributing(true);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${EDGE_BASE}/lead-distributor`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "distribute",
          company_id: collaborator.company_id,
          collaborator_id: targetSeller,
          phone_numbers: Array.from(selected),
          daily_limit: dailyLimit,
          requester_role: "ceo",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${data.distributed || selected.size} distribuídos${data.skipped ? `, ${data.skipped} pulados (sem opt-in)` : ""}`);
        setSelected(new Set());
        fetchLeads();
      } else {
        toast.error(data.error || "Erro ao distribuir");
      }
    } catch {
      toast.error("Erro de conexão");
    }
    setDistributing(false);
  };

  const filtered = leads.filter(
    (l) => !search || l.name?.toLowerCase().includes(search.toLowerCase()) || l.phone.includes(search)
  );

  const interestColor = (i: string) =>
    i === "Alto" ? "text-green-400" : i === "Médio" ? "text-yellow-400" : "text-muted-foreground";

  return (
    <DashboardLayout>
      <PageHeader title="Distribuição de Leads" subtitle="Distribua leads para a equipe de vendas" />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="distribute">Distribuir</TabsTrigger>
          <TabsTrigger value="distributed">Distribuídos</TabsTrigger>
        </TabsList>

        {/* DISTRIBUTE TAB */}
        <TabsContent value="distribute" className="space-y-4">
          {/* Actions bar */}
          <Card>
            <CardContent className="p-4 flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[150px]">
                <Label className="text-xs">Vendedor</Label>
                <Select value={targetSeller} onValueChange={setTargetSeller}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {sellers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-28">
                <Label className="text-xs">Limite diário</Label>
                <Input type="number" value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value))} />
              </div>
              <Button onClick={handleDistribute} disabled={distributing || selected.size === 0 || !targetSeller}>
                {distributing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Distribuir ({selected.size})
              </Button>
            </CardContent>
          </Card>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou telefone..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {/* Table */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Inbox className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Nenhum lead disponível para distribuição</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Novos leads aparecerão aqui quando receberem opt-in</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="p-3 w-10">
                          <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                        </th>
                        <th className="text-left p-3">Nome</th>
                        <th className="text-left p-3">Telefone</th>
                        <th className="text-left p-3">Origem</th>
                        <th className="text-left p-3">Opt-in</th>
                        <th className="text-left p-3">Interesse</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((l) => (
                        <tr key={l.phone} className="border-b border-border/50 hover:bg-muted/20 cursor-pointer" onClick={() => toggleSelect(l.phone)}>
                          <td className="p-3">
                            <Checkbox checked={selected.has(l.phone)} onCheckedChange={() => toggleSelect(l.phone)} />
                          </td>
                          <td className="p-3 font-medium">{l.name || "—"}</td>
                          <td className="p-3 font-mono text-xs">{l.phone}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-xs">{l.origin}</Badge>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">{l.opt_in_at || "—"}</td>
                          <td className={`p-3 text-xs font-medium ${interestColor(l.interest)}`}>{l.interest || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* DISTRIBUTED TAB */}
        <TabsContent value="distributed" className="space-y-4">
          {statsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : stats.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Nenhuma distribuição registrada</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {stats.map((s) => {
                const isExpanded = expanded === s.collaborator_id;
                const totalPct = s.total > 0 ? ((s.dispatched + s.responded + s.converted) / s.total) * 100 : 0;
                return (
                  <Card key={s.collaborator_id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : s.collaborator_id)}>
                        <div>
                          <p className="font-medium text-sm">{s.name}</p>
                          <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                            <span>Total: {s.total}</span>
                            <span>Pend: {s.pending}</span>
                            <span>Enviados: {s.dispatched}</span>
                            <span className="text-green-400">Resp: {s.responded}</span>
                            <span className="text-emerald-400">Conv: {s.converted}</span>
                            {s.returned > 0 && <span className="text-yellow-400">Dev: {s.returned}</span>}
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                      <Progress value={totalPct} className="h-2" />
                      {isExpanded && s.leads && s.leads.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {s.leads.map((l) => (
                            <div key={l.phone} className="flex justify-between text-xs p-2 bg-muted/20 rounded">
                              <span>{l.name || l.phone}</span>
                              <Badge variant="outline" className="text-xs">{l.status}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
