import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getAccountAConfig(supabase: any) {
  let accountAUrl = Deno.env.get("UAZAPI_ACCOUNT_A_URL") || "";
  let accountAToken = Deno.env.get("UAZAPI_ACCOUNT_A_TOKEN") || "";

  if (!accountAUrl || !accountAToken) {
    const { data: account } = await supabase
      .from("uazapi_accounts")
      .select("api_url, admin_token")
      .eq("account_key", "account_a")
      .maybeSingle();
    if (account) {
      if (!accountAUrl) accountAUrl = account.api_url;
      if (!accountAToken) accountAToken = account.admin_token;
    }
  }

  if (!accountAUrl) accountAUrl = "https://walkholding.uazapi.com";

  if (!accountAToken) {
    const { data: cfg } = await supabase
      .from("system_configs")
      .select("value")
      .eq("key", "uazapi_admin_token")
      .maybeSingle();
    accountAToken = cfg?.value || "";
  }

  return { accountAUrl, accountAToken };
}

async function createInstanceOnUazapi(accountAUrl: string, accountAToken: string, instanceName: string): Promise<string> {
  const createRes = await fetch(`${accountAUrl}/instance/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "AdminToken": accountAToken },
    body: JSON.stringify({ name: instanceName }),
  });
  const createData = await createRes.json();
  return createData?.token || createData?.instance?.token || "";
}

async function fetchQrCode(accountAUrl: string, instanceToken: string): Promise<string | null> {
  try {
    const qrRes = await fetch(`${accountAUrl}/instance/qrcode`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "InstanceToken": instanceToken },
    });
    const qrData = await qrRes.json();
    return qrData?.qrcode || qrData?.qr_code || qrData?.base64 || null;
  } catch (e) {
    console.error("fetchQrCode error:", e);
    return null;
  }
}

async function recreateAndGetQr(
  supabase: any,
  accountAUrl: string,
  accountAToken: string,
  collaborator_id: string,
  existingInstanceId?: string,
): Promise<Response> {
  if (!accountAToken) {
    return json({ error: "Token admin UAZAPI não configurado" }, 500);
  }

  const instanceName = `wa_${collaborator_id.slice(0, 8)}_fixo`;
  let instanceToken = "";

  try {
    instanceToken = await createInstanceOnUazapi(accountAUrl, accountAToken, instanceName);
  } catch (e) {
    console.error("UAZAPI create instance error:", e);
    return json({ error: "Falha ao criar instância UAZAPI" }, 500);
  }

  if (!instanceToken) {
    return json({ error: "UAZAPI não retornou token da instância" }, 500);
  }

  const updateData = {
    instance_name: instanceName,
    instance_token: instanceToken,
    status: "disconnected",
    updated_at: new Date().toISOString(),
  };

  if (existingInstanceId) {
    await supabase.from("whatsapp_instances").update(updateData).eq("id", existingInstanceId);
  } else {
    await supabase.from("whatsapp_instances").insert({
      collaborator_id,
      instance_name: instanceName,
      instance_token: instanceToken,
      chip_type: "fixo",
      status: "disconnected",
    });
  }

  // Wait for UAZAPI to initialize the instance
  await new Promise(r => setTimeout(r, 3000));

  const qrCode = await fetchQrCode(accountAUrl, instanceToken);

  if (qrCode) {
    await supabase.from("whatsapp_instances")
      .update({ qr_code: qrCode, status: "connecting", updated_at: new Date().toISOString() })
      .eq("collaborator_id", collaborator_id)
      .eq("chip_type", "fixo");
  }

  return json({ qr_code: qrCode, connected: false });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { action, collaborator_id } = body;

    if (!collaborator_id) return json({ error: "collaborator_id required" }, 400);

    const { accountAUrl, accountAToken } = await getAccountAConfig(supabase);

    // Check if collaborator has a whatsapp_instances record (chip fixo)
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("collaborator_id", collaborator_id)
      .eq("chip_type", "fixo")
      .maybeSingle();

    // ── STATUS ──
    if (action === "status") {
      if (!instance) {
        return json({ has_instance: false, connected: false });
      }

      if (!instance.instance_token) {
        return json({ has_instance: true, connected: false });
      }

      try {
        const statusRes = await fetch(`${accountAUrl}/instance/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "InstanceToken": instance.instance_token },
        });
        const statusData = await statusRes.json();

        const connected = statusData?.status === "connected" || statusData?.connected === true;
        const phone = statusData?.phone || statusData?.number || instance.phone_number || null;
        const profileName = statusData?.profile_name || statusData?.pushname || null;

        const updateData: Record<string, unknown> = {
          status: connected ? "connected" : "disconnected",
          updated_at: new Date().toISOString(),
        };
        if (phone) updateData.phone_number = phone;
        if (connected) updateData.qr_code = null;

        await supabase.from("whatsapp_instances").update(updateData).eq("id", instance.id);

        return json({
          has_instance: true,
          connected,
          phone,
          profile_name: profileName,
          status: connected ? "connected" : "disconnected",
        });
      } catch (e) {
        console.error("UAZAPI status error:", e);
        return json({
          has_instance: true,
          connected: instance.status === "connected",
          phone: instance.phone_number,
        });
      }
    }

    // ── QRCODE ──
    if (action === "qrcode") {
      if (!instance) {
        return json({ error: "Instância não encontrada. Conecte primeiro." }, 404);
      }

      if (!instance.instance_token) {
        // No token — auto-recreate the instance
        console.log("qrcode: no instance_token, auto-recreating...");
        return await recreateAndGetQr(supabase, accountAUrl, accountAToken, collaborator_id, instance.id);
      }

      const qrCode = await fetchQrCode(accountAUrl, instance.instance_token);

      if (qrCode) {
        await supabase.from("whatsapp_instances").update({
          qr_code: qrCode,
          status: "connecting",
          updated_at: new Date().toISOString(),
        }).eq("id", instance.id);
        return json({ qr_code: qrCode });
      }

      // QR failed — token may be invalid, auto-recreate
      console.log("qrcode: QR fetch failed, auto-recreating instance...");
      return await recreateAndGetQr(supabase, accountAUrl, accountAToken, collaborator_id, instance.id);
    }

    // ── CREATE (default action — create instance if not exists, return QR) ──
    if (instance) {
      // Already has instance — check if connected
      if (instance.status === "connected" && instance.instance_token) {
        try {
          const statusRes = await fetch(`${accountAUrl}/instance/status`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "InstanceToken": instance.instance_token },
          });
          const statusData = await statusRes.json();
          const connected = statusData?.status === "connected" || statusData?.connected === true;
          if (connected) {
            return json({
              connected: true,
              phone: statusData?.phone || instance.phone_number,
              profile_name: statusData?.profile_name || statusData?.pushname || null,
            });
          }
        } catch {}
      }

      // Instance exists but no token — recreate
      if (!instance.instance_token) {
        console.log("create: instance exists but no token, recreating...");
        return await recreateAndGetQr(supabase, accountAUrl, accountAToken, collaborator_id, instance.id);
      }

      // Not connected — get QR
      const qrCode = await fetchQrCode(accountAUrl, instance.instance_token);

      if (qrCode) {
        await supabase.from("whatsapp_instances").update({
          qr_code: qrCode,
          status: "connecting",
          updated_at: new Date().toISOString(),
        }).eq("id", instance.id);
        return json({ qr_code: qrCode, connected: false });
      }

      // QR failed — token likely invalid, recreate
      console.log("create: QR fetch failed for existing instance, recreating...");
      return await recreateAndGetQr(supabase, accountAUrl, accountAToken, collaborator_id, instance.id);
    }

    // No instance yet — create one
    return await recreateAndGetQr(supabase, accountAUrl, accountAToken, collaborator_id);

  } catch (e) {
    console.error("Edge function error:", e);
    return json({ error: (e as Error).message || "Erro interno" }, 500);
  }
});
