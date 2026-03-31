import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { toast } from "sonner";
import { CheckCircle, XCircle, Loader2, Copy, Phone, Key, Webhook, Building2 } from "lucide-react";
import { EDGE_BASE } from "@/lib/constants";

interface WAConfig {
  id: string;
  company_id: string;
  company_name: string;
  whatsapp_number: string | null;
  phone_number_id: string | null;
  waba_id: string | null;
  access_token: string | null;
  verify_token: string;
  webhook_url: string | null;
  is_active: boolean;
}

const WEBHOOK_BASE = `${EDGE_BASE}/whatsapp-meta-webhook`;

export default function ConfigWhatsApp() {
  const { isCEO } = useCollaborator();
  const [configs, setConfigs] = useState<WAConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, Partial<WAConfig>>>({});

  useEffect(() => {
    fetchConfigs();
  }, []);

  async function fetchConfigs() {
    setLoading(true);
    const { data, error } = await supabase
      .from("company_whatsapp_config")
      .select("*, companies(name)")
      .order("companies(name)");

    if (error) {
      toast.error("Erro ao carregar configurações");
    } else {
      const mapped = (data || []).map((r: any) => ({
        ...r,
        company_name: r.companies?.name || "—",
      }));
      setConfigs(mapped);
      // Init editing state
      const init: Record<string, Partial<WAConfig>> = {};
      mapped.forEach((c: WAConfig) => { init[c.company_id] = { ...c }; });
      setEditing(init);
    }
    setLoading(false);
  }

  function handleChange(company_id: string, field: keyof WAConfig, value: string) {
    setEditing(prev => ({
      ...prev,
      [company_id]: { ...prev[company_id], [field]: value },
    }));
  }

  async function handleSave(company_id: string) {
    setSaving(company_id);
    const data = editing[company_id];
    const { error } = await supabase
      .from("company_whatsapp_config")
      .update({
        whatsapp_number: data.whatsapp_number || null,
        phone_number_id: data.phone_number_id || null,
        waba_id: data.waba_id || null,
        access_token: data.access_token || null,
        webhook_url: data.webhook_url || null,
        is_active: !!(data.phone_number_id && data.waba_id && data.access_token && data.whatsapp_number),
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", company_id);

    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Configuração salva!");
      fetchConfigs();
    }
    setSaving(null);
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  }

  if (!isCEO) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Acesso restrito ao CEO.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        <PageHeader
          title="WhatsApp por Empresa"
          subtitle="Configure o número Meta Business de cada empresa do grupo"
        />

        {/* Instrução */}
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-amber-300 font-medium">📋 Como configurar</p>
            <ol className="text-xs text-muted-foreground mt-2 space-y-1 list-decimal list-inside">
              <li>Acesse <strong>Meta Business Suite → WhatsApp Manager</strong></li>
              <li>Crie ou selecione o número da empresa</li>
              <li>Copie o <strong>Phone Number ID</strong> e o <strong>WABA ID</strong></li>
              <li>Gere um <strong>Access Token permanente</strong> no App Dashboard</li>
              <li>Configure o Webhook URL com o <strong>Verify Token</strong> mostrado abaixo</li>
              <li>Cole os dados aqui e clique em <strong>Salvar</strong></li>
            </ol>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4">
            {configs.map(cfg => {
              const edit = editing[cfg.company_id] || cfg;
              const isSaving = saving === cfg.company_id;
              const isConfigured = !!(cfg.phone_number_id && cfg.waba_id && cfg.access_token && cfg.whatsapp_number);
              const webhookUrl = `${WEBHOOK_BASE}?company=${cfg.company_id}`;

              return (
                <Card key={cfg.company_id} className={`border ${isConfigured ? "border-green-500/30" : "border-border/40"}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-base">{cfg.company_name}</CardTitle>
                      </div>
                      <Badge variant={isConfigured ? "default" : "secondary"} className={isConfigured ? "bg-green-500/20 text-green-400 border-green-500/30" : ""}>
                        {isConfigured ? <><CheckCircle className="h-3 w-3 mr-1" />Ativo</> : <><XCircle className="h-3 w-3 mr-1" />Pendente</>}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Número WhatsApp */}
                      <div className="space-y-1.5">
                        <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> Número WhatsApp</Label>
                        <Input
                          placeholder="+55 11 99999-9999"
                          value={edit.whatsapp_number || ""}
                          onChange={e => handleChange(cfg.company_id, "whatsapp_number", e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>

                      {/* Phone Number ID */}
                      <div className="space-y-1.5">
                        <Label className="text-xs flex items-center gap-1"><Key className="h-3 w-3" /> Phone Number ID</Label>
                        <Input
                          placeholder="1076393195549565"
                          value={edit.phone_number_id || ""}
                          onChange={e => handleChange(cfg.company_id, "phone_number_id", e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>

                      {/* WABA ID */}
                      <div className="space-y-1.5">
                        <Label className="text-xs">WABA ID (WhatsApp Business Account)</Label>
                        <Input
                          placeholder="2057526771644703"
                          value={edit.waba_id || ""}
                          onChange={e => handleChange(cfg.company_id, "waba_id", e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>

                      {/* Access Token */}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Access Token (permanente)</Label>
                        <Input
                          type="password"
                          placeholder="EAAxxxxxxxxx..."
                          value={edit.access_token || ""}
                          onChange={e => handleChange(cfg.company_id, "access_token", e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>

                    {/* Webhook info (somente leitura) */}
                    <div className="rounded-lg bg-secondary/40 p-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Webhook className="h-3 w-3" /> Dados para configurar no Meta</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-28">Webhook URL:</span>
                        <code className="text-xs bg-background/60 px-2 py-0.5 rounded flex-1 truncate">{webhookUrl}</code>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyToClipboard(webhookUrl, "Webhook URL")}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-28">Verify Token:</span>
                        <code className="text-xs bg-background/60 px-2 py-0.5 rounded flex-1">{cfg.verify_token}</code>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyToClipboard(cfg.verify_token, "Verify Token")}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button size="sm" onClick={() => handleSave(cfg.company_id)} disabled={isSaving}>
                        {isSaving ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Salvando...</> : "Salvar"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
