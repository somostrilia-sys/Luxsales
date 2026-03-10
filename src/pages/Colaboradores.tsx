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
import { Plus, Pencil, Loader2, Trash2, UserX, UserCheck } from "lucide-react";

export default function Colaboradores() {
  const { isCEO } = useCollaborator();
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
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [allCollaborators, setAllCollaborators] = useState<any[]>([]);

  useEffect(() => { loadData(); }, [selectedCompanyId]);

  const loadData = async () => {
    setLoading(true);
    let collabQuery = supabase.from("collaborators").select(`
      id, name, email, phone, whatsapp, active, company_id, role_id, unit_id, unit_ids, reports_to,
      company:companies!collaborators_company_id_fkey(id, name),
      role:roles!collaborators_role_id_fkey(id, name, level),
      unit:units!collaborators_unit_id_fkey(id, name)
    `).order("name");

    if (selectedCompanyId !== "all") collabQuery = collabQuery.eq("company_id", selectedCompanyId);

    const [collabRes, compRes, roleRes, unitRes, agentRes, raaRes] = await Promise.all([
      collabQuery,
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("roles").select("id, name, level, company_id").order("level"),
      supabase.from("units").select("id, name, company_id").order("name"),
      supabase.from("agent_definitions").select("id, name, emoji, company_id").eq("active", true).order("name"),
      supabase.from("role_agent_access").select("role_id, agent_id"),
    ]);
    setCollaborators(collabRes.data || []);
    setCompanies(compRes.data || []);
    setRoles(roleRes.data || []);
    setUnits(unitRes.data || []);
    setAgents(agentRes.data || []);
    setRoleAgentAccess(raaRes.data || []);
    setLoading(false);
  };

  const filteredCollaborators = collaborators.filter(c => {
    if (filterCompany !== "all" && c.company_id !== filterCompany) return false;
    if (filterRole !== "all" && c.role_id !== filterRole) return false;
    return true;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", email: "", phone: "", whatsapp: "", company_id: "", role_id: "", unit_id: "", active: true });
    setSelectedAgents(new Set());
    setModalOpen(true);
  };

  const openEdit = async (c: any) => {
    setEditing(c);
    setForm({
      name: c.name, email: c.email, phone: c.phone || "", whatsapp: c.whatsapp || "",
      company_id: c.company_id, role_id: c.role_id, unit_id: c.unit_id || "", active: c.active,
    });
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
    setForm(prev => ({ ...prev, company_id: companyId, role_id: "", unit_id: "" }));
    setSelectedAgents(new Set());
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

    const payload = {
      name: form.name, email: form.email, phone: form.phone || null,
      whatsapp: form.whatsapp || null, company_id: form.company_id,
      role_id: form.role_id, unit_id: form.unit_id || null, active: form.active,
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

  const filteredRoles = roles.filter(r => !form.company_id || r.company_id === form.company_id);
  const filteredUnits = units.filter(u => !form.company_id || u.company_id === form.company_id);
  const filteredAgents = agents.filter(a => !form.company_id || a.company_id === form.company_id);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Colaboradores</h1>
          <Button onClick={openCreate} className="btn-modern"><Plus className="h-4 w-4 mr-1" /> Novo Colaborador</Button>
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

        <Card>
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
                      <TableCell>{c.unit?.name || "—"}</TableCell>
                      <TableCell>
                        <Badge className={c.active ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cargo *</Label>
                <Select value={form.role_id} onValueChange={handleRoleChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{filteredRoles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unidade</Label>
                <Select value={form.unit_id} onValueChange={v => setForm({ ...form, unit_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{filteredUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

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
    </DashboardLayout>
  );
}
