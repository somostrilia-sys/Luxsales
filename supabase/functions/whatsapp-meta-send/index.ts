// WhatsApp Meta Send Message
// Envia mensagens via WhatsApp Cloud API oficial da Meta
// Suporta: text, template, image, video, document, audio, location, interactive

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const META_API_BASE = "https://graph.facebook.com";

interface SendRequest {
  company_id: string;
  to: string; // E.164 phone number
  type: "text" | "template" | "image" | "video" | "document" | "audio" | "location" | "interactive" | "reaction";
  // Text
  text?: { body: string; preview_url?: boolean };
  // Template
  template?: { name: string; language: string; components?: unknown[] };
  // Media
  image?: { link?: string; id?: string; caption?: string };
  video?: { link?: string; id?: string; caption?: string };
  document?: { link?: string; id?: string; caption?: string; filename?: string };
  audio?: { link?: string; id?: string };
  // Location
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  // Interactive
  interactive?: unknown;
  // Reaction
  reaction?: { message_id: string; emoji: string };
  // Context (reply)
  context?: { message_id: string };
  // Override phone number
  phone_number_id?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body: SendRequest = await req.json();
    const { company_id, to, type } = body;

    if (!company_id || !to || !type) {
      return Response.json(
        { error: "company_id, to, and type are required" },
        { status: 400 },
      );
    }

    // 1. Verificar opt-in
    const { data: optIn } = await supabase.rpc("fn_check_opt_in", {
      p_company_id: company_id,
      p_phone: to,
      p_message_type: type === "template" ? (body.template?.name?.includes("marketing") ? "marketing" : "transactional") : "transactional",
    });

    const hasOptIn = optIn?.[0]?.has_opt_in ?? false;
    if (!hasOptIn && type !== "template") {
      return Response.json(
        { error: "Contato nao possui opt-in ativo. Envie um template primeiro." },
        { status: 403 },
      );
    }

    // 2. Verificar DNC (Do Not Call/Contact)
    const { data: isDnc } = await supabase.rpc("fn_check_dnc", {
      p_phone: to,
      p_company_id: company_id,
    });

    if (isDnc) {
      return Response.json(
        { error: "Contato esta na lista DNC (Do Not Contact)" },
        { status: 403 },
      );
    }

    // 3. Buscar credentials da empresa
    const { data: creds } = await supabase
      .from("whatsapp_meta_credentials")
      .select("*")
      .eq("company_id", company_id)
      .eq("is_active", true)
      .single();

    if (!creds) {
      return Response.json(
        { error: "WhatsApp Meta credentials nao encontradas para esta empresa" },
        { status: 404 },
      );
    }

    // 4. Buscar phone number
    let phoneNumberId = body.phone_number_id;
    let phoneRecord;

    if (!phoneNumberId) {
      const { data: phone } = await supabase
        .from("whatsapp_meta_phone_numbers")
        .select("*")
        .eq("company_id", company_id)
        .eq("status", "connected")
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      if (!phone) {
        return Response.json(
          { error: "Nenhum numero WhatsApp conectado para esta empresa" },
          { status: 404 },
        );
      }
      phoneNumberId = phone.phone_number_id;
      phoneRecord = phone;
    }

    if (!phoneRecord) {
      // Buscar pelo ID se foi passado manualmente
      const { data: manualPhone } = await supabase
        .from("whatsapp_meta_phone_numbers")
        .select("*")
        .eq("phone_number_id", phoneNumberId)
        .single();
      phoneRecord = manualPhone;
    }

    // 5. Verificar rate limit (simples, via banco)
    const { data: rateLimit } = await supabase
      .from("whatsapp_meta_rate_limits")
      .select("*")
      .eq("company_id", company_id)
      .eq("limit_type", "messaging")
      .single();

    if (rateLimit?.is_throttled && rateLimit.throttled_until && new Date(rateLimit.throttled_until) > new Date()) {
      return Response.json(
        { error: "Rate limit atingido. Tente novamente apos: " + rateLimit.throttled_until },
        { status: 429 },
      );
    }

    // 6. Se template, buscar template_id
    let templateId = null;
    let pricingCategory = "service";

    if (type === "template" && body.template) {
      const { data: tmpl } = await supabase
        .from("whatsapp_meta_templates")
        .select("id, category, status")
        .eq("company_id", company_id)
        .eq("name", body.template.name)
        .eq("language", body.template.language || "pt_BR")
        .single();

      if (tmpl?.status !== "APPROVED") {
        return Response.json(
          { error: `Template "${body.template.name}" nao esta aprovado (status: ${tmpl?.status || 'nao encontrado'})` },
          { status: 400 },
        );
      }

      templateId = tmpl.id;
      pricingCategory = tmpl.category.toLowerCase();
    }

    // 7. Montar payload para a Meta API
    const apiVersion = creds.api_version || "v21.0";
    const metaPayload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to,
      type: type,
    };

    // Adicionar conteúdo por tipo
    if (type === "text") metaPayload.text = body.text;
    if (type === "template") metaPayload.template = body.template;
    if (type === "image") metaPayload.image = body.image;
    if (type === "video") metaPayload.video = body.video;
    if (type === "document") metaPayload.document = body.document;
    if (type === "audio") metaPayload.audio = body.audio;
    if (type === "location") metaPayload.location = body.location;
    if (type === "interactive") metaPayload.interactive = body.interactive;
    if (type === "reaction") metaPayload.reaction = body.reaction;
    if (body.context) metaPayload.context = body.context;

    // 8. Enviar para Meta API
    const metaResponse = await fetch(
      `${META_API_BASE}/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${creds.meta_access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metaPayload),
      },
    );

    const metaResult = await metaResponse.json();

    if (!metaResponse.ok) {
      // Log erro
      await supabase.from("whatsapp_meta_webhook_events").insert({
        company_id,
        phone_number_id: phoneNumberId,
        event_type: "send_error",
        event_subtype: String(metaResult.error?.code || "unknown"),
        payload: metaResult,
        processing_status: "processed",
        processed_at: new Date().toISOString(),
        idempotency_key: `send_err_${Date.now()}`,
      });

      // Se rate limit da Meta
      if (metaResponse.status === 429) {
        await supabase
          .from("whatsapp_meta_rate_limits")
          .upsert({
            company_id,
            phone_number_id: phoneRecord?.id,
            limit_type: "messaging",
            is_throttled: true,
            throttled_until: new Date(Date.now() + 60000).toISOString(),
            violation_count: (rateLimit?.violation_count || 0) + 1,
            last_violation_at: new Date().toISOString(),
          }, { onConflict: "id" });
      }

      return Response.json(
        { error: "Meta API error", details: metaResult },
        { status: metaResponse.status },
      );
    }

    const wamid = metaResult.messages?.[0]?.id;

    // 9. Salvar mensagem enviada
    await supabase.from("whatsapp_meta_messages").insert({
      company_id,
      message_id: wamid,
      direction: "outbound",
      phone_from: phoneRecord?.display_phone || phoneNumberId,
      phone_to: to,
      type: type,
      body: body.text?.body || body.template?.name || body.image?.caption || null,
      template_name: body.template?.name || null,
      template_id: templateId,
      status: "sent",
      sent_at: new Date().toISOString(),
      phone_number_id: phoneNumberId,
      phone_number_fk: phoneRecord?.id,
      opt_in_id: optIn?.[0]?.opt_in_id || null,
      pricing_category: pricingCategory,
      conversation_origin: "business_initiated",
      is_billable: true,
      reply_to_wamid: body.context?.message_id || null,
      metadata: { api_response: metaResult },
    });

    // 10. Registrar billing
    await supabase.from("billing_usage").insert({
      company_id,
      channel: "whatsapp",
      usage_type: `message_${type}`,
      quantity: 1,
      reference_table: "whatsapp_meta_messages",
      meta_conversation_id: metaResult.contacts?.[0]?.wa_id,
      description: `WhatsApp ${type} para ${to}`,
    });

    // 11. Atualizar stats do template (increment via SQL)
    if (templateId) {
      try { await supabase.rpc("exec_sql" as any, {}); } catch (_) { /* ignore if rpc doesn't exist */ }
      await supabase
        .from("whatsapp_meta_templates")
        .update({
          total_sent: ((await supabase.from("whatsapp_meta_templates").select("total_sent").eq("id", templateId).single()).data?.total_sent ?? 0) + 1,
          last_sent_at: new Date().toISOString(),
        })
        .eq("id", templateId);
    }

    // 12. Audit log
    await supabase.from("audit_logs").insert({
      company_id,
      table_name: "whatsapp_meta_messages",
      action: "API_CALL",
      actor_type: "api",
      metadata: { wamid, to, type, template: body.template?.name },
    });

    return Response.json({
      success: true,
      wamid,
      message_id: wamid,
      contacts: metaResult.contacts,
    });
  } catch (err) {
    console.error("Send error:", err);
    return Response.json(
      { error: "Internal server error", details: String(err) },
      { status: 500 },
    );
  }
});
