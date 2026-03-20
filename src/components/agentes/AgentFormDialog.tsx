import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bot, Mic, Brain, Radio, User, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface VoiceProfile {
  id: string;
  voice_name: string;
  voice_key: string;
  provider: string;
  language: string | null;
  gender: string | null;
  description: string | null;
}

interface VoiceClone {
  id: string;
  name: string;
  provider: string;
  provider_voice_id: string | null;
  language: string | null;
  gender: string | null;
}

interface AgentFormData {
  id?: string;
  name: string;
  slug: string;
  description: string;
  active: boolean;
  company_id: string;
  agent_type: string;
  model: string;
  temperature: number;
  max_tokens: number;
  voice_key: string | null;
  channel: string;
}

interface Company {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent?: AgentFormData | null;
  companies: Company[];
  onSaved: () => void;
}

const LLM_MODELS = [
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "claude-haiku", label: "Claude Haiku" },
  { value: "claude-sonnet", label: "Claude Sonnet" },
  { value: "llama-3.1", label: "Llama 3.1" },
];

const CHANNELS = [
  { value: "telegram", label: "Telegram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telefone", label: "Telefone" },
  { value: "whatsapp_meta", label: "WhatsApp Meta" },
];

const PROVIDER_ORDER = ["OpenAI", "Cartesia", "ElevenLabs", "XTTS"];

const genderIcon = (gender: string | null) => {
  if (gender === "male") return "♂";
  if (gender === "female") return "♀";
  return "◎";
};

const emptyForm: AgentFormData = {
  name: "",
  slug: "",
  description: "",
  active: true,
  company_id: "",
  agent_type: "text",
  model: "gpt-4o-mini",
  temperature: 0.7,
  max_tokens: 150,
  voice_key: null,
  channel: "telegram",
};

export default function AgentFormDialog({ open, onOpenChange, agent, companies, onSaved }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<AgentFormData>(emptyForm);
  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [clones, setClones] = useState<VoiceClone[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(agent ? { ...emptyForm, ...agent } : { ...emptyForm });
      fetchVoices();
    }
  }, [open, agent]);

  const fetchVoices = async () => {
    const [vRes, cRes] = await Promise.all([
      supabase.from("voice_profiles").select("id, voice_name, voice_key, provider, language, gender, description").eq("active", true),
      supabase.from("ai_voice_clones").select("id, name, provider, provider_voice_id, language, gender").eq("is_active", true),
    ]);
    if (vRes.data) setVoices(vRes.data);
    if (cRes.data) setClones(cRes.data);
  };

  const voicesByProvider = PROVIDER_ORDER.map(p => ({
    provider: p,
    items: voices.filter(v => v.provider === p),
  })).filter(g => g.items.length > 0);

  const set = <K extends keyof AgentFormData>(key: K, val: AgentFormData[K]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.name || !form.slug || !form.company_id) {
      toast({ title: "Preencha nome, slug e empresa", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name,
      slug: form.slug,
      description: form.description || null,
      active: form.active,
      company_id: form.company_id,
      agent_type: form.agent_type || "text",
      model: form.model,
      temperature: form.temperature,
      max_tokens: form.max_tokens,
      voice_key: form.voice_key || null,
      channel: form.channel,
    };

    const { error } = form.id
      ? await supabase.from("agent_definitions").update(payload).eq("id", form.id)
      : await supabase.from("agent_definitions").insert({ ...payload, slug: form.slug });

    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: form.id ? "Agente atualizado" : "Agente criado" });
    onSaved();
    onOpenChange(false);
  };

  const isEdit = !!form.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            {isEdit ? "Editar Agente" : "Novo Agente"}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? "Atualize as configurações do agente." : "Configure o novo agente de IA."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Basic info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <User className="h-4 w-4" /> Informações Básicas
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ex: Assistente Comercial" />
              </div>
              <div className="space-y-1.5">
                <Label>Slug</Label>
                <Input value={form.slug} onChange={e => set("slug", e.target.value)} placeholder="assistente-comercial" disabled={isEdit} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Empresa</Label>
                <Select value={form.company_id} onValueChange={v => set("company_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.agent_type} onValueChange={v => set("agent_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texto</SelectItem>
                    <SelectItem value="voice">Voz</SelectItem>
                    <SelectItem value="hybrid">Híbrido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="Descreva a função do agente..." rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={v => set("active", v)} />
              <Label>Ativo</Label>
            </div>
          </div>

          {/* AI Section */}
          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Brain className="h-4 w-4" /> Inteligência Artificial
            </h3>
            <div className="space-y-1.5">
              <Label>Modelo LLM</Label>
              <Select value={form.model} onValueChange={v => set("model", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LLM_MODELS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Temperatura</Label>
                <span className="text-xs text-muted-foreground font-mono">{form.temperature.toFixed(1)}</span>
              </div>
              <Slider
                value={[form.temperature]}
                onValueChange={([v]) => set("temperature", v)}
                min={0}
                max={1}
                step={0.1}
                className="py-1"
              />
              <p className="text-[11px] text-muted-foreground">Menor = mais preciso · Maior = mais criativo</p>
            </div>
            <div className="space-y-1.5">
              <Label>Max Tokens</Label>
              <Input
                type="number"
                min={50}
                max={500}
                value={form.max_tokens}
                onChange={e => set("max_tokens", Math.min(500, Math.max(50, Number(e.target.value))))}
              />
              <p className="text-[11px] text-muted-foreground">Limite de tokens por resposta (50–500)</p>
            </div>
          </div>

          {/* Voice Section */}
          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Mic className="h-4 w-4" /> Voz para Ligações
            </h3>
            <div className="space-y-1.5">
              <Label>Voz</Label>
              <Select value={form.voice_key || "none"} onValueChange={v => set("voice_key", v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Sem voz" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem voz</SelectItem>
                  {voicesByProvider.map(g => (
                    <SelectGroup key={g.provider}>
                      <SelectLabel>{g.provider}</SelectLabel>
                      {g.items.map(v => (
                        <SelectItem key={v.voice_key} value={v.voice_key}>
                          <span className="flex items-center gap-2">
                            <span>{genderIcon(v.gender)}</span>
                            <span>{v.voice_name}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{v.provider}</Badge>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                  {clones.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>🎙 Vozes Clonadas</SelectLabel>
                      {clones.map(c => (
                        <SelectItem key={`clone-${c.id}`} value={c.provider_voice_id || c.id}>
                          <span className="flex items-center gap-2">
                            <span>{genderIcon(c.gender)}</span>
                            <span>{c.name}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{c.provider}</Badge>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Channel Section */}
          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Radio className="h-4 w-4" /> Canal
            </h3>
            <Select value={form.channel} onValueChange={v => set("channel", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHANNELS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar" : "Criar Agente"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
