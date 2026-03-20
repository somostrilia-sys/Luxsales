import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Edge Function: webhook-whatsapp
 * 
 * Receives UAZAPI webhook for incoming WhatsApp messages
 * Routes to correct agent based on chip → consultant mapping
 * 
 * Two modes:
 * - MODE BOT: AI responds automatically (default)
 * - MODE HUMAN: consultant took over, bot stays silent
 * 
 * Owner detection: if sender = consultant's personal number → assistant mode
 * External sender → sales mode (qualify lead)
 */

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const payload = await req.json();
    
    // UAZAPI webhook structure
    const instanceName = payload.instance || payload.instanceName || "";
    const messageData = payload.data || payload;
    const remoteJid = messageData.key?.remoteJid || messageData.from || "";
    const messageText = messageData.message?.conversation || 
                       messageData.message?.extendedTextMessage?.text || 
                       messageData.body || "";
    const fromMe = messageData.key?.fromMe || false;
    const pushName = messageData.pushName || "";

    // Ignore own messages and empty
    if (fromMe || !messageText || !remoteJid) {
      return new Response(JSON.stringify({ status: "ignored" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Extract phone number
    const senderPhone = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");

    // 1. Find which consultant owns this UAZAPI instance
    const { data: consultant } = await supabase
      .from("collaborators")
      .select("id, name, role_id, company_id, whatsapp, whatsapp_comercial, last_agent_id")
      .eq("uazapi_instance_name", instanceName)
      .eq("active", true)
      .single();

    if (!consultant) {
      console.log(`No consultant found for instance: ${instanceName}`);
      return new Response(JSON.stringify({ status: "no_consultant", instance: instanceName }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Detect if sender is the consultant (owner mode)
    const isOwner = senderPhone === consultant.whatsapp?.replace(/\D/g, "") || 
                    senderPhone === consultant.whatsapp_comercial?.replace(/\D/g, "");

    // 3. Check conversation mode (bot vs human)
    const { data: convState } = await supabase
      .from("whatsapp_conversations")
      .select("id, mode, agent_id, lead_score")
      .eq("instance_name", instanceName)
      .eq("remote_jid", remoteJid)
      .single();

    // If mode is "human", bot stays silent
    if (convState?.mode === "human" && !isOwner) {
      return new Response(JSON.stringify({ status: "human_mode", silent: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 4. Determine which agent to use
    let agentSlug = isOwner ? "coach-de-vendas" : "sdr";
    
    if (convState?.agent_id) {
      // Use previously assigned agent
      const { data: agentData } = await supabase
        .from("agent_definitions")
        .select("slug")
        .eq("id", convState.agent_id)
        .single();
      if (agentData) agentSlug = agentData.slug;
    }

    // Get agent by slug or default SDR for the consultant's company
    const { data: agent } = await supabase
      .from("agent_definitions")
      .select("id, name, system_prompt, company_id")
      .eq("slug", agentSlug)
      .eq("active", true)
      .single();

    if (!agent) {
      console.log(`No agent found for slug: ${agentSlug}`);
      return new Response(JSON.stringify({ status: "no_agent" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 5. Save or create conversation
    let convId = convState?.id;
    if (!convId) {
      const { data: newConv } = await supabase
        .from("whatsapp_conversations")
        .insert({
          instance_name: instanceName,
          remote_jid: remoteJid,
          sender_phone: senderPhone,
          sender_name: pushName,
          consultant_id: consultant.id,
          agent_id: agent.id,
          mode: "bot",
          lead_score: 0,
        })
        .select("id")
        .single();
      convId = newConv?.id;
    }

    // Save incoming message
    if (convId) {
      await supabase.from("whatsapp_messages").insert({
        conversation_id: convId,
        role: isOwner ? "owner" : "user",
        content: messageText,
        sender_phone: senderPhone,
        sender_name: pushName,
      });
    }

    // 6. Load conversation history
    const { data: history } = await supabase
      .from("whatsapp_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(20);

    const messages = (history || []).map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.role === "owner" ? `[CONSULTOR ${consultant.name}]: ${m.content}` : m.content,
    }));

    // 7. Build system prompt based on mode
    let contextNote = "";
    if (isOwner) {
      contextNote = `\n\nMODO ASSISTENTE: ${consultant.name} (consultor) está pedindo ajuda. Responda como assistente de vendas. Ajude com scripts, cotações, técnicas de fechamento.`;
    } else {
      contextNote = `\n\nMODO VENDAS: ${pushName || senderPhone} é um lead potencial. Qualifique, gere interesse, agende visita na unidade mais próxima. Seja natural, não robótico.`;
    }

    const systemPrompt = agent.system_prompt + contextNote;

    // 8. Call Claude
    let apiKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
    if (!apiKey) {
      const { data: poolKey } = await supabase
        .from("api_key_pool")
        .select("api_key")
        .eq("provider", "anthropic")
        .eq("active", true)
        .limit(1)
        .single();
      if (poolKey) apiKey = poolKey.api_key;
    }

    if (!apiKey) {
      console.error("No API key available");
      return new Response(JSON.stringify({ status: "no_api_key" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    });

    if (!claudeResp.ok) {
      console.error("Claude error:", await claudeResp.text());
      return new Response(JSON.stringify({ status: "claude_error" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const claudeData = await claudeResp.json();
    const reply = claudeData.content?.[0]?.text || "";

    if (!reply) {
      return new Response(JSON.stringify({ status: "empty_reply" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 9. Save bot reply
    if (convId) {
      await supabase.from("whatsapp_messages").insert({
        conversation_id: convId,
        role: "assistant",
        content: reply,
      });
    }

    // 10. Send via UAZAPI
    const uazapiUrl = Deno.env.get("UAZAPI_SERVER_URL") || "https://trilhoassist.uazapi.com";
    const uazapiToken = Deno.env.get("UAZAPI_ADMIN_TOKEN") || "gHo9rKzAApIBDU8ApqIaGwhtwthKes2Opd58T1jwJjAci7sV2V";

    await fetch(`${uazapiUrl}/instance/${instanceName}/message/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "AdminToken": uazapiToken,
      },
      body: JSON.stringify({
        phone: senderPhone,
        message: reply,
      }),
    });

    return new Response(JSON.stringify({ 
      status: "replied",
      mode: isOwner ? "assistant" : "sales",
      agent: agent.name,
      tokens: {
        input: claudeData.usage?.input_tokens || 0,
        output: claudeData.usage?.output_tokens || 0,
      }
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("webhook-whatsapp error:", error);
    return new Response(JSON.stringify({ status: "error", detail: String(error) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
