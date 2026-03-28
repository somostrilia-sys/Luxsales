import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { EDGE_BASE } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Loader2, BarChart3, Users, Send, MessageSquare, ShieldCheck,
  TrendingUp, Clock, AlertTriangle,
} from "lucide-react";

interface QualityData {
  overall_score: number;
  delivery_rate: number;
  read_rate: number;
  response_rate: number;
  opt_out_rate: number;
  quality_rating: string;
}

interface DispatchData {
  total_today: number;
  total_limit: number;
  by_seller: { name: string; sent: number; limit: number; responses: number }[];
}

interface TemplateData {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  top_performing: { name: string; response_rate: number }[];
}

interface SellerData {
  active: number;
  total: number;
  usage: { name: string; role: string; dispatches_today: number; daily_limit: number; leads_count: number }[];
}

export default function DashboardWB() {
  const { collaborator } = useCollaborator();
  const [loading, setLoading] = useState(true);
  const [quality, setQuality] = useState<QualityData | null>(null);
  const [dispatches, setDispatches] = useState<DispatchData | null>(null);
  const [templates, setTemplates] = useState<TemplateData | null>(null);
  const [sellers, setSellers] = useState<SellerData | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!collaborator) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${EDGE_BASE}/quality-monitor`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: "dashboard",
            company_id: collaborator.company_id,
            requester_role: "ceo",
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setQuality(data.quality || null);
          setDispatches(data.dispatches_today || null);
          setTemplates(data.templates || null);
          setSellers(data.active_sellers || null);
        } else {
          toast.error(data.error || "Erro ao carregar dashboard");
        }
      } catch {
        toast.error("Erro de conexão");
      }
      setLoading(false);
    };
    fetchDashboard();
  }, [collaborator]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const qualityColor =
    quality?.quality_rating === "GREEN" ? "text-green-400" :
    quality?.quality_rating === "YELLOW" ? "text-yellow-400" : "text-red-400";

  return (
    <DashboardLayout>
      <PageHeader title="Dashboard WhatsApp" description="Visão geral de qualidade e métricas" />

      {/* Section 1: Quality */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Qualidade Meta</p>
            <p className={`text-2xl font-bold ${qualityColor}`}>
              {quality?.quality_rating || "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Score: {quality?.overall_score?.toFixed(1) ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Send className="h-3 w-3" /> Taxa de Entrega
            </p>
            <p className="text-2xl font-bold">{quality?.delivery_rate ? `${(quality.delivery_rate * 100).toFixed(1)}%` : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MessageSquare className="h-3 w-3" /> Taxa de Leitura
            </p>
            <p className="text-2xl font-bold">{quality?.read_rate ? `${(quality.read_rate * 100).toFixed(1)}%` : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Taxa de Resposta
            </p>
            <p className="text-2xl font-bold">{quality?.response_rate ? `${(quality.response_rate * 100).toFixed(1)}%` : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Opt-out
            </p>
            <p className="text-2xl font-bold">{quality?.opt_out_rate ? `${(quality.opt_out_rate * 100).toFixed(2)}%` : "—"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Section 2: Dispatches Today */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Send className="h-4 w-4" /> Disparos Hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <p className="text-3xl font-bold">{dispatches?.total_today ?? 0}</p>
            <p className="text-muted-foreground">/ {dispatches?.total_limit ?? 0}</p>
            <Progress
              value={dispatches ? (dispatches.total_today / dispatches.total_limit) * 100 : 0}
              className="flex-1 max-w-sm"
            />
          </div>
          {dispatches?.by_seller && dispatches.by_seller.length > 0 && (
            <div className="space-y-2">
              {dispatches.by_seller.map((s) => (
                <div key={s.name} className="flex items-center justify-between text-sm">
                  <span>{s.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{s.sent}/{s.limit}</span>
                    <Badge variant="outline" className="text-xs">{s.responses} respostas</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-center mb-4">
              <div>
                <p className="text-2xl font-bold text-green-400">{templates?.approved ?? 0}</p>
                <p className="text-xs text-muted-foreground">Aprovados</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-400">{templates?.pending ?? 0}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-400">{templates?.rejected ?? 0}</p>
                <p className="text-xs text-muted-foreground">Rejeitados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Top Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            {templates?.top_performing && templates.top_performing.length > 0 ? (
              <div className="space-y-2">
                {templates.top_performing.map((t) => (
                  <div key={t.name} className="flex items-center justify-between text-sm">
                    <span className="truncate max-w-[60%]">{t.name}</span>
                    <Badge variant="secondary">{(t.response_rate * 100).toFixed(0)}% resp.</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 4: Sellers */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" /> Vendedores Ativos ({sellers?.active ?? 0}/{sellers?.total ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sellers?.usage && sellers.usage.length > 0 ? (
            <div className="space-y-3">
              {sellers.usage.map((s) => (
                <div key={s.name} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.role} — {s.leads_count} leads</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={(s.dispatches_today / s.daily_limit) * 100} className="w-20" />
                    <span className="text-xs text-muted-foreground w-16 text-right">
                      {s.dispatches_today}/{s.daily_limit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem vendedores ativos</p>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
