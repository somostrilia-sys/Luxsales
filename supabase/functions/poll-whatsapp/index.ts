/**
 * poll-whatsapp v3.1
 *
 * Busca mensagens de leads que RESPONDERAM aos disparos.
 * Filtra por blasted_phones para só mostrar leads reais (não conversas aleatórias).
 * Busca texto real da mensagem via POST /message/find.
 *
 * v3.1: Usa uazapi_server_url dinâmico de cada chip (sem URLs hardcoded).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function normalizePhone(p: string): string {
  return String(p).split(":")[0].replace(/@.*/, "").replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* */ }
  const filterCollabId = String(body?.collaborator_id || "");

  // ── 1. Buscar chips descartáveis conectados ──
  let query = supabase
    .from("disposable_chips")
    .select("id, instance_name, instance_token, collaborator_id, uazapi_server_url, collaborators!inner(id, name)")
    .eq("status", "connected");
  if (filterCollabId) query = query.eq("collaborator_id", filterCollabId);

  const { data: chips } = await query;
  if (!chips || chips.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0, message: "Nenhum chip conectado" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 2. Buscar TODOS os phones blastados (para filtrar leads reais) ──
  // Inclui collaborator_id para vincular a conversa ao consultor correto
  const { data: blastedRows } = await supabase
    .from("blasted_phones")
    .select("phone, collaborator_id")
    .limit(10000);
  const blastedPhones = new Map<string, string>(); // phone → collaborator_id
  for (const r of blastedRows || []) {
    if (r.phone) blastedPhones.set(String(r.phone), String(r.collaborator_id || ""));
  }

  let totalProcessed = 0;
  const results: Array<{ leadPhone: string; chip: string; message: string }> = [];
  const errors: string[] = [];

  for (const chip of chips) {
    const token = String(chip.instance_token || "");
    const chipId = String(chip.id || "");
    const collaboratorId = String((chip as any).collaborators?.id || chip.collaborator_id || "");
    const chipName = String(chip.instance_name || "");
    const chipServerUrl = String((chip as any).uazapi_server_url || "").replace(/\/+$/, "");

    if (!token || !collaboratorId || !chipServerUrl) continue;

    try {
      // ── 3. Buscar chats com mensagens não lidas ──
      const chatResp = await fetch(`${chipServerUrl}/chat/find`, {
        method: "POST",
        headers: { "Content-Type": "application/json", token },
        body: JSON.stringify({ limit: 200 }),
        signal: AbortSignal.timeout(10000),
      });
      if (!chatResp.ok) { errors.push(`${chipName}: chat/find ${chatResp.status}`); continue; }
      const chatData = await chatResp.json();
      const allChats: any[] = chatData.chats || [];

      const unreadChats = allChats.filter((c: any) =>
        Number(c.wa_unreadCount || 0) > 0 &&
        !c.wa_isGroup &&
        !String(c.wa_chatid || "").includes("@g.us")
      );

      for (const chat of unreadChats) {
        const chatId = String(chat.wa_chatid || "");
        const leadPhone = normalizePhone(String(chat.phone || chatId));
        if (!leadPhone || leadPhone.length < 10) continue;

        // ── 4. FILTRAR: só leads que receberam disparo ──
        if (!blastedPhones.has(leadPhone)) continue;

        // Usar o collaborator_id de quem ENVIOU o disparo (não o dono do chip)
        const blastCollaboratorId = blastedPhones.get(leadPhone) || collaboratorId;

        const unreadCount = Number(chat.wa_unreadCount || 1);
        const lastMsgTimestamp = Number(chat.wa_lastMsgTimestamp || Date.now());
        const messageId = `${leadPhone}_${lastMsgTimestamp}`;

        // Verificar duplicata
        const { data: existingMsg } = await supabase
          .from("messages")
          .select("id")
          .eq("message_id", messageId)
          .maybeSingle();
        if (existingMsg) continue;

        // ── 5. Buscar TEXTO REAL das mensagens via message/find ──
        let messageText = "(mídia)";
        let allInboundMsgs: any[] = [];
        try {
          const msgResp = await fetch(`${chipServerUrl}/message/find`, {
            method: "POST",
            headers: { "Content-Type": "application/json", token },
            body: JSON.stringify({ chatid: chatId, limit: 10 }),
            signal: AbortSignal.timeout(8000),
          });
          if (msgResp.ok) {
            const msgData = await msgResp.json();
            const msgs: any[] = msgData.messages || [];
            // Pegar msgs inbound (fromMe=false)
            allInboundMsgs = msgs.filter((m: any) => m.fromMe === false);

            // Priorizar mensagem de TEXTO sobre sticker/mídia
            const textMsgs = allInboundMsgs.filter((m: any) => {
              const t = String(m.messageType || "");
              return t === "Conversation" || t === "ExtendedTextMessage";
            });

            const bestMsg = textMsgs.length > 0 ? textMsgs[0] : (allInboundMsgs.length > 0 ? allInboundMsgs[0] : null);
            if (bestMsg) {
              messageText = String(
                bestMsg.text ||
                bestMsg.body ||
                bestMsg.message?.conversation ||
                bestMsg.message?.extendedTextMessage?.text ||
                "(mídia)"
              );
            }
          }
        } catch { /* timeout/error — usa texto genérico */ }

        // Usar o messageid da UAZAPI real como dedup (não timestamp)
        const realMessageId = allInboundMsgs.length > 0
          ? String(allInboundMsgs[0].messageid || messageId)
          : messageId;

        // Re-verificar duplicata com ID real
        const { data: existingReal } = await supabase
          .from("messages")
          .select("id")
          .eq("message_id", realMessageId)
          .maybeSingle();
        if (existingReal) continue;

        // ── 6. Inserir/atualizar conversa ──
        const { data: existingConv } = await supabase
          .from("conversations")
          .select("id, unread_count")
          .eq("lead_phone", leadPhone)
          .eq("consultant_id", blastCollaboratorId)
          .maybeSingle();

        let convId: string | null = null;
        const now = new Date().toISOString();

        if (existingConv?.id) {
          convId = existingConv.id;
          await supabase.from("conversations").update({
            last_message: messageText,
            last_message_at: now,
            unread_count: (Number(existingConv.unread_count) || 0) + unreadCount,
            status: "active",
          }).eq("id", convId);
        } else {
          const { data: newConv, error: convErr } = await supabase
            .from("conversations")
            .insert({
              lead_phone: leadPhone,
              consultant_id: blastCollaboratorId,
              collaborator_id: blastCollaboratorId,
              chip_instance_token: token,
              chip_server_url: chipServerUrl,
              chip_type: "disposable",
              last_message: messageText,
              last_message_at: now,
              unread_count: unreadCount,
              status: "active",
            })
            .select("id")
            .single();

          if (convErr) {
            // Fallback: buscar sem consultant_id
            const { data: fallback } = await supabase
              .from("conversations")
              .select("id")
              .eq("lead_phone", leadPhone)
              .maybeSingle();
            if (fallback?.id) {
              convId = fallback.id;
              await supabase.from("conversations").update({
                consultant_id: blastCollaboratorId,
                collaborator_id: blastCollaboratorId,
                last_message: messageText,
                last_message_at: now,
                unread_count: unreadCount,
              }).eq("id", convId);
            } else {
              errors.push(`Conv error ${leadPhone}: ${convErr.message}`);
              continue;
            }
          } else {
            convId = newConv?.id || null;
          }
        }

        if (!convId) continue;

        // ── 7. Salvar TODAS as mensagens (inbound + outbound) não duplicadas ──
        // Re-fetch all messages (não só inbound) para histórico completo
        let allMsgsToSave: any[] = [];
        try {
          const allMsgResp = await fetch(`${chipServerUrl}/message/find`, {
            method: "POST",
            headers: { "Content-Type": "application/json", token },
            body: JSON.stringify({ chatid: chatId, limit: 10 }),
            signal: AbortSignal.timeout(8000),
          });
          if (allMsgResp.ok) {
            const allMsgData = await allMsgResp.json();
            allMsgsToSave = allMsgData.messages || [];
          }
        } catch { allMsgsToSave = allInboundMsgs; }

        for (const inMsg of allMsgsToSave) {
          const inMsgId = String(inMsg.messageid || "");
          if (!inMsgId) continue;

          // Verificar duplicata individual
          const { data: exists } = await supabase
            .from("messages")
            .select("id")
            .eq("message_id", inMsgId)
            .maybeSingle();
          if (exists) continue;

          const inMsgText = String(
            inMsg.text || inMsg.body ||
            inMsg.message?.conversation ||
            inMsg.message?.extendedTextMessage?.text ||
            ""
          );
          const msgType = String(inMsg.messageType || "").toLowerCase();
          const isFromMe = inMsg.fromMe === true;

          // ── Detectar tipo de mídia e extrair URL via fileURL da UAZAPI ──
          let mediaUrl: string | null = null;
          let mediaType: string | null = null;
          let mediaMimetype: string | null = null;
          let displayContent = inMsgText;

          const mediaTypes: Record<string, string> = {
            "imagemessage": "image",
            "videomessage": "video",
            "audiomessage": "audio",
            "documentmessage": "document",
            "stickermessage": "sticker",
            "documentwithcaptionmessage": "document",
            "pttvmessage": "audio",
          };

          if (mediaTypes[msgType]) {
            mediaType = mediaTypes[msgType];

            // UAZAPI retorna fileURL diretamente no objeto da mensagem
            const rawFileUrl = inMsg.fileURL || inMsg.fileUrl || inMsg.file_url || "";
            if (rawFileUrl && typeof rawFileUrl === "string" && rawFileUrl.length > 5) {
              mediaUrl = rawFileUrl;
            }

            // Extrair mimetype e caption do conteúdo da mensagem
            const msgContent = inMsg.message || inMsg.content || {};
            let mediaObj: any = {};
            if (typeof msgContent === "object") {
              const mediaKey = Object.keys(msgContent).find(k =>
                k.toLowerCase().includes("message") && typeof msgContent[k] === "object"
              );
              mediaObj = mediaKey ? msgContent[mediaKey] : msgContent;
            }
            mediaMimetype = String(mediaObj?.mimetype || mediaObj?.mimeType || inMsg.mimetype || "");
            const caption = String(mediaObj?.caption || inMsg.caption || "");

            // Se não pegou fileURL, tentar /message/download
            if (!mediaUrl) {
              try {
                const dlResp = await fetch(`${chipServerUrl}/message/download`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", token },
                  body: JSON.stringify({ messageid: inMsgId }),
                  signal: AbortSignal.timeout(10000),
                });
                if (dlResp.ok) {
                  const dlData = await dlResp.json();
                  mediaUrl = dlData?.url || dlData?.fileURL || dlData?.mediaUrl || dlData?.base64 || null;
                  if (mediaUrl && !mediaUrl.startsWith("http") && !mediaUrl.startsWith("data:") && mediaUrl.length > 200) {
                    const mime = mediaMimetype || "application/octet-stream";
                    mediaUrl = `data:${mime};base64,${mediaUrl}`;
                  }
                }
              } catch { /* timeout */ }
            }

            // Display content
            if (caption) {
              displayContent = caption;
            } else if (!inMsgText) {
              const typeLabels: Record<string, string> = {
                "image": "📷 Imagem",
                "video": "🎥 Vídeo",
                "audio": "🎵 Áudio",
                "document": "📄 Documento",
                "sticker": "🏷️ Figurinha",
              };
              displayContent = typeLabels[mediaType] || "(mídia)";
            }
          } else if (!inMsgText) {
            displayContent = "(mídia)";
          }

          try {
            await supabase.from("messages").insert({
              conversation_id: convId,
              sender: isFromMe ? "consultant" : "lead",
              content: displayContent,
              direction: isFromMe ? "outbound" : "inbound",
              delivery_status: isFromMe ? "sent" : "delivered",
              channel_type: "whatsapp",
              message_id: inMsgId,
              media_url: mediaUrl,
              media_type: mediaType,
              media_mimetype: mediaMimetype,
            });
          } catch { /* dedup */ }
        }

        // ── 8. Notificar consultor via chip fixo ──
        const { data: fixedChip } = await supabase
          .from("whatsapp_instances")
          .select("instance_token, phone_number, uazapi_server_url")
          .eq("collaborator_id", blastCollaboratorId)
          .eq("status", "connected")
          .maybeSingle();

        if (fixedChip?.instance_token && fixedChip?.phone_number) {
          const fixedChipServerUrl = String((fixedChip as any).uazapi_server_url || "").replace(/\/+$/, "");
          const consultantPhone = normalizePhone(String(fixedChip.phone_number));
          if (consultantPhone && fixedChipServerUrl) {
            await fetch(`${fixedChipServerUrl}/send/text`, {
              method: "POST",
              headers: { "Content-Type": "application/json", token: fixedChip.instance_token },
              body: JSON.stringify({
                number: consultantPhone,
                text: `Lead respondeu!\n+${leadPhone}: "${messageText.slice(0, 100)}"\n─────────────────\nwa.me/${leadPhone}`,
              }),
              signal: AbortSignal.timeout(8000),
            }).catch(() => null);
          }
        }

        // ── 9. Marcar chat como lido no UAZAPI (evita reprocessamento) ──
        try {
          await fetch(`${chipServerUrl}/chat/markRead`, {
            method: "POST",
            headers: { "Content-Type": "application/json", token },
            body: JSON.stringify({ chatid: chatId }),
            signal: AbortSignal.timeout(5000),
          });
        } catch { /* best effort */ }

        totalProcessed++;
        results.push({ leadPhone, chip: chipName, message: messageText.slice(0, 60) });
      }
    } catch (e: any) {
      errors.push(`${chipName}: ${String(e?.message || e).slice(0, 100)}`);
    }
  }

  return new Response(
    JSON.stringify({ ok: true, processed: totalProcessed, results, errors }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
