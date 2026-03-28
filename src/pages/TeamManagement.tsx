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
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { EDGE_BASE } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Plus, Loader2, Edit, Search, UserX, Users, Inbox } from "lucide-react";

interface TeamMember {
  id: string;
  collaborator_id: string;
  role: string;
  daily_limit: number;
  dispatches_today: number;
  active: boolean;
  user_email?: string;
  user_name?: string;
  templates_count?: number;
}

const roleLabels: Record<string, string> = {
  ceo: "CEO",
  director: "Diretor",
  manager: "Gestor",
  collaborator: "Colaborador",
};

export default function TeamManagement() {
  const { collaborator } = useCollaborator();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Edit modal
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [editRole, setEditRole] = useState("collaborator");
  const [editLimit, setEditLimit] = useState(30);
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Add modal
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addName, setAddName] = useState("");
  const [addRole, setAddRole] = useState("collaborator");
  const [addLimit, setAddLimit] = useState(30);
  const [adding, setAdding] = useState(false);

  // Deactivate confirm
  const [deactivating, setDeactivating] = useState<TeamMember | null>(null);
  const [deactivateSaving, setDeactivateSaving] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("dispatch_permissions")
      .select("id, collaborator_id, role, daily_limit, dispatches_today, active")
      .order("role");

    if (error) {
      toast.error("Erro ao carregar equipe");
    } else {
      setMembers((data || []) as TeamMember[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const openEdit = (m: TeamMember) => {
    setEditMember(m);
    setEditRole(m.role);
    setEditLimit(m.daily_limit);
    setEditActive(m.active);
  };

  const saveEdit = async () => {
    if (!editMember) return;
    setSaving(true);
    const { error } = await supabase
      .from("dispatch_permissions")
      .update({ role: editRole, daily_limit: editLimit, active: editActive })
      .eq("id", editMember.id);

    if (error) toast.error("Erro ao salvar");
    else {
      toast.success("Permissão atualizada!");
      setEditMember(null);
      fetchMembers();
    }
    setSaving(false);
  };

  const handleDeactivate = async () => {
    if (!deactivating) return;
    setDeactivateSaving(true);
    const { error } = await supabase
      .from("dispatch_permissions")
      .update({ active: false })
      .eq("id", deactivating.id);

    if (error) toast.error("Erro ao desativar");
    else {
      toast.success("Membro desativado");
      setDeactivating(null);
      fetchMembers();
    }
    setDeactivateSaving(false);
  };

  const addMember = async () => {
    if (!addEmail || !collaborator) return;
    setAdding(true);

    const { data: collab } = await supabase
      .from("collaborators")
      .select("auth_user_id")
      .eq("email", addEmail)
      .maybeSingle();

    if (!collab?.auth_user_id) {
      toast.error("Colaborador não encontrado com este email");
      setAdding(false);
      return;
    }

    const { error } = await supabase
      .from("dispatch_permissions")
      .insert({
        collaborator_id: collab.auth_user_id,
        company_id: collaborator.company_id,
        role: addRole,
        daily_limit: addLimit,
      });

    if (error) {
      if (error.code === "23505") toast.error("Este colaborador já possui permissão");
      else toast.error(error.message);
    } else {
      toast.success("Membro adicionado!");
      setAddOpen(false);
      setAddEmail("");
      setAddName("");
      fetchMembers();
    }
    setAdding(false);
  };

  const filtered = members.filter(
    (m) => !search || m.collaborator_id.includes(search) || m.user_name?.toLowerCase().includes(search.toLowerCase()) || m.user_email?.toLowerCase().includes(search.toLowerCase())
  );

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
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Inbox className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Nenhum membro encontrado</p>
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
                    <th className="text-left p-3">Status</th>
                    <th className="text-right p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => {
                    const pct = m.daily_limit > 0 ? (m.dispatches_today / m.daily_limit) * 100 : 0;
                    return (
                      <tr key={m.id} className={`border-b border-border/50 hover:bg-muted/20 ${!m.active ? "opacity-50" : ""}`}>
                        <td className="p-3">
                          <p className="font-medium">{m.user_name || m.collaborator_id.slice(0, 8) + "..."}</p>
                          {m.user_email && <p className="text-xs text-muted-foreground">{m.user_email}</p>}
                        </td>
                        <td className="p-3">
                          <Badge variant="secondary" className="text-xs">{roleLabels[m.role] || m.role}</Badge>
                        </td>
                        <td className="p-3 text-xs">{m.daily_limit}/dia</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Progress value={pct} className="flex-1 h-2" />
                            <span className="text-xs text-muted-foreground w-14 text-right">{m.dispatches_today}/{m.daily_limit}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          {m.active ? (
                            <Badge variant="outline" className="text-green-400 text-xs">Ativo</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">Inativo</Badge>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            {m.active && (
                              <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => setDeactivating(m)}>
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
              <Input type="number" value={editLimit} onChange={(e) => setEditLimit(Number(e.target.value))} />
            </div>
            <div className="flex items-center gap-3">
              <Label>Ativo</Label>
              <Switch checked={editActive} onCheckedChange={setEditActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMember(null)}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
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
              {deactivateSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
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
              <Input placeholder="email@empresa.com" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} />
            </div>
            <div>
              <Label>Nome</Label>
              <Input placeholder="Nome completo" value={addName} onChange={(e) => setAddName(e.target.value)} />
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
              <Input type="number" value={addLimit} onChange={(e) => setAddLimit(Number(e.target.value))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={addMember} disabled={adding || !addEmail}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
