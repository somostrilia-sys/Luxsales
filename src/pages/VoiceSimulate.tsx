import { useEffect, useState, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Rocket, Phone, Clock, Activity, AlertTriangle, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const ORCH = import.meta.env.VITE_ORCHESTRATOR_URL || "http://192.168.0.206:3002";

type LogEntry = { ts: string; level: "success" | "simulated" | "error"; message: string };

const COMPANIES = [
  { id: "objetivo", label: "Objetivo" },
];

export default function VoiceSimulate() {
  const [simEnabled, setSimEnabled] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [phone, setPhone] = useState("");
  const [companyId, setCompanyId] = useState("objetivo");
  const [dispatching, setDispatching] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<{ active_calls: number; status: string } | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const hour = now.getHours();
  const isBusinessHours = hour >= 8 && hour < 20;

  const addLog = useCallback((level: LogEntry["level"], message: string) => {
    setLogs((prev) => {
      const next = [...prev, { ts: new Date().toLocaleTimeString("pt-BR"), level, message }];
      return next.slice(-50);
    });
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${ORCH}/queue/status`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setStatus(json);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchStatus();
    const iv = setInterval(fetchStatus, 3_000);
    return () => clearInterval(iv);
  }, [fetchStatus]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const toggleSim = async (enabled: boolean) => {
    if (!enabled) {
      const ok = window.confirm("⚠️ Modo Real: chamadas reais serão feitas! Confirma?");
      if (!ok) return;
    }
    setToggling(true);
    try {
      const res = await fetch(`${ORCH}/queue/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error();
      setSimEnabled(enabled);
      addLog(enabled ? "simulated" : "error", enabled ? "Modo simulação ATIVADO" : "Modo REAL ativado — chamadas reais!");
      toast.success(enabled ? "Simulação ativada" : "Modo real ativado");
    } catch {
      toast.error("Falha ao alternar modo");
    } finally {
      setToggling(false);
    }
  };

  const dispatch = async () => {
    if (!phone.replace(/\D/g, "")) {
      toast.error("Informe o telefone");
      return;
    }
    setDispatching(true);
    try {
      const res = await fetch(`${ORCH}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.replace(/\D/g, ""), company_id: companyId, simulation: simEnabled }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Erro");
      addLog(simEnabled ? "simulated" : "success", `Dispatch ${simEnabled ? "(SIM)" : "(REAL)"} → ${phone}`);
      toast.success("Disparo enviado");
    } catch (err: any) {
      addLog("error", `Falha dispatch: ${err.message}`);
      toast.error("Falha no disparo");
    } finally {
      setDispatching(false);
    }
  };

  const logColor = { success: "text-emerald-400", simulated: "text-yellow-400", error: "text-destructive" };

  return (
    <DashboardLayout>
      <PageHeader
        title="Simulação de Chamadas"
        badge={
          <Badge className={simEnabled
            ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
            : "bg-destructive/15 text-destructive border-destructive/30"
          }>
            {simEnabled ? "Simulação" : "Real"}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Toggle */}
          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div className="space-y-1">
                <p className="font-semibold text-lg">Modo Simulação</p>
                <p className="text-sm text-muted-foreground">
                  {simEnabled ? "Nenhuma chamada real será feita" : "⚠️ Chamadas reais serão disparadas"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-medium ${simEnabled ? "text-blue-400" : "text-destructive"}`}>
                  {simEnabled ? "SIM" : "REAL"}
                </span>
                <Switch
                  checked={simEnabled}
                  onCheckedChange={toggleSim}
                  disabled={toggling}
                  className="data-[state=checked]:bg-blue-500 data-[state=unchecked]:bg-destructive"
                />
              </div>
            </CardContent>
          </Card>

          {/* Dispatch Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Disparar Teste</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="11999999999"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Select value={companyId} onValueChange={setCompanyId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COMPANIES.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={dispatch} disabled={dispatching} className="w-full sm:w-auto">
                {dispatching ? <Loader2 className="animate-spin" /> : <Rocket className="h-4 w-4" />}
                Disparar Teste
              </Button>
            </CardContent>
          </Card>

          {/* Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Log em Tempo Real</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-64">
                <div className="p-4 font-mono text-xs space-y-1">
                  {logs.length === 0 ? (
                    <p className="text-muted-foreground text-center py-6">Nenhum evento ainda</p>
                  ) : (
                    logs.map((l, i) => (
                      <div key={i} className={logColor[l.level]}>
                        <span className="text-muted-foreground mr-2">[{l.ts}]</span>
                        {l.message}
                      </div>
                    ))
                  )}
                  <div ref={logEndRef} />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right column — Status */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" /> Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Modo</span>
                <Badge variant="outline" className={simEnabled ? "border-blue-500/40 text-blue-400" : "border-destructive/40 text-destructive"}>
                  {simEnabled ? "Simulação" : "Real"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Chamadas Ativas</span>
                <span className="font-bold text-lg">{status?.active_calls ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Horário Comercial</span>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{isBusinessHours ? "✅ Dentro" : "🔴 Fora"}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Engine</span>
                <Badge variant="outline" className="text-xs capitalize">{status?.status ?? "offline"}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
