import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { toast } from "sonner";
import { Plus, Pencil, Loader2, Trash2, UserX, UserCheck, Link2, Copy, ExternalLink, XCircle, MessageCircle } from "lucide-react";
import { format } from "date-fns";

interface InviteLink {
  id: string;
  token: string;
  company_id: string | null;
  role: string | null;
  max_uses: number | null;
  current_uses: number | null;
  expires_at: string | null;
  is_active: boolean | null;
  created_at: string | null;
}

export default function Colaboradores() {
  const { isCEO, roleLevel, collaborator: currentCollab } = useCollaborator();
  const { selectedCompanyId } = useCompanyFilter();
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [roleAgentAccess, setRoleAgentAccess] = useState<any[]>([]);
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const [form, setForm] = useState({
    name: "", email: "", phone: "", whatsapp: "",
    company_id: "", role_id: "", active: true, reports_to: "",
  });
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [allCollaborators, setAllCollaborators] = useState<any[]>([]);

  // Invite link state
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ company_id: "", role_id: "", max_uses: "9999", expires_days: "7" });
  const [inviteCreating, setInviteCreating] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState("");
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
  const [inviteListOpen, setInviteListOpen] = useState(false);

  const canManageInvites = roleLevel <= 1 || currentCollab?.is_super_admin;

  useEffect(() => { loadData(); if (canManageInvites) loadInvites(); }, [selectedCompanyId]);

  const loadData = async () => {
    setLoading(true);
    let collabQuery = supabase.from("collaborators").select(`
      id, name, email, phone, whatsapp, active, company_id, role_id, unit_id, unit_ids, company_ids, reports_to,
      company:companies!collaborators_company_id_fkey(id, name),
      role:roles!collaborators_role_id_fkey(id, name, level),
      unit:units!collaborators_unit_id_fkey(id, name)
    `).order("name");

    if (selectedCompanyId !== "all") collabQuery = collabQuery.eq("company_id", selectedCompanyId);

    const [collabRes, compRes, roleRes, unitRes, agentRes, raaRes, allCollabRes] = await Promise.all([
      collabQuery,
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("roles").select("id, name, level, company_id").order("level"),
      supabase.from("units").select("id, name, company_id").order("name"),
      supabase.from("agent_definitions").select("id, name, emoji, company_id").eq("active", true).order("name"),
      supabase.from("role_agent_access").select("role_id, agent_id"),
      supabase.from("collaborators").select("id, name, email, company_id, company_ids, role:roles!collaborators_role_id_fkey(name)").eq("active", true).order("name"),
    ]);
    setCollaborators(collabRes.data || []);
    setCompanies(compRes.data || []);
    setRoles(roleRes.data || []);
    setUnits(unitRes.data || []);
    setAgents(agentRes.data || []);
    setRoleAgentAccess(raaRes.data || []);
    setAllCollaborators(allCollabRes.data || []);
    setLoading(false);
  };

  const loadInvites = async () => {
    const { data } = await supabase
      .from("invite_links")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setInviteLinks(data || []);
  };

  const filteredCollaborators = collaborators.filter(c => {
    if (filterCompany !== "all" && c.company_id !== filterCompany) return false;
    if (filterRole !== "all" && c.role_id !== filterRole) return false;
    return true;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", email: "", phone: "", whatsapp: "", company_id: "", role_id: "", active: true, reports_to: "" });
    setSelectedUnitIds([]);
    setSelectedCompanyIds([]);
    setSelectedAgents(new Set());
    setModalOpen(true);
  };

  const openEdit = async (c: any) => {
    setEditing(c);
    setForm({
      name: c.name, email: c.email, phone: c.phone || "", whatsapp: c.whatsapp || "",
      company_id: c.company_id, role_id: c.role_id, active: c.active, reports_to: c.reports_to || "",
    });
    setSelectedUnitIds(Array.isArray(c.unit_ids) ? c.unit_ids : c.unit_id ? [c.unit_id] : []);
    setSelectedCompanyIds(Array.isArray(c.company_ids) ? c.company_ids : []);
    const { data } = await supabase.from("collaborator_agent_access").select("agent_id, has_access").eq("collaborator_id", c.id);
    const overrides = new Map((data || []).map((d: any) => [d.agent_id, d.has_access]));
    const roleAgents = new Set(roleAgentAccess.filter(r => r.role_id === c.role_id).map(r => r.agent_id));
    overrides.forEach((hasAccess, agentId) => {
      if (hasAccess) roleAgents.add(agentId);
      else roleAgents.delete(agentId);
    });
    setSelectedAgents(roleAgents);
    setModalOpen(true);
  };

  const handleCompanyChange = (companyId: string) => {
    setForm(prev => ({ ...prev, company_id: companyId, role_id: "", reports_to: "" }));
    setSelectedUnitIds([]);
    setSelectedCompanyIds(prev => prev.filter(id => id !== companyId));
    setSelectedAgents(new Set());
  };

  const toggleCompanyId = (companyId: string) => {
    setSelectedCompanyIds(prev =>
      prev.includes(companyId) ? prev.filter(id => id !== companyId) : [...prev, companyId]
    );
  };

  const handleRoleChange = (roleId: string) => {
    setForm(prev => ({ ...prev, role_id: roleId }));
    const defaults = new Set(roleAgentAccess.filter(r => r.role_id === roleId).map(r => r.agent_id));
    setSelectedAgents(defaults);
  };

  const save = async () => {
    if (!form.name || !form.email || !form.company_id || !form.role_id) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    const payload: any = {
      name: form.name, email: form.email, phone: form.phone || null,
      whatsapp: form.whatsapp || null, company_id: form.company_id,
      role_id: form.role_id, active: form.active,
      unit_id: selectedUnitIds.length > 0 ? selectedUnitIds[0] : null,
      unit_ids: selectedUnitIds.length > 0 ? selectedUnitIds : null,
      company_ids: selectedCompanyIds.length > 0 ? selectedCompanyIds : null,
      reports_to: form.reports_to || null,
    };
    let collabId: string;
    if (editing) {
      await supabase.from("collaborators").update(payload).eq("id", editing.id);
      collabId = editing.id;
    } else {
      const { data, error } = await supabase.from("collaborators").insert(payload).select("id").single();
      if (error) { toast.error(error.message); return; }
      collabId = data.id;
    }
    await supabase.from("collaborator_agent_access").delete().eq("collaborator_id", collabId);
    const roleDefaults = new Set(roleAgentAccess.filter(r => r.role_id === form.role_id).map(r => r.agent_id));
    const overrides: any[] = [];
    selectedAgents.forEach(agentId => {
      if (!roleDefaults.has(agentId)) overrides.push({ collaborator_id: collabId, agent_id: agentId, has_access: true });
    });
    roleDefaults.forEach(agentId => {
      if (!selectedAgents.has(agentId)) overrides.push({ collaborator_id: collabId, agent_id: agentId, has_access: false });
    });
    if (overrides.length > 0) await supabase.from("collaborator_agent_access").insert(overrides);
    toast.success(editing ? "Colaborador atualizado" : "Colaborador criado");
    setModalOpen(false);
    loadData();
  };

  const manageCollaborator = async (action: string, collaboratorId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/manage-collaborator`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
          body: JSON.stringify({ action, collaborator_id: collaboratorId }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");
      toast.success(action === "delete" ? "Colaborador excluído" : action === "deactivate" ? "Colaborador desativado" : "Colaborador ativado");
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // ─── Invite Functions ───
  const openInviteDialog = () => {
    setInviteForm({ company_id: "", role_id: "", max_uses: "9999", expires_days: "7" });
    setGeneratedInviteLink("");
    setInviteDialogOpen(true);
  };

  const handleCreateInvite = async () => {
    if (!inviteForm.company_id || !inviteForm.role_id) {
      toast.error("Selecione empresa e cargo");
      return;
    }
    setInviteCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(inviteForm.expires_days || "7"));
      const { data, error } = await supabase.from("invite_links").insert({
        company_id: inviteForm.company_id,
        role: inviteForm.role_id,
        max_uses: parseInt(inviteForm.max_uses || "9999"),
        expires_at: expiresAt.toISOString(),
        created_by: session?.user?.id || null,
      }).select("token").single();
      if (error) throw error;
      const link = `${window.location.origin}/register?token=${data.token}`;
      setGeneratedInviteLink(link);
      toast.success("Link de convite gerado!");
      loadInvites();
    } catch (e: any) {
      toast.error("Erro ao gerar convite: " + e.message);
    } finally {
      setInviteCreating(false);
    }
  };

  const copyLink = (token: string) => {
    const link = `${window.location.origin}/register?token=${token}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const shareWhatsApp = (token: string) => {
    const link = `${window.location.origin}/register?token=${token}`;
    const text = encodeURIComponent(`Olá! Use este link para se cadastrar no sistema:\n${link}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const deactivateInvite = async (id: string) => {
    const { error } = await supabase.from("invite_links").update({ is_active: false }).eq("id", id);
    if (error) toast.error("Erro ao desativar");
    else { toast.success("Convite desativado"); loadInvites(); }
  };

  const getInviteStatus = (invite: InviteLink) => {
    if (!invite.is_active) return { label: "Desativado", cls: "bg-muted text-muted-foreground" };
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) return { label: "Expirado", cls: "bg-destructive/20 text-destructive" };
    if (invite.current_uses !== null && invite.max_uses !== null && invite.current_uses >= invite.max_uses) return { label: "Esgotado", cls: "bg-warning/20 text-warning" };
    return { label: "Ativo", cls: "bg-success/20 text-success" };
  };

  const getCompanyName = (id: string | null) => companies.find(c => c.id === id)?.name || "—";
  const getRoleName = (id: string | null) => roles.find(r => r.id === id)?.name || "—";

  const inviteFilteredRoles = roles.filter(r => !inviteForm.company_id || r.company_id === inviteForm.company_id);

  const filteredRoles = roles.filter(r => !form.company_id || r.company_id === form.company_id);
  const filteredUnits = units.filter(u => !form.company_id || u.company_id === form.company_id);
  const filteredAgents = agents.filter(a => !form.company_id || a.company_id === form.company_id);
  const filteredCollabs = allCollaborators.filter(c => {
    if (!form.company_id) return true;
    if (c.company_id === form.company_id) return true;
    if (Array.isArray(c.company_ids) && c.company_ids.includes(form.company_id)) return true;
    return false;
  });

  const toggleUnit = (unitId: string) => {
    setSelectedUnitIds(prev =>
      prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId]
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Colaboradores</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gerencie a equipe e links de convite</p>
          </div>
          <div className="flex gap-2">
            {canManageInvites && (
              <>
                <Button variant="outline" onClick={() => setInviteListOpen(true)} className="text-sm">
                  Convites ({inviteLinks.filter(i => i.is_active && (!i.expires_at || new Date(i.expires_at) > new Date())).length})
                </Button>
                <Button variant="outline" onClick={openInviteDialog} className="text-sm">
                  <Link2 className="h-4 w-4 mr-1.5" />
                  Gerar Link de Cadastro
                </Button>
              </>
            )}
            <Button onClick={openCreate} className="btn-modern"><Plus className="h-4 w-4 mr-1" /> Novo Colaborador</Button>
          </div>
        </div>

        <div className="flex gap-3">
          <Select value={filterCompany} onValueChange={setFilterCompany}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Empresas</SelectItem>
              {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Cargo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Cargos</SelectItem>
              {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card variant="gradient">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-28">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCollaborators.map(c => (
                    <TableRow key={c.id} className="table-row-hover">
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.email}</TableCell>
                      <TableCell>{c.phone || "—"}</TableCell>
                      <TableCell>{c.company?.name || "—"}</TableCell>
                      <TableCell>{c.role?.name || "—"}</TableCell>
                      <TableCell>
                        {(() => {
                          const ids = Array.isArray(c.unit_ids) ? c.unit_ids : c.unit_id ? [c.unit_id] : [];
                          const names = ids.map((id: string) => units.find(u => u.id === id)?.name).filter(Boolean);
                          return names.length > 0 ? names.join(", ") : "—";
                        })()}
                      </TableCell>
                      <TableCell>
                        <Badge className={c.active ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}>
                          {c.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {isCEO && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => manageCollaborator(c.active ? "deactivate" : "activate", c.id)} title={c.active ? "Desativar" : "Ativar"}>
                                {c.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => manageCollaborator("delete", c.id)} title="Excluir" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Edit/Create Collaborator Dialog ─── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Colaborador" : "Novo Colaborador"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email *</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} /></div>
            </div>
            <div>
              <Label>Empresa *</Label>
              <Select value={form.company_id} onValueChange={handleCompanyChange}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {companies.length > 1 && (
              <div>
                <Label className="mb-1 block">Empresas adicionais</Label>
                <p className="text-xs text-muted-foreground mb-1">Selecione empresas adicionais além da principal</p>
                <div className="rounded-md border border-border bg-background max-h-48 overflow-y-auto">
                  <div className="p-2 space-y-1">
                    {companies.filter(c => c.id !== form.company_id).map(c => (
                      <label key={c.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                        <Checkbox checked={selectedCompanyIds.includes(c.id)} onCheckedChange={() => toggleCompanyId(c.id)} />
                        <span className="text-sm text-foreground">{c.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {selectedCompanyIds.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{selectedCompanyIds.length} empresa(s) adicional(is)</p>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cargo *</Label>
                <Select value={form.role_id} onValueChange={handleRoleChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{filteredRoles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Superior Direto</Label>
                <Select value={form.reports_to} onValueChange={v => setForm({ ...form, reports_to: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{filteredCollabs.filter(c => !editing || c.id !== editing.id).map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.role?.name ? ` - ${c.role.name}` : ""}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {filteredUnits.length > 0 && (
              <div>
                <Label className="mb-1 block">Unidades</Label>
                <p className="text-xs text-muted-foreground mb-1">Selecione as unidades</p>
                <div className="rounded-md border border-border bg-background max-h-72 overflow-y-auto">
                  <div className="p-2 space-y-1">
                    {filteredUnits.map(u => (
                      <label key={u.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                        <Checkbox checked={selectedUnitIds.includes(u.id)} onCheckedChange={() => toggleUnit(u.id)} />
                        <span className="text-sm text-foreground">{u.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {selectedUnitIds.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{selectedUnitIds.length} unidade(s) selecionada(s)</p>
                )}
              </div>
            )}
            {filteredAgents.length > 0 && (
              <div>
                <Label className="mb-2 block">Agentes Permitidos</Label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                  {filteredAgents.map(a => (
                    <label key={a.id} className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox
                        checked={selectedAgents.has(a.id)}
                        onCheckedChange={() => {
                          setSelectedAgents(prev => {
                            const next = new Set(prev);
                            next.has(a.id) ? next.delete(a.id) : next.add(a.id);
                            return next;
                          });
                        }}
                      />
                      <span>{a.emoji} {a.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={save} className="btn-modern">{editing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Generate Invite Link Dialog ─── */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Gerar Link de Cadastro
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Empresa *</Label>
              <Select value={inviteForm.company_id} onValueChange={v => setInviteForm(prev => ({ ...prev, company_id: v, role_id: "" }))}>
                <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cargo *</Label>
              <Select value={inviteForm.role_id} onValueChange={v => setInviteForm(prev => ({ ...prev, role_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
                <SelectContent>{inviteFilteredRoles.map(r => <SelectItem key={r.id} value={r.id}>{r.name} (Lv.{r.level})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Máximo de usos</Label>
                <Input type="number" min="1" value={inviteForm.max_uses} onChange={e => setInviteForm(prev => ({ ...prev, max_uses: e.target.value }))} />
              </div>
              <div>
                <Label>Expira em (dias)</Label>
                <Input type="number" min="1" value={inviteForm.expires_days} onChange={e => setInviteForm(prev => ({ ...prev, expires_days: e.target.value }))} />
              </div>
            </div>

            <Button onClick={handleCreateInvite} disabled={inviteCreating} className="w-full btn-modern">
              {inviteCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
              Gerar Link
            </Button>

            {generatedInviteLink && (
              <div className="p-4 rounded-lg bg-secondary/50 border border-border space-y-3">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Link gerado</p>
                <code className="block text-sm font-mono text-primary break-all">{generatedInviteLink}</code>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { navigator.clipboard.writeText(generatedInviteLink); toast.success("Link copiado!"); }}>
                    <Copy className="h-4 w-4 mr-1.5" /> Copiar Link
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => {
                    const text = encodeURIComponent(`Olá! Use este link para se cadastrar no sistema:\n${generatedInviteLink}`);
                    window.open(`https://wa.me/?text=${text}`, "_blank");
                  }}>
                    <MessageCircle className="h-4 w-4 mr-1.5" /> WhatsApp
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Invite Links List Dialog ─── */}
      <Dialog open={inviteListOpen} onOpenChange={setInviteListOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Convites Criados</DialogTitle>
          </DialogHeader>
          {inviteLinks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Nenhum convite criado ainda</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Usos</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inviteLinks.map(invite => {
                  const status = getInviteStatus(invite);
                  return (
                    <TableRow key={invite.id} className="table-row-hover">
                      <TableCell className="font-medium">{getCompanyName(invite.company_id)}</TableCell>
                      <TableCell>{getRoleName(invite.role)}</TableCell>
                      <TableCell>{invite.current_uses ?? 0}/{invite.max_uses ?? "∞"}</TableCell>
                      <TableCell className="text-sm">
                        {invite.expires_at ? format(new Date(invite.expires_at), "dd/MM/yy HH:mm") : "Nunca"}
                      </TableCell>
                      <TableCell><Badge className={status.cls}>{status.label}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => copyLink(invite.token)} title="Copiar">
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => shareWhatsApp(invite.token)} title="WhatsApp">
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          {invite.is_active && (
                            <Button variant="ghost" size="sm" onClick={() => deactivateInvite(invite.id)} title="Desativar" className="text-destructive hover:text-destructive">
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
