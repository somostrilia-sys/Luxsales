import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Network, ShieldCheck, TriangleAlert, Activity } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { toast } from "sonner";

const EDGE_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

type ProxyLog = {
  id: string;
  chip_id: string;
  action: string;
  proxy_url: string | null;
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  success: boolean;
  status: string | null;
  error_message: string | null;
  response_time_ms: number | null;
  created_at: string;
};

type ProxyMonitor = {
  chip_id: string;
  proxy_url: string | null;
  source: string;
  status: string;
  last_tested_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  last_http_status: number | null;
  last_response_ms: number | null;
  exit_ip: string | null;
  target_url: string | null;
  metadata?: Record<string, any> | null;
};

type ChipRow = {
  id: string;
  chip_index: number;
  instance_name: string | null;
  status: string;
  collaborator_id: string;
  disposable_chipset_proxy?: ProxyMonitor[] | ProxyMonitor | null;
};

type ChipOption = {
  id: string;
  chip_index: number;
  instance_name: string | null;
  status: string;
  monitor: ProxyMonitor | null;
};

function maskProxyUrl(url: string | null) {
  if (!url) return "—";
  return url.replace(/:([^@]+)@/, ":••••@");
}

function formatLocation(log: Pick<ProxyLog, "city" | "region" | "country">) {
  return [log.city, log.region, log.country].filter(Boolean).join(", ") || "—";
}

export default function Proxy() {
  const { collaborator, roleLevel } = useCollaborator();
  const isAdmin = roleLevel <= 1;
  const [chips, setChips] = useState<ChipOption[]>([]);
  const [logs, setLogs] = useState<ProxyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [selectedChipId, setSelectedChipId] = useState<string>("all");
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const callEdge = useCallback(async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;
    const resp = await fetch(`${EDGE_BASE}/manage-disposable-chip`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    let payload: any = null;
    try {
      payload = await resp.json();
    } catch {
      payload = null;
    }

    if (!resp.ok) {
      return { ...(payload || {}), error: payload?.error || `HTTP ${resp.status}` };
    }

    return payload;
  }, []);

  const fetchChips = useCallback(async () => {
    const query = supabase
      .from("disposable_chips")
      .select("id, chip_index, instance_name, status, collaborator_id, disposable_chipset_proxy(*)")
      .order("chip_index");

    const scopedQuery = isAdmin || !collaborator?.id
      ? query
      : query.eq("collaborator_id", collaborator.id);

    const { data, error } = await scopedQuery;
    if (error) throw error;

    const mapped = ((data as ChipRow[]) || []).map((chip) => ({
      id: chip.id,
      chip_index: chip.chip_index,
      instance_name: chip.instance_name,
      status: chip.status,
      monitor: Array.isArray(chip.disposable_chipset_proxy)
        ? chip.disposable_chipset_proxy[0] || null
        : chip.disposable_chipset_proxy || null,
    }));

    setChips(mapped);
    setSelectedChipId((current) => current === "all" || mapped.some((chip) => chip.id === current)
      ? current
      : (mapped[0]?.id || "all"));
  }, [collaborator?.id, isAdmin]);

  const fetchLogs = useCallback(async () => {
    let query = supabase
      .from("proxy_logs")
      .select("id, chip_id, action, proxy_url, ip, city, region, country, success, status, error_message, response_time_ms, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (!isAdmin && collaborator?.id) {
      const { data: ownedChips } = await supabase
        .from("disposable_chips")
        .select("id")
        .eq("collaborator_id", collaborator.id);

      const chipIds = (ownedChips || []).map((chip: any) => chip.id);
      if (chipIds.length === 0) {
        setLogs([]);
        return;
      }
      query = query.in("chip_id", chipIds);
    }

    if (selectedChipId !== "all") query = query.eq("chip_id", selectedChipId);
    if (selectedAction !== "all") query = query.eq("action", selectedAction);
    if (selectedStatus === "success") query = query.eq("success", true);
    if (selectedStatus === "error") query = query.eq("success", false);

    const { data, error } = await query;
    if (error) throw error;
    setLogs((data as ProxyLog[]) || []);
  }, [collaborator?.id, isAdmin, selectedAction, selectedChipId, selectedStatus]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchChips(), fetchLogs()]);
    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar monitoramento de proxy");
    } finally {
      setLoading(false);
    }
  }, [fetchChips, fetchLogs]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const selectedChip = useMemo(
    () => chips.find((chip) => chip.id === selectedChipId) || null,
    [chips, selectedChipId],
  );

  const todayCount = useMemo(
    () => logs.filter((log) => new Date(log.created_at).toDateString() === new Date().toDateString()).length,
    [logs],
  );

  const latestLog = logs[0] || null;

  const handleTestNow = async () => {
    if (!selectedChip || selectedChipId === "all") {
      toast.error("Selecione um chip para testar");
      return;
    }

    setTesting(true);
    const result = await callEdge({ action: "test_proxy", chip_id: selectedChip.id });
    setTesting(false);

    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success("Teste real do proxy concluído");
    }

    await refreshAll();
  };

  const statusBadge = selectedChip?.monitor?.status === "healthy"
    ? <Badge className="bg-primary/10 text-primary border-primary/20"><ShieldCheck className="h-3 w-3 mr-1" /> Proxy Online</Badge>
    : selectedChip?.monitor?.status === "error"
      ? <Badge className="bg-destructive/10 text-destructive border-destructive/20"><TriangleAlert className="h-3 w-3 mr-1" /> Proxy Offline</Badge>
      : <Badge variant="outline"><Activity className="h-3 w-3 mr-1" /> Sem teste recente</Badge>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Proxy"
          subtitle="Teste real, status atual e logs operacionais do proxy por chip"
          badge={<div className="p-2 rounded-lg bg-primary/10"><Network className="h-6 w-6 text-primary" /></div>}
        />

        <div className="grid gap-4 lg:grid-cols-[1.4fr,1fr,1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Teste e status atual</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr,180px,180px]">
                <Select value={selectedChipId} onValueChange={setSelectedChipId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um chip" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os chips</SelectItem>
                    {chips.map((chip) => (
                      <SelectItem key={chip.id} value={chip.id}>
                        Chip #{chip.chip_index} {chip.instance_name ? `• ${chip.instance_name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleTestNow} disabled={testing || !selectedChip || selectedChipId === "all"} className="gap-2">
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Network className="h-4 w-4" />}
                  Testar Proxy Agora
                </Button>
                <Button variant="outline" onClick={refreshAll}>Atualizar</Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {statusBadge}
                {selectedChip?.monitor?.proxy_url && <Badge variant="outline">{maskProxyUrl(selectedChip.monitor.proxy_url)}</Badge>}
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">IP externo</p>
                  <p className="text-sm font-medium break-all">{selectedChip?.monitor?.exit_ip || latestLog?.ip || "—"}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Cidade / Estado / País</p>
                  <p className="text-sm font-medium">{selectedChip?.monitor?.metadata?.city || formatLocation(latestLog || { city: null, region: null, country: null })}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Último teste</p>
                  <p className="text-sm font-medium">{selectedChip?.monitor?.last_tested_at ? new Date(selectedChip.monitor.last_tested_at).toLocaleString("pt-BR") : "—"}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Latência</p>
                  <p className="text-sm font-medium">{selectedChip?.monitor?.last_response_ms ? `${selectedChip.monitor.last_response_ms} ms` : latestLog?.response_time_ms ? `${latestLog.response_time_ms} ms` : "—"}</p>
                </div>
              </div>

              {selectedChip?.monitor?.last_error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {selectedChip.monitor.last_error}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Resumo rápido</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Conexões via proxy hoje</p>
                <p className="text-2xl font-semibold">{todayCount}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Último teste realizado</p>
                <p className="font-medium">{latestLog ? new Date(latestLog.created_at).toLocaleString("pt-BR") : "—"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Select value={selectedAction} onValueChange={setSelectedAction}>
                <SelectTrigger><SelectValue placeholder="Ação" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas ações</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="connect">Connect</SelectItem>
                  <SelectItem value="test">Test</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Logs do proxy</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : logs.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Nenhum log encontrado para os filtros atuais.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Chip</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>IP usado</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tempo</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const chip = chips.find((item) => item.id === log.chip_id);
                      return (
                        <TableRow key={log.id}>
                          <TableCell>#{chip?.chip_index || "—"}</TableCell>
                          <TableCell className="uppercase">{log.action}</TableCell>
                          <TableCell className="font-mono text-xs">{log.ip || "—"}</TableCell>
                          <TableCell>{formatLocation(log)}</TableCell>
                          <TableCell>
                            {log.success
                              ? <Badge className="bg-primary/10 text-primary border-primary/20">OK</Badge>
                              : <Badge className="bg-destructive/10 text-destructive border-destructive/20">Erro</Badge>}
                          </TableCell>
                          <TableCell>{log.response_time_ms ? `${log.response_time_ms} ms` : "—"}</TableCell>
                          <TableCell>{new Date(log.created_at).toLocaleString("pt-BR")}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
