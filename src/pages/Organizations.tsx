import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { EDGE_BASE } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Building2, Users, CheckCircle, XCircle, MessageSquare, Loader2, ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Organization {
  id: string;
  name: string;
  slug: string;
  type: "internal" | "external";
  is_active: boolean;
  plan: string;
  max_companies: number;
  created_at: string;
  company_count: number;
  member_count: number;
  has_whatsapp: boolean;
}

export default function Organizations() {
  const { collaborator } = useCollaborator();
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  const getHeaders = useCallback(async () => {
    const session = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.data.session?.access_token || ""}`,
    };
  }, []);

  const fetchOrgs = useCallback(async () => {
    if (!collaborator) return;
    setLoading(true);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${EDGE_BASE}/onboarding`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "list-organizations",
          requester_role: "ceo",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setOrgs(data.organizations || []);
      } else {
        toast.error(data.error || "Erro ao carregar organizações");
      }
    } catch {
      toast.error("Erro de conexão");
    }
    setLoading(false);
  }, [collaborator, getHeaders]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const toggleActive = async (orgId: string, currentActive: boolean) => {
    try {
      const headers = await getHeaders();
      const res = await fetch(`${EDGE_BASE}/onboarding`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "update-organization",
          organization_id: orgId,
          is_active: !currentActive,
          requester_role: "ceo",
        }),
      });
      if (res.ok) {
        toast.success(currentActive ? "Organização desativada" : "Organização ativada");
        fetchOrgs();
      }
    } catch {
      toast.error("Erro ao atualizar");
    }
  };

  const external = orgs.filter((o) => o.type === "external");
  const internal = orgs.filter((o) => o.type === "internal");

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <PageHeader
          title="Organizações"
          description="Gerencie empresas externas que usam a plataforma LuxSales"
        />

        <div className="flex gap-3">
          <Button onClick={() => navigate("/onboarding")}>
            <Building2 className="h-4 w-4 mr-2" />
            Nova Organização
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Grupo interno */}
            {internal.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Grupo Interno</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {internal.map((org) => (
                    <OrgCard key={org.id} org={org} onToggle={toggleActive} />
                  ))}
                </div>
              </div>
            )}

            {/* Empresas externas */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Empresas Externas ({external.length})
              </h3>
              {external.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhuma empresa externa cadastrada</p>
                    <p className="text-sm mt-1">Use o botão acima para adicionar a primeira</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {external.map((org) => (
                    <OrgCard key={org.id} org={org} onToggle={toggleActive} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function OrgCard({
  org,
  onToggle,
}: {
  org: Organization;
  onToggle: (id: string, active: boolean) => void;
}) {
  const planColors: Record<string, string> = {
    starter: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    professional: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    enterprise: "bg-gold/10 text-gold border-gold/30",
  };

  return (
    <Card className={!org.is_active ? "opacity-50" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">{org.name}</CardTitle>
          <Badge variant="outline" className={planColors[org.plan] || ""}>
            {org.plan}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">/{org.slug}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            {org.company_count} empresa{org.company_count !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {org.member_count} membro{org.member_count !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex gap-2 text-xs">
          {org.has_whatsapp ? (
            <Badge variant="outline" className="text-green-400 border-green-500/30">
              <MessageSquare className="h-3 w-3 mr-1" /> WhatsApp
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground border-border">
              <MessageSquare className="h-3 w-3 mr-1" /> Sem WhatsApp
            </Badge>
          )}
          {org.is_active ? (
            <Badge variant="outline" className="text-green-400 border-green-500/30">
              <CheckCircle className="h-3 w-3 mr-1" /> Ativa
            </Badge>
          ) : (
            <Badge variant="outline" className="text-red-400 border-red-500/30">
              <XCircle className="h-3 w-3 mr-1" /> Inativa
            </Badge>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onToggle(org.id, org.is_active)}
          >
            {org.is_active ? "Desativar" : "Ativar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
