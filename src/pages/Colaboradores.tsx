import { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, UserX, Loader2 } from "lucide-react";

interface CollabRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  is_active: boolean;
  company: { id: string; name: string } | null;
  role: { id: string; name: string; level: number } | null;
  sector: { id: string; name: string } | null;
  unit: { id: string; name: string } | null;
}

export default function Colaboradores() {
  const { collaborator, isCEO, isDiretor, isGestor, roleLevel } = useCollaborator();
  const [collabs, setCollabs] = useState<CollabRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [companies, setCompanies] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [sectors, setSectors] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  // New collaborator form
  const [form, setForm] = useState({
    name: "", email: "", phone: "", whatsapp: "",
    company_id: "", sector_id: "", role_id: "", unit_id: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, [collaborator]);

  const loadData = async () => {
    if (!collaborator) return;
    setLoading(true);

    let query = supabase.from("collaborators").select(`
      id, name, email, phone, whatsapp, is_active,
      company:companies!collaborators_company_id_fkey(id, name),
      role:roles!collaborators_role_id_fkey(id, name, level),
      sector:sectors!collaborators_sector_id_fkey(id, name),
      unit:units!collaborators_unit_id_fkey(id, name)
    `).order("name");

    if (isDiretor) {
      query = query.eq("company_id", collaborator.company_id).eq("sector_id", collaborator.sector_id!);
    } else if (isGestor) {
      query = query.eq("company_id", collaborator.company_id).eq("unit_id", collaborator.unit_id!);
    } else if (!isCEO) {
      query = query.eq("id", collaborator.id);
    }

    const [collabRes, compRes, roleRes] = await Promise.all([
      query,
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("roles").select("id, name, level, company_id").order("level"),
    ]);

    setCollabs((collabRes.data || []) as unknown as CollabRow[]);
    setCompanies(compRes.data || []);
    setRoles(roleRes.data || []);
    setLoading(false);
  };

  // Cascade: company → sectors
  useEffect(() => {
    if (!form.company_id) { setSectors([]); return; }
    supabase.from("sectors").select("id, name").eq("company_id", form.company_id).order("name")
      .then(({ data }) => setSectors(data || []));
  }, [form.company_id]);

  // Cascade: company → units
  useEffect(() => {
    if (!form.company_id) { setUnits([]); return; }
    supabase.from("units").select("id, name").eq("company_id", form.company_id).order("name")
      .then(({ data }) => setUnits(data || []));
  }, [form.company_id]);

  const companyRoles = useMemo(() =>
    roles.filter(r => r.company_id === form.company_id), [roles, form.company_id]);

  const filtered = useMemo(() => {
    return collabs.filter(c => {
      const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase());
      const matchCompany = filterCompany === "all" || c.company?.id === filterCompany;
      const matchRole = filterRole === "all" || c.role?.id === filterRole;
      return matchSearch && matchCompany && matchRole;
    });
  }, [collabs, search, filterCompany, filterRole]);

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.company_id || !form.role_id) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("collaborators").insert({
      name: form.name,
      email: form.email,
      phone: form.phone || null,
      whatsapp: form.whatsapp || null,
      company_id: form.company_id,
      sector_id: form.sector_id || null,
      role_id: form.role_id,
      unit_id: form.unit_id || null,
    });

    if (error) {
      toast.error("Erro ao criar colaborador", { description: error.message });
    } else {
      toast.success("Colaborador criado com sucesso!");
      setDialogOpen(false);
      setForm({ name: "", email: "", phone: "", whatsapp: "", company_id: "", sector_id: "", role_id: "", unit_id: "" });
      loadData();
    }
    setSaving(false);
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase.from("collaborators").update({ is_active: !currentActive }).eq("id", id);
    if (error) toast.error("Erro ao atualizar status");
    else { toast.success(currentActive ? "Colaborador desativado" : "Colaborador ativado"); loadData(); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Colaboradores</h1>
            <p className="text-muted-foreground text-sm">{filtered.length} encontrados</p>
          </div>
          {isCEO && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary"><Plus className="h-4 w-4 mr-2" />Novo Colaborador</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Novo Colaborador</DialogTitle></DialogHeader>
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome *</Label>
                      <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Email *</Label>
                      <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Telefone</Label>
                      <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>WhatsApp</Label>
                      <Input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Empresa *</Label>
                    <Select value={form.company_id} onValueChange={v => setForm(f => ({ ...f, company_id: v, sector_id: "", role_id: "", unit_id: "" }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Setor</Label>
                      <Select value={form.sector_id} onValueChange={v => setForm(f => ({ ...f, sector_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{sectors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Cargo *</Label>
                      <Select value={form.role_id} onValueChange={v => setForm(f => ({ ...f, role_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{companyRoles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Unidade</Label>
                    <Select value={form.unit_id} onValueChange={v => setForm(f => ({ ...f, unit_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleCreate} disabled={saving} className="w-full">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Criar Colaborador
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-10" placeholder="Buscar por nome ou email..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {isCEO && (
            <Select value={filterCompany} onValueChange={setFilterCompany}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Empresas</SelectItem>
                {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Cargo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Cargos</SelectItem>
              {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Status</TableHead>
                    {isCEO && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => (
                    <TableRow key={c.id} className="table-row-hover">
                      <TableCell>
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{c.company?.name || "—"}</TableCell>
                      <TableCell>{c.role?.name || "—"}</TableCell>
                      <TableCell>{c.sector?.name || "—"}</TableCell>
                      <TableCell>{c.unit?.name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={c.is_active ? "default" : "secondary"}>
                          {c.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      {isCEO && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleToggleActive(c.id, c.is_active)}>
                            <UserX className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum colaborador encontrado</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
