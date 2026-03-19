// WhatsApp Meta Onboarding
// Gerencia o processo de onboarding de empresas na WhatsApp Cloud API
// Registra phone numbers, configura webhooks, verifica business

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const META_API_BASE = "https://graph.facebook.com";

interface OnboardingRequest {
  company_id: string;
  action:
    | "setup_credentials"
    | "register_phone"
    | "verify_phone"
    | "check_status"
    | "update_business_profile"
    | "get_phone_numbers";
  // setup_credentials
  meta_access_token?: string;
  meta_phone_number_id?: string;
  meta_waba_id?: string;
  app_id?: string;
  business_id?: string;
  webhook_verify_token?: string;
  // verify_phone
  verification_code?: string;
  phone_number_id?: string;
  // update_business_profile
  business_profile?: {
    about?: string;
    address?: string;
    description?: string;
    email?: string;
    vertical?: string;
    websites?: string[];
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body: OnboardingRequest = await req.json();
    const { company_id, action } = body;

    if (!company_id || !action) {
      return Response.json({ error: "company_id and action required" }, { status: 400 });
    }

    switch (action) {
      // ---- Setup inicial de credentials ----
      case "setup_credentials": {
        if (!body.meta_access_token || !body.meta_waba_id) {
          return Response.json({ error: "meta_access_token and meta_waba_id required" }, { status: 400 });
        }

        const verifyToken = body.webhook_verify_token || crypto.randomUUID();

        // Verificar se já existe
        const { data: existing } = await supabase
          .from("whatsapp_meta_credentials")
          .select("id")
          .eq("company_id", company_id)
          .single();

        const credData = {
          company_id,
          meta_access_token: body.meta_access_token,
          meta_waba_id: body.meta_waba_id,
          meta_phone_number_id: body.meta_phone_number_id || "",
          meta_display_phone: "",
          app_id: body.app_id || null,
          business_id: body.business_id || null,
          webhook_verify_token: verifyToken,
          onboarding_status: "in_progress",
          is_active: true,
          updated_at: new Date().toISOString(),
        };

        if (existing) {
          await supabase
            .from("whatsapp_meta_credentials")
            .update(credData)
            .eq("id", existing.id);
        } else {
          await supabase.from("whatsapp_meta_credentials").insert(credData);
        }

        // Criar rate limit padrao
        const { data: cred } = await supabase
          .from("whatsapp_meta_credentials")
          .select("id")
          .eq("company_id", company_id)
          .single();

        await supabase.from("whatsapp_meta_rate_limits").insert({
          company_id,
          limit_type: "messaging",
          max_per_second: 80,
          max_per_day: 250,
        }).onConflict("id").ignore();

        // Audit
        await supabase.from("audit_logs").insert({
          company_id,
          table_name: "whatsapp_meta_credentials",
          action: existing ? "UPDATE" : "INSERT",
          actor_type: "api",
          metadata: { waba_id: body.meta_waba_id },
        });

        // Webhook URL para configurar na Meta
        const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-meta-webhook`;

        return Response.json({
          success: true,
          verify_token: verifyToken,
          webhook_url: webhookUrl,
          next_steps: [
            "1. Vá em developers.facebook.com > seu App > WhatsApp > Configuration",
            "2. Em Webhook, clique Edit e configure:",
            `   - Callback URL: ${webhookUrl}`,
            `   - Verify Token: ${verifyToken}`,
            "3. Clique Verify and Save",
            "4. Marque os campos: messages, message_template_status_update",
            "5. Execute action: 'get_phone_numbers' para registrar seus numeros",
          ],
        });
      }

      // ---- Buscar phone numbers da WABA ----
      case "get_phone_numbers": {
        const { data: creds } = await supabase
          .from("whatsapp_meta_credentials")
          .select("*")
          .eq("company_id", company_id)
          .eq("is_active", true)
          .single();

        if (!creds) {
          return Response.json({ error: "Credentials not found. Run setup_credentials first." }, { status: 404 });
        }

        const apiVersion = creds.api_version || "v21.0";
        const response = await fetch(
          `${META_API_BASE}/${apiVersion}/${creds.meta_waba_id}/phone_numbers`,
          { headers: { Authorization: `Bearer ${creds.meta_access_token}` } },
        );

        const result = await response.json();

        if (!response.ok) {
          return Response.json({ error: "Meta API error", details: result }, { status: response.status });
        }

        // Registrar cada numero no banco
        const registered = [];
        for (const phone of result.data || []) {
          await supabase.from("whatsapp_meta_phone_numbers").upsert({
            company_id,
            credential_id: creds.id,
            phone_number_id: phone.id,
            display_phone: phone.display_phone_number,
            verified_name: phone.verified_name,
            quality_rating: phone.quality_rating || null,
            messaging_limit_tier: phone.messaging_limit_tier || "TIER_250",
            status: phone.code_verification_status === "VERIFIED" ? "connected" : "pending",
            code_verification_status: phone.code_verification_status,
            name_status: phone.name_status,
            is_official_business_account: phone.is_official_business_account || false,
            platform_type: phone.platform_type || "CLOUD_API",
            updated_at: new Date().toISOString(),
          }, { onConflict: "phone_number_id" });

          registered.push({
            phone_number_id: phone.id,
            display_phone: phone.display_phone_number,
            verified_name: phone.verified_name,
            status: phone.code_verification_status,
          });
        }

        // Atualizar credential com o primeiro numero
        if (registered.length > 0) {
          await supabase
            .from("whatsapp_meta_credentials")
            .update({
              meta_phone_number_id: registered[0].phone_number_id,
              meta_display_phone: registered[0].display_phone,
            })
            .eq("id", creds.id);
        }

        return Response.json({ success: true, phone_numbers: registered });
      }

      // ---- Verificar status do onboarding ----
      case "check_status": {
        const { data: creds } = await supabase
          .from("whatsapp_meta_credentials")
          .select("*")
          .eq("company_id", company_id)
          .single();

        const { data: phones } = await supabase
          .from("whatsapp_meta_phone_numbers")
          .select("*")
          .eq("company_id", company_id);

        const { data: templates } = await supabase
          .from("whatsapp_meta_templates")
          .select("id, name, status, category")
          .eq("company_id", company_id);

        const { data: optIns } = await supabase
          .from("whatsapp_meta_opt_ins")
          .select("id")
          .eq("company_id", company_id)
          .eq("is_active", true);

        const status = {
          credentials: creds ? {
            configured: true,
            verified: creds.is_verified,
            onboarding_status: creds.onboarding_status,
            quality_rating: creds.quality_rating,
            messaging_limit: creds.messaging_limit_tier,
          } : { configured: false },
          phone_numbers: phones || [],
          templates: {
            total: templates?.length || 0,
            approved: templates?.filter(t => t.status === "APPROVED").length || 0,
            pending: templates?.filter(t => t.status === "PENDING").length || 0,
            rejected: templates?.filter(t => t.status === "REJECTED").length || 0,
          },
          opt_ins: { total_active: optIns?.length || 0 },
          webhook_url: `${SUPABASE_URL}/functions/v1/whatsapp-meta-webhook`,
          checklist: {
            credentials_configured: !!creds,
            phone_registered: (phones?.length || 0) > 0,
            phone_verified: phones?.some(p => p.status === "connected") || false,
            templates_approved: templates?.some(t => t.status === "APPROVED") || false,
            webhook_configured: !!creds?.webhook_verify_token,
            opt_in_system_ready: true,
          },
        };

        return Response.json(status);
      }

      // ---- Atualizar Business Profile ----
      case "update_business_profile": {
        const { data: creds } = await supabase
          .from("whatsapp_meta_credentials")
          .select("*")
          .eq("company_id", company_id)
          .eq("is_active", true)
          .single();

        if (!creds) {
          return Response.json({ error: "Credentials not found" }, { status: 404 });
        }

        const phoneNumberId = body.phone_number_id || creds.meta_phone_number_id;
        const apiVersion = creds.api_version || "v21.0";

        const response = await fetch(
          `${META_API_BASE}/${apiVersion}/${phoneNumberId}/whatsapp_business_profile`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${creds.meta_access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              ...body.business_profile,
            }),
          },
        );

        const result = await response.json();
        return Response.json({ success: response.ok, details: result });
      }

      default:
        return Response.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (err) {
    console.error("Onboarding error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
