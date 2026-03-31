import { useState, useEffect, useCallback } from "react";
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
import { EDGE_BASE } from "@/lib/constants";
import {
  CheckCircle, XCircle, Loader2, Copy, Phone, Key, Webhook,
  Building2, RefreshCw, ShieldCheck, AlertTriangle,
} from "lucide-react";

interface WAConfig {
  id: string;
  company_id: string;
  company_name: string;
  meta_phone_number_id: string;
  meta_waba_id: string;
  meta_access_token: string;
  meta_display_phone: string;
  is_active: boolean;
  quality_rating: string | null;
  messaging_limit_tier: string | null;
  verified_name: string | null;
  webhook_verify_token: string;
}

interface EditState {
  meta_phone_number_id: string;
  meta_waba_id: string;
  meta_access_token: string;
  meta_display_phone: string;
}

const WEBHOOK_URL = `${EDGE_BASE}/whatsapp-meta-webhook`;

export default function ConfigWhatsApp() {
  const { isCEO } = useCollaborator();
  const [configs, setConfigs] = useState<WAConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [validating, setValidating] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, EditState>>({});

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    // Buscar empresas + credentials
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name")
      .not("id", "in", "(d33b6a84-8f72-4441-b2eb-dd151a31ac12,6fa2b90c-e123-4fcc-8e8b-c639f58636f8)")
      .order("name");

    if (!companies) { setLoading(false); return; }

    const { data: creds } = await supabase
      .from("whatsapp_meta_credentials")
      .select("*");

    const credMap = new Map((creds || []).map((c: any) => [c.company_id, c]));
    const mapped: WAConfig[] = companies.map((co: any) => {
      const c = credMap.get(co.id);
      return {
        id: c?.id || "",
        company_id: co.id,
        company_name: co.name,
        meta_phone_number_id: c?.meta_phone_number_id || "",
        meta_waba_id: c?.meta_waba_id || "",
        meta_access_token: c?.meta_access_token || "",
        meta_display_phone: c?.meta_display_phone || "",
        is_active: c?.is_active || false,
        quality_rating: c?.quality_rating || null,
        messaging_limit_tier: c?.messaging_limit_tier || null,
        verified_name: null,
        webhook_verify_token: c?.webhook_verify_token || `luxsales_${co.id.slice(0, 8)}`,
      };
    });

    setConfigs(mapped);
    const init: Record<string, EditState> = {};
    mapped.forEach((c) => {
      init[c.company_id] = {
        meta_phone_number_id: c.meta_phone_number_id,
        meta_waba_id: c.meta_waba_id,
        meta_access_token: c.meta_access_token,
        meta_display_phone: c.meta_display_phone,
      };
    });
    setEditing(init);
    setLoading(false);
  }, []);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  function handleChange(company_id: string, field: keyof EditState, value: string) {
    setEditing((prev) => ({
      ...prev,
      [company_id]: { ...prev[company_id], [field]: value },
    }));
  }

  // Validar token com Meta API
  async function validateAndSave(company_id: string) {
    const edit = editing[company_id];
    if (!edit.meta_access_token || !edit.meta_phone_number_id) {
      toast.error("Phone Number ID e Access Token são obrigatórios");
      return;
    }

    setValidating(company_id);

    // 1. Testar token na Meta API
    try {
      const res = await fetch(
        `https://graph.facebook.com/v22.0/${edit.meta_phone_number_id}?fields=quality_rating,messaging_limit_tier,verified_name,display_phone_number`,
        { headers: { Authorization: `Bearer ${edit.meta_access_token}` } }
      );
      const data = await res.json();

      if (!res.ok || data.error) {
        toast.error(`Token inválido: ${data.error?.message || "Erro desconhecido"}`);
        setValidating(null);
        return;
      }

      // Auto-preencher campos da Meta
      const displayPhone = data.display_phone_number || edit.meta_display_phone;
      const updatedEdit = {
        ...edit,
        meta_display_phone: displayPhone,
      };

      // Se WABA ID não preenchido, tentar buscar
      if (!edit.meta_waba_id) {
        try {
          const wabaRes = await fetch(
            `https://graph.facebook.com/v22.0/${edit.meta_phone_number_id}?fields=whatsapp_business_account`,
            { headers: { Authorization: `Bearer ${edit.meta_access_token}` } }
          );
          const wabaData = await wabaRes.json();
          if (wabaData.whatsapp_business_account?.id) {
            updatedEdit.meta_waba_id = wabaData.whatsapp_business_account.id;
          }
        } catch { /* ok, user pode preencher manual */ }
      }

      // 2. Salvar em whatsapp_meta_credentials (upsert)
      const cfg = configs.find((c) => c.company_id === company_id);
      const upsertData = {
        company_id,
        meta_phone_number_id: updatedEdit.meta_phone_number_id,
        meta_waba_id: updatedEdit.meta_waba_id || "",
        meta_access_token: updatedEdit.meta_access_token,
        meta_display_phone: displayPhone,
        quality_rating: data.quality_rating || null,
        messaging_limit_tier: data.messaging_limit_tier || null,
        api_version: "v22.0",
        is_active: true,
        webhook_verify_token: cfg?.webhook_verify_token || `luxsales_${company_id.slice(0, 8)}`,
        updated_at: new Date().toISOString(),
      };

      const { data: credResult, error } = await supabase
        .from("whatsapp_meta_credentials")
        .upsert(upsertData, { onConflict: "company_id" })
        .select("id")
        .single();

      if (error) {
        toast.error("Erro ao salvar: " + error.message);
        setValidating(null);
        return;
      }

      const credentialId = credResult?.id || cfg?.id;

      // 3. Popular whatsapp_meta_phone_numbers (para o webhook resolver company_id)
      await supabase.from("whatsapp_meta_phone_numbers").upsert({
        company_id,
        credential_id: credentialId,
        phone_number_id: updatedEdit.meta_phone_number_id,
        display_phone: displayPhone.replace(/[^0-9]/g, ""),
        verified_name: data.verified_name || null,
        quality_rating: data.quality_rating || null,
        messaging_limit_tier: data.messaging_limit_tier || null,
        status: "connected",
        webhook_url: WEBHOOK_URL,
        updated_at: new Date().toISOString(),
      }, { onConflict: "phone_number_id" });

      // 4. Sincronizar company_whatsapp_config (manter compatibilidade)
      await supabase.from("company_whatsapp_config").upsert({
        company_id,
        whatsapp_number: displayPhone,
        phone_number_id: updatedEdit.meta_phone_number_id,
        waba_id: updatedEdit.meta_waba_id,
        access_token: updatedEdit.meta_access_token,
        verify_token: cfg?.webhook_verify_token || `luxsales_${company_id.slice(0, 8)}`,
        webhook_url: WEBHOOK_URL,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "company_id" });

      setEditing((prev) => ({ ...prev, [company_id]: updatedEdit }));

      toast.success(
        `Conectado! ${data.verified_name || "WhatsApp"} — Quality: ${data.quality_rating || "N/A"}`,
        { duration: 5000 }
      );

      // 5. Auto-sincronizar templates
      if (updatedEdit.meta_waba_id) {
        syncTemplates(company_id, updatedEdit.meta_waba_id, updatedEdit.meta_access_token);
      }

      fetchConfigs();
    } catch (err: any) {
      toast.error("Erro de conexão com Meta API: " + (err.message || ""));
    }

    setValidating(null);
  }

  // Sincronizar templates da Meta
  async function syncTemplates(company_id: string, waba_id: string, token: string) {
    setSyncing(company_id);
    try {
      const res = await fetch(
        `https://graph.facebook.com/v22.0/${waba_id}/message_templates?limit=250`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      const templates = data.data || [];

      if (templates.length === 0) {
        toast.info("Nenhum template encontrado na Meta");
        setSyncing(null);
        return;
      }

      // Upsert cada template
      let synced = 0;
      for (const t of templates) {
        const { error } = await supabase.from("whatsapp_meta_templates").upsert({
          company_id,
          name: t.name,
          status: t.status,
          language: t.language || "pt_BR",
          category: t.category || "",
          meta_template_id: t.id,
          components: t.components || [],
          updated_at: new Date().toISOString(),
        }, { onConflict: "company_id,name,language" });
        if (!error) synced++;
      }

      toast.success(`${synced} templates sincronizados da Meta`);
    } catch (err: any) {
      toast.error("Erro ao sincronizar templates: " + (err.message || ""));
    }
    setSyncing(null);
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

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-amber-300 font-medium">Como configurar</p>
            <ol className="text-xs text-muted-foreground mt-2 space-y-1 list-decimal list-inside">
              <li>Cole o <strong>Phone Number ID</strong> e o <strong>Access Token</strong> (mínimo)</li>
              <li>Clique em <strong>Validar e Salvar</strong> — o sistema testa na Meta e preenche os demais campos</li>
              <li>Templates são sincronizados automaticamente</li>
              <li>Configure o Webhook URL abaixo no Meta App Dashboard</li>
            </ol>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4">
            {configs.map((cfg) => {
              const edit = editing[cfg.company_id] || {
                meta_phone_number_id: "",
                meta_waba_id: "",
                meta_access_token: "",
                meta_display_phone: "",
              };
              const isValidating = validating === cfg.company_id;
              const isSyncing = syncing === cfg.company_id;
              const isConnected = cfg.is_active && !!cfg.meta_access_token;

              return (
                <Card
                  key={cfg.company_id}
                  className={`border ${isConnected ? "border-green-500/30" : "border-border/40"}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-base">{cfg.company_name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        {cfg.quality_rating && (
                          <Badge
                            variant="outline"
                            className={
                              cfg.quality_rating === "GREEN"
                                ? "border-green-500/50 text-green-400"
                                : cfg.quality_rating === "YELLOW"
                                ? "border-yellow-500/50 text-yellow-400"
                                : "border-red-500/50 text-red-400"
                            }
                          >
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            {cfg.quality_rating}
                          </Badge>
                        )}
                        {cfg.messaging_limit_tier && (
                          <Badge variant="outline" className="text-muted-foreground">
                            {cfg.messaging_limit_tier.replace("TIER_", "Tier ")}
                          </Badge>
                        )}
                        <Badge
                          variant={isConnected ? "default" : "secondary"}
                          className={
                            isConnected
                              ? "bg-green-500/20 text-green-400 border-green-500/30"
                              : ""
                          }
                        >
                          {isConnected ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Conectado
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3 mr-1" />
                              Pendente
                            </>
                          )}
                        </Badge>
                      </div>
                    </div>
                    {isConnected && cfg.meta_display_phone && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {cfg.meta_display_phone}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs flex items-center gap-1">
                          <Key className="h-3 w-3" /> Phone Number ID *
                        </Label>
                        <Input
                          placeholder="1076393195549565"
                          value={edit.meta_phone_number_id}
                          onChange={(e) =>
                            handleChange(cfg.company_id, "meta_phone_number_id", e.target.value)
                          }
                          className="h-8 text-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs flex items-center gap-1">
                          <Key className="h-3 w-3" /> Access Token *
                        </Label>
                        <Input
                          type="password"
                          placeholder="EAAxxxxxxxxx..."
                          value={edit.meta_access_token}
                          onChange={(e) =>
                            handleChange(cfg.company_id, "meta_access_token", e.target.value)
                          }
                          className="h-8 text-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">WABA ID (auto-detectado)</Label>
                        <Input
                          placeholder="Preenchido automaticamente"
                          value={edit.meta_waba_id}
                          onChange={(e) =>
                            handleChange(cfg.company_id, "meta_waba_id", e.target.value)
                          }
                          className="h-8 text-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs flex items-center gap-1">
                          <Phone className="h-3 w-3" /> Número (auto-detectado)
                        </Label>
                        <Input
                          placeholder="Preenchido automaticamente"
                          value={edit.meta_display_phone}
                          onChange={(e) =>
                            handleChange(cfg.company_id, "meta_display_phone", e.target.value)
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>

                    {/* Webhook info */}
                    <div className="rounded-lg bg-secondary/40 p-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Webhook className="h-3 w-3" /> Dados para configurar no Meta App
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-28">Webhook URL:</span>
                        <code className="text-xs bg-background/60 px-2 py-0.5 rounded flex-1 truncate">
                          {WEBHOOK_URL}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => copyToClipboard(WEBHOOK_URL, "Webhook URL")}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-28">Verify Token:</span>
                        <code className="text-xs bg-background/60 px-2 py-0.5 rounded flex-1">
                          {cfg.webhook_verify_token}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() =>
                            copyToClipboard(cfg.webhook_verify_token, "Verify Token")
                          }
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-between items-center">
                      {isConnected && edit.meta_waba_id ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            syncTemplates(
                              cfg.company_id,
                              edit.meta_waba_id,
                              edit.meta_access_token
                            )
                          }
                          disabled={isSyncing}
                        >
                          {isSyncing ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Sincronizando...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Sincronizar Templates
                            </>
                          )}
                        </Button>
                      ) : (
                        <div />
                      )}

                      <Button
                        size="sm"
                        onClick={() => validateAndSave(cfg.company_id)}
                        disabled={isValidating}
                      >
                        {isValidating ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Validando...
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            Validar e Salvar
                          </>
                        )}
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
