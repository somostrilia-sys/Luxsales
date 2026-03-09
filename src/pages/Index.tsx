import { useEffect, useState } from "react";
import { Bot, Users, Target, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";

export default function Index() {
  const { collaborator, isCEO, isDiretor, isGestor } = useCollaborator();
  const [stats, setStats] = useState({ agents: 0, collaborators: 0, leads: 0, conversations: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!collaborator) return;
    loadStats();
  }, [collaborator]);

  const loadStats = async () => {
    const companyId = collaborator!.company_id;

    const [agentsRes, collabRes, leadsRes, convsRes] = await Promise.all([
      supabase.from("agent_definitions").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("is_active", true),
      supabase.from("collaborators").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("is_active", true),
      supabase.from("contact_leads").select("id", { count: "exact", head: true }).eq("company_target", companyId),
      supabase.from("agent_conversations").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    ]);

    setStats({
      agents: agentsRes.count || 0,
      collaborators: collabRes.count || 0,
      leads: leadsRes.count || 0,
      conversations: convsRes.count || 0,
    });
    setLoading(false);
  };

  const kpis = [
    { label: "Agentes Ativos", value: stats.agents, icon: Bot },
    { label: "Colaboradores", value: stats.collaborators, icon: Users },
    { label: "Leads", value: stats.leads, icon: Target },
    { label: "Conversas", value: stats.conversations, icon: TrendingUp },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            {collaborator?.company?.name} — {collaborator?.role?.name}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-stagger">
          {kpis.map((s) => (
            <Card
              key={s.label}
              className="kpi-card border-0 bg-gradient-to-br from-[hsl(var(--kpi-from))] to-[hsl(var(--kpi-to))] text-primary-foreground overflow-hidden"
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-primary-foreground/70">{s.label}</p>
                    <p className="text-3xl font-bold mt-1">{loading ? "..." : s.value}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/10 backdrop-blur-sm">
                    <s.icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
