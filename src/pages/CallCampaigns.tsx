import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Plus, Play, Pause, Edit, Loader2, Target, TrendingUp, Activity,
  PhoneCall, Megaphone, Clock,
} from "lucide-react";

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

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function CallCampaigns() {
  const { collaborator } = useCollaborator();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "", dialer_mode: "manual", ai_enabled: false, ai_prompt: "",
    whatsapp_followup: false, whatsapp_template: "", schedule_start: "08:00",
    schedule_end: "18:00", max_retry: 3, calls_per_agent: 1,
    allowed_days: [1, 2, 3, 4, 5] as number[],
  });

  useEffect(() => { loadCampaigns(); }, [collaborator]);

  const loadCampaigns = async () => {
    setLoading(true);
    const companyId = collaborator?.company_id;
    if (!companyId) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) { console.error(error); toast.error("Erro ao carregar campanhas."); }
    setCampaigns(data ?? []);
    setLoading(false);
  };

  const createCampaign = async () => {
    setSaving(true);
    const companyId = collaborator?.company_id;
    if (!companyId) { toast.error("Empresa não encontrada."); setSaving(false); return; }
    const { error } = await supabase.from("campaigns").insert({
      company_id: companyId,
      name: form.name,
      dialer_mode: form.dialer_mode,
      ai_enabled: form.ai_enabled,
      ai_prompt: form.ai_prompt || null,
      whatsapp_followup: form.whatsapp_followup,
      whatsapp_template: form.whatsapp_template || null,
      schedule_start: form.schedule_start,
      schedule_end: form.schedule_end,
      max_retry: form.max_retry,
      calls_per_agent: form.calls_per_agent,
      allowed_days: form.allowed_days,
      status: "draft",
    } as any);
    if (error) { console.error(error); toast.error("Erro ao criar campanha."); }
    else {
      toast.success("Campanha criada com sucesso!");
      setCreateOpen(false);
      setForm({ name: "", dialer_mode: "manual", ai_enabled: false, ai_prompt: "", whatsapp_followup: false, whatsapp_template: "", schedule_start: "08:00", schedule_end: "18:00", max_retry: 3, calls_per_agent: 1, allowed_days: [1, 2, 3, 4, 5] });
      await loadCampaigns();
    }
    setSaving(false);
  };

  const toggleStatus = async (id: string, current: string) => {
    const newStatus = current === "active" ? "paused" : "active";
    const { error } = await supabase.from("campaigns").update({ status: newStatus }).eq("id", id);
    if (error) toast.error("Erro ao atualizar status.");
    else { toast.success(`Campanha ${newStatus === "active" ? "iniciada" : "pausada"}.`); await loadCampaigns(); }
  };

  const toggleDay = (day: number) => {
    setForm(f => ({
      ...f,
      allowed_days: f.allowed_days.includes(day)
        ? f.allowed_days.filter(d => d !== day)
        : [...f.allowed_days, day].sort(),
    }));
  };

  // Stats
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter(c => c.status === "active").length;
  const totalCalled = campaigns.reduce((s, c) => s + (c.total_called ?? 0), 0);
  const totalQualified = campaigns.reduce((s, c) => s + (c.total_qualified ?? 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader title="Campanhas" subtitle="Gerencie campanhas de discagem automática com IA">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white"><Plus className="h-4 w-4 mr-1.5" />Nova Campanha</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Nova Campanha</DialogTitle></DialogHeader>
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>Nome da Campanha</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Prospecção Março" />
                </div>
                <div className="space-y-2">
                  <Label>Modo do Discador</Label>
                  <Select value={form.dialer_mode} onValueChange={v => setForm({ ...form, dialer_mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="power">Power Dialer</SelectItem>
                      <SelectItem value="predictive">Preditivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border border-border/60 bg-secondary/10">
                  <div><p className="text-sm font-medium">Habilitar IA</p><p className="text-xs text-muted-foreground">A IA conduzirá a conversa automaticamente</p></div>
                  <Switch checked={form.ai_enabled} onCheckedChange={v => setForm({ ...form, ai_enabled: v })} />
                </div>
                {form.ai_enabled && (
                  <div className="space-y-2">
                    <Label>Prompt da IA</Label>
                    <Textarea value={form.ai_prompt} onChange={e => setForm({ ...form, ai_prompt: e.target.value })} placeholder="Instruções para a IA durante a ligação..." className="min-h-[100px]" />
                  </div>
                )}

                <div className="flex items-center justify-between p-4 rounded-lg border border-border/60 bg-secondary/10">
                  <div><p className="text-sm font-medium">Follow-up WhatsApp</p><p className="text-xs text-muted-foreground">Enviar WhatsApp após ligação qualificada</p></div>
                  <Switch checked={form.whatsapp_followup} onCheckedChange={v => setForm({ ...form, whatsapp_followup: v })} />
                </div>
                {form.whatsapp_followup && (
                  <div className="space-y-2">
                    <Label>Template WhatsApp</Label>
                    <Textarea value={form.whatsapp_template} onChange={e => setForm({ ...form, whatsapp_template: e.target.value })} placeholder="Mensagem de follow-up..." />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Horário Início</Label><Input type="time" value={form.schedule_start} onChange={e => setForm({ ...form, schedule_start: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Horário Fim</Label><Input type="time" value={form.schedule_end} onChange={e => setForm({ ...form, schedule_end: e.target.value })} /></div>
                </div>

                <div className="space-y-2">
                  <Label>Dias da Semana</Label>
                  <div className="flex gap-2">
                    {WEEKDAYS.map((d, i) => (
                      <label key={i} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${form.allowed_days.includes(i) ? "border-primary bg-primary/10 text-foreground" : "border-border/60 text-muted-foreground"}`}>
                        <Checkbox checked={form.allowed_days.includes(i)} onCheckedChange={() => toggleDay(i)} />
                        <span className="text-xs">{d}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Máx. Tentativas</Label><Input type="number" value={form.max_retry} onChange={e => setForm({ ...form, max_retry: Number(e.target.value) })} /></div>
                  <div className="space-y-2"><Label>Ligações/Agente</Label><Input type="number" value={form.calls_per_agent} onChange={e => setForm({ ...form, calls_per_agent: Number(e.target.value) })} /></div>
                </div>

                <Button onClick={createCampaign} disabled={saving || !form.name} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Criar Campanha
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </PageHeader>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Campanhas", value: totalCampaigns, icon: Megaphone, color: "text-primary" },
            { label: "Ativas", value: activeCampaigns, icon: Activity, color: "text-emerald-400" },
            { label: "Ligações Feitas", value: totalCalled, icon: PhoneCall, color: "text-blue-400" },
            { label: "Qualificados", value: totalQualified, icon: Target, color: "text-red-400" },
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
            {campaigns.map(c => {
              const progress = c.total_leads > 0 ? Math.round((c.total_called / c.total_leads) * 100) : 0;
              return (
                <Card key={c.id} className="bg-card border-border/60 hover:border-border transition-colors">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-foreground">{c.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {c.dialer_mode === "power" ? "Power Dialer" : c.dialer_mode === "predictive" ? "Preditivo" : "Manual"}
                          {c.ai_enabled && " • IA ativa"}
                        </p>
                      </div>
                      <Badge variant="outline" className={statusColor(c.status)}>{statusLabel(c.status)}</Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{c.total_called ?? 0} / {c.total_leads ?? 0} leads</span>
                        <span>{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div><p className="text-lg font-bold text-foreground">{c.total_called ?? 0}</p><p className="text-[10px] text-muted-foreground">Ligadas</p></div>
                      <div><p className="text-lg font-bold text-emerald-400">{c.total_answered ?? 0}</p><p className="text-[10px] text-muted-foreground">Atendidas</p></div>
                      <div><p className="text-lg font-bold text-red-400">{c.total_qualified ?? 0}</p><p className="text-[10px] text-muted-foreground">Qualificados</p></div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" variant={c.status === "active" ? "outline" : "default"} className={c.status === "active" ? "" : "bg-emerald-600 hover:bg-emerald-700 text-white"} onClick={() => toggleStatus(c.id, c.status)}>
                        {c.status === "active" ? <><Pause className="h-4 w-4 mr-1" />Pausar</> : <><Play className="h-4 w-4 mr-1" />Iniciar</>}
                      </Button>
                      <Button size="sm" variant="outline"><Edit className="h-4 w-4 mr-1" />Editar</Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
