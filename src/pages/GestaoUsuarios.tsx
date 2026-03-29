import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, Users2, Plus, Copy, Ban, Pencil, Link,
} from "lucide-react";
import { SUPABASE_URL } from "@/lib/constants";

const MODULES = [
  { key: "leads", label: "Leads" },
  { key: "dialer", label: "Discador" },
  { key: "conversations", label: "Conversas WA" },
  { key: "templates", label: "Templates" },
  { key: "queues", label: "Filas" },
  { key: "reports", label: "Relatórios" },
  { key: "config", label: "Configurações" },
  { key: "team", label: "Equipe" },
  { key: "whatsapp", label: "WhatsApp Business" },
];

interface PermissionRow {
  module: string;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface CollabRow {
  id: string;
  name: string;
  email: string;
  active: boolean;
  role: { name: string; level: number } | null;
  permissions: PermissionRow[];
}

interface InviteRow {
  id: string;
  token: string;
  invited_name: string | null;
  invited_email: string | null;
  company_id: string;
  company_name?: string;
  role_id: string;
  role_name?: string;
  expires_at: string | null;
  used_count: number;
  max_uses: number | null;
  active: boolean;
  permissions: PermissionRow[];
  created_at: string;
}

interface Role {
  id: string;
  name: string;
  level: number;
}

interface Company {
  id: string;
  name: string;
}

const ROLE_DEFAULT_PERMS: Record<number, Partial<PermissionRow>[]> = {
  3: [
    { module: "leads", can_view: true }, { module: "dialer", can_view: true },
    { module: "conversations", can_view: true }, { module: "templates", can_view: true },
    { module: "queues", can_view: true }, { module: "reports", can_view: true },
  ],
  2: [
    { module: "leads", can_view: true, can_edit: true }, { module: "dialer", can_view: true, can_edit: true },
    { module: "conversations", can_view: true, can_edit: true }, { module: "templates", can_view: true, can_edit: true },
    { module: "queues", can_view: true, can_edit: true }, { module: "reports", can_view: true },
    { module: "team", can_view: true },
  ],
  1: [
    { module: "leads", can_view: true, can_edit: true, can_delete: true },
    { module: "dialer", can_view: true, can_edit: true },
    { module: "conversations", can_view: true, can_edit: true, can_delete: true },
    { module: "templates", can_view: true, can_edit: true, can_delete: true },
    { module: "queues", can_view: true, can_edit: true, can_delete: true },
    { module: "reports", can_view: true, can_edit: true },
    { module: "team", can_view: true, can_edit: true },
    { module: "whatsapp", can_view: true },
  ],
};

function defaultPerms(level?: number): PermissionRow[] {
  const base = level !== undefined ? (ROLE_DEFAULT_PERMS[level] || ROLE_DEFAULT_PERMS[3]) : [];
  return MODULES.map(m => {
    const found = base.find(p => p.module === m.key);
    return {
      module: m.key,
      can_view: found?.can_view ?? false,
      can_edit: found?.can_edit ?? false,
      can_delete: found?.can_delete ?? false,
    };
  });
}

export default function GestaoUsuarios() {
  const { collaborator, isCEO, roleLevel } = useCollaborator();
  const { companies, selectedCompanyId } = useCompanyFilter();

  const [collabs, setCollabs] = useState<CollabRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitesLoading, setInvitesLoading] = useState(true);

  // Edit permissions modal
  const [editTarget, setEditTarget] = useState<CollabRow | null>(null);
  const [editPerms, setEditPerms] = useState<PermissionRow[]>([]);
  const [saving, setSaving] = useState(false);

  // Create invite modal
  const [showCreateInvite, setShowCreateInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCompany, setInviteCompany] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [invitePerms, setInvitePerms] = useState<PermissionRow[]>(defaultPerms(3));
  const [inviteValidity, setInviteValidity] = useState("7");
  const [inviteMaxUses, setInviteMaxUses] = useState("1");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const companyId = isCEO
    ? (selectedCompanyId === "all" ? null : selectedCompanyId)
    : collaborator?.company_id;

  // Load roles and companies
  useEffect(() => {
    supabase.from("roles").select("id, name, level").order("level").then(({ data }) => {
      setRoles(data || []);
    });
    if (isCEO) {
      supabase.from("companies").select("id, name").order("name").then(({ data }) => {
        setAllCompanies(data || []);
      });
    } else if (collaborator) {
      setAllCompanies([{ id: collaborator.company_id, name: collaborator.company?.name || "" }]);
    }
  }, [isCEO, collaborator]);

  // Set default invite company
  useEffect(() => {
    if (!inviteCompany && allCompanies.length > 0) {
      setInviteCompany(companyId || allCompanies[0].id);
    }
  }, [allCompanies, companyId, inviteCompany]);

  const fetchCollabs = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("collaborators")
      .select("id, name, email, active, role:roles(name, level), company:companies(name)")
      .order("name");

    if (companyId) {
      query = query.eq("company_id", companyId);
    }

    const { data: collabData } = await query;
    if (!collabData) { setLoading(false); return; }

    // Fetch permissions for all collaborators
    const ids = collabData.map(c => c.id);
    let permsData: any[] = [];
    if (ids.length > 0) {
      const { data } = await supabase
        .from("user_permissions")
        .select("collaborator_id, module, can_view, can_edit, can_delete")
        .in("collaborator_id", ids);
      permsData = data || [];
    }

    const collabsWithPerms = collabData.map(c => ({
      ...c,
      role: c.role as { name: string; level: number } | null,
      permissions: permsData.filter(p => p.collaborator_id === c.id),
    }));

    setCollabs(collabsWithPerms);
    setLoading(false);
  }, [companyId]);

  const fetchInvites = useCallback(async () => {
    setInvitesLoading(true);
    let query = supabase
      .from("invite_links")
      .select("id, token, invited_name, invited_email, company_id, role_id, expires_at, used_count, max_uses, active, permissions, created_at, company:companies(name), role:roles(name)")
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (companyId) {
      query = query.eq("company_id", companyId);
    }

    const { data } = await query;
    const rows = (data || []).map((r: any) => ({
      ...r,
      company_name: r.company?.name,
      role_name: r.role?.name,
    }));
    setInvites(rows);
    setInvitesLoading(false);
  }, [companyId]);

  useEffect(() => { fetchCollabs(); }, [fetchCollabs]);
  useEffect(() => { fetchInvites(); }, [fetchInvites]);

  // Open edit permissions modal
  const openEdit = (c: CollabRow) => {
    const existing = c.permissions;
    const merged = MODULES.map(m => {
      const found = existing.find(p => p.module === m.key);
      return found || { module: m.key, can_view: false, can_edit: false, can_delete: false };
    });
    setEditPerms(merged);
    setEditTarget(c);
  };

  const savePermissions = async () => {
    if (!editTarget) return;
    setSaving(true);
    // Upsert permissions
    const rows = editPerms.map(p => ({
      collaborator_id: editTarget.id,
      company_id: companyId || collaborator?.company_id,
      module: p.module,
      can_view: p.can_view,
      can_edit: p.can_edit,
      can_delete: p.can_delete,
    }));

    const { error } = await supabase
      .from("user_permissions")
      .upsert(rows, { onConflict: "collaborator_id,module" });

    if (error) {
      toast.error("Erro ao salvar permissões");
    } else {
      toast.success("Permissões atualizadas");
      setEditTarget(null);
      fetchCollabs();
    }
    setSaving(false);
  };

  const deactivateCollab = async (id: string) => {
    const { error } = await supabase.from("collaborators").update({ active: false }).eq("id", id);
    if (error) { toast.error("Erro ao desativar colaborador"); return; }
    toast.success("Colaborador desativado");
    fetchCollabs();
  };

  const togglePerm = (idx: number, field: "can_view" | "can_edit" | "can_delete") => {
    setEditPerms(prev => prev.map((p, i) => i === idx ? { ...p, [field]: !p[field] } : p));
  };

  const toggleInvitePerm = (idx: number, field: "can_view" | "can_edit") => {
    setInvitePerms(prev => prev.map((p, i) => i === idx ? { ...p, [field]: !p[field] } : p));
  };

  const createInvite = async () => {
    if (!inviteCompany || !inviteRole) {
      toast.error("Selecione a empresa e o cargo");
      return;
    }
    setCreatingInvite(true);

    const token = crypto.randomUUID();
    let expiresAt: string | null = null;
    if (inviteValidity !== "0") {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(inviteValidity));
      expiresAt = d.toISOString();
    }

    const maxUses = inviteMaxUses === "0" ? null : parseInt(inviteMaxUses);

    const { error } = await supabase.from("invite_links").insert({
      token,
      company_id: inviteCompany,
      role_id: inviteRole,
      invited_name: inviteName || null,
      invited_email: inviteEmail || null,
      permissions: invitePerms.filter(p => p.can_view || p.can_edit),
      expires_at: expiresAt,
      max_uses: maxUses,
      used_count: 0,
      active: true,
      created_by: collaborator?.id,
    });

    if (error) {
      toast.error("Erro ao criar convite: " + error.message);
      setCreatingInvite(false);
      return;
    }

    const link = `${window.location.origin}/convite/${token}`;
    setCreatedLink(link);
    fetchInvites();
    setCreatingInvite(false);
  };

  const copyLink = (token: string) => {
    const link = `${window.location.origin}/convite/${token}`;
    navigator.clipboard.writeText(link).then(() => toast.success("Link copiado!"));
  };

  const revokeInvite = async (id: string) => {
    await supabase.from("invite_links").update({ active: false }).eq("id", id);
    toast.success("Convite revogado");
    fetchInvites();
  };

  const resetCreateModal = () => {
    setInviteName("");
    setInviteEmail("");
    setInviteRole("");
    setInviteCompany(companyId || allCompanies[0]?.id || "");
    setInvitePerms(defaultPerms(3));
    setInviteValidity("7");
    setInviteMaxUses("1");
    setCreatedLink(null);
  };

  const formatExpiry = (expires_at: string | null) => {
    if (!expires_at) return "Sem expiração";
    return new Date(expires_at).toLocaleDateString("pt-BR");
  };

  if (roleLevel > 1) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Acesso restrito.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Gestão de Usuários"
        subtitle="Gerencie colaboradores e convites"
      />

      <Tabs defaultValue="team">
        <TabsList className="mb-6">
          <TabsTrigger value="team">Equipe</TabsTrigger>
          <TabsTrigger value="invites">Convites</TabsTrigger>
        </TabsList>

        {/* === ABA EQUIPE === */}
        <TabsContent value="team">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : collabs.length === 0 ? (
                <div className="py-16 text-center">
                  <Users2 className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">Nenhum colaborador encontrado</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        {!companyId && <TableHead>Empresa</TableHead>}
                        <TableHead>Cargo</TableHead>
                        <TableHead>Módulos</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {collabs.map(c => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.email}</TableCell>
                          {!companyId && <TableCell className="text-xs text-muted-foreground">{(c as any).company?.name || "—"}</TableCell>}
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{c.role?.name || "—"}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {c.permissions.filter(p => p.can_view).slice(0, 4).map(p => (
                                <Badge key={p.module} variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {MODULES.find(m => m.key === p.module)?.label || p.module}
                                </Badge>
                              ))}
                              {c.permissions.filter(p => p.can_view).length > 4 && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  +{c.permissions.filter(p => p.can_view).length - 4}
                                </Badge>
                              )}
                              {c.permissions.filter(p => p.can_view).length === 0 && (
                                <span className="text-xs text-muted-foreground">Todos (CEO)</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {c.active ? (
                              <Badge variant="outline" className="text-xs text-green-400 border-green-500/30 bg-green-500/10">Ativo</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-red-400 border-red-500/30 bg-red-500/10">Inativo</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="sm" onClick={() => openEdit(c)} title="Editar Permissões">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {c.active && (
                                <Button variant="ghost" size="sm" onClick={() => deactivateCollab(c.id)} title="Desativar">
                                  <Ban className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === ABA CONVITES === */}
        <TabsContent value="invites">
          <div className="flex justify-end mb-4">
            <Button
              onClick={() => { resetCreateModal(); setShowCreateInvite(true); }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Criar Convite
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {invitesLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : invites.length === 0 ? (
                <div className="py-16 text-center">
                  <Link className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">Nenhum convite ativo</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Convidado</TableHead>
                        <TableHead>Cargo</TableHead>
                        {isCEO && <TableHead>Empresa</TableHead>}
                        <TableHead>Expira</TableHead>
                        <TableHead>Usos</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invites.map(inv => (
                        <TableRow key={inv.id}>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">{inv.invited_name || "—"}</p>
                              <p className="text-xs text-muted-foreground">{inv.invited_email || "—"}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{inv.role_name || "—"}</Badge>
                          </TableCell>
                          {isCEO && (
                            <TableCell className="text-xs text-muted-foreground">{inv.company_name || "—"}</TableCell>
                          )}
                          <TableCell className="text-xs">{formatExpiry(inv.expires_at)}</TableCell>
                          <TableCell className="text-xs">
                            {inv.used_count}/{inv.max_uses === null ? "∞" : inv.max_uses}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="sm" onClick={() => copyLink(inv.token)} title="Copiar link">
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => revokeInvite(inv.id)} title="Revogar">
                                <Ban className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* === MODAL: Editar Permissões === */}
      <Dialog open={!!editTarget} onOpenChange={open => !open && setEditTarget(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Permissões — {editTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground px-1 mb-1">
              <span>Módulo</span>
              <span className="text-center">Ver</span>
              <span className="text-center">Editar</span>
              <span className="text-center">Excluir</span>
            </div>
            {editPerms.map((p, idx) => (
              <div key={p.module} className="grid grid-cols-4 gap-2 items-center px-1 py-1.5 rounded-lg hover:bg-secondary/40">
                <span className="text-sm">{MODULES.find(m => m.key === p.module)?.label}</span>
                <div className="flex justify-center">
                  <Checkbox checked={p.can_view} onCheckedChange={() => togglePerm(idx, "can_view")} />
                </div>
                <div className="flex justify-center">
                  <Checkbox checked={p.can_edit} onCheckedChange={() => togglePerm(idx, "can_edit")} />
                </div>
                <div className="flex justify-center">
                  <Checkbox checked={p.can_delete} onCheckedChange={() => togglePerm(idx, "can_delete")} />
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancelar</Button>
            <Button onClick={savePermissions} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === MODAL: Criar Convite === */}
      <Dialog open={showCreateInvite} onOpenChange={open => { if (!open) { setShowCreateInvite(false); setCreatedLink(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Convite</DialogTitle>
          </DialogHeader>

          {createdLink ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Convite criado com sucesso! Copie o link abaixo:</p>
              <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg border border-border">
                <code className="text-xs flex-1 break-all">{createdLink}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(createdLink).then(() => toast.success("Copiado!"))}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => { setShowCreateInvite(false); setCreatedLink(null); }}>Fechar</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nome (opcional)</Label>
                  <Input placeholder="Nome do convidado" value={inviteName} onChange={e => setInviteName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email (opcional)</Label>
                  <Input type="email" placeholder="email@exemplo.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                </div>
              </div>

              {isCEO && (
                <div className="space-y-1.5">
                  <Label>Empresa</Label>
                  <Select value={inviteCompany} onValueChange={setInviteCompany}>
                    <SelectTrigger><SelectValue placeholder="Selecionar empresa" /></SelectTrigger>
                    <SelectContent>
                      {allCompanies.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Cargo</Label>
                <Select value={inviteRole} onValueChange={(v) => { setInviteRole(v); const r = roles.find(r => r.id === v); if (r) setInvitePerms(defaultPerms(r.level)); }}>
                  <SelectTrigger><SelectValue placeholder="Selecionar cargo" /></SelectTrigger>
                  <SelectContent>
                    {roles.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Validade</Label>
                  <Select value={inviteValidity} onValueChange={setInviteValidity}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 dias</SelectItem>
                      <SelectItem value="30">30 dias</SelectItem>
                      <SelectItem value="0">Sem expiração</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Usos máximos</Label>
                  <Select value={inviteMaxUses} onValueChange={setInviteMaxUses}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 uso</SelectItem>
                      <SelectItem value="5">5 usos</SelectItem>
                      <SelectItem value="0">Ilimitado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Permissões</Label>
                <div className="grid grid-cols-3 gap-1 text-xs font-medium text-muted-foreground px-1 mb-1">
                  <span>Módulo</span>
                  <span className="text-center">Ver</span>
                  <span className="text-center">Editar</span>
                </div>
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {invitePerms.map((p, idx) => (
                    <div key={p.module} className="grid grid-cols-3 gap-1 items-center px-1 py-1 rounded hover:bg-secondary/30">
                      <span className="text-sm">{MODULES.find(m => m.key === p.module)?.label}</span>
                      <div className="flex justify-center">
                        <Checkbox checked={p.can_view} onCheckedChange={() => toggleInvitePerm(idx, "can_view")} />
                      </div>
                      <div className="flex justify-center">
                        <Checkbox checked={p.can_edit} onCheckedChange={() => toggleInvitePerm(idx, "can_edit")} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateInvite(false)}>Cancelar</Button>
                <Button onClick={createInvite} disabled={creatingInvite || !inviteRole || !inviteCompany}>
                  {creatingInvite && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar Convite
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
