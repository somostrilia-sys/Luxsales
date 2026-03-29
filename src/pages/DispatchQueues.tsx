import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCompany } from "@/contexts/CompanyContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { supabase } from "@/lib/supabase";
import { EDGE_BASE, SUPABASE_ANON_KEY } from "@/lib/constants";
import { toast } from "sonner";
import {
  Send, Plus, RefreshCw, Loader2, Trash2, Pencil,
  Users, ChevronDown, ChevronUp, UserPlus, UserMinus,
  Play, Pause, CheckCircle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface DispatchQueue {
  id: string;
  company_id: string;
  name: string;
  status: "draft" | "active" | "paused" | "completed";
  template_name: string | null;
  total_leads: number;
  leads_dispatched: number;
  created_at: string;
}

interface DispatchQueueMember {
  id: string;
  queue_id: string;
  collaborator_id: string;
  current_load: number;
  max_load: number;
  active: boolean;
  collaborator?: { name: string; email: string };
}

interface Collaborator {
  id: string;
  name: string;
  email: string;
}

interface Template {
  name: string;
  status: string;
}

// ── SQL ───────────────────────────────────────────────────────────────────────
const CREATE_MEMBERS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS dispatch_queue_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID REFERENCES dispatch_queues(id) ON DELETE CASCADE,
  collaborator_id UUID REFERENCES collaborators(id),
  current_load INTEGER DEFAULT 0,
  max_load INTEGER DEFAULT 50,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(queue_id, collaborator_id)
);
ALTER TABLE dispatch_queue_members ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dispatch_queue_members' AND policyname='dispatch_queue_members_all') THEN
    CREATE POLICY "dispatch_queue_members_all" ON dispatch_queue_members FOR ALL USING (true);
  END IF;
END $$;
`;

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  draft: { label: "Rascunho", cls: "bg-muted text-muted-foreground", icon: null },
  active: { label: "Ativo", cls: "bg-green-500/15 text-green-400 border-green-500/30", icon: <Play className="h-3 w-3" /> },
  paused: { label: "Pausado", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", icon: <Pause className="h-3 w-3" /> },
  completed: { label: "Concluído", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: <CheckCircle className="h-3 w-3" /> },
};

const emptyForm = { name: "", template_name: "", status: "draft" as DispatchQueue["status"] };

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DispatchQueues() {
  const { company_id: baseCompanyId } = useCompany();
  const { selectedCompanyId } = useCompanyFilter();
  const company_id = (selectedCompanyId && selectedCompanyId !== "all") ? selectedCompanyId : baseCompanyId;

  const [queues, setQueues] = useState<DispatchQueue[]>([]);
  const [members, setMembers] = useState<Record<string, DispatchQueueMember[]>>({});
  const [templates, setTemplates] = useState<Template[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersTableReady, setMembersTableReady] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Expanded queue
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Add member dialog
  const [addMemberQueueId, setAddMemberQueueId] = useState<string | null>(null);
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  // ── Ensure members table ────────────────────────────────────────────────────
  const ensureMembersTable = useCallback(async () => {
    const { error } = await supabase.from("dispatch_queue_members").select("id").limit(1);
    if (error && (error.code === "42P01" || error.message?.includes("does not exist"))) {
      try {
        const headers = await getAuthHeaders();
        await fetch(`${EDGE_BASE}/run-sql`, {
          method: "POST",
          headers,
          body: JSON.stringify({ sql: CREATE_MEMBERS_TABLE_SQL }),
        });
      } catch { /* ignore */ }
    }
    setMembersTableReady(true);
  }, []);

  useEffect(() => { ensureMembersTable(); }, [ensureMembersTable]);

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!company_id || !membersTableReady) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("dispatch_queues")
        .select("id, company_id, name, status, template_name, total_leads, leads_dispatched, created_at")
        .eq("company_id", company_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setQueues((data as DispatchQueue[]) || []);

      if (data && data.length > 0) {
        const ids = data.map((q: DispatchQueue) => q.id);
        const { data: mData } = await supabase
          .from("dispatch_queue_members")
          .select("*, collaborator:collaborators(name, email)")
          .in("queue_id", ids);
        const grouped: Record<string, DispatchQueueMember[]> = {};
        for (const m of (mData as DispatchQueueMember[]) || []) {
          if (!grouped[m.queue_id]) grouped[m.queue_id] = [];
          grouped[m.queue_id].push(m);
        }
        setMembers(grouped);
      }
    } catch {
      toast.error("Erro ao carregar filas");
    } finally {
      setLoading(false);
    }
  }, [company_id, membersTableReady]);

  useEffect(() => { load(); }, [load]);

  // ── Load templates ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!company_id) return;
    supabase
      .from("whatsapp_meta_templates")
      .select("name, status")
      .eq("company_id", company_id)
      .eq("status", "APPROVED")
      .then(({ data }) => setTemplates((data as Template[]) || []));
  }, [company_id]);

  // ── Load collaborators ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!company_id) return;
    supabase
      .from("collaborators")
      .select("id, name, email")
      .eq("company_id", company_id)
      .eq("active", true)
      .order("name")
      .then(({ data }) => setCollaborators((data as Collaborator[]) || []));
  }, [company_id]);

  // ── CRUD ────────────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (q: DispatchQueue) => {
    setEditId(q.id);
    setForm({
      name: q.name,
      template_name: q.template_name || "",
      status: q.status,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    const payload = {
      company_id,
      name: form.name.trim(),
      template_name: form.template_name || null,
      status: form.status,
    };
    const { error } = editId
      ? await supabase.from("dispatch_queues").update(payload).eq("id", editId)
      : await supabase.from("dispatch_queues").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success(editId ? "Fila atualizada" : "Fila criada"); setDialogOpen(false); load(); }
    setSaving(false);
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta fila de disparo?")) return;
    const { error } = await supabase.from("dispatch_queues").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Fila excluída"); load(); }
  };

  const cycleStatus = async (q: DispatchQueue) => {
    const next: Record<string, DispatchQueue["status"]> = {
      draft: "active",
      active: "paused",
      paused: "active",
      completed: "draft",
    };
    const { error } = await supabase
      .from("dispatch_queues")
      .update({ status: next[q.status] || "active" })
      .eq("id", q.id);
    if (error) toast.error(error.message);
    else load();
  };

  // ── Members ─────────────────────────────────────────────────────────────────
  const addMember = async () => {
    if (!selectedCollaboratorId || !addMemberQueueId) return;
    setAddingMember(true);
    const { error } = await supabase.from("dispatch_queue_members").insert({
      queue_id: addMemberQueueId,
      collaborator_id: selectedCollaboratorId,
    });
    if (error) toast.error(error.code === "23505" ? "Consultor já está na fila" : error.message);
    else { toast.success("Consultor adicionado"); setAddMemberQueueId(null); setSelectedCollaboratorId(""); load(); }
    setAddingMember(false);
  };

  const removeMember = async (memberId: string) => {
    const { error } = await supabase.from("dispatch_queue_members").delete().eq("id", memberId);
    if (error) toast.error(error.message);
    else { toast.success("Consultor removido"); load(); }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading && queues.length === 0) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <PageHeader title="Filas de Disparo WA" subtitle="Envio de mensagens WhatsApp em massa" />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" /> Criar Fila
            </Button>
          </div>
        </div>

        {/* Empty state */}
        {queues.length === 0 ? (
          <Card>
            <CardContent className="py-14 text-center">
              <Send className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium mb-1">Nenhuma fila de disparo</p>
              <p className="text-xs text-muted-foreground mb-4">
                Configure uma fila de disparo para enviar mensagens em massa
              </p>
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1.5" /> Criar Fila
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {queues.map(q => {
              const qMembers = members[q.id] || [];
              const isExpanded = expandedId === q.id;
              const sc = STATUS_CONFIG[q.status] || STATUS_CONFIG.draft;
              const pct = q.total_leads > 0 ? Math.round((q.leads_dispatched / q.total_leads) * 100) : 0;

              return (
                <Card key={q.id} className="overflow-hidden">
                  <CardContent className="pt-4 pb-3">
                    {/* Queue header row */}
                    <div className="flex items-center justify-between gap-3">
                      <button
                        className="flex items-center gap-3 min-w-0 flex-1 text-left"
                        onClick={() => setExpandedId(isExpanded ? null : q.id)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-sm truncate">{q.name}</h3>
                            <Badge variant="outline" className={`text-[10px] flex items-center gap-1 shrink-0 ${sc.cls}`}>
                              {sc.icon}{sc.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {q.template_name && (
                              <span className="truncate max-w-[140px]">📄 {q.template_name}</span>
                            )}
                            <span>{q.leads_dispatched}/{q.total_leads || 0} disparados ({pct}%)</span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" /> {qMembers.length}
                            </span>
                          </div>
                        </div>
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => cycleStatus(q)}
                        >
                          {q.status === "active" ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                          {q.status === "active" ? "Pausar" : "Ativar"}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(q)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(q.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded: members */}
                    {isExpanded && (
                      <div className="mt-4 border-t pt-3 space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-muted-foreground">Consultores atribuídos</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => { setAddMemberQueueId(q.id); setSelectedCollaboratorId(""); }}
                          >
                            <UserPlus className="h-3.5 w-3.5 mr-1" /> Adicionar
                          </Button>
                        </div>

                        {qMembers.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-3 text-center">
                            Nenhum consultor atribuído
                          </p>
                        ) : (
                          qMembers.map(m => (
                            <div key={m.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-md bg-muted/30">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium truncate">{m.collaborator?.name || "—"}</p>
                                <p className="text-[11px] text-muted-foreground">{m.collaborator?.email}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive shrink-0"
                                onClick={() => removeMember(m.id)}
                              >
                                <UserMinus className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Fila" : "Nova Fila de Disparo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input
                className="h-8 text-xs mt-1"
                placeholder="Ex: Campanha Março - Facebook"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Template</Label>
              <Select
                value={form.template_name || "none"}
                onValueChange={v => setForm(f => ({ ...f, template_name: v === "none" ? "" : v }))}
              >
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Selecionar template..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem template</SelectItem>
                  {templates.map(t => (
                    <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as DispatchQueue["status"] }))}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="paused">Pausado</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={!!addMemberQueueId} onOpenChange={open => !open && setAddMemberQueueId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar Consultor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label className="text-xs">Selecionar consultor</Label>
            <Select value={selectedCollaboratorId} onValueChange={setSelectedCollaboratorId}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Escolha um consultor..." /></SelectTrigger>
              <SelectContent>
                {collaborators.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} — {c.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberQueueId(null)}>Cancelar</Button>
            <Button onClick={addMember} disabled={!selectedCollaboratorId || addingMember}>
              {addingMember ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
