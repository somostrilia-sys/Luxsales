import { useEffect, useState, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Phone, Users, Play, Pause, Zap, Loader2 } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EDGE_BASE } from "@/lib/constants";

const PROXY = `${EDGE_BASE}/orchestrator-proxy`;
const AUTH_HEADER = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjYWR1endhdXRscHpwdmpvZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMDQ1MTcsImV4cCI6MjA4ODU4MDUxN30.LinR7PIoK7n79hWjbSJ3EgDwA_y6uN-HfQnOk7GgYi4";
const proxyUrl = (path: string) => `${PROXY}?path=${encodeURIComponent(path)}`;

type QueueItem = {
  lead_id: string;
  phone: string;
  company?: string;
  priority?: number;
  attempts?: number;
  status?: string;
};

type QueueStatus = {
  status: "running" | "paused" | "stopped";
  active_calls: number;
  queue_items: QueueItem[];
  queue_size: number;
};

const statusConfig = {
  running: { label: "Rodando", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  paused:  { label: "Pausado", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  stopped: { label: "Parado",  className: "bg-muted text-muted-foreground border-border" },
};

export default function VoiceDialer() {
  const [data, setData] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [simMode, setSimMode] = useState(true);
  const [offline, setOffline] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(proxyUrl("/queue/status"), {
        headers: { Authorization: AUTH_HEADER },
      });
      if (!res.ok) throw new Error("Erro ao buscar status");
      const json = await res.json();
      setData(json);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const doAction = async (path: string, label: string) => {
    setActionLoading(path);
    try {
      const res = await fetch(proxyUrl(path), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: AUTH_HEADER },
        body: JSON.stringify({ simulation: simMode }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${label} executado`);
      await fetchStatus();
    } catch {
      toast.error(`Falha ao executar ${label}`);
    } finally {
      setActionLoading(null);
    }
  };

  const st = offline ? "stopped" : (data?.status ?? "stopped");
  const badge = offline
    ? { label: "Offline", className: "bg-destructive/15 text-destructive border-destructive/30" }
    : statusConfig[st];

  return (
    <DashboardLayout>
      <PageHeader
        title="Discador LuxSales"
        badge={<Badge className={badge.className}>{badge.label}</Badge>}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-lg bg-emerald-500/10 p-3">
              <Phone className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Chamadas Ativas</p>
              <p className="text-3xl font-bold">{data?.active_calls ?? 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-lg bg-primary/10 p-3">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fila de Leads</p>
              <p className="text-3xl font-bold">{data?.queue_size ?? 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Modo</p>
              <p className="text-lg font-semibold">
                {simMode ? (
                  <span className="text-blue-400">Simulação</span>
                ) : (
                  <span className="text-destructive">Real</span>
                )}
              </p>
            </div>
            <Switch checked={!simMode} onCheckedChange={(v) => setSimMode(!v)} />
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Button
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          disabled={actionLoading !== null}
          onClick={() => doAction("/queue/start", "Iniciar Discagem")}
        >
          {actionLoading === "/queue/start" ? <Loader2 className="animate-spin" /> : <Play />}
          Iniciar Discagem
        </Button>

        <Button
          variant="outline"
          className="border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10"
          disabled={actionLoading !== null}
          onClick={() => doAction("/queue/pause", "Pausar")}
        >
          {actionLoading === "/queue/pause" ? <Loader2 className="animate-spin" /> : <Pause />}
          Pausar
        </Button>

        <Button
          variant="outline"
          className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
          disabled={actionLoading !== null}
          onClick={() => doAction("/dispatch", "Despachar Próximo")}
        >
          {actionLoading === "/dispatch" ? <Loader2 className="animate-spin" /> : <Zap />}
          Despachar Próximo
        </Button>
      </div>

      {/* Queue Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead ID</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead className="text-center">Prioridade</TableHead>
                <TableHead className="text-center">Tentativas</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : !data?.queue_items?.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    Fila vazia
                  </TableCell>
                </TableRow>
              ) : (
                data.queue_items.map((item) => (
                  <TableRow key={item.lead_id}>
                    <TableCell className="font-mono text-xs">{item.lead_id.slice(0, 8)}</TableCell>
                    <TableCell>{item.phone}</TableCell>
                    <TableCell>{item.company ?? "—"}</TableCell>
                    <TableCell className="text-center">{item.priority ?? 0}</TableCell>
                    <TableCell className="text-center">{item.attempts ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{item.status ?? "pending"}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
