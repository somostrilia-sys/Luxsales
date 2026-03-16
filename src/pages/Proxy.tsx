import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Network, ShieldCheck, TriangleAlert, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { toast } from "sonner";

const EDGE_BASE = "https://ecaduzwautlpzpvjognr.supabase.co/functions/v1";

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
  metadata?: Record<string, string | number | boolean | null> | null;
};

type ChipRow = {
  id: string;
  chip_index: number;
  instance_name: string | null;
  status: string;
  collaborator_id: string;
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

function formatMonitorLocation(monitor: ProxyMonitor | null, fallback: ProxyLog | null) {
  const city = typeof monitor?.metadata?.city === "string" ? monitor.metadata.city : null;
  const region = typeof monitor?.metadata?.region === "string" ? monitor.metadata.region : null;
  const country = typeof monitor?.metadata?.country === "string" ? monitor.metadata.country : null;
  return [city, region, country].filter(Boolean).join(", ") || (fallback ? formatLocation(fallback) : "—");
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
    const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const resp = await fetch(`${EDGE_BASE}/manage-disposable-chip`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    let payload: Record<string, unknown> | null = null;
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
    let chipQuery = supabase
      .from("disposable_chips")
      .select("id, chip_index, instance_name, status, collaborator_id")
      .order("chip_index", { ascending: true });

    if (!isAdmin && collaborator?.id) {
      chipQuery = chipQuery.eq("collaborator_id", collaborator.id);
    }

    const { data: chipRows, error: chipError } = await chipQuery;
    if (chipError) throw chipError;

    const chipIds = ((chipRows as ChipRow[]) || []).map((chip) => chip.id);

    let monitorMap = new Map<string, ProxyMonitor>();
    if (chipIds.length > 0) {
      const { data: monitorRows, error: monitorError } = await supabase
        .from("disposable_chipset_proxy")
        .select("chip_id, proxy_url, created_at, updated_at")
        .in("chip_id", chipIds);

      if (monitorError) throw monitorError;
      monitorMap = new Map(
        ((monitorRows as Array<{ chip_id: string; proxy_url: string | null; updated_at?: string | null }> | null) || []).map((monitor) => [
          monitor.chip_id,
          {
            chip_id: monitor.chip_id,
            proxy_url: monitor.proxy_url,
            source: "configured",
            status: monitor.proxy_url ? "configured" : "missing",
            last_tested_at: monitor.updated_at ?? null,
            last_success_at: null,
            last_error: null,
            last_http_status: null,
            last_response_ms: null,
            exit_ip: null,
            target_url: null,
            metadata: null,
          } satisfies ProxyMonitor,
        ])
      );
    }

    const mapped = ((chipRows as ChipRow[]) || []).map((chip) => ({
      id: chip.id,
      chip_index: chip.chip_index,
      instance_name: chip.instance_name,
      status: chip.status,
      monitor: monitorMap.get(chip.id) || null,
    }));

    setChips(mapped);
    setSelectedChipId((current) => {
      if (current === "all") return current;
      return mapped.some((chip) => chip.id === current) ? current : "all";
    });
  }, [collaborator?.id, isAdmin]);

  const fetchLogs = useCallback(async () => {
    let allowedChipIds: string[] | null = null;

    if (!isAdmin && collaborator?.id) {
      const { data: ownedChips, error: ownedChipsError } = await supabase
        .from("disposable_chips")
        .select("id")
        .eq("collaborator_id", collaborator.id);

      if (ownedChipsError) throw ownedChipsError;
      allowedChipIds = (ownedChips || []).map((chip: { id: string }) => chip.id);

      if (allowedChipIds.length === 0) {
        setLogs([]);
        return;
      }
    }

    let query = supabase
      .from("proxy_logs")
      .select("id, chip_id, action, ip, city, region, country, success, status, error_message, response_time_ms, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (allowedChipIds) query = query.in("chip_id", allowedChipIds);
    if (selectedChipId !== "all") query = query.eq("chip_id", selectedChipId);
    if (selectedAction !== "all") query = query.eq("action", selectedAction);
    if (selectedStatus === "success") query = query.eq("success", true);
    if (selectedStatus === "error") query = query.eq("success", false);

    const { data, error } = await query;
    if (error) throw error;
    setLogs(
      (((data as Omit<ProxyLog, "proxy_url">[] | null) || []).map((log) => ({
        ...log,
        proxy_url: null,
      })) as ProxyLog[])
    );
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

  const latestLog = useMemo(
    () => (selectedChipId === "all" ? logs[0] || null : logs.find((log) => log.chip_id === selectedChipId) || null),
    [logs, selectedChipId],
  );

  const todayCount = useMemo(
    () => logs.filter((log) => new Date(log.created_at).toDateString() === new Date().toDateString()).length,
    [logs],
  );

  const handleTestNow = async () => {
    if (!selectedChip || selectedChipId === "all") {
      toast.error("Selecione um chip para testar");
      return;
    }

    setTesting(true);
    const result = await callEdge({ action: "test_proxy", chip_id: selectedChip.id });
    setTesting(false);

    if (result?.error) {
      toast.error(String(result.error));
    } else {
      toast.success("Teste real do proxy concluído");
    }

    await refreshAll();
  };

  const statusBadge = selectedChip?.monitor?.status === "healthy"
    ? <Badge className="bg-primary/10 text-primary border-primary/20"><ShieldCheck className="h-3 w-3 mr-1" />Proxy online</Badge>
    : selectedChip?.monitor?.status === "error"
      ? <Badge className="bg-destructive/10 text-destructive border-destructive/20"><TriangleAlert className="h-3 w-3 mr-1" />Proxy offline</Badge>
      : <Badge variant="outline"><Activity className="h-3 w-3 mr-1" />Sem teste recente</Badge>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Proxy"
          subtitle="Monitoramento real de proxies por chip com dados do Supabase e teste sob demanda"
          badge={<div className="rounded-lg bg-primary/10 p-2"><Network className="h-6 w-6 text-primary" /></div>}
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
                        Chip #{chip.chip_index}{chip.instance_name ? ` • ${chip.instance_name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleTestNow} disabled={testing || !selectedChip || selectedChipId === "all"} className="gap-2">
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Network className="h-4 w-4" />}
                  Testar agora
                </Button>
                <Button variant="outline" onClick={refreshAll}>Atualizar</Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {statusBadge}
                {selectedChip?.monitor?.proxy_url && <Badge variant="outline">{maskProxyUrl(selectedChip.monitor.proxy_url)}</Badge>}
                {selectedChip && <Badge variant="outline">Status do chip: {selectedChip.status}</Badge>}
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">IP externo</p>
                  <p className="break-all text-sm font-medium">{selectedChip?.monitor?.exit_ip || latestLog?.ip || "—"}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Localização</p>
                  <p className="text-sm font-medium">{formatMonitorLocation(selectedChip?.monitor || null, latestLog)}</p>
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

              {!loading && chips.length === 0 && (
                <div className="rounded-lg border border-border px-4 py-6 text-sm text-muted-foreground">
                  Nenhum chip de disparo encontrado no Supabase para o escopo deste usuário.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumo rápido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Chips encontrados</p>
                <p className="text-2xl font-semibold">{chips.length}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Testes hoje</p>
                <p className="text-2xl font-semibold">{todayCount}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Último teste realizado</p>
                <p className="font-medium">{latestLog ? new Date(latestLog.created_at).toLocaleString("pt-BR") : "—"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filtros</CardTitle>
            </CardHeader>
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
              <div className="py-8 text-center text-sm text-muted-foreground">Nenhum log real encontrado para os filtros atuais.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Chip</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>IP usado</TableHead>
                      <TableHead>Localização</TableHead>
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