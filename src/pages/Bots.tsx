import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Plus, Search, Bot, Pencil, Power, QrCode, Eye, EyeOff, Loader2 } from "lucide-react";

interface BotInstance {
  id: string;
  name: string;
  collaborator_id: string | null;
  company_id: string | null;
  bot_type: string;
  anthropic_api_key: string | null;
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

const BOT_TYPES = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "ai_assistant", label: "AI Assistant" },
  { value: "hybrid", label: "Híbrido" },
];

const defaultForm = {
  name: "",
  collaborator_id: "",
  company_id: "",
  bot_type: "whatsapp",
  anthropic_api_key: "",
  uazapi_instance_id: "",
  uazapi_token: "",
  whatsapp_number: "",
  max_msgs_per_day: 200,
  msg_interval_min: 5,
  msg_interval_max: 15,
  active_hours_start: "08:00",
  active_hours_end: "18:00",
};

export default function Bots() {
  const [bots, setBots] = useState<BotInstance[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BotInstance | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [botsRes, compRes, collabRes, agentsRes] = await Promise.all([
      supabase.from("bot_instances").select("*").order("name"),
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("collaborators").select("id, name, company_id").eq("active", true).order("name"),
      supabase.from("agent_definitions").select("id, name, company_id").eq("active", true).order("name"),
    ]);
    setBots(botsRes.data || []);
    setCompanies(compRes.data || []);
    setCollaborators(collabRes.data || []);
    setAgents(agentsRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openNew = () => {
    setEditing(null);
    setForm(defaultForm);
    setSelectedAgentIds([]);
    setShowApiKey(false);
    setModalOpen(true);
  };

  const openEdit = (bot: BotInstance) => {
    setEditing(bot);
    setForm({
      name: bot.name || "",
      collaborator_id: bot.collaborator_id || "",
      company_id: bot.company_id || "",
      bot_type: bot.bot_type || "whatsapp",
      anthropic_api_key: bot.anthropic_api_key || "",
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
    setShowApiKey(false);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!form.company_id) { toast.error("Selecione uma empresa"); return; }
    setSaving(true);
    const payload: any = {
      name: form.name.trim(),
      collaborator_id: form.collaborator_id || null,
      company_id: form.company_id,
      bot_type: form.bot_type,
      anthropic_api_key: form.anthropic_api_key || null,
      uazapi_instance_id: form.uazapi_instance_id || null,
      uazapi_token: form.uazapi_token || null,
      whatsapp_number: form.whatsapp_number || null,
      agent_ids: selectedAgentIds.length > 0 ? selectedAgentIds : null,
      max_msgs_per_day: form.max_msgs_per_day,
      msg_interval_min: form.msg_interval_min,
      msg_interval_max: form.msg_interval_max,
      active_hours_start: form.active_hours_start,
      active_hours_end: form.active_hours_end,
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from("bot_instances").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("bot_instances").insert(payload));
    }
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success(editing ? "Bot atualizado!" : "Bot criado!");
    setModalOpen(false);
    fetchData();
  };

  const toggleActive = async (bot: BotInstance) => {
    const { error } = await supabase.from("bot_instances").update({ active: !bot.active }).eq("id", bot.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success(bot.active ? "Bot desativado" : "Bot ativado");
    fetchData();
  };

  const toggleAgentId = (id: string) => {
    setSelectedAgentIds(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  const getCompanyName = (id: string | null) => companies.find(c => c.id === id)?.name || "—";
  const getCollaboratorName = (id: string | null) => collaborators.find(c => c.id === id)?.name || "—";
  const getBotTypeLabel = (t: string) => BOT_TYPES.find(b => b.value === t)?.label || t;

  const filteredBots = bots.filter(b => b.name?.toLowerCase().includes(search.toLowerCase()));
  const filteredAgents = agents.filter(a => a.company_id === form.company_id);
  const filteredCollaborators = collaborators.filter(c => !form.company_id || c.company_id === form.company_id);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gerenciamento de Bots</h1>
            <p className="text-sm text-muted-foreground">Cadastre e gerencie as instâncias de bot do sistema</p>
          </div>
          <Button onClick={openNew} className="gap-2 bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Novo Bot
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar bot..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-[#111118] border-[#1E1E2E]"
          />
        </div>

        {/* Bot Cards */}
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
                    <div>
                      <span className="text-muted-foreground">Colaborador:</span>
                      <p className="text-foreground truncate">{getCollaboratorName(bot.collaborator_id)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tipo:</span>
                      <p className="text-foreground">{getBotTypeLabel(bot.bot_type)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">WhatsApp:</span>
                      <p className="text-foreground">{bot.whatsapp_number || "—"}</p>
                    </div>
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
                    <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs" onClick={() => openEdit(bot)}>
                      <Pencil className="h-3 w-3" /> Editar
                    </Button>
                    <Button size="sm" variant="outline" className={`flex-1 gap-1 text-xs ${bot.active ? "text-amber-400 hover:text-amber-300" : "text-emerald-400 hover:text-emerald-300"}`} onClick={() => toggleActive(bot)}>
                      <Power className="h-3 w-3" /> {bot.active ? "Desativar" : "Ativar"}
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => toast.info("QR Code em breve!")}>
                      <QrCode className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#111118] border-[#1E1E2E] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Bot" : "Novo Bot"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Nome */}
            <div>
              <Label>Nome do Bot *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-[#0a0a0f] border-[#1E1E2E]" />
            </div>

            {/* Empresa */}
            <div>
              <Label>Empresa *</Label>
              <Select value={form.company_id} onValueChange={v => { setForm({ ...form, company_id: v, collaborator_id: "" }); setSelectedAgentIds([]); }}>
                <SelectTrigger className="bg-[#0a0a0f] border-[#1E1E2E]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* Colaborador */}
            <div>
              <Label>Colaborador vinculado</Label>
              <Select value={form.collaborator_id} onValueChange={v => setForm({ ...form, collaborator_id: v })}>
                <SelectTrigger className="bg-[#0a0a0f] border-[#1E1E2E]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{filteredCollaborators.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* Tipo */}
            <div>
              <Label>Tipo</Label>
              <Select value={form.bot_type} onValueChange={v => setForm({ ...form, bot_type: v })}>
                <SelectTrigger className="bg-[#0a0a0f] border-[#1E1E2E]"><SelectValue /></SelectTrigger>
                <SelectContent>{BOT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* API Key Anthropic */}
            <div>
              <Label>API Key Anthropic</Label>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={form.anthropic_api_key}
                  onChange={e => setForm({ ...form, anthropic_api_key: e.target.value })}
                  className="bg-[#0a0a0f] border-[#1E1E2E] pr-10"
                  placeholder="sk-ant-..."
                />
                <Button type="button" variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0" onClick={() => setShowApiKey(!showApiKey)}>
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* UAZAPI */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>ID Instância UAZAPI</Label>
                <Input value={form.uazapi_instance_id} onChange={e => setForm({ ...form, uazapi_instance_id: e.target.value })} className="bg-[#0a0a0f] border-[#1E1E2E]" />
              </div>
              <div>
                <Label>Token UAZAPI</Label>
                <Input value={form.uazapi_token} onChange={e => setForm({ ...form, uazapi_token: e.target.value })} className="bg-[#0a0a0f] border-[#1E1E2E]" />
              </div>
            </div>

            {/* WhatsApp */}
            <div>
              <Label>Número WhatsApp</Label>
              <Input value={form.whatsapp_number} onChange={e => setForm({ ...form, whatsapp_number: e.target.value })} className="bg-[#0a0a0f] border-[#1E1E2E]" placeholder="+55..." />
            </div>

            {/* Agentes multi-select */}
            {form.company_id && (
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

            {/* Config Anti-Ban */}
            <div className="border border-[#1E1E2E] rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Configuração Anti-Ban</h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Msgs/dia</Label>
                  <Input type="number" value={form.max_msgs_per_day} onChange={e => setForm({ ...form, max_msgs_per_day: +e.target.value })} className="bg-[#0a0a0f] border-[#1E1E2E]" />
                </div>
                <div>
                  <Label className="text-xs">Intervalo min (s)</Label>
                  <Input type="number" value={form.msg_interval_min} onChange={e => setForm({ ...form, msg_interval_min: +e.target.value })} className="bg-[#0a0a0f] border-[#1E1E2E]" />
                </div>
                <div>
                  <Label className="text-xs">Intervalo max (s)</Label>
                  <Input type="number" value={form.msg_interval_max} onChange={e => setForm({ ...form, msg_interval_max: +e.target.value })} className="bg-[#0a0a0f] border-[#1E1E2E]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Horário início</Label>
                  <Input type="time" value={form.active_hours_start} onChange={e => setForm({ ...form, active_hours_start: e.target.value })} className="bg-[#0a0a0f] border-[#1E1E2E]" />
                </div>
                <div>
                  <Label className="text-xs">Horário fim</Label>
                  <Input type="time" value={form.active_hours_end} onChange={e => setForm({ ...form, active_hours_end: e.target.value })} className="bg-[#0a0a0f] border-[#1E1E2E]" />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Salvar" : "Criar Bot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
