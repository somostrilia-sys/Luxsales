import { useState, useEffect, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Search, Bot, Pencil, Power, QrCode, Eye, EyeOff, Loader2, Key, Trash2, Smartphone, RefreshCw } from "lucide-react";

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

// ── Disposable Chips Section ──

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
}

const EDGE_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

function DisposableChipsSection({ collaboratorId }: { collaboratorId: string | null }) {
  const [chips, setChips] = useState<DisposableChip[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null); // chip_id being connected
  const [deleting, setDeleting] = useState<string | null>(null);
  const pollingRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // Form para novo chip (servidor + token)
  const [showAddForm, setShowAddForm] = useState(false);
  const [newServerUrl, setNewServerUrl] = useState("https://walkholding.uazapi.com");
  const [newAdminToken, setNewAdminToken] = useState("");

  const fetchChips = useCallback(async () => {
    if (!collaboratorId) { setChips([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("disposable_chips")
      .select("*")
      .eq("collaborator_id", collaboratorId)
      .order("chip_index");
    setChips((data as DisposableChip[]) || []);
    setLoading(false);
  }, [collaboratorId]);

  useEffect(() => { fetchChips(); return () => { Object.values(pollingRefs.current).forEach(clearInterval); }; }, [fetchChips]);

  const callEdge = async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;
    const resp = await fetch(`${EDGE_BASE}/manage-disposable-chip`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return resp.json();
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
        toast.success("Chip conectado com sucesso!");
      }
    }, 5000);
  }, []);

  const addChip = async () => {
    if (!collaboratorId || !newAdminToken.trim()) { toast.error("Admin Token é obrigatório"); return; }
    setAdding(true);
    const result = await callEdge({
      action: "create",
      collaborator_id: collaboratorId,
      uazapi_server_url: newServerUrl.trim(),
      uazapi_admin_token: newAdminToken.trim(),
    });
    setAdding(false);
    if (result?.error) { toast.error("Erro: " + result.error); return; }
    toast.success(`Chip #${result.chip?.chip_index} criado no UAZAPI!`);
    setShowAddForm(false);
    setNewAdminToken("");
    fetchChips();
  };

  const updateField = async (chipId: string, field: string, value: string) => {
    await supabase.from("disposable_chips").update({ [field]: value, updated_at: new Date().toISOString() } as any).eq("id", chipId);
    setChips(prev => prev.map(c => c.id === chipId ? { ...c, [field]: value } : c));
  };

  const handleConnect = async (chip: DisposableChip) => {
    setConnecting(chip.id);
    // Se não tem instância, a Edge Function vai criar automaticamente
    const result = await callEdge({ action: "connect", chip_id: chip.id });
    if (result?.error) { toast.error("Erro ao conectar: " + result.error); setConnecting(null); return; }
    const qrCode = result?.qr_code;
    setChips(prev => prev.map(c => c.id === chip.id ? { ...c, status: "connecting", qr_code: qrCode || c.qr_code } : c));
    toast.info("Escaneie o QR code no WhatsApp");
    startStatusPolling(chip.id);
  };

  const handleDelete = async (chip: DisposableChip) => {
    setDeleting(chip.id);
    const result = await callEdge({ action: "delete", chip_id: chip.id });
    setDeleting(null);
    if (result?.error) { toast.error("Erro: " + result.error); return; }
    toast.success("Chip removido");
    if (pollingRefs.current[chip.id]) { clearInterval(pollingRefs.current[chip.id]); delete pollingRefs.current[chip.id]; }
    fetchChips();
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
            Chips Descartáveis
            {chips.length > 0 && <span className="text-sm text-muted-foreground font-normal">({chips.length}/5)</span>}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Números para disparo em massa — antibloco por rodízio</p>
        </div>
        <Button size="sm" onClick={() => setShowAddForm(v => !v)} disabled={!collaboratorId || chips.length >= 5} className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Chip
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Formulário de novo chip */}
        {showAddForm && (
          <div className="border border-amber-500/30 rounded-lg p-4 space-y-3 bg-amber-500/5">
            <p className="text-sm font-medium text-amber-400">Novo Chip Descartável</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">URL Servidor UAZAPI</Label>
                <Input
                  value={newServerUrl}
                  onChange={e => setNewServerUrl(e.target.value)}
                  placeholder="https://meuservidor.uazapi.com"
                  className="bg-background border-border text-sm mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Admin Token UAZAPI *</Label>
                <Input
                  value={newAdminToken}
                  onChange={e => setNewAdminToken(e.target.value)}
                  placeholder="Token administrativo..."
                  className="bg-background border-border text-sm mt-1"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { setShowAddForm(false); setNewAdminToken(""); }}>Cancelar</Button>
              <Button size="sm" onClick={addChip} disabled={adding} className="gap-2">
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {adding ? "Criando..." : "Criar Chip"}
              </Button>
            </div>
          </div>
        )}

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
            {chips.map(chip => (
              <div key={chip.id} className="border border-border rounded-lg p-4 space-y-3">
                {/* Header do chip */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">Chip #{chip.chip_index}</span>
                    {statusBadge(chip.status)}
                    {chip.phone && <span className="text-xs text-muted-foreground">{chip.phone}</span>}
                  </div>
                  <div className="flex gap-2">
                    {chip.status !== "connected" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleConnect(chip)}
                        disabled={connecting === chip.id}
                        className="gap-1 text-xs"
                      >
                        {connecting === chip.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <QrCode className="h-3 w-3" />}
                        {connecting === chip.id ? "Aguardando..." : "Conectar"}
                      </Button>
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

                {/* QR Code */}
                {chip.qr_code && chip.status !== "connected" && (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <p className="text-xs text-amber-400">Escaneie com o WhatsApp</p>
                    <div className="bg-white p-3 rounded-xl shadow border">
                      <img
                        src={chip.qr_code.startsWith("data:") ? chip.qr_code : `data:image/png;base64,${chip.qr_code}`}
                        alt={`QR Chip #${chip.chip_index}`}
                        width={200}
                        height={200}
                        className="rounded"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground animate-pulse">Aguardando conexão...</p>
                  </div>
                )}

                {/* Instância info */}
                {chip.instance_name && (
                  <p className="text-xs text-muted-foreground">Instância: {chip.instance_name}</p>
                )}

                {/* Campos editáveis de servidor */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <Label className="text-xs text-muted-foreground">Servidor UAZAPI</Label>
                    <Input
                      value={chip.uazapi_server_url || ""}
                      onChange={e => setChips(prev => prev.map(c => c.id === chip.id ? { ...c, uazapi_server_url: e.target.value } : c))}
                      onBlur={e => updateField(chip.id, "uazapi_server_url", e.target.value)}
                      className="bg-background border-border text-xs mt-1 h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Admin Token</Label>
                    <Input
                      type="password"
                      value={chip.uazapi_admin_token || ""}
                      onChange={e => setChips(prev => prev.map(c => c.id === chip.id ? { ...c, uazapi_admin_token: e.target.value } : c))}
                      onBlur={e => updateField(chip.id, "uazapi_admin_token", e.target.value)}
                      className="bg-background border-border text-xs mt-1 h-8"
                    />
                  </div>
                </div>
              </div>
            ))}
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
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gerenciamento de Bots</h1>
          <p className="text-sm text-muted-foreground">Cadastre e gerencie bots e API keys do sistema</p>
        </div>

        <Tabs defaultValue="bots" className="w-full">
          <TabsList className="bg-[#111118] border border-[#1E1E2E]">
            <TabsTrigger value="bots" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Bot className="h-4 w-4" /> Bots
            </TabsTrigger>
            {roleLevel <= 1 && (
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
                <Plus className="h-4 w-4" /> Novo Bot
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
          {roleLevel <= 1 && (
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
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive gap-2" onClick={() => toast.info("Desconectar em breve")}>
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
      </div>

      {/* ════════════════════ MODAL BOT ════════════════════ */}
      <Dialog open={botModalOpen} onOpenChange={setBotModalOpen}>
        <DialogContent className="bg-[#111118] border-[#1E1E2E] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBot ? "Editar Bot" : "Novo Bot"}</DialogTitle>
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
