import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function Configuracoes() {
  const [config, setConfig] = useState({
    horarioInicio: "08:00",
    horarioFim: "20:00",
    intervalo: "6",
    emailNotif: true,
    whatsappNotif: false,
    alertaErro: true,
    alertaLead: true,
    relatoriosDiarios: true,
  });

  const salvar = () => toast.success("Configurações salvas com sucesso!");

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-muted-foreground text-sm">Horários de execução e notificações</p>
        </div>

        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-lg">Horários de Execução</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Início</Label><Input type="time" value={config.horarioInicio} onChange={(e) => setConfig({ ...config, horarioInicio: e.target.value })} /></div>
              <div><Label>Fim</Label><Input type="time" value={config.horarioFim} onChange={(e) => setConfig({ ...config, horarioFim: e.target.value })} /></div>
            </div>
            <div>
              <Label>Intervalo entre execuções</Label>
              <Select value={config.intervalo} onValueChange={(v) => setConfig({ ...config, intervalo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hora</SelectItem>
                  <SelectItem value="2">2 horas</SelectItem>
                  <SelectItem value="4">4 horas</SelectItem>
                  <SelectItem value="6">6 horas</SelectItem>
                  <SelectItem value="12">12 horas</SelectItem>
                  <SelectItem value="24">24 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-lg">Notificações</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: "emailNotif", label: "Notificações por Email" },
              { key: "whatsappNotif", label: "Notificações por WhatsApp" },
              { key: "alertaErro", label: "Alertas de Erro" },
              { key: "alertaLead", label: "Alertas de Novos Leads" },
              { key: "relatoriosDiarios", label: "Resumo Diário por Email" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <Label>{item.label}</Label>
                <Switch
                  checked={config[item.key as keyof typeof config] as boolean}
                  onCheckedChange={(v) => setConfig({ ...config, [item.key]: v })}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Button onClick={salvar} className="w-full sm:w-auto">Salvar Configurações</Button>
      </div>
    </DashboardLayout>
  );
}
