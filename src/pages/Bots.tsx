import { useState, useEffect, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import { EDGE_BASE } from "@/lib/constants";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Search, Bot, Pencil, Power, QrCode, Eye, EyeOff, Loader2, Key, Trash2, Smartphone, RefreshCw, BookOpen, MessageCircle, Users, ChevronDown, ChevronUp, Activity, ShieldCheck, TriangleAlert, Timer, Network, Upload, Send } from "lucide-react";
import Papa from "papaparse";

// ── Types ──

interface BotInstance {
  id: string;
  name: string;
  collaborator_id: string | null;
  company_id: string | null;
  bot_type: string;
  anthropic_api_key: string | null;
  api_key_id: string | null;
  uazapi_instance_id: string | null;
  uazapi_token: string | null;
  whatsapp_number: string | null;
  whatsapp_status: string | null;
  agent_ids: string[] | null;
  max_msgs_per_day: number | null;
  msg_interval_min: number | null;
  msg_interval_max: number | null;
  active_hours_start: string | null;
  active_hours_end: string | null;
  active: boolean;
  last_seen_at: string | null;
}

interface ApiKeyPool {
  id: string;
  name: string;
  provider: string;
  api_key: string;
  max_bots: number | null;
  max_requests_per_min: number | null;
  max_tokens_per_day: number | null;
  active: boolean;
  last_used_at: string | null;
}

const BOT_TYPES = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "ai_assistant", label: "AI Assistant" },
  { value: "hybrid", label: "Híbrido" },
];

const PROVIDERS = [
  { value: "anthropic", label: "Anthropic" },
  { value: "ideogram", label: "Ideogram" },
  { value: "uazapi", label: "UAZAPI" },
];

const defaultBotForm = {
  name: "",
  collaborator_id: "",
  company_id: "",
  bot_type: "whatsapp",
  api_key_id: "",
  uazapi_instance_id: "",
  uazapi_token: "",
  whatsapp_number: "",
  max_msgs_per_day: 200,
  msg_interval_min: 5,
  msg_interval_max: 15,
  active_hours_start: "08:00",
  active_hours_end: "18:00",
};

const defaultKeyForm = {
  name: "",
  provider: "anthropic",
  api_key: "",
  max_bots: 30,
  max_requests_per_min: 60,
};

function maskKey(key: string) {
  if (!key || key.length < 10) return "••••••••";
  return key.slice(0, 7) + "..." + key.slice(-5);
}

// ── Proxy Editor (inline por chip) ──
interface ProxyMonitor {
  chip_id: string;
  proxy_url: string | null;
  source: "manual" | "chip" | "iproyal" | "none";
  status: "unknown" | "healthy" | "degraded" | "error";
  last_tested_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  last_http_status: number | null;
  last_response_ms: number | null;
  exit_ip: string | null;
  target_url: string | null;
  metadata?: Record<string, unknown> | null;
}

interface DisposableChip {
  id: string;
  collaborator_id: string;
  chip_index: number;
  instance_name: string | null;
  instance_token: string | null;
  status: string;
  qr_code: string | null;
  phone: string | null;
  uazapi_server_url: string;
  uazapi_admin_token: string;
  proxy_url?: string | null;
  proxy_monitor?: ProxyMonitor | null;
}

function maskProxyUrl(url: string) {
  return url.replace(/:([^@]+)@/, ":••••@");
}

function formatProxySource(source?: string | null) {
  if (source === "iproyal") return "IPRoyal fallback";
  if (source === "chip") return "Proxy do chip";
  if (source === "manual") return "Proxy manual";
  return "Sem proxy";
}

function ProxyEditor({
  chip,
  callEdge,
  onUpdate,
}: {
  chip: DisposableChip;
  callEdge: (body: Record<string, unknown>) => Promise<any>;
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(chip.proxy_url || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(chip.proxy_url || "");
  }, [chip.proxy_url]);

  const save = async () => {
    setSaving(true);
    const result = await callEdge({ action: "set_proxy", chip_id: chip.id, proxy_url: value.trim() || null });
    setSaving(false);
    if (result?.error) { toast.error("Erro ao salvar proxy: " + result.error); return; }
    toast.success(value.trim() ? "Proxy configurado!" : "Proxy removido");
    setEditing(false);
    onUpdate();
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-2 text-xs">
        {chip.proxy_url ? (
          <span className="font-mono truncate max-w-[220px]" title={chip.proxy_url}>
            🔒 {maskProxyUrl(chip.proxy_url)}
          </span>
        ) : (
          <span className="text-muted-foreground/70">Sem proxy manual salvo</span>
        )}
        <button
          onClick={() => { setValue(chip.proxy_url || ""); setEditing(true); }}
          className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          {chip.proxy_url ? "Editar" : "+ Proxy"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2 items-center">
      <input
        type="text"
        className="flex-1 text-xs bg-background border border-border rounded px-2 py-1 font-mono placeholder:text-muted-foreground/40"
        placeholder="http://user:senha@host:porta"
        value={value}
        onChange={e => setValue(e.target.value)}
        autoFocus
      />
      <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => setEditing(false)}>✕</Button>
      <Button size="sm" className="text-xs h-7 px-2" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
      </Button>
    </div>
  );
}

function ProxyMonitorPanel({ chip }: { chip: DisposableChip }) {
  const monitor = chip.proxy_monitor;

  const statusTone = monitor?.status === "healthy"
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
    : monitor?.status === "degraded"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
      : monitor?.status === "error"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-border bg-muted/30 text-muted-foreground";

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={statusTone}>
          {monitor?.status === "healthy" ? <ShieldCheck className="h-3 w-3 mr-1" /> : monitor?.status === "error" ? <TriangleAlert className="h-3 w-3 mr-1" /> : <Activity className="h-3 w-3 mr-1" />}
          {monitor?.status === "healthy" ? "Monitorado e operacional" : monitor?.status === "degraded" ? "Monitorado com ressalvas" : monitor?.status === "error" ? "Falha real detectada" : "Sem teste recente"}
        </Badge>
        <Badge variant="outline">{formatProxySource(monitor?.source)}</Badge>
        {monitor?.last_http_status && <Badge variant="outline">HTTP {monitor.last_http_status}</Badge>}
      </div>

      <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-border px-3 py-2">
          <p className="text-muted-foreground flex items-center gap-1"><Timer className="h-3 w-3" /> Latência</p>
          <p className="font-medium">{monitor?.last_response_ms ? `${monitor.last_response_ms} ms` : "—"}</p>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <p className="text-muted-foreground flex items-center gap-1"><Network className="h-3 w-3" /> IP de saída</p>
          <p className="font-medium break-all">{monitor?.exit_ip || "—"}</p>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <p className="text-muted-foreground">Último teste</p>
          <p className="font-medium">{monitor?.last_tested_at ? new Date(monitor.last_tested_at).toLocaleString("pt-BR") : "Nunca"}</p>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <p className="text-muted-foreground">Último sucesso</p>
          <p className="font-medium">{monitor?.last_success_at ? new Date(monitor.last_success_at).toLocaleString("pt-BR") : "—"}</p>
        </div>
      </div>

      {chip.proxy_url && (
        <div className="text-xs font-mono break-all rounded-md border border-border px-3 py-2">
          {maskProxyUrl(chip.proxy_url)}
        </div>
      )}

      {monitor?.last_error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {monitor.last_error}
        </div>
      )}
    </div>
  );
}

// ── Disposable Chips Section ──

// EDGE_BASE imported at top of file

function DisposableChipsSection({ collaboratorId }: { collaboratorId: string | null }) {
  const [chips, setChips] = useState<DisposableChip[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [testingProxy, setTestingProxy] = useState<string | null>(null);
  const [activeQrChipId, setActiveQrChipId] = useState<string | null>(null);
  const pollingRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // Form para novo chip
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProxyUrl, setNewProxyUrl] = useState("");

  const mapChipRow = useCallback((row: any): DisposableChip => {
    const monitor = Array.isArray(row.disposable_chipset_proxy)
      ? row.disposable_chipset_proxy[0] || null
      : row.disposable_chipset_proxy || null;

    return {
      ...row,
      proxy_url: monitor?.proxy_url || null,
      proxy_monitor: monitor,
    };
  }, []);

  const fetchChips = useCallback(async () => {
    if (!collaboratorId) { setChips([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("disposable_chips")
      .select("*, disposable_chipset_proxy(*)")
      .eq("collaborator_id", collaboratorId)
      .order("chip_index");
    setChips(((data as any[]) || []).map(mapChipRow));
    setLoading(false);
  }, [collaboratorId, mapChipRow]);

  useEffect(() => { fetchChips(); return () => { Object.values(pollingRefs.current).forEach(clearInterval); }; }, [fetchChips]);

  const callEdge = async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;
    const resp = await fetch(`${EDGE_BASE}/manage-disposable-chip`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify(body),
    });

    let payload: any = null;
    try {
      payload = await resp.json();
    } catch {
      payload = null;
    }

    if (!resp.ok) {
      return { ...(payload || {}), error: payload?.error || `HTTP ${resp.status}: ${resp.statusText}` };
    }

    return payload;
  };

  const startStatusPolling = useCallback((chipId: string) => {
    if (pollingRefs.current[chipId]) clearInterval(pollingRefs.current[chipId]);
    pollingRefs.current[chipId] = setInterval(async () => {
      const result = await callEdge({ action: "status", chip_id: chipId });
      if (result?.status === "connected") {
        clearInterval(pollingRefs.current[chipId]);
        delete pollingRefs.current[chipId];
        setChips(prev => prev.map(c => c.id === chipId ? { ...c, status: "connected", qr_code: null, phone: result.phone || c.phone } : c));
        setConnecting(null);
        setActiveQrChipId(prev => prev === chipId ? null : prev);
        toast.success("✅ Chip conectado com sucesso!");
        fetchChips();
      } else if (result?.status === "connecting" && result?.qr_code) {
        setChips(prev => prev.map(c => c.id === chipId ? { ...c, qr_code: result.qr_code, status: "connecting" } : c));
      } else if (result?.status === "disconnected" || result?.qr_expired) {
        const newQr = await callEdge({ action: "connect", chip_id: chipId });
        if (newQr?.qr_code) {
          setChips(prev => prev.map(c => c.id === chipId ? { ...c, qr_code: newQr.qr_code, status: "connecting" } : c));
          toast.info("QR atualizado — escaneie agora");
          fetchChips();
        }
      }
    }, 8000);
  }, [callEdge, fetchChips]);

  const addChip = async () => {
    if (!collaboratorId) { toast.error("Colaborador não encontrado"); return; }
    setAdding(true);
    const result = await callEdge({
      action: "create",
      collaborator_id: collaboratorId,
      ...(newProxyUrl.trim() ? { proxy_url: newProxyUrl.trim() } : {}),
    });
    setAdding(false);
    if (result?.error) { toast.error("Erro: " + result.error); return; }
    toast.success(`Chip #${result.chip?.chip_index} criado!`);
    setNewProxyUrl("");
    setShowAddForm(false);
    fetchChips();
  };

  const updateField = async (chipId: string, field: string, value: string) => {
    await supabase.from("disposable_chips").update({ [field]: value, updated_at: new Date().toISOString() } as any).eq("id", chipId);
    setChips(prev => prev.map(c => c.id === chipId ? { ...c, [field]: value } : c));
  };

  const handleConnect = async (chip: DisposableChip, retryCount = 0) => {
    setConnecting(chip.id);
    try {
      const result = await callEdge({ action: "connect", chip_id: chip.id });
      if (result?.error) {
        if (retryCount < 2) {
          toast.info("Criando instância, aguarde...");
          await new Promise(r => setTimeout(r, 2500));
          return handleConnect(chip, retryCount + 1);
        }
        toast.error("Erro ao conectar: " + result.error);
        setConnecting(null);
        fetchChips();
        return;
      }
      const qrCode = result?.qr_code;
      setChips(prev => prev.map(c => c.id === chip.id
        ? { ...c, status: "connecting", qr_code: qrCode || c.qr_code, instance_token: result?.instance_token || c.instance_token }
        : c
      ));
      if (qrCode) {
        toast.success(`Proxy ${result?.proxy_status === "healthy" ? "validado" : "aplicado"} antes do QR`);
        startStatusPolling(chip.id);
        fetchChips();
      } else if (retryCount < 2) {
        await new Promise(r => setTimeout(r, 2000));
        return handleConnect(chip, retryCount + 1);
      } else {
        toast.warning("QR não retornado. Tente clicar Conectar novamente.");
        setConnecting(null);
      }
    } catch (e) {
      if (retryCount < 1) {
        await new Promise(r => setTimeout(r, 2000));
        return handleConnect(chip, retryCount + 1);
      }
      toast.error("Falha ao conectar chip. Tente novamente.");
      setConnecting(null);
      fetchChips();
    }
  };

  const handleTestProxy = async (chip: DisposableChip) => {
    setTestingProxy(chip.id);
    const result = await callEdge({ action: "monitor_proxy", chip_id: chip.id, include_qr_probe: true });
    setTestingProxy(null);

    if (result?.error) {
      toast.error(result.error);
      fetchChips();
      return;
    }

    toast.success(result?.proxy_status === "healthy"
      ? "Proxy validado com sucesso"
      : "Teste concluído com observações");
    fetchChips();
  };

  const handleDelete = async (chip: DisposableChip) => {
    if (!window.confirm(`Remover Chip #${chip.chip_index}? Esta ação é irreversível.`)) return;
    setDeleting(chip.id);
    // Stop polling first
    if (pollingRefs.current[chip.id]) {
      clearInterval(pollingRefs.current[chip.id]);
      delete pollingRefs.current[chip.id];
    }
    try {
      const result = await callEdge({ action: "delete", chip_id: chip.id });
      if (result?.error) {
        toast.error("Erro ao remover: " + result.error);
        // Even on error, try to refresh from DB to check current state
        await fetchChips();
        setDeleting(null);
        return;
      }
      toast.success("Chip removido com sucesso");
      // Remove from local state and also refresh from DB for consistency
      setChips(prev => prev.filter(c => c.id !== chip.id));
      // Refresh from DB after short delay to ensure consistency
      setTimeout(() => fetchChips(), 500);
    } catch (e: any) {
      console.error("Chip delete error:", e);
      toast.error("Falha ao remover chip. Tente novamente.");
      // Refresh state from DB
      await fetchChips();
    } finally {
      setDeleting(null);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "connected") return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">🟢 Conectado</Badge>;
    if (status === "connecting") return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">🟡 Aguardando QR</Badge>;
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">🔴 Desconectado</Badge>;
  };

  return (
    <Card className="border-amber-500/30">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-amber-500" />
            📱 Chips de Disparo
            {chips.length > 0 && <span className="text-sm text-muted-foreground font-normal">({chips.length}/5)</span>}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Chips adicionais para prospecção e disparo em massa. Seu WhatsApp pessoal já tem bot ativo após conectar abaixo.</p>
        </div>
        <Button size="sm" onClick={async () => { if (!collaboratorId) { toast.error("Colaborador não encontrado"); return; } setAdding(true); const result = await callEdge({ action: "create", collaborator_id: collaboratorId }); setAdding(false); if (result?.error) { toast.error("Erro: " + result.error); return; } toast.success("Chip #" + (result.chip?.chip_index || "") + " criado!"); fetchChips(); }} disabled={!collaboratorId || chips.length >= 5} className="gap-2">
          <Plus className="h-4 w-4" />
          + Novo Chip
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : chips.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <Smartphone className="h-10 w-10 text-muted-foreground mx-auto opacity-40" />
            <p className="text-muted-foreground text-sm">Nenhum chip cadastrado ainda</p>
            <p className="text-xs text-muted-foreground/60">Adicione até 5 chips por consultor para disparo antibloco</p>
          </div>
        ) : (
          <div className="space-y-3">
            {chips.map((chip, displayIdx) => (
              <div key={chip.id} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-semibold">Chip #{displayIdx + 1}</span>
                    {statusBadge(chip.status)}
                    {chip.phone && <span className="text-xs text-muted-foreground">{chip.phone}</span>}
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs"
                      onClick={() => handleTestProxy(chip)}
                      disabled={testingProxy === chip.id || connecting === chip.id}
                    >
                      {testingProxy === chip.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Activity className="h-3 w-3" />}
                      {testingProxy === chip.id ? "Testando..." : "Testar proxy"}
                    </Button>
                    {chip.status !== "connected" && (
                      <Badge
                        onClick={() => { if (!connecting) { handleConnect(chip); setActiveQrChipId(chip.id); } }}
                        className={`cursor-pointer gap-1 text-xs px-3 py-1 ${connecting === chip.id ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'}`}
                      >
                        {connecting === chip.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <QrCode className="h-3 w-3" />}
                        {connecting === chip.id ? "Aguardando..." : "QR Code"}
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs text-destructive hover:text-destructive"
                      onClick={() => handleDelete(chip)}
                      disabled={deleting === chip.id}
                    >
                      {deleting === chip.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>

                <ProxyEditor chip={chip} callEdge={callEdge} onUpdate={fetchChips} />
                <ProxyMonitorPanel chip={chip} />

                {activeQrChipId === chip.id && chip.qr_code && chip.status !== "connected" && (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <p className="text-xs text-amber-400">Escaneie com o WhatsApp</p>
                    <div className="bg-white p-3 rounded-xl shadow border">
                      <img
                        src={chip.qr_code.startsWith("data:") ? chip.qr_code : `data:image/png;base64,${chip.qr_code}`}
                        alt={`QR Chip #${displayIdx + 1}`}
                        width={200}
                        height={200}
                        className="rounded"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground animate-pulse">Aguardando conexão...</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Bot Training Section ──

function BotTrainingSection({ collaboratorId }: { collaboratorId: string | null }) {
  const [trainingText, setTrainingText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!collaboratorId) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("collaborators")
        .select("bot_training")
        .eq("id", collaboratorId)
        .maybeSingle();
      setTrainingText((data as any)?.bot_training || "");
      setLoading(false);
    })();
  }, [collaboratorId]);

  const handleSave = async () => {
    if (!collaboratorId) return;
    setSaving(true);
    const { error } = await supabase
      .from("collaborators")
      .update({ bot_training: trainingText } as any)
      .eq("id", collaboratorId);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success("Material de treino salvo!");
  };

  return (
    <Card className="border-blue-500/30">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-500" />
          Treinar meu Bot
        </CardTitle>
        <p className="text-xs text-muted-foreground">Cole aqui material da empresa para treinar seu bot (textos, scripts, FAQ, etc.)</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <Textarea
              value={trainingText}
              onChange={e => setTrainingText(e.target.value)}
              placeholder="Cole aqui o material de treinamento do seu bot..."
              className="min-h-[200px] bg-background border-border"
            />
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar Material
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── WhatsApp Conversations Section ──

interface WaBotConversation {
  id: string;
  collaborator_id: string;
  contact_name: string | null;
  contact_phone: string;
  history: Array<{ role: string; content: string }>;
  last_message_at: string | null;
  created_at: string | null;
}

function WhatsAppConversationsSection({ collaboratorId }: { collaboratorId: string | null }) {
  const [conversations, setConversations] = useState<WaBotConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<WaBotConversation | null>(null);

  useEffect(() => {
    if (!collaboratorId) { setConversations([]); setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("whatsapp_bot_conversations")
        .select("*")
        .eq("collaborator_id", collaboratorId)
        .order("last_message_at", { ascending: false });
      setConversations((data as WaBotConversation[]) || []);
      setLoading(false);
    })();
  }, [collaboratorId]);

  return (
    <>
      <Card className="border-green-500/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-500" />
            Conversas do WhatsApp
            {conversations.length > 0 && (
              <span className="text-sm text-muted-foreground font-normal">({conversations.length})</span>
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground">Histórico de conversas do bot com contatos</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <MessageCircle className="h-10 w-10 text-muted-foreground mx-auto opacity-40" />
              <p className="text-muted-foreground text-sm">Nenhuma conversa registrada ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className="w-full text-left border border-border rounded-lg p-3 hover:border-green-500/40 hover:bg-muted/30 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                      <MessageCircle className="h-4 w-4 text-green-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">
                        {conv.contact_name || conv.contact_phone}
                      </p>
                      {conv.contact_name && (
                        <p className="text-xs text-muted-foreground">{conv.contact_phone}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">
                      {conv.last_message_at
                        ? new Date(conv.last_message_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">{conv.history?.length || 0} msgs</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de conversa */}
      <Dialog open={!!selectedConversation} onOpenChange={open => !open && setSelectedConversation(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-500" />
              {selectedConversation?.contact_name || selectedConversation?.contact_phone}
            </DialogTitle>
            {selectedConversation?.contact_name && (
              <p className="text-xs text-muted-foreground">{selectedConversation.contact_phone}</p>
            )}
          </DialogHeader>
          <ScrollArea className="flex-1 max-h-[60vh] px-1">
            <div className="space-y-3 py-2">
              {(selectedConversation?.history || []).map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-muted text-foreground rounded-bl-md"
                        : "bg-primary text-primary-foreground rounded-br-md"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {(selectedConversation?.history || []).length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">Nenhuma mensagem</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Admin: All Collaborators Chips Overview (CEO/Diretor only) ──

interface CollabChipOverview {
  collaborator_id: string;
  collaborator_name: string;
  chips: DisposableChip[];
}

function AdminChipsOverview() {
  const [data, setData] = useState<CollabChipOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCollabs, setExpandedCollabs] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Fetch all disposable chips with collaborator names
      const { data: chips } = await supabase
        .from("disposable_chips")
        .select("*")
        .order("chip_index");

      const { data: collabs } = await supabase
        .from("collaborators")
        .select("id, name")
        .eq("active", true)
        .order("name");

      if (chips && collabs) {
        const collabMap = new Map(collabs.map((c: any) => [c.id, c.name]));
        const grouped = new Map<string, DisposableChip[]>();

        for (const chip of chips as DisposableChip[]) {
          const existing = grouped.get(chip.collaborator_id) || [];
          existing.push(chip);
          grouped.set(chip.collaborator_id, existing);
        }

        const result: CollabChipOverview[] = [];
        for (const [collabId, collabChips] of grouped.entries()) {
          result.push({
            collaborator_id: collabId,
            collaborator_name: collabMap.get(collabId) || "Desconhecido",
            chips: collabChips,
          });
        }
        result.sort((a, b) => a.collaborator_name.localeCompare(b.collaborator_name));
        setData(result);
      }
      setLoading(false);
    })();
  }, []);

  const toggleExpand = (collabId: string) => {
    setExpandedCollabs(prev => {
      const next = new Set(prev);
      if (next.has(collabId)) next.delete(collabId);
      else next.add(collabId);
      return next;
    });
  };

  const statusDot = (status: string) => {
    if (status === "connected") return "bg-emerald-500";
    if (status === "connecting") return "bg-amber-500";
    return "bg-red-500";
  };

  const totalChips = data.reduce((sum, d) => sum + d.chips.length, 0);
  const connectedChips = data.reduce((sum, d) => sum + d.chips.filter(c => c.status === "connected").length, 0);

  return (
    <Card className="border-purple-500/30">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5 text-purple-500" />
          Painel Geral — Todos os Chips
          <span className="text-sm text-muted-foreground font-normal ml-2">
            {connectedChips}/{totalChips} conectados | {data.length} colaboradores
          </span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">Visão administrativa de todos os chips descartáveis de todos os colaboradores</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : data.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">Nenhum chip cadastrado no sistema</p>
        ) : (
          <div className="space-y-2">
            {data.map(item => {
              const connected = item.chips.filter(c => c.status === "connected").length;
              const isExpanded = expandedCollabs.has(item.collaborator_id);
              return (
                <div key={item.collaborator_id} className="border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleExpand(item.collaborator_id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        {item.chips.map(c => (
                          <div key={c.id} className={`w-2.5 h-2.5 rounded-full ${statusDot(c.status)}`} />
                        ))}
                      </div>
                      <span className="font-medium text-sm">{item.collaborator_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {connected}/{item.chips.length} chips
                      </span>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {isExpanded && (
                    <div className="border-t border-border p-3 space-y-2 bg-muted/10">
                      {item.chips.map((chip, idx) => (
                        <div key={chip.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${statusDot(chip.status)}`} />
                            <span>Chip #{idx + 1}</span>
                          </div>
                          <span className="text-muted-foreground">{chip.phone || "Sem número"}</span>
                          <Badge variant="outline" className={`text-[10px] ${
                            chip.status === "connected" ? "text-emerald-400 border-emerald-500/30" :
                            chip.status === "connecting" ? "text-amber-400 border-amber-500/30" :
                            "text-red-400 border-red-500/30"
                          }`}>
                            {chip.status === "connected" ? "Conectado" : chip.status === "connecting" ? "Aguardando" : "Desconectado"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Blast Messages Section ──

function BlastMessagesSection({ collaboratorId }: { collaboratorId: string | null }) {
  const [messages, setMessages] = useState<string[]>(["", "", "", "", ""]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!collaboratorId) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;
        const resp = await fetch(`${EDGE_BASE}/blast-messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: "load", collaborator_id: collaboratorId }),
        });
        const result = await resp.json();
        if (result?.messages && Array.isArray(result.messages)) {
          const msgs = result.messages.slice(0, 5);
          while (msgs.length < 5) msgs.push("");
          setMessages(msgs);
        }
      } catch (e) {
        console.error("Erro ao carregar mensagens:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [collaboratorId]);

  const handleSave = async () => {
    if (!collaboratorId) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;
      const resp = await fetch(`${EDGE_BASE}/blast-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "save", collaborator_id: collaboratorId, messages }),
      });
      const result = await resp.json();
      if (result?.error) { toast.error("Erro: " + result.error); return; }
      toast.success("Mensagens salvas com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const updateMsg = (idx: number, value: string) => {
    setMessages(prev => prev.map((m, i) => i === idx ? value : m));
  };

  return (
    <Card className="border-blue-500/30">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-blue-500" />
          Mensagens de Disparo
        </CardTitle>
        <p className="text-xs text-muted-foreground">Configure até 5 variações de mensagem para o motor de disparo. Use {"{nome}"} para personalizar.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} className="space-y-1">
                <Label className="text-xs text-muted-foreground">Mensagem {i + 1} {i === 0 && <span className="text-primary">*</span>}</Label>
                <Textarea
                  value={msg}
                  onChange={e => updateMsg(i, e.target.value)}
                  placeholder={`Variação ${i + 1} da mensagem de prospecção...`}
                  className="min-h-[80px] bg-background border-border resize-y"
                />
              </div>
            ))}
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving || !messages[0]?.trim()} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar Mensagens
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Upload Contacts Section ──

function UploadContactsSection({ collaboratorId }: { collaboratorId: string | null }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [totalRows, setTotalRows] = useState(0);
  const [lastResult, setLastResult] = useState<{ imported: number; skipped: number } | null>(null);

  const downloadTemplate = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;
      const resp = await fetch(`${EDGE_BASE}/upload-contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "template" }),
      });
      const result = await resp.json();
      if (result?.csv) {
        const blob = new Blob([result.csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "modelo_contatos.csv";
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Modelo baixado!");
      }
    } catch (e: any) {
      toast.error("Erro ao baixar modelo: " + e.message);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLastResult(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as any[];
        setPreview(rows.slice(0, 5));
        setTotalRows(rows.length);
      },
      error: (err) => toast.error("Erro ao ler: " + err.message),
    });
  };

  const handleUpload = async () => {
    if (!collaboratorId || totalRows === 0) return;
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error("Selecione o arquivo novamente"); return; }
    setUploading(true);
    try {
      const text = await file.text();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;
      const resp = await fetch(`${EDGE_BASE}/upload-contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "upload", collaborator_id: collaboratorId, csv_data: text }),
      });
      const result = await resp.json();
      if (result?.error) { toast.error("Erro: " + result.error); return; }
      setLastResult({ imported: result.imported ?? 0, skipped: result.skipped ?? 0 });
      toast.success(`${result.imported ?? 0} contatos importados, ${result.skipped ?? 0} ignorados`);
      setPreview([]);
      setFileName("");
      setTotalRows(0);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="border-orange-500/30">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Upload className="h-5 w-5 text-orange-500" />
          Importar Contatos para Disparo
        </CardTitle>
        <p className="text-xs text-muted-foreground">Anexe uma planilha CSV com contatos de uma base externa para disparo em massa.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx" onChange={handleFile} className="hidden" />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading} variant="outline" className="gap-2">
            <Upload className="h-4 w-4" /> Selecionar Planilha
          </Button>
          <Button onClick={downloadTemplate} variant="ghost" className="gap-2 text-xs">
            📄 Baixar Modelo CSV
          </Button>
          {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
        </div>

        {preview.length > 0 && (
          <>
            <div className="border rounded-lg overflow-hidden border-border">
              <p className="text-xs text-muted-foreground p-2 bg-muted/30">
                Prévia — {totalRows.toLocaleString("pt-BR")} linhas
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      {Object.keys(preview[0]).slice(0, 6).map(k => (
                        <th key={k} className="px-3 py-2 text-left font-medium text-muted-foreground">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-b border-border/50">
                        {Object.values(row).slice(0, 6).map((v, j) => (
                          <td key={j} className="px-3 py-1.5 text-foreground">{String(v || "—")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <Button onClick={handleUpload} disabled={uploading} className="gap-2">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {uploading ? "Enviando..." : `Importar ${totalRows.toLocaleString("pt-BR")} contatos`}
            </Button>
          </>
        )}

        {lastResult && (
          <div className="flex gap-4 text-sm">
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              ✅ {lastResult.imported} importados
            </Badge>
            {lastResult.skipped > 0 && (
              <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                ⚠️ {lastResult.skipped} ignorados
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Bots() {
  const { collaborator, roleLevel } = useCollaborator();
  const { user } = useAuth();

  // ── WhatsApp states ──
  type WaStatus = "loading" | "disconnected" | "connecting" | "connected" | "no_instance";
  const [waInstanceStatus, setWaInstanceStatus] = useState<WaStatus>("loading");
  const [waQrCode, setWaQrCode] = useState<string | null>(null);
  const [waPhone, setWaPhone] = useState<string | null>(null);
  const [waProfileName, setWaProfileName] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [bots, setBots] = useState<BotInstance[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [keySearch, setKeySearch] = useState("");

  // Bot modal
  const [botModalOpen, setBotModalOpen] = useState(false);
  const [editingBot, setEditingBot] = useState<BotInstance | null>(null);
  const [botForm, setBotForm] = useState(defaultBotForm);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [savingBot, setSavingBot] = useState(false);

  // Key modal
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKeyPool | null>(null);
  const [keyForm, setKeyForm] = useState(defaultKeyForm);
  const [showKeyValue, setShowKeyValue] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [botsRes, compRes, collabRes, agentsRes, keysRes] = await Promise.all([
      supabase.from("bot_instances").select("*").order("name"),
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("collaborators").select("id, name, company_id").eq("active", true).order("name"),
      supabase.from("agent_definitions").select("id, name, company_id").eq("active", true).order("name"),
      supabase.from("api_key_pool").select("*").order("name"),
    ]);
    setBots(botsRes.data || []);
    setCompanies(compRes.data || []);
    setCollaborators(collabRes.data || []);
    setAgents(agentsRes.data || []);
    setApiKeys(keysRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── WhatsApp: helpers ──
  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }, []);

  const fetchQrCode = useCallback(async (collabId: string) => {
    setWaInstanceStatus("connecting");
    try {
      const { data } = await supabase.functions.invoke("create-whatsapp-instance", {
        body: { action: "qrcode", collaborator_id: collabId },
      });
      if (data?.qr_code) {
        setWaQrCode(data.qr_code);
      } else {
        toast.error("Não foi possível gerar QR code");
      }
    } catch { toast.error("Erro ao gerar QR code"); }
  }, []);

  const startPolling = useCallback((collabId: string) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke("create-whatsapp-instance", {
          body: { action: "status", collaborator_id: collabId },
        });
        if (data?.connected) {
          setWaInstanceStatus("connected");
          setWaQrCode(null);
          setWaPhone(data.phone || null);
          setWaProfileName(data.profile_name || null);
          stopPolling();
          toast.success("WhatsApp conectado!");
        }
      } catch {}
    }, 5000);
  }, [stopPolling]);

  // ── WhatsApp: mount check ──
  useEffect(() => {
    if (!collaborator?.id) { setWaInstanceStatus("loading"); return; }
    const collabId = collaborator.id;
    (async () => {
      setWaInstanceStatus("loading");
      try {
        const { data, error } = await supabase.functions.invoke("create-whatsapp-instance", {
          body: { action: "status", collaborator_id: collabId },
        });
        if (error || data?.error) { setWaInstanceStatus("no_instance"); return; }
        if (data?.connected) {
          setWaInstanceStatus("connected");
          setWaPhone(data.phone || null);
          setWaProfileName(data.profile_name || null);
        } else if (data?.has_instance) {
          // Has instance but disconnected → auto fetch QR
          await fetchQrCode(collabId);
          startPolling(collabId);
        } else {
          setWaInstanceStatus("no_instance");
        }
      } catch { setWaInstanceStatus("no_instance"); }
    })();
    return () => stopPolling();
  }, [collaborator?.id, fetchQrCode, startPolling, stopPolling]);

  // ── WhatsApp: start polling when connecting ──
  useEffect(() => {
    if (waInstanceStatus === "connecting" && waQrCode && collaborator?.id) {
      startPolling(collaborator.id);
    }
  }, [waInstanceStatus, waQrCode, collaborator?.id, startPolling]);

  const handleConnectWa = async () => {
    if (!collaborator?.id) { toast.error("Colaborador não encontrado"); return; }
    setWaInstanceStatus("connecting");
    try {
      const { data, error } = await supabase.functions.invoke("create-whatsapp-instance", {
        body: { collaborator_id: collaborator.id },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Erro ao criar instância");
        setWaInstanceStatus("no_instance");
      } else if (data?.connected) {
        setWaInstanceStatus("connected");
        setWaPhone(data.phone || null);
        toast.success("WhatsApp conectado!");
      } else if (data?.qr_code) {
        setWaQrCode(data.qr_code);
        startPolling(collaborator.id);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro de conexão");
      setWaInstanceStatus("no_instance");
    }
  };

  const handleRefreshQr = async () => {
    if (!collaborator?.id) return;
    await fetchQrCode(collaborator.id);
  };

  // ── Bot helpers ──

  const openNewBot = () => {
    setEditingBot(null);
    setBotForm(defaultBotForm);
    setSelectedAgentIds([]);
    setBotModalOpen(true);
  };

  const openEditBot = (bot: BotInstance) => {
    setEditingBot(bot);
    setBotForm({
      name: bot.name || "",
      collaborator_id: bot.collaborator_id || "",
      company_id: bot.company_id || "",
      bot_type: bot.bot_type || "whatsapp",
      api_key_id: bot.api_key_id || "",
      uazapi_instance_id: bot.uazapi_instance_id || "",
      uazapi_token: bot.uazapi_token || "",
      whatsapp_number: bot.whatsapp_number || "",
      max_msgs_per_day: bot.max_msgs_per_day ?? 200,
      msg_interval_min: bot.msg_interval_min ?? 5,
      msg_interval_max: bot.msg_interval_max ?? 15,
      active_hours_start: bot.active_hours_start || "08:00",
      active_hours_end: bot.active_hours_end || "18:00",
    });
    setSelectedAgentIds(bot.agent_ids || []);
    setBotModalOpen(true);
  };

  const handleSaveBot = async () => {
    if (!botForm.name.trim()) { toast.error("Nome é obrigatório"); return; }
    setSavingBot(true);
    const payload: any = {
      name: botForm.name.trim(),
      collaborator_id: collaborator?.id || null,
      company_id: collaborator?.company_id || null,
      bot_type: botForm.bot_type,
      api_key_id: botForm.api_key_id || null,
      uazapi_instance_id: botForm.uazapi_instance_id || null,
      uazapi_token: botForm.uazapi_token || null,
      whatsapp_number: botForm.whatsapp_number || null,
      agent_ids: null,
      max_msgs_per_day: botForm.max_msgs_per_day,
      msg_interval_min: botForm.msg_interval_min,
      msg_interval_max: botForm.msg_interval_max,
      active_hours_start: botForm.active_hours_start,
      active_hours_end: botForm.active_hours_end,
    };
    let error;
    if (editingBot) {
      ({ error } = await supabase.from("bot_instances").update(payload).eq("id", editingBot.id));
    } else {
      ({ error } = await supabase.from("bot_instances").insert(payload));
    }
    setSavingBot(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success(editingBot ? "Bot atualizado!" : "Bot criado!");
    setBotModalOpen(false);
    fetchData();
  };

  const toggleBotActive = async (bot: BotInstance) => {
    const { error } = await supabase.from("bot_instances").update({ active: !bot.active }).eq("id", bot.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success(bot.active ? "Bot desativado" : "Bot ativado");
    fetchData();
  };

  const toggleAgentId = (id: string) => {
    setSelectedAgentIds(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  // ── API Key helpers ──

  const openNewKey = () => {
    setEditingKey(null);
    setKeyForm(defaultKeyForm);
    setShowKeyValue(false);
    setKeyModalOpen(true);
  };

  const openEditKey = (k: ApiKeyPool) => {
    setEditingKey(k);
    setKeyForm({
      name: k.name || "",
      provider: k.provider || "anthropic",
      api_key: k.api_key || "",
      max_bots: k.max_bots ?? 30,
      max_requests_per_min: k.max_requests_per_min ?? 60,
    });
    setShowKeyValue(false);
    setKeyModalOpen(true);
  };

  const handleSaveKey = async () => {
    if (!keyForm.name.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!keyForm.api_key.trim()) { toast.error("API Key é obrigatória"); return; }
    setSavingKey(true);
    const payload: any = {
      name: keyForm.name.trim(),
      provider: keyForm.provider,
      api_key: keyForm.api_key.trim(),
      max_bots: keyForm.max_bots,
      max_requests_per_min: keyForm.max_requests_per_min,
    };
    let error;
    if (editingKey) {
      ({ error } = await supabase.from("api_key_pool").update(payload).eq("id", editingKey.id));
    } else {
      ({ error } = await supabase.from("api_key_pool").insert(payload));
    }
    setSavingKey(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success(editingKey ? "API Key atualizada!" : "API Key criada!");
    setKeyModalOpen(false);
    fetchData();
  };

  const toggleKeyActive = async (k: ApiKeyPool) => {
    const { error } = await supabase.from("api_key_pool").update({ active: !k.active }).eq("id", k.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success(k.active ? "Key desativada" : "Key ativada");
    fetchData();
  };

  const deleteKey = async (k: ApiKeyPool) => {
    const linkedBots = bots.filter(b => b.api_key_id === k.id).length;
    if (linkedBots > 0) { toast.error(`Não é possível excluir: ${linkedBots} bot(s) vinculado(s)`); return; }
    const { error } = await supabase.from("api_key_pool").delete().eq("id", k.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("API Key excluída");
    fetchData();
  };

  // ── Lookups ──

  const getCompanyName = (id: string | null) => companies.find(c => c.id === id)?.name || "—";
  const getCollaboratorName = (id: string | null) => collaborators.find(c => c.id === id)?.name || "—";
  const getBotTypeLabel = (t: string) => BOT_TYPES.find(b => b.value === t)?.label || t;
  const getProviderLabel = (p: string) => PROVIDERS.find(pr => pr.value === p)?.label || p;
  const getBotsUsingKey = (keyId: string) => bots.filter(b => b.api_key_id === keyId).length;

  const filteredBots = bots.filter(b => b.name?.toLowerCase().includes(search.toLowerCase()));
  const filteredKeys = apiKeys.filter(k => k.name?.toLowerCase().includes(keySearch.toLowerCase()));
  const filteredAgents = agents.filter(a => a.company_id === botForm.company_id);
  const filteredCollaborators = collaborators.filter(c => !botForm.company_id || c.company_id === botForm.company_id);
  const anthropicKeys = apiKeys.filter(k => k.provider === "anthropic" && k.active);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title={roleLevel >= 2 ? "Meu WhatsApp & Chips" : "Gerenciamento de Bots"}
          subtitle="Conecte seu WhatsApp e gerencie chips de disparo"
        />

        {roleLevel <= 1 && (
        <Tabs defaultValue="bots" className="w-full">
          <TabsList className="bg-[#111118] border border-[#1E1E2E]">
            <TabsTrigger value="bots" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Bot className="h-4 w-4" /> Chips de Disparo
            </TabsTrigger>
            {roleLevel === 0 && (
            <TabsTrigger value="apikeys" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Key className="h-4 w-4" /> API Keys
            </TabsTrigger>
            )}
          </TabsList>

          {/* ════════════════════ ABA BOTS ════════════════════ */}
          <TabsContent value="bots" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar bot..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-[#111118] border-[#1E1E2E]" />
              </div>
              <Button onClick={openNewBot} className="gap-2 bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4" /> Chip de Disparo
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : filteredBots.length === 0 ? (
              <Card className="bg-[#111118] border-[#1E1E2E]">
                <CardContent className="py-12 text-center space-y-3">
                  <Bot className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="text-muted-foreground">Nenhum bot encontrado.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredBots.map(bot => (
                  <Card key={bot.id} className="bg-[#111118] border-[#1E1E2E] hover:border-primary/30 transition-colors">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Bot className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{bot.name}</h3>
                            <p className="text-xs text-muted-foreground">{getCompanyName(bot.company_id)}</p>
                          </div>
                        </div>
                        <Badge variant={bot.active ? "default" : "secondary"} className={bot.active ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : ""}>
                          {bot.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-muted-foreground">Colaborador:</span><p className="text-foreground truncate">{getCollaboratorName(bot.collaborator_id)}</p></div>
                        <div><span className="text-muted-foreground">Tipo:</span><p className="text-foreground">{getBotTypeLabel(bot.bot_type)}</p></div>
                        <div><span className="text-muted-foreground">WhatsApp:</span><p className="text-foreground">{bot.whatsapp_number || "—"}</p></div>
                        <div>
                          <span className="text-muted-foreground">Status WA:</span>
                          <Badge variant="outline" className={bot.whatsapp_status === "connected" ? "text-emerald-400 border-emerald-500/30" : "text-amber-400 border-amber-500/30"}>
                            {bot.whatsapp_status === "connected" ? "Online" : "Offline"}
                          </Badge>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Último acesso:</span>
                          <p className="text-foreground">{bot.last_seen_at ? new Date(bot.last_seen_at).toLocaleString("pt-BR") : "Nunca"}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-[#1E1E2E]">
                        <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs" onClick={() => openEditBot(bot)}><Pencil className="h-3 w-3" /> Editar</Button>
                        <Button size="sm" variant="outline" className={`flex-1 gap-1 text-xs ${bot.active ? "text-amber-400 hover:text-amber-300" : "text-emerald-400 hover:text-emerald-300"}`} onClick={() => toggleBotActive(bot)}>
                          <Power className="h-3 w-3" /> {bot.active ? "Desativar" : "Ativar"}
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => toast.info("QR Code em breve!")}><QrCode className="h-3 w-3" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ════════════════════ ABA API KEYS ════════════════════ */}
          {roleLevel === 0 && (
          <TabsContent value="apikeys" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar API key..." value={keySearch} onChange={e => setKeySearch(e.target.value)} className="pl-10 bg-[#111118] border-[#1E1E2E]" />
              </div>
              <Button onClick={openNewKey} className="gap-2 bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4" /> Nova API Key
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : filteredKeys.length === 0 ? (
              <Card className="bg-[#111118] border-[#1E1E2E]">
                <CardContent className="py-12 text-center space-y-3">
                  <Key className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="text-muted-foreground">Nenhuma API key cadastrada.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredKeys.map(k => {
                  const usedBots = getBotsUsingKey(k.id);
                  return (
                    <Card key={k.id} className="bg-[#111118] border-[#1E1E2E] hover:border-primary/30 transition-colors">
                      <CardContent className="p-5 space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Key className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-foreground">{k.name}</h3>
                              <p className="text-xs text-muted-foreground">{getProviderLabel(k.provider)}</p>
                            </div>
                          </div>
                          <Badge variant={k.active ? "default" : "secondary"} className={k.active ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : ""}>
                            {k.active ? "Ativa" : "Inativa"}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Key:</span>
                            <p className="text-foreground font-mono text-xs">{maskKey(k.api_key)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Bots vinculados:</span>
                            <p className="text-foreground">{usedBots}/{k.max_bots ?? "∞"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Req/min:</span>
                            <p className="text-foreground">{k.max_requests_per_min ?? "—"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Último uso:</span>
                            <p className="text-foreground">{k.last_used_at ? new Date(k.last_used_at).toLocaleString("pt-BR") : "Nunca"}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2 border-t border-[#1E1E2E]">
                          <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs" onClick={() => openEditKey(k)}>
                            <Pencil className="h-3 w-3" /> Editar
                          </Button>
                          <Button size="sm" variant="outline" className={`flex-1 gap-1 text-xs ${k.active ? "text-amber-400 hover:text-amber-300" : "text-emerald-400 hover:text-emerald-300"}`} onClick={() => toggleKeyActive(k)}>
                            <Power className="h-3 w-3" /> {k.active ? "Desativar" : "Ativar"}
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1 text-xs text-destructive hover:text-destructive" onClick={() => deleteKey(k)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
          )}
        </Tabs>
        )}

        {/* ════════════════════ PAINEL ADMIN — TODOS OS CHIPS ════════════════════ */}
        {roleLevel === 0 && <AdminChipsOverview />}

        {/* ════════════════════ MEU WHATSAPP ════════════════════ */}
        <Card className="border-emerald-500/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-emerald-500" />
              Meu WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent>
            {waInstanceStatus === "loading" ? (
              <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : waInstanceStatus === "connected" ? (
              <div className="flex items-center gap-4 py-4">
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-sm px-3 py-1">🟢 Conectado</Badge>
                <div>
                  {waProfileName && <span className="text-foreground font-medium">{waProfileName}</span>}
                  {waPhone && <span className="text-muted-foreground text-sm ml-2">{waPhone}</span>}
                </div>
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive gap-2" onClick={async () => {
                  if (!window.confirm("Desconectar WhatsApp principal?")) return;
                  try {
                    const { data: instances } = await supabase
                      .from("bot_instances")
                      .select("id, uazapi_token")
                      .eq("collaborator_id", collaborator?.id)
                      .eq("bot_type", "whatsapp")
                      .limit(1);
                    const inst = instances?.[0];
                    if (inst) {
                      await supabase.from("bot_instances").update({
                        whatsapp_status: "disconnected",
                        uazapi_instance_id: null,
                        uazapi_token: null,
                        whatsapp_number: null
                      }).eq("id", inst.id);
                    }
                    toast.success("WhatsApp desconectado");
                    window.location.reload();
                  } catch(e) {
                    toast.error("Erro ao desconectar");
                  }
                }}>
                  <Power className="h-4 w-4" /> Desconectar
                </Button>
              </div>
            ) : (waInstanceStatus === "connecting" && waQrCode) ? (
              <div className="flex flex-col items-center gap-5 py-6">
                <div className="bg-white p-4 rounded-2xl shadow-lg border-2 border-emerald-500/20">
                  <img src={waQrCode} alt="QR Code WhatsApp" width={220} height={220} className="rounded-lg" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-foreground">Escaneie com WhatsApp Business</p>
                  <p className="text-xs text-muted-foreground">Configurações &gt; Aparelhos conectados &gt; Conectar aparelho</p>
                </div>
                <Button size="sm" variant="outline" onClick={handleRefreshQr} className="gap-2">
                  <RefreshCw className="h-4 w-4" /> Atualizar QR
                </Button>
              </div>
            ) : waInstanceStatus === "connecting" ? (
              <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="text-center py-8 space-y-3">
                <Smartphone className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground text-sm">Nenhuma instância WhatsApp vinculada</p>
                <Button onClick={handleConnectWa} className="gap-2">
                  <QrCode className="h-4 w-4" /> Conectar WhatsApp
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ════════════════════ CHIPS DESCARTÁVEIS ════════════════════ */}
        <DisposableChipsSection collaboratorId={collaborator?.id || null} />

        {/* ════════════════════ MENSAGENS DE DISPARO ════════════════════ */}
        <BlastMessagesSection collaboratorId={collaborator?.id || null} />

        {/* ════════════════════ UPLOAD DE CONTATOS ════════════════════ */}
        <UploadContactsSection collaboratorId={collaborator?.id || null} />

        {/* ════════════════════ TREINAR MEU BOT ════════════════════ */}
        <BotTrainingSection collaboratorId={collaborator?.id || null} />

        {/* ════════════════════ CONVERSAS DO WHATSAPP ════════════════════ */}
        <WhatsAppConversationsSection collaboratorId={collaborator?.id || null} />
      </div>
      {/* ════════════════════ MODAL BOT ════════════════════ */}
      <Dialog open={botModalOpen} onOpenChange={setBotModalOpen}>
        <DialogContent className="bg-[#111118] border-[#1E1E2E] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBot ? "Editar Bot" : "+ Chip de Disparo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Bot *</Label>
              <Input value={botForm.name} onChange={e => setBotForm({ ...botForm, name: e.target.value })} className="bg-[#0a0a0f] border-[#1E1E2E]" />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={botForm.bot_type} onValueChange={v => setBotForm({ ...botForm, bot_type: v })}>
                <SelectTrigger className="bg-[#0a0a0f] border-[#1E1E2E]"><SelectValue /></SelectTrigger>
                <SelectContent>{BOT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {roleLevel === 0 && (
            <>
            {/* API Key Anthropic - agora select do pool */}
            <div>
              <Label>API Key Anthropic</Label>
              <Select value={botForm.api_key_id} onValueChange={v => setBotForm({ ...botForm, api_key_id: v })}>
                <SelectTrigger className="bg-[#0a0a0f] border-[#1E1E2E]"><SelectValue placeholder="Selecione uma API key" /></SelectTrigger>
                <SelectContent>
                  {anthropicKeys.map(k => {
                    const used = getBotsUsingKey(k.id);
                    return (
                      <SelectItem key={k.id} value={k.id}>
                        {k.name} — {used}/{k.max_bots ?? "∞"} bots
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Cadastre keys na aba "API Keys"</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                ℹ️ Instância e token UAZAPI são configurados automaticamente pelo servidor <strong>trilhoassist</strong>. 
                Para chips descartáveis, use a aba "Chips Descartáveis" em Meu WhatsApp.
              </p>
            </div>
            </>
            )}
            <div>
              <Label>Número WhatsApp</Label>
              <Input value={botForm.whatsapp_number} onChange={e => setBotForm({ ...botForm, whatsapp_number: e.target.value })} className="bg-[#0a0a0f] border-[#1E1E2E]" placeholder="+55..." />
            </div>


            <div className="border border-[#1E1E2E] rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Configuração Anti-Ban</h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Msgs/dia</Label>
                  <Input type="number" value={botForm.max_msgs_per_day} onChange={e => setBotForm({ ...botForm, max_msgs_per_day: +e.target.value })} className="bg-[#0a0a0f] border-[#1E1E2E]" />
                </div>
                <div>
                  <Label className="text-xs">Intervalo min (s)</Label>
                  <Input type="number" value={botForm.msg_interval_min} onChange={e => setBotForm({ ...botForm, msg_interval_min: +e.target.value })} className="bg-[#0a0a0f] border-[#1E1E2E]" />
                </div>
                <div>
                  <Label className="text-xs">Intervalo max (s)</Label>
                  <Input type="number" value={botForm.msg_interval_max} onChange={e => setBotForm({ ...botForm, msg_interval_max: +e.target.value })} className="bg-[#0a0a0f] border-[#1E1E2E]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Horário início</Label>
                  <Input type="time" value={botForm.active_hours_start} onChange={e => setBotForm({ ...botForm, active_hours_start: e.target.value })} className="bg-[#0a0a0f] border-[#1E1E2E]" />
                </div>
                <div>
                  <Label className="text-xs">Horário fim</Label>
                  <Input type="time" value={botForm.active_hours_end} onChange={e => setBotForm({ ...botForm, active_hours_end: e.target.value })} className="bg-[#0a0a0f] border-[#1E1E2E]" />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBotModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveBot} disabled={savingBot} className="gap-2">
              {savingBot && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingBot ? "Salvar" : "Criar Bot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════ MODAL API KEY ════════════════════ */}
      <Dialog open={keyModalOpen} onOpenChange={setKeyModalOpen}>
        <DialogContent className="bg-[#111118] border-[#1E1E2E] max-w-md">
          <DialogHeader>
            <DialogTitle>{editingKey ? "Editar API Key" : "Nova API Key"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={keyForm.name} onChange={e => setKeyForm({ ...keyForm, name: e.target.value })} className="bg-[#0a0a0f] border-[#1E1E2E]" placeholder="Ex: Anthropic Key 1" />
            </div>
            <div>
              <Label>Provider *</Label>
              <Select value={keyForm.provider} onValueChange={v => setKeyForm({ ...keyForm, provider: v })}>
                <SelectTrigger className="bg-[#0a0a0f] border-[#1E1E2E]"><SelectValue /></SelectTrigger>
                <SelectContent>{PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>API Key *</Label>
              <div className="relative">
                <Input
                  type={showKeyValue ? "text" : "password"}
                  value={keyForm.api_key}
                  onChange={e => setKeyForm({ ...keyForm, api_key: e.target.value })}
                  className="bg-[#0a0a0f] border-[#1E1E2E] pr-10"
                  placeholder="Cole a API key aqui..."
                />
                <Button type="button" variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0" onClick={() => setShowKeyValue(!showKeyValue)}>
                  {showKeyValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Limite máx. de bots</Label>
                <Input type="number" value={keyForm.max_bots} onChange={e => setKeyForm({ ...keyForm, max_bots: +e.target.value })} className="bg-[#0a0a0f] border-[#1E1E2E]" />
              </div>
              <div>
                <Label>Requests/min</Label>
                <Input type="number" value={keyForm.max_requests_per_min} onChange={e => setKeyForm({ ...keyForm, max_requests_per_min: +e.target.value })} className="bg-[#0a0a0f] border-[#1E1E2E]" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKeyModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveKey} disabled={savingKey} className="gap-2">
              {savingKey && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingKey ? "Salvar" : "Criar Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
