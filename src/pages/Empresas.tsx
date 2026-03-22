import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Building2, Search, Users, Loader2 } from "lucide-react";

interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  plan: string;
  logo_url: string | null;
  max_agents: number | null;
  max_minutes_month: number | null;
  dpo_name: string | null;
  dpo_email: string | null;
  active: boolean;
  created_at: string;
}

const planColors: Record<string, string> = {
  starter: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  business: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  enterprise: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

export default function Empresas() {
  const { isCEO } = useCollaborator();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [collabCounts, setCollabCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Company | null>(null);

  useEffect(() => {
    if (isCEO) fetchData();
  }, [isCEO]);

  async function fetchData() {
    setLoading(true);
    const [compRes, collabRes] = await Promise.all([
      supabase.from("companies").select("*").order("created_at", { ascending: false }),
      supabase.from("collaborators").select("company_id").eq("active", true),
    ]);

    if (compRes.data) setCompanies(compRes.data);
    if (collabRes.data) {
      const counts: Record<string, number> = {};
      collabRes.data.forEach((c: any) => {
        counts[c.company_id] = (counts[c.company_id] || 0) + 1;
      });
      setCollabCounts(counts);
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.from("companies").update({
      name: selected.name,
      cnpj: selected.cnpj,
      email: selected.email,
      phone: selected.phone,
      plan: selected.plan,
      logo_url: selected.logo_url,
      max_agents: selected.max_agents,
      max_minutes_month: selected.max_minutes_month,
      dpo_name: selected.dpo_name,
      dpo_email: selected.dpo_email,
      active: selected.active,
    }).eq("id", selected.id);

    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Empresa atualizada com sucesso!");
      setEditOpen(false);
      fetchData();
    }
  }

  if (!isCEO) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground text-lg">Acesso restrito</p>
        </div>
      </DashboardLayout>
    );
  }

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalActive = companies.filter((c) => c.active).length;
  const byPlan = {
    starter: companies.filter((c) => c.plan === "starter").length,
    business: companies.filter((c) => c.plan === "business").length,
    enterprise: companies.filter((c) => c.plan === "enterprise").length,
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Empresas"
        subtitle="Gerencie todas as empresas da plataforma"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{companies.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{totalActive}</p>
            <p className="text-xs text-muted-foreground">Ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{byPlan.starter}</p>
            <p className="text-xs text-muted-foreground">Starter</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-400">{byPlan.business}</p>
            <p className="text-xs text-muted-foreground">Business</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{byPlan.enterprise}</p>
            <p className="text-xs text-muted-foreground">Enterprise</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar empresa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Colaboradores</TableHead>
                  <TableHead>Criação</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={planColors[company.plan] || ""}>
                        {company.plan}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {company.cnpj || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {company.email || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={company.active ? "default" : "secondary"}>
                        {company.active ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{collabCounts[company.id] || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(company.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelected({ ...company });
                          setEditOpen(true);
                        }}
                      >
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhuma empresa encontrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Empresa</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Nome</Label>
                <Input
                  value={selected.name}
                  onChange={(e) => setSelected({ ...selected, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>CNPJ</Label>
                <Input
                  value={selected.cnpj || ""}
                  onChange={(e) => setSelected({ ...selected, cnpj: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input
                    value={selected.email || ""}
                    onChange={(e) => setSelected({ ...selected, email: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Telefone</Label>
                  <Input
                    value={selected.phone || ""}
                    onChange={(e) => setSelected({ ...selected, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Plano</Label>
                <Select
                  value={selected.plan}
                  onValueChange={(v) => setSelected({ ...selected, plan: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Logo URL</Label>
                <Input
                  value={selected.logo_url || ""}
                  onChange={(e) => setSelected({ ...selected, logo_url: e.target.value })}
                />
                {selected.logo_url && (
                  <img
                    src={selected.logo_url}
                    alt="Logo preview"
                    className="h-16 w-16 object-contain rounded border border-border mt-1"
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Max Agentes</Label>
                  <Input
                    type="number"
                    value={selected.max_agents ?? ""}
                    onChange={(e) =>
                      setSelected({ ...selected, max_agents: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Max Minutos/Mês</Label>
                  <Input
                    type="number"
                    value={selected.max_minutes_month ?? ""}
                    onChange={(e) =>
                      setSelected({
                        ...selected,
                        max_minutes_month: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>DPO Nome</Label>
                  <Input
                    value={selected.dpo_name || ""}
                    onChange={(e) => setSelected({ ...selected, dpo_name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>DPO Email</Label>
                  <Input
                    value={selected.dpo_email || ""}
                    onChange={(e) => setSelected({ ...selected, dpo_email: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={selected.active}
                  onCheckedChange={(v) => setSelected({ ...selected, active: v })}
                />
                <Label>Ativo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
