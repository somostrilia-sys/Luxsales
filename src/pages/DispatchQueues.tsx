import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Send, Play, Pause, Pencil, Plus, RefreshCw,
  Loader2, ChevronLeft, Eye, MessageSquare, Reply,
  Upload, Paperclip, X, PhoneForwarded,
} from "lucide-react";

interface DispatchQueue {
  id: string; name: string; status: string; template_name: string | null;
  template_slot: string | null; segment: string | null;
  filter_tags: string[]; filter_temperatures: string[];
  max_per_hour: number; daily_limit: number;
  respect_tier_limit: boolean; safety_pct: number;
  schedule_start: string | null; schedule_end: string | null;
  active_days: number[];
  total_leads: number; leads_dispatched: number;
  leads_delivered: number; leads_read: number; leads_replied: number;
  created_at: string;
  attachment_url: string | null;
  auto_trigger: { on_call_qualified: boolean; delay_minutes: number } | null;
}

interface Template { name: string; status: string; }

const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const statusBadge: Record<string, { label: string; cls: string }> = {
  draft: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
  active: { label: "Ativa", cls: "bg-green-500/15 text-green-400 border-green-500/30" },
  paused: { label: "Pausada", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  completed: { label: "Concluída", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
};

const slotOptions = [
  { value: "pos_ligacao_principal", label: "Pós-ligação principal" },
  { value: "follow_up_48h", label: "Follow-up 48h" },
  { value: "reengajamento_7d", label: "Reengajamento 7d" },
  { value: "oferta_especial", label: "Oferta especial" },
  { value: "lembrete", label: "Lembrete" },
];

const emptyForm = {
  name: "", template_name: "", template_slot: "",
  segment: "", filter_tags: "", filter_temperatures: [] as string[],
  max_per_hour: 50, daily_limit: 500,
  respect_tier_limit: true, safety_pct: 50,
  schedule_start: "08:00", schedule_end: "20:00",
  active_days: [1, 2, 3, 4, 5],
  attachment_url: "" as string,
  auto_trigger_enabled: false,
  auto_trigger_delay: 2,
};

const DQ_PAGE_SIZE = 20;

export default function DispatchQueues() {
  const { company_id } = useCompany();
  const navigate = useNavigate();

  const [queues, setQueues] = useState<DispatchQueue[]>([]);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    if (!company_id) return;
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const { count } = await supabase
        .from("dispatch_queues")
        .select("*", { count: "exact", head: true })
        .eq("company_id", company_id)
        .abortSignal(controller.signal);
      setTotal(count || 0);

      const { data } = await supabase
        .from("dispatch_queues")
        .select("*")
        .eq("company_id", company_id)
        .order("created_at", { ascending: false })
        .range(page * DQ_PAGE_SIZE, (page + 1) * DQ_PAGE_SIZE - 1)
        .abortSignal(controller.signal);
      setQueues((data as any[]) || []);
    } catch (e: any) {
      if (e.name !== "AbortError") toast.error("Erro ao carregar filas");
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, [company_id, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!company_id) return;
    supabase.from("whatsapp_meta_templates").select("name, status")
      .eq("company_id", company_id).eq("status", "APPROVED")
      .limit(20)
      .then(({ data }) => setTemplates((data as Template[]) || []));
  }, [company_id]);

  const openCreate = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (q: DispatchQueue) => {
    setEditId(q.id);
    setForm({
      name: q.name, template_name: q.template_name || "",
      template_slot: q.template_slot || "", segment: q.segment || "",
      filter_tags: (q.filter_tags || []).join(", "),
      filter_temperatures: q.filter_temperatures || [],
      max_per_hour: q.max_per_hour, daily_limit: q.daily_limit,
      respect_tier_limit: q.respect_tier_limit, safety_pct: q.safety_pct,
      schedule_start: q.schedule_start || "08:00", schedule_end: q.schedule_end || "20:00",
      active_days: q.active_days || [1, 2, 3, 4, 5],
      attachment_url: q.attachment_url || "",
      auto_trigger_enabled: q.auto_trigger?.on_call_qualified ?? false,
      auto_trigger_delay: q.auto_trigger?.delay_minutes ?? 2,
    });
    setDialogOpen(true);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Apenas PDF, PNG, JPG ou WebP");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo máximo 10MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${company_id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("dispatch-attachments").upload(path, file);
    if (error) {
      toast.error("Erro no upload: " + error.message);
    } else {
      const { data: urlData } = supabase.storage.from("dispatch-attachments").getPublicUrl(path);
      setForm(f => ({ ...f, attachment_url: urlData.publicUrl }));
      toast.success("Anexo enviado");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    const payload: any = {
      company_id, name: form.name.trim(),
      template_name: form.template_name || null, template_slot: form.template_slot || null,
      segment: form.segment || null,
      filter_tags: form.filter_tags ? form.filter_tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      filter_temperatures: form.filter_temperatures,
      max_per_hour: form.max_per_hour, daily_limit: form.daily_limit,
      respect_tier_limit: form.respect_tier_limit, safety_pct: form.safety_pct,
      schedule_start: form.schedule_start, schedule_end: form.schedule_end,
      active_days: form.active_days,
      attachment_url: form.attachment_url || null,
      auto_trigger: form.auto_trigger_enabled
        ? { on_call_qualified: true, delay_minutes: form.auto_trigger_delay }
        : null,
    };
    const { error } = editId
      ? await supabase.from("dispatch_queues").update(payload).eq("id", editId)
      : await supabase.from("dispatch_queues").insert(payload);
    if (error) toast.error(error.message); else { toast.success("Salvo"); setDialogOpen(false); load(); }
    setSaving(false);
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("dispatch_queues").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Status atualizado"); load(); }
  };

  const toggleDay = (day: number) => {
    setForm(f => ({
      ...f, active_days: f.active_days.includes(day) ? f.active_days.filter(d => d !== day) : [...f.active_days, day].sort()
    }));
  };

  const toggleTemp = (t: string) => {
    setForm(f => ({
      ...f, filter_temperatures: f.filter_temperatures.includes(t) ? f.filter_temperatures.filter(x => x !== t) : [...f.filter_temperatures, t]
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
            <PageHeader title="Filas de Disparo" subtitle={`${queues.length} fila(s)`} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1.5" /> Atualizar</Button>
            <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" /> Nova Fila</Button>
          </div>
        </div>

        {queues.length === 0 ? (
          <Card><CardContent className="py-12 text-center">
            <Send className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma fila de disparo criada</p>
            <Button className="mt-3" size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" /> Criar Fila</Button>
          </CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {queues.map(q => {
              const pct = q.total_leads > 0 ? Math.round((q.leads_dispatched / q.total_leads) * 100) : 0;
              const sb = statusBadge[q.status] || statusBadge.draft;
              return (
                <Card key={q.id} className="hover:border-primary/20 transition-colors">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-sm truncate">{q.name}</h3>
                          <Badge variant="outline" className={`text-[10px] ${sb.cls}`}>{sb.label}</Badge>
                          {q.template_name && <Badge variant="secondary" className="text-[10px]">{q.template_name}</Badge>}
                        </div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Progress value={pct} className="flex-1 h-1.5" />
                          <span className="text-xs text-muted-foreground w-20">{q.leads_dispatched}/{q.total_leads}</span>
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {q.leads_delivered} entregues</span>
                          <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {q.leads_read} lidos</span>
                          <span className="flex items-center gap-1"><Reply className="h-3 w-3" /> {q.leads_replied} respondidos</span>
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
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {Math.ceil(total / DQ_PAGE_SIZE) > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{page * DQ_PAGE_SIZE + 1}–{Math.min((page + 1) * DQ_PAGE_SIZE, total)} de {total}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="flex items-center px-3 text-xs">{page + 1} / {Math.ceil(total / DQ_PAGE_SIZE)}</span>
            <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / DQ_PAGE_SIZE) - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Editar Fila" : "Nova Fila de Disparo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Nome*</Label><Input className="h-8 text-xs" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Template</Label>
                <Select value={form.template_name || "none"} onValueChange={v => setForm(f => ({ ...f, template_name: v === "none" ? "" : v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecionar...</SelectItem>
                    {templates.map(t => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Slot</Label>
                <Select value={form.template_slot || "none"} onValueChange={v => setForm(f => ({ ...f, template_slot: v === "none" ? "" : v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecionar...</SelectItem>
                    {slotOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
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
            <div>
              <Label className="text-xs mb-1.5 block">Filtrar por temperatura</Label>
              <div className="flex gap-3">
                {[{ v: "hot", l: "🔥 Hot" }, { v: "warm", l: "🌡️ Warm" }].map(t => (
                  <div key={t.v} className="flex items-center gap-1">
                    <Checkbox checked={form.filter_temperatures.includes(t.v)} onCheckedChange={() => toggleTemp(t.v)} />
                    <span className="text-xs">{t.l}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Máx/hora</Label><Input type="number" className="h-8 text-xs" value={form.max_per_hour} onChange={e => setForm(f => ({ ...f, max_per_hour: +e.target.value }))} /></div>
              <div><Label className="text-xs">Máx diário</Label><Input type="number" className="h-8 text-xs" value={form.daily_limit} onChange={e => setForm(f => ({ ...f, daily_limit: +e.target.value }))} /></div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Respeitar limite do tier</Label>
              <Switch checked={form.respect_tier_limit} onCheckedChange={v => setForm(f => ({ ...f, respect_tier_limit: v }))} />
            </div>
            <div><Label className="text-xs">Safety %: {form.safety_pct}%</Label><Input type="number" className="h-8 text-xs" value={form.safety_pct} onChange={e => setForm(f => ({ ...f, safety_pct: +e.target.value }))} min={10} max={100} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Início</Label><Input type="time" className="h-8 text-xs" value={form.schedule_start} onChange={e => setForm(f => ({ ...f, schedule_start: e.target.value }))} /></div>
              <div><Label className="text-xs">Fim</Label><Input type="time" className="h-8 text-xs" value={form.schedule_end} onChange={e => setForm(f => ({ ...f, schedule_end: e.target.value }))} /></div>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Dias ativos</Label>
              <div className="flex gap-2">{dayLabels.map((d, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Checkbox checked={form.active_days.includes(i)} onCheckedChange={() => toggleDay(i)} id={`dday-${i}`} />
                  <label htmlFor={`dday-${i}`} className="text-xs">{d}</label>
                </div>
              ))}</div>
            </div>

            {/* Attachment Upload */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" /> Anexo (PDF/Imagem)
              </Label>
              {form.attachment_url ? (
                <div className="flex items-center gap-2 bg-muted/30 rounded-md p-2 text-xs">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <a href={form.attachment_url} target="_blank" rel="noreferrer" className="truncate text-primary hover:underline flex-1">
                    {form.attachment_url.split("/").pop()}
                  </a>
                  <Button type="button" variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setForm(f => ({ ...f, attachment_url: "" }))}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div>
                  <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={handleFileUpload} />
                  <Button type="button" variant="outline" size="sm" className="text-xs" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                    {uploading ? "Enviando..." : "Upload"}
                  </Button>
                </div>
              )}
            </div>

            {/* Auto-trigger after call */}
            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1.5">
                  <PhoneForwarded className="h-3.5 w-3.5" /> Disparo automático pós-ligação
                </Label>
                <Switch
                  checked={form.auto_trigger_enabled}
                  onCheckedChange={v => setForm(f => ({ ...f, auto_trigger_enabled: v }))}
                />
              </div>
              {form.auto_trigger_enabled && (
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground">
                    Leads qualificados na ligação entram automaticamente nesta fila
                  </p>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs whitespace-nowrap">Aguardar</Label>
                    <Input
                      type="number"
                      min={0}
                      max={60}
                      className="h-7 text-xs w-16"
                      value={form.auto_trigger_delay}
                      onChange={e => setForm(f => ({ ...f, auto_trigger_delay: +e.target.value }))}
                    />
                    <span className="text-xs text-muted-foreground">min após ligação</span>
                  </div>
                </div>
              )}
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
