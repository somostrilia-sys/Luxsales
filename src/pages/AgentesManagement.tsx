import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Bot, Settings2, Loader2 } from "lucide-react";

interface AgentDef {
  id: string;
  name: string;
  emoji: string;
  type: string;
  description: string;
  is_active: boolean;
  company: { id: string; name: string } | null;
}

export default function AgentesManagement() {
  const { collaborator, isCEO } = useCollaborator();
  const [agents, setAgents] = useState<AgentDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<AgentDef | null>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [roleAccess, setRoleAccess] = useState<Record<string, boolean>>({});
  const [savingPerms, setSavingPerms] = useState(false);

  useEffect(() => { loadAgents(); }, [collaborator]);

  const loadAgents = async () => {
    if (!collaborator) return;
    let query = supabase.from("agent_definitions").select(`
      id, name, emoji, type, description, is_active,
      company:companies!agent_definitions_company_id_fkey(id, name)
    `).order("name");

    if (!isCEO) query = query.eq("company_id", collaborator.company_id);

    const { data } = await query;
    setAgents((data || []) as unknown as AgentDef[]);
    setLoading(false);
  };

  const handleToggleAgent = async (id: string, active: boolean) => {
    if (!isCEO) return;
    const { error } = await supabase.from("agent_definitions").update({ is_active: !active }).eq("id", id);
    if (error) toast.error("Erro ao atualizar");
    else { toast.success(active ? "Agente desativado" : "Agente ativado"); loadAgents(); }
  };

  const openPermissions = async (agent: AgentDef) => {
    setSelectedAgent(agent);
    const companyId = agent.company?.id;
    const [rolesRes, accessRes] = await Promise.all([
      supabase.from("roles").select("id, name, level").eq("company_id", companyId!).order("level"),
      supabase.from("role_agent_access").select("role_id").eq("agent_id", agent.id),
    ]);
    setRoles(rolesRes.data || []);
    const access: Record<string, boolean> = {};
    (accessRes.data || []).forEach((a: any) => { access[a.role_id] = true; });
    setRoleAccess(access);
  };

  const savePermissions = async () => {
    if (!selectedAgent) return;
    setSavingPerms(true);

    // Delete existing then insert new
    await supabase.from("role_agent_access").delete().eq("agent_id", selectedAgent.id);
    const inserts = Object.entries(roleAccess).filter(([, v]) => v).map(([roleId]) => ({
      agent_id: selectedAgent.id,
      role_id: roleId,
    }));
    if (inserts.length > 0) {
      await supabase.from("role_agent_access").insert(inserts);
    }
    toast.success("Permissões salvas!");
    setSavingPerms(false);
    setSelectedAgent(null);
  };

  // Group by company
  const grouped = agents.reduce<Record<string, AgentDef[]>>((acc, agent) => {
    const key = agent.company?.name || "Sem empresa";
    if (!acc[key]) acc[key] = [];
    acc[key].push(agent);
    return acc;
  }, {});

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Agentes</h1>
          <p className="text-muted-foreground text-sm">Gerenciamento de agentes de IA</p>
        </div>

        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          Object.entries(grouped).map(([company, companyAgents]) => (
            <div key={company} className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">{company}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {companyAgents.map(agent => (
                  <Card key={agent.id} className="border bg-card/80 backdrop-blur-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{agent.emoji}</span>
                          <div>
                            <p className="font-semibold">{agent.name}</p>
                            <p className="text-xs text-muted-foreground">{agent.type}</p>
                          </div>
                        </div>
                        {isCEO && (
                          <Switch checked={agent.is_active} onCheckedChange={() => handleToggleAgent(agent.id, agent.is_active)} />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-3">{agent.description}</p>
                      <div className="flex items-center justify-between mt-4">
                        <Badge variant={agent.is_active ? "default" : "secondary"}>
                          {agent.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                        {isCEO && (
                          <Button variant="ghost" size="sm" onClick={() => openPermissions(agent)}>
                            <Settings2 className="h-4 w-4 mr-1" />Permissões
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Permissions Dialog */}
      <Dialog open={!!selectedAgent} onOpenChange={(open) => !open && setSelectedAgent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permissões — {selectedAgent?.emoji} {selectedAgent?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {roles.map(role => (
              <label key={role.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                <Checkbox
                  checked={roleAccess[role.id] || false}
                  onCheckedChange={(checked) => setRoleAccess(prev => ({ ...prev, [role.id]: !!checked }))}
                />
                <div>
                  <p className="font-medium text-sm">{role.name}</p>
                  <p className="text-xs text-muted-foreground">Nível {role.level}</p>
                </div>
              </label>
            ))}
          </div>
          <Button onClick={savePermissions} disabled={savingPerms} className="w-full">
            {savingPerms ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Salvar Permissões
          </Button>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
