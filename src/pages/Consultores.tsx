import { useState, useMemo } from "react";
import { Search, Plus, Pencil, Trash2, User } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { consultores as allConsultores, type Consultor, type ConsultorPerfil } from "@/lib/mock-data";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";

export default function Consultores() {
  const { empresa } = useEmpresa();
  const [extras, setExtras] = useState<Consultor[]>([]);
  const [edits, setEdits] = useState<Record<string, Consultor>>({});
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const emptyForm = { nome: "", telefone: "", email: "", empresa, perfil: "consultor" as ConsultorPerfil, regiao: "", ativo: true };
  const [formData, setFormData] = useState(emptyForm);

  const lista = useMemo(() => {
    const base = allConsultores
      .filter(c => c.empresa === empresa && !deleted.has(c.id))
      .map(c => edits[c.id] || c);
    return [...base, ...extras.filter(c => c.empresa === empresa)];
  }, [empresa, edits, deleted, extras]);

  const filtrados = lista.filter(
    (c) => c.nome.toLowerCase().includes(busca.toLowerCase()) || c.email.toLowerCase().includes(busca.toLowerCase())
  );

  const openNew = () => { setFormData({ ...emptyForm, empresa }); setEditingId(null); setDialogOpen(true); };
  const openEdit = (c: Consultor) => { setFormData({ nome: c.nome, telefone: c.telefone, email: c.email, empresa: c.empresa, perfil: c.perfil, regiao: c.regiao, ativo: c.ativo }); setEditingId(c.id); setDialogOpen(true); };

  const salvar = () => {
    if (!formData.nome || !formData.email) { toast.error("Nome e email são obrigatórios"); return; }
    if (editingId) {
      setEdits(prev => ({ ...prev, [editingId]: { id: editingId, ...formData } }));
      toast.success("Consultor atualizado");
    } else {
      setExtras(prev => [...prev, { id: String(Date.now()), ...formData }]);
      toast.success("Consultor adicionado");
    }
    setDialogOpen(false);
  };

  const excluir = (id: string) => { setDeleted(prev => new Set(prev).add(id)); setExtras(prev => prev.filter(c => c.id !== id)); toast.success("Consultor removido"); };
  const toggleAtivo = (id: string) => {
    const c = lista.find(x => x.id === id);
    if (!c) return;
    const updated = { ...c, ativo: !c.ativo };
    if (extras.find(x => x.id === id)) {
      setExtras(prev => prev.map(x => x.id === id ? updated : x));
    } else {
      setEdits(prev => ({ ...prev, [id]: updated }));
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold">Consultores</h1>
            <p className="text-muted-foreground text-sm">Equipe — {empresa} ({lista.length})</p>
          </div>
          <div className="flex gap-2">
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNew} className="btn-shimmer"><Plus className="h-4 w-4 mr-1" /> Novo</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>{editingId ? "Editar" : "Novo"} Consultor</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Nome</Label><Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} /></div>
                    <div><Label>Telefone</Label><Input value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} /></div>
                  </div>
                  <div><Label>Email</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-4">
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
                  <Button onClick={salvar} className="btn-shimmer">Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="shadow-sm overflow-hidden bg-card/80 backdrop-blur-sm" style={{ animation: 'fade-slide-up 0.5s ease-out 0.1s both' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Nome</th>
                  <th className="text-left p-3 font-medium">Email</th>
                  <th className="text-left p-3 font-medium">Telefone</th>
                  <th className="text-left p-3 font-medium">Perfil</th>
                  <th className="text-left p-3 font-medium">Região</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.slice(0, 50).map((c) => (
                  <tr key={c.id} className="border-t table-row-hover">
                    <td className="p-3 font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary">
                          <User className="h-4 w-4" />
                        </div>
                        {c.nome}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{c.email}</td>
                    <td className="p-3 text-muted-foreground">{c.telefone}</td>
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
            {lista.length > 50 && (
              <p className="text-center text-xs text-muted-foreground py-3">Mostrando 50 de {lista.length} registros</p>
            )}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
