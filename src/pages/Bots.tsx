import { useState, useEffect, useCallback } from "react";
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
import { toast } from "sonner";
import { Plus, Search, Bot, Pencil, Power, QrCode, Eye, EyeOff, Loader2, Key, Trash2, Smartphone } from "lucide-react";

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

export default function Bots() {
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
    if (!botForm.company_id) { toast.error("Selecione uma empresa"); return; }
    setSavingBot(true);
    const payload: any = {
      name: botForm.name.trim(),
      collaborator_id: botForm.collaborator_id || null,
      company_id: botForm.company_id,
      bot_type: botForm.bot_type,
      api_key_id: botForm.api_key_id || null,
      uazapi_instance_id: botForm.uazapi_instance_id || null,
      uazapi_token: botForm.uazapi_token || null,
      whatsapp_number: botForm.whatsapp_number || null,
      agent_ids: selectedAgentIds.length > 0 ? selectedAgentIds : null,
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
            <TabsTrigger value="apikeys" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Key className="h-4 w-4" /> API Keys
            </TabsTrigger>
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
        </Tabs>
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
              <Label>Empresa *</Label>
              <Select value={botForm.company_id} onValueChange={v => { setBotForm({ ...botForm, company_id: v, collaborator_id: "" }); setSelectedAgentIds([]); }}>
                <SelectTrigger className="bg-[#0a0a0f] border-[#1E1E2E]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Colaborador vinculado</Label>
              <Select value={botForm.collaborator_id} onValueChange={v => setBotForm({ ...botForm, collaborator_id: v })}>
                <SelectTrigger className="bg-[#0a0a0f] border-[#1E1E2E]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{filteredCollaborators.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>ID Instância UAZAPI</Label>
                <Input value={botForm.uazapi_instance_id} onChange={e => setBotForm({ ...botForm, uazapi_instance_id: e.target.value })} className="bg-[#0a0a0f] border-[#1E1E2E]" />
              </div>
              <div>
                <Label>Token UAZAPI</Label>
                <Input value={botForm.uazapi_token} onChange={e => setBotForm({ ...botForm, uazapi_token: e.target.value })} className="bg-[#0a0a0f] border-[#1E1E2E]" />
              </div>
            </div>
            <div>
              <Label>Número WhatsApp</Label>
              <Input value={botForm.whatsapp_number} onChange={e => setBotForm({ ...botForm, whatsapp_number: e.target.value })} className="bg-[#0a0a0f] border-[#1E1E2E]" placeholder="+55..." />
            </div>

            {botForm.company_id && (
              <div>
                <Label>Agentes vinculados {selectedAgentIds.length > 0 && <span className="text-primary">({selectedAgentIds.length})</span>}</Label>
                <div className="mt-1 max-h-48 overflow-y-auto border border-[#1E1E2E] rounded-md p-2 space-y-1 bg-[#0a0a0f] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full">
                  {filteredAgents.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center">Nenhum agente nesta empresa</p>
                  ) : filteredAgents.map(a => (
                    <label key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#1E1E2E] cursor-pointer text-sm">
                      <Checkbox checked={selectedAgentIds.includes(a.id)} onCheckedChange={() => toggleAgentId(a.id)} />
                      <span className="text-foreground">{a.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

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
