import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Plus, Play, Pause, Edit, Loader2, Target, Activity,
  PhoneCall, Megaphone, Clock,
} from "lucide-react";

type Campaign = {
  id: string;
  name: string;
  voice_key: string | null;
  product: string | null;
  status: string | null;
  daily_limit: number | null;
  schedule_start: string | null;
  schedule_end: string | null;
  ai_seller_name: string | null;
  voice_tone: string | null;
  opening_script: string | null;
  development_script: string | null;
  closing_script: string | null;
  objections: unknown;
  rules: string | null;
  call_goal: string | null;
  created_at: string | null;
};

type CampaignForm = {
  name: string;
  product: string;
  voice_key: string;
  daily_limit: string;
  schedule_start: string;
  schedule_end: string;
  status: string;
};

const initialForm: CampaignForm = {
  name: "",
  product: "Objetivo",
  voice_key: "",
  daily_limit: "50",
  schedule_start: "08:00",
  schedule_end: "18:00",
  status: "draft",
};

const statusColor = (s: string) => {
  if (s === "active") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (s === "paused") return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  if (s === "draft") return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  return "bg-red-500/20 text-red-400 border-red-500/30";
};
const statusLabel = (s: string) => {
  const m: Record<string, string> = { active: "Ativa", paused: "Pausada", draft: "Rascunho", completed: "Finalizada" };
  return m[s] ?? s;
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
};

const normalizeCampaign = (item: any): Campaign => ({
  id: String(item.id),
  name: item.name ?? "Campanha sem nome",
  voice_key: item.voice_key ?? null,
  product: item.product ?? null,
  status: item.status ?? "draft",
  daily_limit: typeof item.daily_limit === "number" ? item.daily_limit : Number(item.daily_limit ?? 0),
  schedule_start: item.schedule_start ?? null,
  schedule_end: item.schedule_end ?? null,
  ai_seller_name: item.ai_seller_name ?? null,
  voice_tone: item.voice_tone ?? null,
  opening_script: item.opening_script ?? null,
  development_script: item.development_script ?? null,
  closing_script: item.closing_script ?? null,
  objections: item.objections ?? null,
  rules: item.rules ?? null,
  call_goal: item.call_goal ?? null,
  created_at: item.created_at ?? null,
});

export default function CallCampaigns() {
  const { collaborator } = useCollaborator();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [editForm, setEditForm] = useState<CampaignForm>(initialForm);

  // Create form state
  const [form, setForm] = useState<CampaignForm>(initialForm);

  useEffect(() => { loadCampaigns(); }, [collaborator]);

  const loadCampaigns = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("call_campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { console.error(error); toast.error("Erro ao carregar campanhas."); }
    setCampaigns((data ?? []).map(normalizeCampaign));
    setLoading(false);
  };

  const createCampaign = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        product: form.product,
        voice_key: form.voice_key || null,
        daily_limit: Number(form.daily_limit || 0),
        schedule_start: form.schedule_start,
        schedule_end: form.schedule_end,
        status: "draft",
      };
      const { error } = await supabase.from("call_campaigns").insert(payload as never);
      if (error) throw error;
      toast.success("Campanha criada com sucesso!");
      setCreateOpen(false);
      setForm(initialForm);
      await loadCampaigns();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao criar campanha.");
    } finally {
      setSaving(false);
    }
  };

  const updateCampaign = async () => {
    if (!editingCampaign) return;
    setSaving(true);
    try {
      const payload = {
        name: editForm.name,
        product: editForm.product,
        voice_key: editForm.voice_key || null,
        daily_limit: Number(editForm.daily_limit || 0),
        status: editForm.status,
      };
      const { error } = await supabase
        .from("call_campaigns")
        .update(payload as never)
        .eq("id", editingCampaign.id);
      if (error) throw error;
      toast.success("Campanha atualizada com sucesso!");
      setEditOpen(false);
      setEditingCampaign(null);
      await loadCampaigns();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar campanha.");
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (c: Campaign) => {
    setEditingCampaign(c);
    setEditForm({
      name: c.name,
      product: c.product ?? "",
      voice_key: c.voice_key ?? "",
      daily_limit: String(c.daily_limit ?? 50),
      schedule_start: c.schedule_start ?? "08:00",
      schedule_end: c.schedule_end ?? "18:00",
      status: c.status ?? "draft",
    });
    setEditOpen(true);
  };

  const toggleStatus = async (id: string, current: string) => {
    const newStatus = current === "active" ? "paused" : "active";
    const { error } = await supabase.from("call_campaigns").update({ status: newStatus } as never).eq("id", id);
    if (error) toast.error("Erro ao atualizar status.");
    else { toast.success(`Campanha ${newStatus === "active" ? "iniciada" : "pausada"}.`); await loadCampaigns(); }
  };

  // Stats
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter(c => c.status === "active").length;
  const draftCampaigns = campaigns.filter(c => c.status === "draft").length;
  const pausedCampaigns = campaigns.filter(c => c.status === "paused").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader title="Campanhas" subtitle="Gerencie campanhas de ligação com IA">
          {/* Create Dialog */}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white"><Plus className="h-4 w-4 mr-1.5" />Nova Campanha</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Nova Campanha</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome da Campanha</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Reativação Março" />
                </div>
                <div className="space-y-2">
                  <Label>Produto</Label>
                  <Select value={form.product} onValueChange={v => setForm({ ...form, product: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Objetivo">Objetivo</SelectItem>
                      <SelectItem value="Trilia">Trilia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Voice Key</Label>
                  <Input value={form.voice_key} onChange={e => setForm({ ...form, voice_key: e.target.value })} placeholder="Ex: lucas-v1" />
                </div>
                <div className="space-y-2">
                  <Label>Limite Diário</Label>
                  <Input type="number" value={form.daily_limit} onChange={e => setForm({ ...form, daily_limit: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Horário Início</Label><Input type="time" value={form.schedule_start} onChange={e => setForm({ ...form, schedule_start: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Horário Fim</Label><Input type="time" value={form.schedule_end} onChange={e => setForm({ ...form, schedule_end: e.target.value })} /></div>
                </div>
                <Button onClick={createCampaign} disabled={saving || !form.name} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Criar Campanha
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </PageHeader>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Editar Campanha</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Produto</Label>
                <Select value={editForm.product} onValueChange={v => setEditForm({ ...editForm, product: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Objetivo">Objetivo</SelectItem>
                    <SelectItem value="Trilia">Trilia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Voice Key</Label>
                <Input value={editForm.voice_key} onChange={e => setEditForm({ ...editForm, voice_key: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Limite Diário</Label>
                <Input type="number" value={editForm.daily_limit} onChange={e => setEditForm({ ...editForm, daily_limit: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={v => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="paused">Pausada</SelectItem>
                    <SelectItem value="completed">Finalizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={updateCampaign} disabled={saving || !editForm.name} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Edit className="h-4 w-4 mr-2" />}
                Salvar Alterações
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Campanhas", value: totalCampaigns, icon: Megaphone, color: "text-primary" },
            { label: "Ativas", value: activeCampaigns, icon: Activity, color: "text-emerald-400" },
            { label: "Pausadas", value: pausedCampaigns, icon: Pause, color: "text-yellow-400" },
            { label: "Rascunhos", value: draftCampaigns, icon: Clock, color: "text-blue-400" },
          ].map(s => (
            <Card key={s.label} className="bg-card border-border/60">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center"><s.icon className={`h-5 w-5 ${s.color}`} /></div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{s.value.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Campaign Cards */}
        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {[1, 2].map(i => <Card key={i} className="bg-card border-border/60"><CardContent className="p-6"><Skeleton className="h-32 w-full" /></CardContent></Card>)}
          </div>
        ) : campaigns.length === 0 ? (
          <Card className="bg-card border-border/60">
            <CardContent className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
              <Megaphone className="h-10 w-10 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">Nenhuma campanha criada ainda</p>
              <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" />Criar Primeira Campanha</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {campaigns.map(c => (
              <Card key={c.id} className="bg-card border-border/60 hover:border-border transition-colors">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{c.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {c.product ?? "Sem produto"}
                        {c.voice_key && ` • Voz: ${c.voice_key}`}
                      </p>
                    </div>
                    <Badge variant="outline" className={statusColor(c.status ?? "draft")}>{statusLabel(c.status ?? "draft")}</Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-lg font-bold text-foreground">{c.daily_limit ?? 0}</p>
                      <p className="text-[10px] text-muted-foreground">Limite/dia</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-blue-400">{c.schedule_start ?? "—"}</p>
                      <p className="text-[10px] text-muted-foreground">Início</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-emerald-400">{c.schedule_end ?? "—"}</p>
                      <p className="text-[10px] text-muted-foreground">Fim</p>
                    </div>
                  </div>

                  {c.call_goal && (
                    <p className="text-xs text-muted-foreground"><Target className="inline h-3 w-3 mr-1" />Objetivo: {c.call_goal}</p>
                  )}

                  <p className="text-[10px] text-muted-foreground">Criada em {formatDate(c.created_at)}</p>

                  <div className="flex gap-2">
                    <Button size="sm" variant={c.status === "active" ? "outline" : "default"} className={c.status === "active" ? "" : "bg-emerald-600 hover:bg-emerald-700 text-white"} onClick={() => toggleStatus(c.id, c.status ?? "draft")}>
                      {c.status === "active" ? <><Pause className="h-4 w-4 mr-1" />Pausar</> : <><Play className="h-4 w-4 mr-1" />Iniciar</>}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEditDialog(c)}><Edit className="h-4 w-4 mr-1" />Editar</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
