import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Bot, Plus, Search, Info } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface Agent {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  company_id: string;
  description: string | null;
  agent_type: string | null;
}

interface Company {
  id: string;
  name: string;
}

interface RoleAgentAccess {
  agent_id: string;
  role_id: string;
}

interface Role {
  id: string;
  level: number;
  company_id: string;
}

const LEVELS = [
  { level: 0, label: "CEO" },
  { level: 1, label: "Diretor" },
  { level: 2, label: "Gestor" },
  { level: 3, label: "Colaborador" },
];

export default function Agentes() {
  const { toast } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [access, setAccess] = useState<RoleAgentAccess[]>([]);
  const [companyFilter, setCompanyFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailAgent, setDetailAgent] = useState<Agent | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [agentsRes, companiesRes, rolesRes, accessRes] = await Promise.all([
      supabase.from("agent_definitions").select("id, name, slug, active, company_id, description, agent_type"),
      supabase.from("companies").select("id, name"),
      supabase.from("roles").select("id, level, company_id"),
      supabase.from("role_agent_access").select("agent_id, role_id"),
    ]);
    if (agentsRes.data) setAgents(agentsRes.data);
    if (companiesRes.data) setCompanies(companiesRes.data);
    if (rolesRes.data) setRoles(rolesRes.data);
    if (accessRes.data) setAccess(accessRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const companyName = (id: string) => companies.find(c => c.id === id)?.name ?? "—";

  const hasLevelAccess = (agentId: string, level: number, companyId: string): boolean => {
    const companyRoles = roles.filter(r => r.level === level && r.company_id === companyId);
    return companyRoles.some(r => access.some(a => a.agent_id === agentId && a.role_id === r.id));
  };

  const toggleLevelAccess = async (agent: Agent, level: number) => {
    const companyRoles = roles.filter(r => r.level === level && r.company_id === agent.company_id);
    if (companyRoles.length === 0) {
      toast({ title: "Sem roles", description: `Nenhuma role de nível ${level} encontrada para esta empresa.`, variant: "destructive" });
      return;
    }

    const currentlyOn = hasLevelAccess(agent.id, level, agent.company_id);

    if (currentlyOn) {
      const roleIds = companyRoles.map(r => r.id);
      const { error } = await supabase
        .from("role_agent_access")
        .delete()
        .eq("agent_id", agent.id)
        .in("role_id", roleIds);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
      setAccess(prev => prev.filter(a => !(a.agent_id === agent.id && roleIds.includes(a.role_id))));
    } else {
      const inserts = companyRoles.map(r => ({ agent_id: agent.id, role_id: r.id }));
      const { error } = await supabase.from("role_agent_access").upsert(inserts, { onConflict: "role_id,agent_id" });
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
      setAccess(prev => [...prev, ...inserts]);
    }
  };

  const filtered = agents
    .filter(a => companyFilter === "all" || a.company_id === companyFilter)
    .filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Agentes de IA</h1>
            <p className="text-sm text-muted-foreground">Gerencie os agentes disponíveis para cada nível de acesso</p>
          </div>
          <Button onClick={() => setModalOpen(true)} className="gap-2 w-fit">
            <Plus className="h-4 w-4" /> Novo Agente
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="w-full sm:w-[220px] bg-card border-border">
              <SelectValue placeholder="Filtrar por empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {companies.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar agente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoComplete="new-password"
              name="agent-search"
              className="pl-9 bg-card border-border"
            />
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="bg-card border-border">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-10 h-10 rounded-lg" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                  <div className="space-y-2.5 pt-1 border-t border-border">
                    <Skeleton className="h-3 w-24 mt-2" />
                    {Array.from({ length: 4 }).map((_, j) => (
                      <div key={j} className="flex items-center justify-between">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-5 w-9 rounded-full" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum agente encontrado.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(agent => (
              <Card key={agent.id} className="bg-card border-border">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{agent.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{companyName(agent.company_id)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailAgent(agent)}>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Badge variant={agent.active ? "default" : "secondary"} className={agent.active ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : ""}>
                        {agent.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>

                  {agent.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{agent.description}</p>
                  )}

                  <div className="space-y-2.5 pt-1 border-t border-border">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider pt-2">Acesso por nível</p>
                    {LEVELS.map(({ level, label }) => (
                      <div key={level} className="flex items-center justify-between">
                        <span className="text-sm text-foreground">{label}</span>
                        <Switch
                          checked={hasLevelAccess(agent.id, level, agent.company_id)}
                          onCheckedChange={() => toggleLevelAccess(agent, level)}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      <Dialog open={!!detailAgent} onOpenChange={(open) => !open && setDetailAgent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              {detailAgent?.name}
            </DialogTitle>
            <DialogDescription>Detalhes do agente</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {detailAgent?.agent_type && (
              <div>
                <span className="font-medium text-foreground">Tipo:</span>{" "}
                <Badge variant="outline">{detailAgent.agent_type}</Badge>
              </div>
            )}
            {detailAgent?.company_id && (
              <div>
                <span className="font-medium text-foreground">Empresa:</span>{" "}
                <span className="text-muted-foreground">{companyName(detailAgent.company_id)}</span>
              </div>
            )}
            <div>
              <span className="font-medium text-foreground">Descrição:</span>
              <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                {detailAgent?.description || "Sem descrição disponível."}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New agent modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Agente</DialogTitle>
            <DialogDescription>Funcionalidade em desenvolvimento.</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Em breve você poderá criar novos agentes por aqui.</p>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
