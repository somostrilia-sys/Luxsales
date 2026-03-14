import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Edge function to send WhatsApp message via UaZapi
 * Used by the frontend chat component (AtendimentoLeads) as a fallback
 * when the backend API is not available.
 *
 * Body: { instance_token, phone, message }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { instance_token, phone, message } = await req.json();

    if (!instance_token || !phone || !message) {
      return json({ error: "instance_token, phone, and message are required" }, 400);
    }

    // Find chip's server URL from disposable_chips or use default
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let serverUrl = "https://walkholding.uazapi.com";

    // 1. Buscar em disposable_chips
    const { data: chip } = await supabase
      .from("disposable_chips")
      .select("uazapi_server_url, uazapi_account, chip_index")
      .eq("instance_token", instance_token)
      .maybeSingle();

    if (chip?.uazapi_server_url) {
      serverUrl = chip.uazapi_server_url;
    } else if (chip?.uazapi_account) {
      // Buscar URL da conta na tabela uazapi_accounts
      const { data: account } = await supabase
        .from("uazapi_accounts")
        .select("api_url")
        .eq("account_key", chip.uazapi_account)
        .single();
      if (account?.api_url) serverUrl = account.api_url;
    } else if (!chip) {
      // 2. Buscar em whatsapp_instances (chip fixo = conta A)
      const { data: waInstance } = await supabase
        .from("whatsapp_instances")
        .select("id")
        .eq("instance_token", instance_token)
        .maybeSingle();

      if (waInstance) {
        const { data: accountA } = await supabase
          .from("uazapi_accounts")
          .select("api_url")
          .eq("account_key", "account_a")
          .single();
        if (accountA?.api_url) serverUrl = accountA.api_url;
      }
    }

    // Format phone for WhatsApp
    const formattedPhone = phone.replace(/\D/g, "");

    // Simulate typing (2-5 seconds)
    try {
      await fetch(`${serverUrl}/chat/composing`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "InstanceToken": instance_token },
        body: JSON.stringify({ phone: formattedPhone }),
      });
    } catch {}

    await new Promise((r) => setTimeout(r, 2000 + Math.random() * 3000));

    // Send message
    const sendRes = await fetch(`${serverUrl}/chat/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "InstanceToken": instance_token },
      body: JSON.stringify({
        phone: formattedPhone,
        message,
      }),
    });

    const sendData = await sendRes.json();

    if (!sendRes.ok) {
      return json({ error: sendData?.error || "Failed to send message" }, 500);
    }

    return json({
      ok: true,
      message_id: sendData?.id || sendData?.messageId || null,
    });
  } catch (e) {
    console.error("Send WhatsApp message error:", e);
    return json({ error: e.message || "Internal error" }, 500);
  }
});
