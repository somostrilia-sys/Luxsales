// WhatsApp Meta Webhook Handler
// Recebe e processa todos os webhook events da Meta WhatsApp Cloud API
// Endpoints: GET (verificação) e POST (eventos)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

Deno.serve(async (req: Request) => {
  // ============================================================
  // GET - Webhook Verification (Meta envia para validar o endpoint)
  // ============================================================
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token && challenge) {
      // Buscar o verify_token nas credentials
      const { data: creds } = await supabase
        .from("whatsapp_meta_credentials")
        .select("webhook_verify_token")
        .eq("webhook_verify_token", token)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (creds) {
        console.log("Webhook verified successfully");
        return new Response(challenge, { status: 200 });
      }
    }

    return new Response("Forbidden", { status: 403 });
  }

  // ============================================================
  // POST - Webhook Events
  // ============================================================
  if (req.method === "POST") {
    try {
      const body = await req.json();

      // Validar que é um evento do WhatsApp Business Account
      if (body.object !== "whatsapp_business_account") {
        return new Response("Not a WhatsApp event", { status: 400 });
      }

      // Processar cada entry
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field !== "messages") continue;

          const value = change.value;
          const phoneNumberId = value.metadata?.phone_number_id;
          const displayPhone = value.metadata?.display_phone_number;

          // Resolver company_id pelo phone_number_id
          const { data: phoneRecord } = await supabase
            .from("whatsapp_meta_phone_numbers")
            .select("id, company_id, credential_id")
            .eq("phone_number_id", phoneNumberId)
            .single();

          const companyId = phoneRecord?.company_id || null;

          // ---- Processar mensagens recebidas ----
          if (value.messages) {
            for (const message of value.messages) {
              const idempotencyKey = `msg_${message.id}`;

              // Inserir webhook event
              const { error: webhookErr } = await supabase.from("whatsapp_meta_webhook_events").upsert({
                company_id: companyId,
                phone_number_id: phoneNumberId,
                event_type: "messages",
                event_subtype: message.type,
                wamid: message.id,
                from_phone: message.from,
                to_phone: displayPhone,
                payload: message,
                processing_status: "processing",
                idempotency_key: idempotencyKey,
              }, { onConflict: "idempotency_key", ignoreDuplicates: true });
              if (webhookErr) console.error("Webhook event insert error:", webhookErr.message);

              // Inserir mensagem na tabela principal
              const messageBody =
                message.text?.body ||
                message.caption ||
                message.interactive?.body?.text ||
                null;

              const mediaUrl =
                message.image?.id ||
                message.video?.id ||
                message.audio?.id ||
                message.document?.id ||
                null;

              const { error: msgErr } = await supabase.from("whatsapp_meta_messages").insert({
                company_id: companyId,
                message_id: message.id,
                direction: "inbound",
                phone_from: message.from,
                phone_to: displayPhone,
                type: message.type,
                body: messageBody,
                media_url: mediaUrl,
                status: "received",
                phone_number_id: phoneNumberId,
                phone_number_fk: phoneRecord?.id || null,
                context: message.context || null,
                metadata: {
                  timestamp: message.timestamp,
                  contacts: value.contacts,
                },
                conversation_origin: "user_initiated",
                pricing_category: "service",
                reply_to_wamid: message.context?.id || null,
                is_forwarded: message.context?.forwarded || false,
                frequently_forwarded:
                  message.context?.frequently_forwarded || false,
              });
              if (msgErr) console.error("Message insert error:", msgErr.message);

              // Atualizar webhook event como processado
              await supabase
                .from("whatsapp_meta_webhook_events")
                .update({
                  processing_status: "processed",
                  processed_at: new Date().toISOString(),
                })
                .eq("idempotency_key", idempotencyKey);

              // Atualizar indicador de digitando em wa_conversations
              if (message.type === "text" || message.type === "interactive") {
                await supabase
                  .from("wa_conversations")
                  .update({
                    is_typing: true,
                    typing_updated_at: new Date().toISOString(),
                  })
                  .eq("phone", message.from);
              }

              // Log de auditoria
              await supabase.from("audit_logs").insert({
                company_id: companyId,
                table_name: "whatsapp_meta_messages",
                action: "INSERT",
                actor_type: "webhook",
                metadata: {
                  wamid: message.id,
                  from: message.from,
                  type: message.type,
                },
              });
            }
          }

          // ---- Processar status updates (sent/delivered/read/failed) ----
          if (value.statuses) {
            for (const status of value.statuses) {
              const idempotencyKey = `status_${status.id}_${status.status}`;

              // Log webhook event
              const { error: statusEvtErr } = await supabase.from("whatsapp_meta_webhook_events").upsert({
                company_id: companyId,
                phone_number_id: phoneNumberId,
                event_type: "statuses",
                event_subtype: status.status,
                wamid: status.id,
                from_phone: displayPhone,
                to_phone: status.recipient_id,
                payload: status,
                processing_status: "processing",
                idempotency_key: idempotencyKey,
              }, { onConflict: "idempotency_key", ignoreDuplicates: true });
              if (statusEvtErr) console.error("Status event insert error:", statusEvtErr.message);

              // Atualizar status da mensagem
              const updateData: Record<string, unknown> = {
                status: status.status,
              };

              const timestamp = status.timestamp
                ? new Date(parseInt(status.timestamp) * 1000).toISOString()
                : new Date().toISOString();

              switch (status.status) {
                case "sent":
                  updateData.sent_at = timestamp;
                  break;
                case "delivered":
                  updateData.delivered_at = timestamp;
                  break;
                case "read":
                  updateData.read_at = timestamp;
                  break;
                case "failed":
                  updateData.failed_at = timestamp;
                  updateData.error_code = status.errors?.[0]?.code;
                  updateData.error_title = status.errors?.[0]?.title;
                  updateData.error_details = status.errors?.[0];
                  break;
              }

              // Atualizar mensagem pelo wamid
              await supabase
                .from("whatsapp_meta_messages")
                .update(updateData)
                .eq("message_id", status.id);

              // Se tem conversation info, atualizar billing
              if (status.conversation) {
                const conv = status.conversation;
                await supabase.from("whatsapp_meta_conversations_billing")
                  .upsert({
                    company_id: companyId,
                    meta_conversation_id: conv.id,
                    phone_number_id: phoneRecord?.id,
                    contact_phone: status.recipient_id,
                    category: conv.origin?.type?.toUpperCase() || "SERVICE",
                    origin: conv.origin?.type?.includes("business")
                      ? "business_initiated"
                      : "user_initiated",
                    is_billable: !conv.origin?.type?.includes("referral"),
                    pricing_model: "per_message",
                    window_start: conv.expiration_timestamp
                      ? new Date(
                        (parseInt(conv.expiration_timestamp) - 86400) * 1000,
                      ).toISOString()
                      : new Date().toISOString(),
                    window_end: conv.expiration_timestamp
                      ? new Date(
                        parseInt(conv.expiration_timestamp) * 1000,
                      ).toISOString()
                      : new Date(Date.now() + 86400000).toISOString(),
                    first_message_wamid: status.id,
                  }, { onConflict: "meta_conversation_id" });

                // Atualizar pricing na mensagem
                await supabase
                  .from("whatsapp_meta_messages")
                  .update({
                    meta_conversation_id: conv.id,
                    pricing_category: conv.origin?.type || "service",
                  })
                  .eq("message_id", status.id);
              }

              // Processar quality signals
              if (status.status === "failed" && status.errors?.[0]) {
                const error = status.errors[0];
                // Erros criticos de qualidade
                if (
                  [131026, 131047, 131048, 131049, 131051].includes(
                    error.code,
                  )
                ) {
                  await supabase.from("whatsapp_meta_quality_signals").insert({
                    company_id: companyId,
                    phone_number_id: phoneRecord?.id,
                    signal_type: "QUALITY_UPDATE",
                    severity: "high",
                    details: error,
                    source: "webhook",
                  });
                }
              }

              // Marcar webhook processado
              await supabase
                .from("whatsapp_meta_webhook_events")
                .update({
                  processing_status: "processed",
                  processed_at: new Date().toISOString(),
                })
                .eq("idempotency_key", idempotencyKey);
            }
          }

          // ---- Processar errors ----
          if (value.errors) {
            for (const error of value.errors) {
              await supabase.from("whatsapp_meta_webhook_events").insert({
                company_id: companyId,
                phone_number_id: phoneNumberId,
                event_type: "errors",
                event_subtype: String(error.code),
                payload: error,
                processing_status: "processed",
                processed_at: new Date().toISOString(),
                idempotency_key: `error_${Date.now()}_${error.code}`,
              });

              // Quality signal para erros graves
              await supabase.from("whatsapp_meta_quality_signals").insert({
                company_id: companyId,
                phone_number_id: phoneRecord?.id,
                signal_type: "QUALITY_UPDATE",
                severity: error.code >= 131000 ? "critical" : "medium",
                details: error,
                source: "webhook",
              });
            }
          }
        }
      }

      // Meta exige resposta 200 OK
      return new Response("OK", { status: 200 });
    } catch (err) {
      console.error("Webhook processing error:", err);
      // Ainda retornar 200 para evitar retry loop da Meta
      return new Response("OK", { status: 200 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
