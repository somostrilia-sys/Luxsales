import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Plus, Loader2, Users, Edit, Search } from "lucide-react";

interface TeamMember {
  id: string;
  collaborator_id: string;
  role: string;
  daily_limit: number;
  dispatches_today: number;
  active: boolean;
  user_email?: string;
  user_name?: string;
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
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [editRole, setEditRole] = useState("collaborator");
  const [editLimit, setEditLimit] = useState(30);
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("collaborator");
  const [addLimit, setAddLimit] = useState(30);
  const [adding, setAdding] = useState(false);

  const fetchMembers = async () => {
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
  };

  useEffect(() => {
    fetchMembers();
  }, []);

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

    if (error) {
      toast.error("Erro ao salvar");
    } else {
      toast.success("Permissão atualizada!");
      setEditMember(null);
      fetchMembers();
    }
    setSaving(false);
  };

  const addMember = async () => {
    if (!addEmail) return;
    setAdding(true);

    // Look up user by email in collaborators
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
        company_id: collaborator?.company_id,
        role: addRole,
        daily_limit: addLimit,
      });

    if (error) {
      if (error.code === "23505") {
        toast.error("Este colaborador já possui permissão");
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success("Membro adicionado!");
      setAddOpen(false);
      setAddEmail("");
      fetchMembers();
    }
    setAdding(false);
  };

  const filtered = members.filter(
    (m) => !search || m.collaborator_id.includes(search) || m.user_email?.toLowerCase().includes(search.toLowerCase())
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
          <Plus className="h-4 w-4 mr-1" /> Adicionar Membro
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => (
            <Card key={m.id} className={!m.active ? "opacity-50" : ""}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{m.user_name || m.collaborator_id.slice(0, 8) + "..."}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">{roleLabels[m.role] || m.role}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {m.dispatches_today}/{m.daily_limit} disparos hoje
                    </span>
                    {!m.active && <Badge variant="destructive" className="text-xs">Inativo</Badge>}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>
                  <Edit className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
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
                  <SelectItem value="ceo">CEO</SelectItem>
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

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Membro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email do colaborador</Label>
              <Input placeholder="email@empresa.com" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} />
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
