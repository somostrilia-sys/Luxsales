import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Phone, Play, Pause, Pencil, Trash2, Plus, RefreshCw,
  Loader2, ChevronLeft, CheckCircle, Users, Target,
} from "lucide-react";

interface VoiceConfig {
  system_prompt: string; opening_script: string; objection_tree: string;
  forbidden_phrases: string; tone: string; conversation_example: string;
}

interface CallQueue {
  id: string; name: string; status: string; segment: string | null;
  filter_tags: string[]; max_attempts: number; calls_per_hour: number;
  daily_limit: number; schedule_start: string | null; schedule_end: string | null;
  active_days: number[]; retry_no_answer_min: number; retry_busy_min: number;
  voice_key: string | null; system_prompt: string | null; opening_script: string | null;
  priority_min: number; priority_max: number;
  total_leads: number; leads_called: number; leads_answered: number;
  leads_opted_in: number; leads_converted: number;
  created_at: string;
  voice_config: VoiceConfig | null;
}

interface VoiceProfile { voice_key: string; voice_name: string; }

const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const statusBadge: Record<string, { label: string; cls: string }> = {
  draft: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
  active: { label: "Ativa", cls: "bg-green-500/15 text-green-400 border-green-500/30" },
  paused: { label: "Pausada", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  completed: { label: "Concluída", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
};

const emptyForm = {
  name: "", segment: "", filter_tags: "", max_attempts: 3,
  calls_per_hour: 30, daily_limit: 200, schedule_start: "08:00",
  schedule_end: "20:00", active_days: [1, 2, 3, 4, 5],
  retry_no_answer_min: 120, retry_busy_min: 30, voice_key: "",
  system_prompt: "", opening_script: "", priority_min: 1, priority_max: 10,
};

export default function CallQueues() {
  const { company_id } = useCompany();
  const navigate = useNavigate();

  const [queues, setQueues] = useState<CallQueue[]>([]);
  const [loading, setLoading] = useState(true);
  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!company_id) return;
    setLoading(true);
    const { data } = await supabase
      .from("call_queues")
      .select("*")
      .eq("company_id", company_id)
      .order("created_at", { ascending: false });
    setQueues((data as any[]) || []);
    setLoading(false);
  }, [company_id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    supabase.from("voice_profiles").select("voice_key, voice_name").eq("active", true)
      .then(({ data }) => setVoices((data as VoiceProfile[]) || []));
  }, []);

  const openCreate = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (q: CallQueue) => {
    setEditId(q.id);
    setForm({
      name: q.name, segment: q.segment || "", filter_tags: (q.filter_tags || []).join(", "),
      max_attempts: q.max_attempts, calls_per_hour: q.calls_per_hour, daily_limit: q.daily_limit,
      schedule_start: q.schedule_start || "08:00", schedule_end: q.schedule_end || "20:00",
      active_days: q.active_days || [1, 2, 3, 4, 5],
      retry_no_answer_min: q.retry_no_answer_min, retry_busy_min: q.retry_busy_min,
      voice_key: q.voice_key || "", system_prompt: q.system_prompt || "",
      opening_script: q.opening_script || "", priority_min: q.priority_min, priority_max: q.priority_max,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    const payload = {
      company_id,
      name: form.name.trim(),
      segment: form.segment || null,
      filter_tags: form.filter_tags ? form.filter_tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      max_attempts: form.max_attempts, calls_per_hour: form.calls_per_hour, daily_limit: form.daily_limit,
      schedule_start: form.schedule_start, schedule_end: form.schedule_end,
      active_days: form.active_days,
      retry_no_answer_min: form.retry_no_answer_min, retry_busy_min: form.retry_busy_min,
      voice_key: form.voice_key || null, system_prompt: form.system_prompt || null,
      opening_script: form.opening_script || null,
      priority_min: form.priority_min, priority_max: form.priority_max,
    };
    const { error } = editId
      ? await supabase.from("call_queues").update(payload).eq("id", editId)
      : await supabase.from("call_queues").insert(payload);
    if (error) toast.error(error.message); else { toast.success("Salvo"); setDialogOpen(false); load(); }
    setSaving(false);
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("call_queues").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Status atualizado"); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir fila?")) return;
    const { error } = await supabase.from("call_queues").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Excluída"); load(); }
  };

  const toggleDay = (day: number) => {
    setForm(f => ({
      ...f, active_days: f.active_days.includes(day) ? f.active_days.filter(d => d !== day) : [...f.active_days, day].sort()
    }));
  };

  if (loading) {
    return <DashboardLayout><div className="space-y-4"><Skeleton className="h-8 w-48" /><div className="grid gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/leads")}><ChevronLeft className="h-4 w-4" /></Button>
            <PageHeader title="Filas de Ligação" subtitle={`${queues.length} fila(s)`} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1.5" /> Atualizar</Button>
            <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" /> Nova Fila</Button>
          </div>
        </div>

        {queues.length === 0 ? (
          <Card><CardContent className="py-12 text-center">
            <Phone className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma fila de ligação criada</p>
            <Button className="mt-3" size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" /> Criar Fila</Button>
          </CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {queues.map(q => {
              const pct = q.total_leads > 0 ? Math.round((q.leads_called / q.total_leads) * 100) : 0;
              const convRate = q.leads_called > 0 ? Math.round((q.leads_converted / q.leads_called) * 100) : 0;
              const sb = statusBadge[q.status] || statusBadge.draft;
              return (
                <Card key={q.id} className="hover:border-primary/20 transition-colors">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-sm truncate">{q.name}</h3>
                          <Badge variant="outline" className={`text-[10px] ${sb.cls}`}>{sb.label}</Badge>
                        </div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Progress value={pct} className="flex-1 h-1.5" />
                          <span className="text-xs text-muted-foreground w-16">{q.leads_called}/{q.total_leads}</span>
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {q.leads_answered} atendidos</span>
                          <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> {q.leads_opted_in} opt-ins</span>
                          <span className="flex items-center gap-1"><Target className="h-3 w-3" /> {q.leads_converted} conv. ({convRate}%)</span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {q.status !== "active" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Ativar" onClick={() => setStatus(q.id, "active")}><Play className="h-3.5 w-3.5" /></Button>
                        )}
                        {q.status === "active" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Pausar" onClick={() => setStatus(q.id, "paused")}><Pause className="h-3.5 w-3.5" /></Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(q)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(q.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Editar Fila" : "Nova Fila de Ligação"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Nome*</Label><Input className="h-8 text-xs" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Segmento</Label>
                <Select value={form.segment || "none"} onValueChange={v => setForm(f => ({ ...f, segment: v === "none" ? "" : v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Todos</SelectItem>
                    <SelectItem value="protecao_veicular">Proteção Veicular</SelectItem>
                    <SelectItem value="clinica">Clínica</SelectItem>
                    <SelectItem value="imobiliaria">Imobiliária</SelectItem>
                    <SelectItem value="ecommerce">E-commerce</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Tags (vírgula)</Label><Input className="h-8 text-xs" value={form.filter_tags} onChange={e => setForm(f => ({ ...f, filter_tags: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Máx tentativas</Label><Input type="number" className="h-8 text-xs" value={form.max_attempts} onChange={e => setForm(f => ({ ...f, max_attempts: +e.target.value }))} /></div>
              <div><Label className="text-xs">Chamadas/hora</Label><Input type="number" className="h-8 text-xs" value={form.calls_per_hour} onChange={e => setForm(f => ({ ...f, calls_per_hour: +e.target.value }))} /></div>
              <div><Label className="text-xs">Máx diário</Label><Input type="number" className="h-8 text-xs" value={form.daily_limit} onChange={e => setForm(f => ({ ...f, daily_limit: +e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Início</Label><Input type="time" className="h-8 text-xs" value={form.schedule_start} onChange={e => setForm(f => ({ ...f, schedule_start: e.target.value }))} /></div>
              <div><Label className="text-xs">Fim</Label><Input type="time" className="h-8 text-xs" value={form.schedule_end} onChange={e => setForm(f => ({ ...f, schedule_end: e.target.value }))} /></div>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Dias ativos</Label>
              <div className="flex gap-2">{dayLabels.map((d, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Checkbox checked={form.active_days.includes(i)} onCheckedChange={() => toggleDay(i)} id={`day-${i}`} />
                  <label htmlFor={`day-${i}`} className="text-xs">{d}</label>
                </div>
              ))}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Retry não atende (min)</Label><Input type="number" className="h-8 text-xs" value={form.retry_no_answer_min} onChange={e => setForm(f => ({ ...f, retry_no_answer_min: +e.target.value }))} /></div>
              <div><Label className="text-xs">Retry ocupado (min)</Label><Input type="number" className="h-8 text-xs" value={form.retry_busy_min} onChange={e => setForm(f => ({ ...f, retry_busy_min: +e.target.value }))} /></div>
            </div>
            <div>
              <Label className="text-xs">Voz</Label>
              <Select value={form.voice_key || "none"} onValueChange={v => setForm(f => ({ ...f, voice_key: v === "none" ? "" : v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Padrão</SelectItem>
                  {voices.map(v => <SelectItem key={v.voice_key} value={v.voice_key}>{v.voice_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">System Prompt</Label><Textarea className="text-xs h-16" value={form.system_prompt} onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))} /></div>
            <div><Label className="text-xs">Script de abertura</Label><Textarea className="text-xs h-16" value={form.opening_script} onChange={e => setForm(f => ({ ...f, opening_script: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Prioridade mín: {form.priority_min}</Label><Slider value={[form.priority_min]} onValueChange={v => setForm(f => ({ ...f, priority_min: v[0] }))} min={1} max={10} /></div>
              <div><Label className="text-xs">Prioridade máx: {form.priority_max}</Label><Slider value={[form.priority_max]} onValueChange={v => setForm(f => ({ ...f, priority_max: v[0] }))} min={1} max={10} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}{editId ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
