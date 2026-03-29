import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { toast } from "sonner";
import { Plus, Loader2, Trash2, Users, UserCheck, UserX, Copy, Check } from "lucide-react";
import { format } from "date-fns";

interface Member {
  id: string;
  name: string;
  email: string;
  active: boolean;
  created_at: string;
  roles: { name: string; level: number } | null;
}

interface Role {
  id: string;
  name: string;
  level: number;
}

export default function MeuTime() {
  const { collaborator, roleLevel } = useCollaborator();
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { selectedCompanyId } = useCompanyFilter();
  const companyId = (selectedCompanyId && selectedCompanyId !== "all") ? selectedCompanyId : collaborator?.company_id;

  async function fetchMembers() {
    if (!companyId || !collaborator) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("collaborators")
      .select("id, name, email, active, created_at, roles:role_id(name, level)")
      .eq("company_id", companyId)
      .neq("id", collaborator.id)
      .order("name");

    if (error) {
      toast.error("Erro ao carregar membros");
      console.error(error);
    } else {
      setMembers((data as any[]) || []);
    }
    setLoading(false);
  }

  async function fetchRoles() {
    if (!companyId) return;
    const { data } = await supabase
      .from("roles")
      .select("id, name, level")
      .eq("company_id", companyId)
      .order("level");
    if (data) setRoles(data);
  }

  useEffect(() => {
    fetchMembers();
    fetchRoles();
  }, [companyId, collaborator?.id]);

  const totalMembers = members.length;
  const activeMembers = members.filter((m) => m.active).length;
  const inactiveMembers = totalMembers - activeMembers;

  async function handleToggleActive(member: Member) {
    const newActive = !member.active;
    const { error } = await supabase
      .from("collaborators")
      .update({ active: newActive })
      .eq("id", member.id);

    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      toast.success(newActive ? "Membro ativado" : "Membro desativado");
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, active: newActive } : m))
      );
    }
  }

  async function handleDelete(memberId: string) {
    const { error } = await supabase
      .from("collaborators")
      .delete()
      .eq("id", memberId);

    if (error) {
      toast.error("Erro ao remover membro");
    } else {
      toast.success("Membro removido");
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    }
    setDeleteConfirm(null);
  }

  async function handleInvite() {
    if (!inviteName.trim() || !inviteEmail.trim() || !inviteRoleId) {
      toast.error("Preencha todos os campos");
      return;
    }
    setSubmitting(true);

    const token = crypto.randomUUID();
    const { error } = await supabase.from("invite_links").insert({
      token,
      company_id: companyId,
      role_id: inviteRoleId,
      active: true,
      max_uses: 1,
      used_count: 0,
      metadata: { invited_name: inviteName, invited_email: inviteEmail },
    });

    if (error) {
      toast.error("Erro ao criar convite");
      console.error(error);
    } else {
      const link = `${window.location.origin}/register?token=${token}`;
      setInviteLink(link);
      toast.success("Convite criado com sucesso!");
    }
    setSubmitting(false);
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  }

  function resetInviteDialog() {
    setInviteOpen(false);
    setInviteName("");
    setInviteEmail("");
    setInviteRoleId("");
    setInviteLink("");
    setCopied(false);
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Meu Time"
        subtitle="Gerencie os membros do seu time"
      >
        <Button onClick={() => setInviteOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Convidar Membro
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total de Membros</p>
              <p className="text-2xl font-bold">{totalMembers}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <UserCheck className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="text-sm text-muted-foreground">Ativos</p>
              <p className="text-2xl font-bold text-emerald-500">{activeMembers}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <UserX className="h-8 w-8 text-red-400" />
            <div>
              <p className="text-sm text-muted-foreground">Inativos</p>
              <p className="text-2xl font-bold text-red-400">{inactiveMembers}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de membros */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum membro no time</p>
              <p className="text-sm">Convide alguem clicando em "Convidar Membro"</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell className="text-muted-foreground">{member.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {member.roles?.name || "Sem cargo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={member.active}
                          onCheckedChange={() => handleToggleActive(member)}
                        />
                        <Badge variant={member.active ? "default" : "secondary"}>
                          {member.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.created_at
                        ? format(new Date(member.created_at), "dd/MM/yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {deleteConfirm === member.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-muted-foreground">Confirmar?</span>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(member.id)}
                          >
                            Sim
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDeleteConfirm(null)}
                          >
                            Nao
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-400 hover:text-red-500 hover:bg-red-500/10"
                          onClick={() => setDeleteConfirm(member.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Convite */}
      <Dialog open={inviteOpen} onOpenChange={(open) => !open && resetInviteDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar Membro</DialogTitle>
          </DialogHeader>

          {!inviteLink ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome</label>
                <Input
                  placeholder="Nome do membro"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Cargo</label>
                <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleInvite}
                  disabled={submitting}
                  className="w-full gap-2"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Gerar Link de Convite
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Envie este link para <strong>{inviteName}</strong> ({inviteEmail}):
              </p>
              <div className="flex items-center gap-2">
                <Input value={inviteLink} readOnly className="text-xs" />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleCopyLink}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetInviteDialog} className="w-full">
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
