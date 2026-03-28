import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface Config {
  horarioInicio: string;
  horarioFim: string;
  intervalo: string;
  emailNotif: boolean;
  whatsappNotif: boolean;
  alertaErro: boolean;
  alertaLead: boolean;
  relatoriosDiarios: boolean;
}

const DEFAULTS: Config = {
  horarioInicio: "08:00",
  horarioFim: "20:00",
  intervalo: "2",
  emailNotif: true,
  whatsappNotif: false,
  alertaErro: true,
  alertaLead: true,
  relatoriosDiarios: true,
};

const DB_KEYS: Record<keyof Config, string> = {
  horarioInicio: "dispatch_schedule_start",
  horarioFim: "dispatch_schedule_end",
  intervalo: "dispatch_interval_hours",
  emailNotif: "notif_email",
  whatsappNotif: "notif_whatsapp",
  alertaErro: "notif_alert_error",
  alertaLead: "notif_alert_lead",
  relatoriosDiarios: "notif_daily_report",
};

export default function Configuracoes() {
  const [config, setConfig] = useState<Config>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const keys = Object.values(DB_KEYS);
      const { data, error } = await supabase
        .from("system_configs")
        .select("key, value")
        .in("key", keys);

      if (error) throw error;

      const map: Record<string, string> = {};
      (data || []).forEach((row) => { map[row.key] = row.value; });

      setConfig({
        horarioInicio: map[DB_KEYS.horarioInicio] ?? DEFAULTS.horarioInicio,
        horarioFim: map[DB_KEYS.horarioFim] ?? DEFAULTS.horarioFim,
        intervalo: map[DB_KEYS.intervalo] ?? DEFAULTS.intervalo,
        emailNotif: (map[DB_KEYS.emailNotif] ?? "true") === "true",
        whatsappNotif: (map[DB_KEYS.whatsappNotif] ?? "false") === "true",
        alertaErro: (map[DB_KEYS.alertaErro] ?? "true") === "true",
        alertaLead: (map[DB_KEYS.alertaLead] ?? "true") === "true",
        relatoriosDiarios: (map[DB_KEYS.relatoriosDiarios] ?? "true") === "true",
      });
    } catch (e: any) {
      toast.error("Erro ao carregar configurações: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const salvar = async () => {
    setSaving(true);
    try {
      const upserts = (Object.keys(config) as (keyof Config)[]).map((k) => ({
        key: DB_KEYS[k],
        value: String(config[k]),
      }));

      const { error } = await supabase
        .from("system_configs")
        .upsert(upserts, { onConflict: "key" });

      if (error) throw error;
      toast.success("Configurações salvas com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <PageHeader
          title="Configurações"
          subtitle="Horários de envio e notificações"
        />

        <Card className="shadow-sm bg-card/80 backdrop-blur-sm">
          <CardHeader><CardTitle className="text-lg">Horários de Envio</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Início</Label>
                <Input
                  type="time"
                  value={config.horarioInicio}
                  onChange={(e) => setConfig({ ...config, horarioInicio: e.target.value })}
                />
              </div>
              <div>
                <Label>Fim</Label>
                <Input
                  type="time"
                  value={config.horarioFim}
                  onChange={(e) => setConfig({ ...config, horarioFim: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Intervalo entre disparos</Label>
              <Select
                value={config.intervalo}
                onValueChange={(v) => setConfig({ ...config, intervalo: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hora</SelectItem>
                  <SelectItem value="2">2 horas</SelectItem>
                  <SelectItem value="3">3 horas</SelectItem>
                  <SelectItem value="4">4 horas</SelectItem>
                  <SelectItem value="6">6 horas</SelectItem>
                  <SelectItem value="12">12 horas</SelectItem>
                  <SelectItem value="24">24 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm bg-card/80 backdrop-blur-sm">
          <CardHeader><CardTitle className="text-lg">Notificações</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: "emailNotif" as const, label: "Notificações por Email" },
              { key: "whatsappNotif" as const, label: "Notificações por WhatsApp" },
              { key: "alertaErro" as const, label: "Alertas de Erro" },
              { key: "alertaLead" as const, label: "Alertas de Novos Leads" },
              { key: "relatoriosDiarios" as const, label: "Resumo Diário por Email" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <Label>{item.label}</Label>
                <Switch
                  checked={config[item.key]}
                  onCheckedChange={(v) => setConfig({ ...config, [item.key]: v })}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Button onClick={salvar} disabled={saving} className="w-full sm:w-auto btn-shimmer">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : "Salvar Configurações"}
        </Button>
      </div>
    </DashboardLayout>
  );
}
