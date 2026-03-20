import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Bot, Plus, Search, Info, Mic, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import AgentFormDialog from "@/components/agentes/AgentFormDialog";

interface Agent {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  company_id: string;
  description: string | null;
  agent_type: string | null;
  model: string | null;
  voice_key: string | null;
  channel: string | null;
  max_tokens: number | null;
  temperature: number | null;
}

interface Company { id: string; name: string; }
interface RoleAgentAccess { agent_id: string; role_id: string; }
interface Role { id: string; level: number; company_id: string; slug: string | null; }

interface LevelConfig { key: string; label: string; match: (r: Role) => boolean; }

const LEVELS: LevelConfig[] = [
  { key: "ceo", label: "CEO", match: (r) => r.level === 0 },
  { key: "diretor", label: "Diretor", match: (r) => r.level === 1 },
  { key: "gestor", label: "Gestor", match: (r) => r.level === 2 },
  { key: "consultor", label: "Consultor", match: (r) => r.level === 3 && (r.slug || "").startsWith("consultor") },
  { key: "colaborador", label: "Colaborador", match: (r) => r.level === 3 && (r.slug || "").startsWith("colab") },
];

const MODEL_LABELS: Record<string, string> = {
  "gpt-4o-mini": "4o-mini",
  "gpt-4o": "4o",
  "claude-haiku": "Haiku",
  "claude-sonnet": "Sonnet",
  "llama-3.1": "Llama",
};

export default function Agentes() {
  const { toast } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [access, setAccess] = useState<RoleAgentAccess[]>([]);
  const [companyFilter, setCompanyFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const [detailAgent, setDetailAgent] = useState<Agent | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [agentsRes, companiesRes, rolesRes, accessRes] = await Promise.all([
      supabase.from("agent_definitions").select("id, name, slug, active, company_id, description, agent_type, model, voice_key, channel, max_tokens, temperature"),
      supabase.from("companies").select("id, name"),
      supabase.from("roles").select("id, level, company_id, slug"),
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

  const getRolesForConfig = (config: LevelConfig, companyId: string): Role[] =>
    roles.filter(r => r.company_id === companyId && config.match(r));

  const hasConfigAccess = (agentId: string, config: LevelConfig, companyId: string): boolean => {
    const matchedRoles = getRolesForConfig(config, companyId);
    return matchedRoles.some(r => access.some(a => a.agent_id === agentId && a.role_id === r.id));
  };

  const toggleConfigAccess = async (agent: Agent, config: LevelConfig) => {
    const matchedRoles = getRolesForConfig(config, agent.company_id);
    if (matchedRoles.length === 0) {
      toast({ title: "Sem roles", description: `Nenhuma role "${config.label}" encontrada para esta empresa.`, variant: "destructive" });
      return;
    }
    const currentlyOn = hasConfigAccess(agent.id, config, agent.company_id);
    if (currentlyOn) {
      const roleIds = matchedRoles.map(r => r.id);
      const { error } = await supabase.from("role_agent_access").delete().eq("agent_id", agent.id).in("role_id", roleIds);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      setAccess(prev => prev.filter(a => !(a.agent_id === agent.id && roleIds.includes(a.role_id))));
    } else {
      const inserts = matchedRoles.map(r => ({ agent_id: agent.id, role_id: r.id }));
      const { error } = await supabase.from("role_agent_access").upsert(inserts, { onConflict: "role_id,agent_id" });
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      setAccess(prev => [...prev, ...inserts]);
    }
  };

  const filtered = agents
    .filter(a => companyFilter === "all" || a.company_id === companyFilter)
    .filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

  const openEdit = (agent: Agent) => {
    setEditAgent(agent);
    setFormOpen(true);
  };

  const openCreate = () => {
    setEditAgent(null);
    setFormOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Agentes de IA"
          subtitle="Gerencie os agentes disponíveis para cada nível de acesso"
          badge={<Bot className="h-6 w-6 text-primary" />}
        >
          <Button onClick={openCreate} className="gap-2 w-fit">
            <Plus className="h-4 w-4" /> Novo Agente
          </Button>
        </PageHeader>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="w-full sm:w-[220px] bg-card border-border">
              <SelectValue placeholder="Filtrar por empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Buscar agente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="bg-card border-border">
                <CardContent className="p-5 space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-20 w-full" />
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
                  {/* Header */}
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
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(agent)}>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailAgent(agent)}>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Badge variant={agent.active ? "default" : "secondary"} className={agent.active ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : ""}>
                        {agent.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>

                  {/* Meta badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {agent.model && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {MODEL_LABELS[agent.model] || agent.model}
                      </Badge>
                    )}
                    {agent.voice_key && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                        <Mic className="h-3 w-3" /> Voz
                      </Badge>
                    )}
                    {agent.channel && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {agent.channel}
                      </Badge>
                    )}
                  </div>

                  {agent.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{agent.description}</p>
                  )}

                  {/* Access toggles */}
                  <div className="space-y-2.5 pt-1 border-t border-border">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider pt-2">Acesso por nível</p>
                    {LEVELS.map(config => (
                      <div key={config.key} className="flex items-center justify-between">
                        <span className="text-sm text-foreground">{config.label}</span>
                        <Switch
                          checked={hasConfigAccess(agent.id, config, agent.company_id)}
                          onCheckedChange={() => toggleConfigAccess(agent, config)}
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
              <div><span className="font-medium text-foreground">Tipo:</span> <Badge variant="outline">{detailAgent.agent_type}</Badge></div>
            )}
            {detailAgent?.company_id && (
              <div><span className="font-medium text-foreground">Empresa:</span> <span className="text-muted-foreground">{companyName(detailAgent.company_id)}</span></div>
            )}
            {detailAgent?.model && (
              <div><span className="font-medium text-foreground">Modelo:</span> <span className="text-muted-foreground">{detailAgent.model}</span></div>
            )}
            {detailAgent?.voice_key && (
              <div><span className="font-medium text-foreground">Voz:</span> <Badge variant="outline" className="gap-1"><Mic className="h-3 w-3" />{detailAgent.voice_key}</Badge></div>
            )}
            {detailAgent?.channel && (
              <div><span className="font-medium text-foreground">Canal:</span> <span className="text-muted-foreground">{detailAgent.channel}</span></div>
            )}
            {detailAgent?.temperature != null && (
              <div><span className="font-medium text-foreground">Temperatura:</span> <span className="text-muted-foreground">{detailAgent.temperature}</span></div>
            )}
            {detailAgent?.max_tokens != null && (
              <div><span className="font-medium text-foreground">Max Tokens:</span> <span className="text-muted-foreground">{detailAgent.max_tokens}</span></div>
            )}
            <div>
              <span className="font-medium text-foreground">Descrição:</span>
              <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{detailAgent?.description || "Sem descrição disponível."}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Form modal */}
      <AgentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        agent={editAgent ? {
          id: editAgent.id,
          name: editAgent.name,
          slug: editAgent.slug,
          description: editAgent.description || "",
          active: editAgent.active,
          company_id: editAgent.company_id,
          agent_type: editAgent.agent_type || "text",
          model: editAgent.model || "gpt-4o-mini",
          temperature: editAgent.temperature ?? 0.7,
          max_tokens: editAgent.max_tokens ?? 150,
          voice_key: editAgent.voice_key,
          channel: editAgent.channel || "telegram",
        } : null}
        companies={companies}
        onSaved={fetchData}
      />
    </DashboardLayout>
  );
}
