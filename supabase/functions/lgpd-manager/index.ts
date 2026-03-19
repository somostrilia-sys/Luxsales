// LGPD Manager
// Gerencia consentimento, opt-in/opt-out, direito ao esquecimento
// Compliance com Lei Geral de Protecao de Dados

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface LgpdRequest {
  company_id: string;
  action: "opt_in" | "opt_out" | "check" | "delete_data" | "export_data" | "list_opt_ins";
  phone: string;
  // opt_in
  contact_name?: string;
  method?: string;
  source?: string;
  consent_text?: string;
  legal_basis?: string;
  consent_marketing?: boolean;
  consent_transactional?: boolean;
  // list
  page?: number;
  limit?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body: LgpdRequest = await req.json();
    const { company_id, action, phone } = body;

    if (!company_id || !action) {
      return Response.json({ error: "company_id and action required" }, { status: 400 });
    }

    switch (action) {
      // ---- Registrar opt-in ----
      case "opt_in": {
        if (!phone) {
          return Response.json({ error: "phone required" }, { status: 400 });
        }

        const consentText = body.consent_text ||
          "Autorizo o recebimento de mensagens via WhatsApp para fins de comunicacao comercial e suporte.";

        const { data, error } = await supabase.from("whatsapp_meta_opt_ins").upsert({
          company_id,
          phone_number: phone,
          contact_name: body.contact_name || null,
          opt_in_method: body.method || "api",
          opt_in_source: body.source || null,
          opted_in_at: new Date().toISOString(),
          opted_out_at: null,
          is_active: true,
          consent_text: consentText,
          lgpd_legal_basis: body.legal_basis || "consent",
          lgpd_data_purpose: "Comunicacao comercial via WhatsApp",
          lgpd_retention_days: 365,
          consent_marketing: body.consent_marketing ?? false,
          consent_transactional: body.consent_transactional ?? true,
          consent_support: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "company_id,phone_number" });

        if (error) {
          return Response.json({ error: error.message }, { status: 400 });
        }

        await supabase.from("audit_logs").insert({
          company_id,
          table_name: "whatsapp_meta_opt_ins",
          action: "INSERT",
          actor_type: "api",
          metadata: { phone, method: body.method, legal_basis: body.legal_basis },
        });

        return Response.json({ success: true, message: "Opt-in registrado com sucesso" });
      }

      // ---- Registrar opt-out ----
      case "opt_out": {
        if (!phone) {
          return Response.json({ error: "phone required" }, { status: 400 });
        }

        const { error } = await supabase
          .from("whatsapp_meta_opt_ins")
          .update({
            is_active: false,
            opted_out_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("company_id", company_id)
          .eq("phone_number", phone);

        if (error) {
          return Response.json({ error: error.message }, { status: 400 });
        }

        await supabase.from("audit_logs").insert({
          company_id,
          table_name: "whatsapp_meta_opt_ins",
          action: "UPDATE",
          actor_type: "api",
          metadata: { phone, action: "opt_out" },
        });

        return Response.json({ success: true, message: "Opt-out registrado. Contato nao recebera mais mensagens." });
      }

      // ---- Verificar status do opt-in ----
      case "check": {
        if (!phone) {
          return Response.json({ error: "phone required" }, { status: 400 });
        }

        const { data } = await supabase
          .from("whatsapp_meta_opt_ins")
          .select("*")
          .eq("company_id", company_id)
          .eq("phone_number", phone)
          .single();

        return Response.json({
          has_opt_in: data?.is_active || false,
          details: data || null,
        });
      }

      // ---- Direito ao esquecimento (LGPD Art. 18) ----
      case "delete_data": {
        if (!phone) {
          return Response.json({ error: "phone required" }, { status: 400 });
        }

        // Marcar pedido de exclusao
        await supabase
          .from("whatsapp_meta_opt_ins")
          .update({
            lgpd_deletion_requested_at: new Date().toISOString(),
            is_active: false,
            opted_out_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("company_id", company_id)
          .eq("phone_number", phone);

        // Executar anonimizacao
        const { data: result } = await supabase.rpc("fn_process_lgpd_deletion", {
          p_company_id: company_id,
          p_phone: phone,
        });

        return Response.json({
          success: true,
          message: "Dados anonimizados conforme LGPD Art. 18",
          details: result,
        });
      }

      // ---- Exportar dados do titular (LGPD Art. 18) ----
      case "export_data": {
        if (!phone) {
          return Response.json({ error: "phone required" }, { status: 400 });
        }

        // Coletar todos os dados do titular
        const { data: optIn } = await supabase
          .from("whatsapp_meta_opt_ins")
          .select("*")
          .eq("company_id", company_id)
          .eq("phone_number", phone);

        const { data: messages } = await supabase
          .from("whatsapp_meta_messages")
          .select("id, direction, type, body, status, created_at")
          .eq("company_id", company_id)
          .or(`phone_from.eq.${phone},phone_to.eq.${phone}`)
          .order("created_at", { ascending: false })
          .limit(500);

        const { data: conversations } = await supabase
          .from("whatsapp_meta_conversations_billing")
          .select("category, origin, window_start, window_end, message_count")
          .eq("company_id", company_id)
          .eq("contact_phone", phone);

        await supabase.from("audit_logs").insert({
          company_id,
          table_name: "lgpd_export",
          action: "EXPORT",
          actor_type: "api",
          metadata: { phone, message_count: messages?.length },
        });

        return Response.json({
          titular: { phone },
          consent: optIn,
          messages: messages,
          conversations: conversations,
          exported_at: new Date().toISOString(),
          note: "Dados exportados conforme LGPD Art. 18, inciso V",
        });
      }

      // ---- Listar opt-ins ----
      case "list_opt_ins": {
        const page = body.page || 1;
        const limit = body.limit || 50;
        const offset = (page - 1) * limit;

        const { data, count } = await supabase
          .from("whatsapp_meta_opt_ins")
          .select("*", { count: "exact" })
          .eq("company_id", company_id)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        return Response.json({
          opt_ins: data,
          total: count,
          page,
          pages: Math.ceil((count || 0) / limit),
        });
      }

      default:
        return Response.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (err) {
    console.error("LGPD error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
