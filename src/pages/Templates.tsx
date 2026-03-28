import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { EDGE_BASE } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Plus, Loader2, FileText, CheckCircle, Clock, XCircle, Search,
} from "lucide-react";

interface Template {
  name: string;
  category: string;
  language: string;
  status: string;
  body: string;
  header?: string;
  footer?: string;
  buttons?: string[];
  response_rate?: number;
  total_sent?: number;
}

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  APPROVED: { icon: CheckCircle, color: "text-green-400", label: "Aprovado" },
  PENDING: { icon: Clock, color: "text-yellow-400", label: "Pendente" },
  REJECTED: { icon: XCircle, color: "text-red-400", label: "Rejeitado" },
};

export default function Templates() {
  const { collaborator } = useCollaborator();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    category: "MARKETING",
    body: "",
    header: "",
    footer: "",
  });

  const fetchTemplates = async () => {
    if (!collaborator) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${EDGE_BASE}/template-intelligence`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: "list-all",
          company_id: collaborator.company_id,
        }),
      });
      const data = await res.json();
      if (res.ok) setTemplates(data.templates || []);
    } catch {
      toast.error("Erro ao buscar templates");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, [collaborator]);

  const createTemplate = async () => {
    if (!newTemplate.name || !newTemplate.body || !collaborator) return;
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${EDGE_BASE}/template-intelligence`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: "create",
          company_id: collaborator.company_id,
          ...newTemplate,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Template enviado para aprovação!");
        setCreateOpen(false);
        setNewTemplate({ name: "", category: "MARKETING", body: "", header: "", footer: "" });
        fetchTemplates();
      } else {
        toast.error(data.error || "Erro");
      }
    } catch {
      toast.error("Erro de conexão");
    }
    setCreating(false);
  };

  const filtered = templates.filter((t) => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <DashboardLayout>
      <PageHeader title="Templates" subtitle="Gerencie seus templates WhatsApp" />

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar template..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="APPROVED">Aprovado</SelectItem>
            <SelectItem value="PENDING">Pendente</SelectItem>
            <SelectItem value="REJECTED">Rejeitado</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Template
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum template encontrado.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => {
            const st = statusConfig[t.status] || statusConfig.PENDING;
            const StIcon = st.icon;
            return (
              <Card key={t.name} className="hover:border-primary/30 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-sm">{t.name}</CardTitle>
                    <Badge variant="outline" className={`${st.color} text-xs`}>
                      <StIcon className="h-3 w-3 mr-1" /> {st.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground line-clamp-3">{t.body}</p>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-xs">{t.category}</Badge>
                    {t.total_sent !== undefined && <span>{t.total_sent} envios</span>}
                    {t.response_rate !== undefined && <span>{(t.response_rate * 100).toFixed(0)}% resp.</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input placeholder="meu_template" value={newTemplate.name} onChange={(e) => setNewTemplate((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={newTemplate.category} onValueChange={(v) => setNewTemplate((p) => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                  <SelectItem value="UTILITY">Utilidade</SelectItem>
                  <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cabeçalho (opcional)</Label>
              <Input placeholder="Texto do cabeçalho" value={newTemplate.header} onChange={(e) => setNewTemplate((p) => ({ ...p, header: e.target.value }))} />
            </div>
            <div>
              <Label>Corpo da mensagem</Label>
              <Textarea placeholder="Olá {{1}}, ..." rows={4} value={newTemplate.body} onChange={(e) => setNewTemplate((p) => ({ ...p, body: e.target.value }))} />
              <p className="text-xs text-muted-foreground mt-1">Use {"{{1}}"}, {"{{2}}"} para variáveis</p>
            </div>
            <div>
              <Label>Rodapé (opcional)</Label>
              <Input placeholder="Texto do rodapé" value={newTemplate.footer} onChange={(e) => setNewTemplate((p) => ({ ...p, footer: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={createTemplate} disabled={creating || !newTemplate.name || !newTemplate.body}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Enviar para Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
