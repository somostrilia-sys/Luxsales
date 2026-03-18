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

  if (!accountAUrl) accountAUrl = "https://walk2.uazapi.com";

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

// uazapiGO: POST /instance/create with AdminToken header
async function createInstanceOnUazapi(accountAUrl: string, accountAToken: string, instanceName: string): Promise<string> {
  console.log("createInstance:", accountAUrl, "name:", instanceName);
  const createRes = await fetch(`${accountAUrl}/instance/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "AdminToken": accountAToken },
    body: JSON.stringify({ name: instanceName }),
  });
  const createData = await createRes.json();
  console.log("createInstance status:", createRes.status, "token:", createData?.token ? "yes" : "no");
  return createData?.token || createData?.instance?.token || "";
}

// uazapiGO: POST /instance/connect?token= → returns qrcode in instance.qrcode
async function connectAndGetQr(accountAUrl: string, instanceToken: string): Promise<string | null> {
  try {
    console.log("connectAndGetQr:", accountAUrl + "/instance/connect");
    const res = await fetch(`${accountAUrl}/instance/connect?token=${instanceToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    console.log("connectAndGetQr status:", res.status, "has qrcode:", Boolean(data?.instance?.qrcode || data?.qrcode));
    const qr = data?.instance?.qrcode || data?.qrcode || data?.qr_code || data?.base64 || null;
    return qr || null;
  } catch (e) {
    console.error("connectAndGetQr error:", e);
    return null;
  }
}

async function connectAndGetQrWithRetry(accountAUrl: string, instanceToken: string, maxAttempts = 3): Promise<string | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`connectAndGetQr attempt ${attempt}/${maxAttempts}`);
    const qr = await connectAndGetQr(accountAUrl, instanceToken);
    if (qr) return qr;
    if (attempt < maxAttempts) {
      const delay = attempt * 2000;
      console.log(`QR not ready, waiting ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  return null;
}

// uazapiGO: GET /instance/status?token=
async function getInstanceStatus(accountAUrl: string, instanceToken: string): Promise<any> {
  try {
    const res = await fetch(`${accountAUrl}/instance/status?token=${instanceToken}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
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
    uazapi_server_url: accountAUrl,
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
      uazapi_server_url: accountAUrl,
      chip_type: "fixo",
      status: "disconnected",
    });
  }

  // Wait for UAZAPI to initialize the instance
  console.log("Waiting 2s for UAZAPI to initialize:", instanceName);
  await new Promise(r => setTimeout(r, 2000));

  // Connect and get QR via POST /instance/connect?token=
  const qrCode = await connectAndGetQrWithRetry(accountAUrl, instanceToken, 3);

  if (qrCode) {
    await supabase.from("whatsapp_instances")
      .update({ qr_code: qrCode, status: "connecting", updated_at: new Date().toISOString() })
      .eq("collaborator_id", collaborator_id)
      .eq("chip_type", "fixo");
    return json({ qr_code: qrCode, connected: false });
  }

  console.error("Failed to get QR after retries for:", collaborator_id);
  return json({ error: "Instância criada, mas QR não disponível. Tente novamente.", qr_code: null, connected: false }, 500);
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

    // Resolve the server URL for this instance (may differ from accountAUrl for old instances)
    const serverUrl = instance?.uazapi_server_url || accountAUrl;

    // ── STATUS ──
    if (action === "status") {
      if (!instance) {
        return json({ has_instance: false, connected: false });
      }

      if (!instance.instance_token) {
        return json({ has_instance: true, connected: false });
      }

      try {
        const statusData = await getInstanceStatus(serverUrl, instance.instance_token);

        if (!statusData) {
          return json({ has_instance: true, connected: false, phone: instance.phone_number });
        }

        const connected = statusData?.status?.connected === true
          || statusData?.instance?.status === "connected"
          || statusData?.connected === true;
        const phone = statusData?.instance?.owner || statusData?.phone || statusData?.number || instance.phone_number || null;
        const profileName = statusData?.instance?.profileName || statusData?.profile_name || statusData?.pushname || null;

        const updatePayload: Record<string, unknown> = {
          status: connected ? "connected" : "disconnected",
          updated_at: new Date().toISOString(),
        };
        if (phone) updatePayload.phone_number = phone;
        if (connected) updatePayload.qr_code = null;

        await supabase.from("whatsapp_instances").update(updatePayload).eq("id", instance.id);

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
        console.log("qrcode: no instance_token, auto-recreating...");
        return await recreateAndGetQr(supabase, accountAUrl, accountAToken, collaborator_id, instance.id);
      }

      const qrCode = await connectAndGetQrWithRetry(serverUrl, instance.instance_token, 2);

      if (qrCode) {
        await supabase.from("whatsapp_instances").update({
          qr_code: qrCode,
          status: "connecting",
          updated_at: new Date().toISOString(),
        }).eq("id", instance.id);
        return json({ qr_code: qrCode });
      }

      // QR failed — token may be invalid, auto-recreate
      console.log("qrcode: connect failed, auto-recreating...");
      return await recreateAndGetQr(supabase, accountAUrl, accountAToken, collaborator_id, instance.id);
    }

    // ── CREATE (default action — create instance if not exists, return QR) ──
    if (instance) {
      // Check if connected
      if (instance.instance_token) {
        const statusData = await getInstanceStatus(serverUrl, instance.instance_token);
        const connected = statusData?.status?.connected === true || statusData?.instance?.status === "connected";

        if (connected) {
          return json({
            connected: true,
            phone: statusData?.instance?.owner || instance.phone_number,
            profile_name: statusData?.instance?.profileName || null,
          });
        }

        // Not connected — try to connect and get QR
        const qrCode = await connectAndGetQrWithRetry(serverUrl, instance.instance_token, 2);

        if (qrCode) {
          await supabase.from("whatsapp_instances").update({
            qr_code: qrCode,
            status: "connecting",
            updated_at: new Date().toISOString(),
          }).eq("id", instance.id);
          return json({ qr_code: qrCode, connected: false });
        }
      }

      // Token invalid or no QR — recreate
      console.log("create: existing instance failed, recreating...");
      return await recreateAndGetQr(supabase, accountAUrl, accountAToken, collaborator_id, instance.id);
    }

    // No instance yet — create one
    return await recreateAndGetQr(supabase, accountAUrl, accountAToken, collaborator_id);

  } catch (e) {
    console.error("Edge function error:", e);
    return json({ error: (e as Error).message || "Erro interno" }, 500);
  }
});
