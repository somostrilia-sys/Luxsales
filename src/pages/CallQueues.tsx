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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCompany } from "@/contexts/CompanyContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { supabase } from "@/lib/supabase";
import { EDGE_BASE, SUPABASE_ANON_KEY } from "@/lib/constants";
import { toast } from "sonner";
import {
  Phone, Plus, RefreshCw, Loader2, Trash2, Pencil,
  Users, ChevronDown, ChevronUp, UserPlus, UserMinus,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface LeadQueue {
  id: string;
  company_id: string;
  name: string;
  type: "round_robin" | "manual" | "priority" | "geographic";
  source_filter: string[];
  max_leads_per_agent: number;
  active: boolean;
  created_at: string;
}

interface QueueMember {
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

// ── SQL ───────────────────────────────────────────────────────────────────────
const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS lead_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'round_robin' CHECK (type IN ('round_robin', 'manual', 'priority', 'geographic')),
  source_filter TEXT[],
  max_leads_per_agent INTEGER DEFAULT 50,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE lead_queues ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lead_queues' AND policyname='lead_queues_all') THEN
    CREATE POLICY "lead_queues_all" ON lead_queues FOR ALL USING (true);
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS lead_queue_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID REFERENCES lead_queues(id) ON DELETE CASCADE,
  collaborator_id UUID REFERENCES collaborators(id),
  current_load INTEGER DEFAULT 0,
  max_load INTEGER DEFAULT 50,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(queue_id, collaborator_id)
);
ALTER TABLE lead_queue_members ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lead_queue_members' AND policyname='lead_queue_members_all') THEN
    CREATE POLICY "lead_queue_members_all" ON lead_queue_members FOR ALL USING (true);
  END IF;
END $$;
`;

const SOURCES = [
  { value: "facebook_ad", label: "Facebook Ad" },
  { value: "landing_page", label: "Landing Page" },
  { value: "google_ad", label: "Google Ad" },
  { value: "manual", label: "Manual" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "indicacao", label: "Indicação" },
];

const TYPE_LABELS: Record<string, string> = {
  round_robin: "Round Robin",
  manual: "Manual",
  priority: "Por Prioridade",
  geographic: "Geográfico",
};

const emptyForm = {
  name: "",
  type: "round_robin" as LeadQueue["type"],
  source_filter: [] as string[],
  max_leads_per_agent: 50,
};

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
export default function CallQueues() {
  const { company_id: baseCompanyId } = useCompany();
  const { selectedCompanyId } = useCompanyFilter();
  const company_id = (selectedCompanyId && selectedCompanyId !== "all") ? selectedCompanyId : baseCompanyId;

  const [queues, setQueues] = useState<LeadQueue[]>([]);
  const [members, setMembers] = useState<Record<string, QueueMember[]>>({});
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [tablesReady, setTablesReady] = useState(false);

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

  // ── Ensure tables ───────────────────────────────────────────────────────────
  const ensureTables = useCallback(async () => {
    const { error } = await supabase.from("lead_queues").select("id").limit(1);
    if (error && (error.code === "42P01" || error.message?.includes("does not exist"))) {
      try {
        const headers = await getAuthHeaders();
        await fetch(`${EDGE_BASE}/run-sql`, {
          method: "POST",
          headers,
          body: JSON.stringify({ sql: CREATE_TABLES_SQL }),
        });
      } catch { /* ignore */ }
    }
    setTablesReady(true);
  }, []);

  useEffect(() => { ensureTables(); }, [ensureTables]);

  // ── Load queues ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!company_id || !tablesReady) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("lead_queues")
        .select("*")
        .eq("company_id", company_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setQueues((data as LeadQueue[]) || []);

      // Load members for all queues
      if (data && data.length > 0) {
        const ids = data.map((q: LeadQueue) => q.id);
        const { data: mData } = await supabase
          .from("lead_queue_members")
          .select("*, collaborator:collaborators(name, email)")
          .in("queue_id", ids);
        const grouped: Record<string, QueueMember[]> = {};
        for (const m of (mData as QueueMember[]) || []) {
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
  }, [company_id, tablesReady]);

  useEffect(() => { load(); }, [load]);

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

  const openEdit = (q: LeadQueue) => {
    setEditId(q.id);
    setForm({
      name: q.name,
      type: q.type,
      source_filter: q.source_filter || [],
      max_leads_per_agent: q.max_leads_per_agent,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    const payload = {
      company_id,
      name: form.name.trim(),
      type: form.type,
      source_filter: form.source_filter,
      max_leads_per_agent: form.max_leads_per_agent,
    };
    const { error } = editId
      ? await supabase.from("lead_queues").update(payload).eq("id", editId)
      : await supabase.from("lead_queues").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success(editId ? "Fila atualizada" : "Fila criada"); setDialogOpen(false); load(); }
    setSaving(false);
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta fila?")) return;
    const { error } = await supabase.from("lead_queues").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Fila excluída"); load(); }
  };

  const toggleActive = async (q: LeadQueue) => {
    const { error } = await supabase
      .from("lead_queues")
      .update({ active: !q.active })
      .eq("id", q.id);
    if (error) toast.error(error.message);
    else load();
  };

  // ── Members ─────────────────────────────────────────────────────────────────
  const addMember = async () => {
    if (!selectedCollaboratorId || !addMemberQueueId) return;
    setAddingMember(true);
    const queue = queues.find(q => q.id === addMemberQueueId);
    const { error } = await supabase.from("lead_queue_members").insert({
      queue_id: addMemberQueueId,
      collaborator_id: selectedCollaboratorId,
      max_load: queue?.max_leads_per_agent || 50,
    });
    if (error) toast.error(error.code === "23505" ? "Consultor já está na fila" : error.message);
    else { toast.success("Consultor adicionado"); setAddMemberQueueId(null); setSelectedCollaboratorId(""); load(); }
    setAddingMember(false);
  };

  const removeMember = async (memberId: string) => {
    const { error } = await supabase.from("lead_queue_members").delete().eq("id", memberId);
    if (error) toast.error(error.message);
    else { toast.success("Consultor removido"); load(); }
  };

  const toggleMemberActive = async (m: QueueMember) => {
    const { error } = await supabase
      .from("lead_queue_members")
      .update({ active: !m.active })
      .eq("id", m.id);
    if (error) toast.error(error.message);
    else load();
  };

  const toggleSource = (value: string) => {
    setForm(f => ({
      ...f,
      source_filter: f.source_filter.includes(value)
        ? f.source_filter.filter(s => s !== value)
        : [...f.source_filter, value],
    }));
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
          <PageHeader title="Filas de Ligação" subtitle="Distribuição automática de leads" />
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
              <Phone className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium mb-1">Nenhuma fila criada</p>
              <p className="text-xs text-muted-foreground mb-4">
                Crie sua primeira fila para distribuir leads automaticamente
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
              return (
                <Card key={q.id} className="overflow-hidden">
                  <CardContent className="pt-4 pb-3">
                    {/* Queue header row */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                          className="flex items-center gap-3 min-w-0 flex-1 text-left"
                          onClick={() => setExpandedId(isExpanded ? null : q.id)}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-sm truncate">{q.name}</h3>
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                {TYPE_LABELS[q.type] || q.type}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`text-[10px] shrink-0 ${q.active ? "bg-green-500/15 text-green-400 border-green-500/30" : "bg-muted text-muted-foreground"}`}
                              >
                                {q.active ? "Ativa" : "Inativa"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" /> {qMembers.length} membro(s)
                              </span>
                              {q.source_filter?.length > 0 && (
                                <span>{q.source_filter.length} fonte(s)</span>
                              )}
                              <span>Máx {q.max_leads_per_agent} leads/agente</span>
                            </div>
                          </div>
                          {isExpanded
                            ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                        </button>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Switch checked={q.active} onCheckedChange={() => toggleActive(q)} />
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
                          <p className="text-xs font-medium text-muted-foreground">Consultores</p>
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
                            Nenhum consultor nesta fila
                          </p>
                        ) : (
                          qMembers.map(m => (
                            <div key={m.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-md bg-muted/30">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium truncate">
                                  {m.collaborator?.name || "—"}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {m.current_load}/{m.max_load} leads
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Switch
                                  checked={m.active}
                                  onCheckedChange={() => toggleMemberActive(m)}
                                  className="scale-75"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive"
                                  onClick={() => removeMember(m.id)}
                                >
                                  <UserMinus className="h-3.5 w-3.5" />
                                </Button>
                              </div>
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
            <DialogTitle>{editId ? "Editar Fila" : "Criar Fila"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input
                className="h-8 text-xs mt-1"
                placeholder="Ex: Leads Facebook - Time A"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Tipo de distribuição</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as LeadQueue["type"] }))}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="round_robin">Round Robin</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="priority">Por Prioridade</SelectItem>
                  <SelectItem value="geographic">Geográfico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-2 block">Fontes de leads</Label>
              <div className="grid grid-cols-2 gap-2">
                {SOURCES.map(s => (
                  <div key={s.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`src-${s.value}`}
                      checked={form.source_filter.includes(s.value)}
                      onCheckedChange={() => toggleSource(s.value)}
                    />
                    <label htmlFor={`src-${s.value}`} className="text-xs cursor-pointer">
                      {s.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Máx leads por agente</Label>
              <Input
                type="number"
                className="h-8 text-xs mt-1"
                value={form.max_leads_per_agent}
                onChange={e => setForm(f => ({ ...f, max_leads_per_agent: +e.target.value }))}
                min={1}
                max={500}
              />
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
