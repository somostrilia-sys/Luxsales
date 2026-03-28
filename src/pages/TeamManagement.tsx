import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useCompany } from "@/contexts/CompanyContext";
import { EDGE_BASE, SUPABASE_ANON_KEY } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Plus, Loader2, Edit, Search, UserX, Users } from "lucide-react";

interface TeamMember {
  id: string;
  collaborator_id: string;
  role: string;
  daily_dispatch_limit: number;
  daily_dispatches_used: number;
  is_active: boolean;
  can_dispatch: boolean;
  allowed_templates: string[];
  user_email?: string;
  user_name?: string;
}

const roleBadgeClass: Record<string, string> = {
  ceo: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  director: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  manager: "bg-green-500/20 text-green-400 border-green-500/30",
  collaborator: "bg-muted text-muted-foreground border-border",
};

const roleLabels: Record<string, string> = {
  ceo: "CEO",
  director: "Diretor",
  manager: "Gestor",
  collaborator: "Colaborador",
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

async function callEdge(fn: string, body: Record<string, unknown>) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${EDGE_BASE}/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      res.status === 403 ? "Sem permissão" :
      res.status === 404 ? "Colaborador não encontrado" :
      res.status >= 500 ? "Erro no servidor" :
      json?.error || "Erro desconhecido";
    throw new Error(msg);
  }
  return json;
}

export default function TeamManagement() {
  const { company_id, user_role } = useCompany();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Templates aprovados
  const [approvedTemplates, setApprovedTemplates] = useState<string[]>([]);

  // Edit modal
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [editRole, setEditRole] = useState("collaborator");
  const [editLimit, setEditLimit] = useState(30);
  const [editActive, setEditActive] = useState(true);
  const [editTemplates, setEditTemplates] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Add modal
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("collaborator");
  const [addLimit, setAddLimit] = useState(30);
  const [addTemplates, setAddTemplates] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  // Deactivate confirm
  const [deactivating, setDeactivating] = useState<TeamMember | null>(null);
  const [deactivateSaving, setDeactivateSaving] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!company_id) return;
    setLoading(true);
    try {
      const json = await callEdge("dispatch-permissions", {
        action: "list",
        company_id,
        requester_role: "ceo",
      });
      const perms = json?.permissions || json?.data || [];
      setMembers(Array.isArray(perms) ? perms : []);
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar equipe");
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [company_id]);

  const fetchTemplates = useCallback(async () => {
    if (!company_id) return;
    try {
      const json = await callEdge("template-intelligence", {
        action: "list-approved",
        company_id,
      });
      const tpls = json?.templates || json?.data || [];
      setApprovedTemplates(Array.isArray(tpls) ? tpls.map((t: any) => typeof t === "string" ? t : t.name || t.template_name) : []);
    } catch {
      // Templates may not exist yet
    }
  }, [company_id]);

  useEffect(() => {
    fetchMembers();
    fetchTemplates();
  }, [fetchMembers, fetchTemplates]);

  const openEdit = (m: TeamMember) => {
    setEditMember(m);
    setEditRole(m.role);
    setEditLimit(m.daily_dispatch_limit || 30);
    setEditActive(m.is_active !== false);
    setEditTemplates(m.allowed_templates || []);
  };

  const saveEdit = async () => {
    if (!editMember || !company_id) return;
    setSaving(true);
    try {
      await callEdge("dispatch-permissions", {
        action: "set",
        company_id,
        collaborator_id: editMember.collaborator_id,
        role: editRole,
        daily_dispatch_limit: editLimit,
        allowed_templates: editTemplates,
        is_active: editActive,
        requester_role: "ceo",
      });
      toast.success("Permissão atualizada!");
      setEditMember(null);
      fetchMembers();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivating || !company_id) return;
    setDeactivateSaving(true);
    try {
      await callEdge("dispatch-permissions", {
        action: "deactivate",
        company_id,
        collaborator_id: deactivating.collaborator_id,
        requester_role: "ceo",
      });
      toast.success("Membro desativado");
      setDeactivating(null);
      fetchMembers();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeactivateSaving(false);
    }
  };

  const addMember = async () => {
    if (!addEmail || !company_id) return;
    setAdding(true);
    try {
      // Lookup collaborator by email
      const { data: collab } = await supabase
        .from("collaborators")
        .select("id")
        .eq("email", addEmail.trim().toLowerCase())
        .maybeSingle();

      if (!collab?.id) {
        toast.error("Colaborador não encontrado com este email");
        setAdding(false);
        return;
      }

      await callEdge("dispatch-permissions", {
        action: "set",
        company_id,
        collaborator_id: collab.id,
        role: addRole,
        daily_dispatch_limit: addLimit,
        allowed_templates: addTemplates,
        requester_role: "ceo",
      });

      toast.success("Membro adicionado!");
      setAddOpen(false);
      setAddEmail("");
      setAddRole("collaborator");
      setAddLimit(30);
      setAddTemplates([]);
      fetchMembers();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAdding(false);
    }
  };

  const filtered = members.filter(
    (m) =>
      !search ||
      m.collaborator_id?.includes(search) ||
      m.user_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.user_email?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleTemplate = (list: string[], setList: (v: string[]) => void, tpl: string) => {
    setList(list.includes(tpl) ? list.filter((t) => t !== tpl) : [...list, tpl]);
  };

  return (
    <DashboardLayout>
      <PageHeader title="Equipe" subtitle="Gerencie permissões de disparo da equipe" />

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar Colaborador
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : filtered.length === 0 && !search ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">Nenhum colaborador cadastrado</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Adicione colaboradores para gerenciar sua equipe</p>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar primeiro colaborador
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Nenhum resultado para "{search}"</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left p-3">Colaborador</th>
                    <th className="text-left p-3">Role</th>
                    <th className="text-left p-3">Limite</th>
                    <th className="text-left p-3 min-w-[150px]">Usado hoje</th>
                    <th className="text-left p-3">Templates</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-right p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => {
                    const limit = m.daily_dispatch_limit || 0;
                    const used = m.daily_dispatches_used || 0;
                    const pct = limit > 0 ? (used / limit) * 100 : 0;
                    const active = m.is_active !== false;
                    const tplCount = m.allowed_templates?.length || 0;
                    return (
                      <tr key={m.id || m.collaborator_id} className={`border-b border-border/50 hover:bg-muted/20 ${!active ? "opacity-50" : ""}`}>
                        <td className="p-3">
                          <p className="font-medium">{m.user_name || m.collaborator_id?.slice(0, 8) + "..."}</p>
                          {m.user_email && <p className="text-xs text-muted-foreground">{m.user_email}</p>}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className={`text-xs ${roleBadgeClass[m.role] || roleBadgeClass.collaborator}`}>
                            {roleLabels[m.role] || m.role}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs">{limit}/dia</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Progress value={Math.min(pct, 100)} className="flex-1 h-2" />
                            <span className="text-xs text-muted-foreground w-14 text-right">{used}/{limit}</span>
                          </div>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {tplCount > 0 ? `${tplCount} aprovado${tplCount > 1 ? "s" : ""}` : "—"}
                        </td>
                        <td className="p-3">
                          {active ? (
                            <Badge variant="outline" className="text-xs text-green-400 border-green-500/30">🟢 Ativo</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">Inativo</Badge>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            {active && (
                              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeactivating(m)}>
                                <UserX className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editMember} onOpenChange={() => setEditMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Permissão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Role</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="director">Diretor</SelectItem>
                  <SelectItem value="manager">Gestor</SelectItem>
                  <SelectItem value="collaborator">Colaborador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Limite diário</Label>
              <Input type="number" value={editLimit} onChange={(e) => setEditLimit(Number(e.target.value))} min={1} />
            </div>
            <div className="flex items-center gap-3">
              <Label>Ativo</Label>
              <Switch checked={editActive} onCheckedChange={setEditActive} />
            </div>
            {approvedTemplates.length > 0 && (
              <div>
                <Label>Templates autorizados</Label>
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                  {approvedTemplates.map((tpl) => (
                    <div key={tpl} className="flex items-center gap-2">
                      <Checkbox
                        checked={editTemplates.includes(tpl)}
                        onCheckedChange={() => toggleTemplate(editTemplates, setEditTemplates, tpl)}
                      />
                      <span className="text-sm">{tpl}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMember(null)}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Dialog */}
      <Dialog open={!!deactivating} onOpenChange={() => setDeactivating(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desativar Membro</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja desativar {deactivating?.user_name || deactivating?.collaborator_id}? Ele não poderá mais fazer disparos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivating(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeactivate} disabled={deactivateSaving}>
              {deactivateSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Desativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Colaborador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email do colaborador</Label>
              <Input placeholder="email@empresa.com" type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={addRole} onValueChange={setAddRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="director">Diretor</SelectItem>
                  <SelectItem value="manager">Gestor</SelectItem>
                  <SelectItem value="collaborator">Colaborador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Limite diário</Label>
              <Input type="number" value={addLimit} onChange={(e) => setAddLimit(Number(e.target.value))} min={1} />
            </div>
            {approvedTemplates.length > 0 && (
              <div>
                <Label>Templates autorizados</Label>
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                  {approvedTemplates.map((tpl) => (
                    <div key={tpl} className="flex items-center gap-2">
                      <Checkbox
                        checked={addTemplates.includes(tpl)}
                        onCheckedChange={() => toggleTemplate(addTemplates, setAddTemplates, tpl)}
                      />
                      <span className="text-sm">{tpl}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={addMember} disabled={adding || !addEmail.trim()}>
              {adding && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
