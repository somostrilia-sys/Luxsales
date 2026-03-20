// Meta Auto-Onboard
// Configura automaticamente TODAS as empresas na Meta WhatsApp Cloud API
// Chamado uma vez quando a aprovação da Meta chegar
// POST { app_id, app_secret, meta_access_token, meta_waba_id, business_id }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const META_API_BASE = "https://graph.facebook.com";

interface OnboardRequest {
  meta_access_token: string;
  meta_waba_id: string;
  app_id?: string;
  business_id?: string;
  api_version?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body: OnboardRequest = await req.json();
    const { meta_access_token, meta_waba_id } = body;

    if (!meta_access_token || !meta_waba_id) {
      return Response.json({ error: "meta_access_token and meta_waba_id required" }, { status: 400 });
    }

    const apiVersion = body.api_version || "v21.0";
    const results: Record<string, unknown> = {};

    // 1. Buscar phone numbers da WABA
    const phonesRes = await fetch(
      `${META_API_BASE}/${apiVersion}/${meta_waba_id}/phone_numbers`,
      { headers: { Authorization: `Bearer ${meta_access_token}` } },
    );
    const phonesData = await phonesRes.json();

    if (!phonesRes.ok) {
      return Response.json({ error: "Meta API error fetching phone numbers", details: phonesData }, { status: 400 });
    }

    results.phone_numbers_found = phonesData.data?.length || 0;

    // 2. Buscar todas as empresas
    const { data: companies } = await supabase.from("companies").select("id, name, slug");

    // 3. Atualizar credentials de TODAS as empresas
    const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-meta-webhook`;
    const companiesUpdated = [];

    for (const company of companies || []) {
      // Atualizar credential existente
      const { error } = await supabase
        .from("whatsapp_meta_credentials")
        .update({
          meta_access_token,
          meta_waba_id,
          app_id: body.app_id || null,
          business_id: body.business_id || null,
          api_version: apiVersion,
          onboarding_status: "active",
          is_active: true,
          is_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq("company_id", company.id);

      if (!error) {
        companiesUpdated.push(company.name);
      }
    }

    results.companies_updated = companiesUpdated;

    // 4. Registrar phone numbers
    const phonesRegistered = [];
    for (const phone of phonesData.data || []) {
      // Associar ao primeiro company sem phone number (ou Walk Holding como default)
      const { data: existingPhone } = await supabase
        .from("whatsapp_meta_phone_numbers")
        .select("id")
        .eq("phone_number_id", phone.id)
        .single();

      if (!existingPhone) {
        const { data: cred } = await supabase
          .from("whatsapp_meta_credentials")
          .select("id, company_id")
          .order("created_at")
          .limit(1)
          .single();

        if (cred) {
          await supabase.from("whatsapp_meta_phone_numbers").insert({
            company_id: cred.company_id,
            credential_id: cred.id,
            phone_number_id: phone.id,
            display_phone: phone.display_phone_number,
            verified_name: phone.verified_name,
            quality_rating: phone.quality_rating || null,
            messaging_limit_tier: phone.messaging_limit_tier || "TIER_250",
            status: phone.code_verification_status === "VERIFIED" ? "connected" : "pending",
            code_verification_status: phone.code_verification_status,
            name_status: phone.name_status,
            platform_type: "CLOUD_API",
          });

          phonesRegistered.push({
            phone: phone.display_phone_number,
            name: phone.verified_name,
            status: phone.code_verification_status,
          });
        }
      }
    }

    results.phones_registered = phonesRegistered;

    // 5. Sincronizar templates da Meta
    const templatesRes = await fetch(
      `${META_API_BASE}/${apiVersion}/${meta_waba_id}/message_templates?limit=250`,
      { headers: { Authorization: `Bearer ${meta_access_token}` } },
    );
    const templatesData = await templatesRes.json();

    let templatesSynced = 0;
    if (templatesRes.ok && templatesData.data) {
      for (const tmpl of templatesData.data) {
        // Sync para a primeira empresa (pode redistribuir depois)
        const firstCompany = companies?.[0];
        if (firstCompany) {
          await supabase.from("whatsapp_meta_templates").upsert({
            company_id: firstCompany.id,
            meta_template_id: tmpl.id,
            name: tmpl.name,
            language: tmpl.language,
            category: tmpl.category,
            status: tmpl.status,
            quality_score: tmpl.quality_score?.score || "UNKNOWN",
            components: tmpl.components || [],
            updated_at: new Date().toISOString(),
          }, { onConflict: "company_id,name,language" });
          templatesSynced++;
        }
      }
    }

    results.templates_synced = templatesSynced;

    // 6. Configurar webhook na Meta (subscrever para eventos)
    const subscribeRes = await fetch(
      `${META_API_BASE}/${apiVersion}/${body.app_id}/subscriptions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${meta_access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          object: "whatsapp_business_account",
          callback_url: webhookUrl,
          verify_token: (await supabase.from("whatsapp_meta_credentials").select("webhook_verify_token").limit(1).single()).data?.webhook_verify_token,
          fields: ["messages", "message_template_status_update", "messaging_handovers"],
        }),
      },
    );

    const subscribeData = await subscribeRes.json();
    results.webhook_subscribed = subscribeRes.ok;
    results.webhook_details = subscribeData;

    // 7. Log de auditoria
    await supabase.from("audit_logs").insert({
      company_id: companies?.[0]?.id,
      table_name: "meta_onboarding",
      action: "API_CALL",
      actor_type: "api",
      metadata: {
        action: "auto_onboard_all",
        companies_updated: companiesUpdated.length,
        phones_registered: phonesRegistered.length,
        templates_synced: templatesSynced,
        webhook_subscribed: subscribeRes.ok,
      },
    });

    return Response.json({
      success: true,
      webhook_url: webhookUrl,
      results,
      next_steps: [
        "1. Verifique se o webhook foi subscrito corretamente no Facebook Developer",
        "2. Associe os phone numbers às empresas corretas no painel",
        "3. Faça publish no Lovable para ver as mudanças no frontend",
        "4. Teste enviando uma mensagem pelo painel WhatsApp Meta",
      ],
    });
  } catch (err) {
    console.error("Auto-onboard error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
