import { useState } from "react";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { consultores as initialConsultores, type Consultor, type Empresa, type ConsultorPerfil } from "@/lib/mock-data";
import { toast } from "sonner";

const emptyConsultor: Omit<Consultor, "id"> = {
  nome: "", telefone: "", email: "", empresa: "Objetivo", perfil: "consultor", regiao: "", ativo: true,
};

export default function Consultores() {
  const [lista, setLista] = useState<Consultor[]>(initialConsultores);
  const [busca, setBusca] = useState("");
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>("todas");
  const [formData, setFormData] = useState<Omit<Consultor, "id">>(emptyConsultor);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtrados = lista.filter((c) => {
    const matchBusca = c.nome.toLowerCase().includes(busca.toLowerCase()) || c.email.toLowerCase().includes(busca.toLowerCase());
    const matchEmpresa = filtroEmpresa === "todas" || c.empresa === filtroEmpresa;
    return matchBusca && matchEmpresa;
  });

  const openNew = () => { setFormData(emptyConsultor); setEditingId(null); setDialogOpen(true); };
  const openEdit = (c: Consultor) => { setFormData({ nome: c.nome, telefone: c.telefone, email: c.email, empresa: c.empresa, perfil: c.perfil, regiao: c.regiao, ativo: c.ativo }); setEditingId(c.id); setDialogOpen(true); };

  const salvar = () => {
    if (!formData.nome || !formData.email) { toast.error("Nome e email são obrigatórios"); return; }
    if (editingId) {
      setLista((prev) => prev.map((c) => (c.id === editingId ? { ...c, ...formData } : c)));
      toast.success("Consultor atualizado");
    } else {
      setLista((prev) => [...prev, { ...formData, id: String(Date.now()) }]);
      toast.success("Consultor adicionado");
    }
    setDialogOpen(false);
  };

  const excluir = (id: string) => { setLista((prev) => prev.filter((c) => c.id !== id)); toast.success("Consultor removido"); };
  const toggleAtivo = (id: string) => { setLista((prev) => prev.map((c) => (c.id === id ? { ...c, ativo: !c.ativo } : c))); };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Consultores</h1>
            <p className="text-muted-foreground text-sm">Gerencie a equipe de consultores</p>
          </div>
          <div className="flex gap-2">
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="Objetivo">Objetivo</SelectItem>
                <SelectItem value="Trilia">Trilia</SelectItem>
                <SelectItem value="WALK">WALK</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>{editingId ? "Editar" : "Novo"} Consultor</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Nome</Label><Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} /></div>
                    <div><Label>Telefone</Label><Input value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} /></div>
                  </div>
                  <div><Label>Email</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Empresa</Label>
                      <Select value={formData.empresa} onValueChange={(v) => setFormData({ ...formData, empresa: v as Empresa })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Objetivo">Objetivo</SelectItem>
                          <SelectItem value="Trilia">Trilia</SelectItem>
                          <SelectItem value="WALK">WALK</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Perfil</Label>
                      <Select value={formData.perfil} onValueChange={(v) => setFormData({ ...formData, perfil: v as ConsultorPerfil })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="gestor">Gestor</SelectItem>
                          <SelectItem value="consultor">Consultor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Região</Label><Input value={formData.regiao} onChange={(e) => setFormData({ ...formData, regiao: e.target.value })} /></div>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                  <Button onClick={salvar}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Nome</th>
                  <th className="text-left p-3 font-medium">Email</th>
                  <th className="text-left p-3 font-medium">Telefone</th>
                  <th className="text-left p-3 font-medium">Empresa</th>
                  <th className="text-left p-3 font-medium">Perfil</th>
                  <th className="text-left p-3 font-medium">Região</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium">{c.nome}</td>
                    <td className="p-3 text-muted-foreground">{c.email}</td>
                    <td className="p-3 text-muted-foreground">{c.telefone}</td>
                    <td className="p-3">{c.empresa}</td>
                    <td className="p-3 capitalize">{c.perfil}</td>
                    <td className="p-3">{c.regiao}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Switch checked={c.ativo} onCheckedChange={() => toggleAtivo(c.id)} />
                        <StatusBadge status={c.ativo ? "ativo" : "inativo"} />
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => excluir(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
