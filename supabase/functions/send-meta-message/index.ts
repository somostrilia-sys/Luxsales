/**
 * send-meta-message
 * Envia mensagens via Meta WhatsApp Business Cloud API
 * Suporta: templates, texto, mídia, interativos
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const body = await req.json().catch(() => ({}));
  const action = body.action || "send";

  // Buscar credenciais Meta (priorizar por company_id, fallback system_configs)
  let cred: any = null;

  if (body.company_id) {
    const { data } = await supabase
      .from("whatsapp_meta_credentials")
      .select("*")
      .eq("company_id", body.company_id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    cred = data;
  }

  if (!cred?.meta_access_token) {
    // Fallback: buscar qualquer credential com token
    const { data } = await supabase
      .from("whatsapp_meta_credentials")
      .select("*")
      .eq("is_active", true)
      .not("meta_access_token", "is", null)
      .limit(1)
      .maybeSingle();
    cred = data;
  }

  if (!cred?.meta_access_token) {
    // Último fallback: system_configs
    const { data: configs } = await supabase
      .from("system_configs")
      .select("key, value")
      .in("key", ["meta_whatsapp_token", "meta_phone_number_id"]);

    const cfg: Record<string, string> = {};
    for (const c of configs || []) cfg[c.key] = c.value;

    if (cfg.meta_whatsapp_token && cfg.meta_phone_number_id) {
      cred = {
        meta_access_token: cfg.meta_whatsapp_token,
        meta_phone_number_id: cfg.meta_phone_number_id,
        company_id: body.company_id,
      };
    }
  }

  if (!cred?.meta_access_token || !cred?.meta_phone_number_id) {
    return new Response(
      JSON.stringify({ error: "Meta WhatsApp credentials not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const META_URL = `https://graph.facebook.com/v22.0/${cred.meta_phone_number_id}/messages`;
  const headers = {
    "Authorization": `Bearer ${cred.meta_access_token}`,
    "Content-Type": "application/json",
  };

  // ── SEND: enviar mensagem ─────────────────────────────────────────────
  if (action === "send") {
    const to = body.to;
    const type = body.type || "text";

    if (!to) {
      return new Response(
        JSON.stringify({ error: "to (phone number) is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let payload: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to.replace(/[^0-9]/g, ""),
    };

    // Texto simples
    if (type === "text") {
      payload.type = "text";
      payload.text = {
        preview_url: body.preview_url || false,
        body: body.text || body.message || "",
      };
    }

    // Template
    if (type === "template") {
      payload.type = "template";
      payload.template = {
        name: body.template_name,
        language: { code: body.language || "pt_BR" },
      };
      if (body.template_params) {
        payload.template.components = [
          {
            type: "body",
            parameters: body.template_params.map((p: string) => ({
              type: "text",
              text: p,
            })),
          },
        ];
      }
    }

    // Imagem
    if (type === "image") {
      payload.type = "image";
      payload.image = {
        link: body.media_url,
        caption: body.caption || "",
      };
    }

    // Documento
    if (type === "document") {
      payload.type = "document";
      payload.document = {
        link: body.media_url,
        caption: body.caption || "",
        filename: body.filename || "document.pdf",
      };
    }

    // Áudio
    if (type === "audio") {
      payload.type = "audio";
      payload.audio = { link: body.media_url };
    }

    // Interativo (botões)
    if (type === "interactive") {
      payload.type = "interactive";
      payload.interactive = {
        type: body.interactive_type || "button",
        body: { text: body.text || "" },
        action: body.interactive_action || {},
      };
      if (body.header_text) {
        payload.interactive.header = { type: "text", text: body.header_text };
      }
      if (body.footer_text) {
        payload.interactive.footer = { text: body.footer_text };
      }
    }

    // Enviar via Meta API
    const metaRes = await fetch(META_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const metaData = await metaRes.json();

    if (!metaRes.ok) {
      return new Response(
        JSON.stringify({ error: "Meta API error", details: metaData }),
        { status: metaRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Salvar no banco
    const messageId = metaData.messages?.[0]?.id;
    await supabase.from("whatsapp_meta_messages").insert({
      company_id: cred.company_id,
      message_id: messageId,
      direction: "outbound",
      phone_from: cred.meta_display_phone?.replace(/[^0-9]/g, ""),
      phone_to: to.replace(/[^0-9]/g, ""),
      phone_number_id: cred.meta_phone_number_id,
      type: type,
      body: type === "text" ? (body.text || body.message) : (body.template_name || body.caption || type),
      status: "sent",
      template_name: type === "template" ? body.template_name : null,
      sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message_id: messageId,
        to: to,
        type: type,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── SEND-TEMPLATE: atalho para enviar template ────────────────────────
  if (action === "send-template") {
    const to = body.to;
    const templateName = body.template_name;
    const params = body.params || [];
    const language = body.language || "pt_BR";

    if (!to || !templateName) {
      return new Response(
        JSON.stringify({ error: "to and template_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: any = {
      messaging_product: "whatsapp",
      to: to.replace(/[^0-9]/g, ""),
      type: "template",
      template: {
        name: templateName,
        language: { code: language },
      },
    };

    if (params.length > 0) {
      payload.template.components = [
        {
          type: "body",
          parameters: params.map((p: string) => ({ type: "text", text: p })),
        },
      ];
    }

    const metaRes = await fetch(META_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const metaData = await metaRes.json();

    if (!metaRes.ok) {
      return new Response(
        JSON.stringify({ error: "Template send failed", details: metaData }),
        { status: metaRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Salvar
    await supabase.from("whatsapp_meta_messages").insert({
      company_id: cred.company_id,
      message_id: metaData.messages?.[0]?.id,
      direction: "outbound",
      phone_from: cred.meta_display_phone?.replace(/[^0-9]/g, ""),
      phone_to: to.replace(/[^0-9]/g, ""),
      phone_number_id: cred.meta_phone_number_id,
      type: "template",
      body: templateName,
      status: "sent",
      template_name: templateName,
      sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message_id: metaData.messages?.[0]?.id,
        template: templateName,
        to: to,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── MARK-READ: marcar mensagem como lida ──────────────────────────────
  if (action === "mark-read") {
    const messageId = body.message_id;
    if (!messageId) {
      return new Response(
        JSON.stringify({ error: "message_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const metaRes = await fetch(META_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    });

    const metaData = await metaRes.json();
    return new Response(
      JSON.stringify(metaData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ error: "Invalid action. Use: send, send-template, mark-read" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
