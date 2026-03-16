import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ProxyConfig = {
  host: string;
  port: number | null;
  username: string;
  password: string;
  protocol: string;
  enabled: boolean;
  last_tested_at: string | null;
};

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeProxyConfig(source: Record<string, unknown>): ProxyConfig {
  const rawPort = source.proxy_port;
  const parsedPort = typeof rawPort === "number"
    ? rawPort
    : typeof rawPort === "string" && rawPort.trim()
      ? Number(rawPort)
      : null;

  return {
    host: String(source.proxy_host || "").trim(),
    port: Number.isFinite(parsedPort) ? parsedPort : null,
    username: String(source.proxy_username || "").trim(),
    password: String(source.proxy_password || "").trim(),
    protocol: String(source.proxy_protocol || "http").trim().toLowerCase(),
    enabled: source.proxy_enabled === true || source.proxy_enabled === "true",
    last_tested_at: source.proxy_last_tested_at
      ? String(source.proxy_last_tested_at)
      : null,
  };
}

function buildUazapiProxyPayload(proxy: ProxyConfig) {
  if (!proxy.enabled || !proxy.host || !proxy.port) return undefined;

  return {
    enabled: true,
    host: proxy.host,
    port: proxy.port,
    username: proxy.username || undefined,
    password: proxy.password || undefined,
    protocol: proxy.protocol || "http",
    last_tested_at: proxy.last_tested_at || undefined,
  };
}

function buildProxyUrlFromParts(proxy: ProxyConfig) {
  if (!proxy.host || !proxy.port) return null;

  const protocol = proxy.protocol || "http";
  const credentials = proxy.username
    ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password || "")}@`
    : "";

  return `${protocol}://${credentials}${proxy.host}:${proxy.port}`;
}

function buildDefaultIprRoyalProxyUrl(chipId: string) {
  const host = (Deno.env.get("IPROYAL_PROXY_HOST") || "").trim();
  const port = (Deno.env.get("IPROYAL_PROXY_PORT") || "").trim();
  const usernameTemplate = (Deno.env.get("IPROYAL_PROXY_USERNAME") || "").trim();
  const password = (Deno.env.get("IPROYAL_PROXY_PASSWORD") || "").trim();

  if (!host || !port || !usernameTemplate || !password) return null;

  const sessionId = chipId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24) || crypto.randomUUID().replace(/-/g, "");
  const username = usernameTemplate.replace(/\{\{\s*session_id\s*\}\}/gi, sessionId);

  return `http://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`;
}

function resolveProxyUrl(chipLike: Record<string, unknown>, chipId: string, storedProxyUrl?: string | null) {
  const normalized = normalizeProxyConfig(chipLike);
  return storedProxyUrl?.trim() || buildProxyUrlFromParts(normalized) || buildDefaultIprRoyalProxyUrl(chipId);
}

async function createUazapiInstance(
  serverUrl: string,
  adminToken: string,
  instanceName: string,
  proxy: ProxyConfig,
) {
  const payload = {
    name: instanceName,
    ...(buildUazapiProxyPayload(proxy) ? { proxy: buildUazapiProxyPayload(proxy) } : {}),
  };

  const createRes = await fetch(`${serverUrl}/instance/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "AdminToken": adminToken },
    body: JSON.stringify(payload),
  });

  const createData = await createRes.json();
  return createData?.token || createData?.instance?.token || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { collaborator_id } = body;
      if (!collaborator_id) return json({ error: "collaborator_id required" }, 400);

      const proxy = normalizeProxyConfig(body);

      const { data: existing } = await supabase
        .from("disposable_chips")
        .select("id")
        .eq("collaborator_id", collaborator_id);
      if ((existing || []).length >= 5) return json({ error: "Limite de 5 chips atingido" }, 400);

      const chipIndex = (existing || []).length + 1;
      const uazapiAccount = chipIndex <= 3 ? "account_b" : "account_c";

      let serverUrl = body.uazapi_server_url || "";
      let finalAdminToken = body.uazapi_admin_token || "";

      if (!serverUrl || !finalAdminToken) {
        const { data: account } = await supabase
          .from("uazapi_accounts")
          .select("api_url, admin_token")
          .eq("account_key", uazapiAccount)
          .single();

        if (account) {
          if (!serverUrl) serverUrl = account.api_url;
          if (!finalAdminToken) finalAdminToken = account.admin_token;
        }
      }

      if (!serverUrl) {
        serverUrl = uazapiAccount === "account_b"
          ? (Deno.env.get("UAZAPI_ACCOUNT_B_URL") || "https://walk2.uazapi.com")
          : (Deno.env.get("UAZAPI_ACCOUNT_C_URL") || "https://walkholding.uazapi.com");
      }
      if (!finalAdminToken) {
        finalAdminToken = uazapiAccount === "account_b"
          ? (Deno.env.get("UAZAPI_ACCOUNT_B_TOKEN") || "")
          : (Deno.env.get("UAZAPI_ACCOUNT_C_TOKEN") || "");
      }

      if (!finalAdminToken) {
        const { data: cfg } = await supabase
          .from("system_configs")
          .select("value")
          .eq("key", "uazapi_admin_token")
          .maybeSingle();
        finalAdminToken = cfg?.value || "";
      }

      const instanceName = `chip_${collaborator_id.slice(0, 8)}_${chipIndex}`;
      let instanceToken = "";

      if (finalAdminToken) {
        try {
          instanceToken = await createUazapiInstance(serverUrl, finalAdminToken, instanceName, proxy);
        } catch (e) {
          console.error("UAZAPI create instance error:", e);
        }
      }

      const { data: chip, error } = await supabase.from("disposable_chips").insert({
        collaborator_id,
        chip_index: chipIndex,
        uazapi_server_url: serverUrl,
        uazapi_admin_token: finalAdminToken,
        uazapi_account: uazapiAccount,
        instance_name: instanceName,
        instance_token: instanceToken,
        status: "disconnected",
        proxy_host: proxy.host || null,
        proxy_port: proxy.port,
        proxy_username: proxy.username || null,
        proxy_password: proxy.password || null,
        proxy_protocol: proxy.protocol || "http",
        proxy_enabled: proxy.enabled,
        proxy_last_tested_at: proxy.last_tested_at,
      }).select().single();

      if (error) return json({ error: error.message }, 500);

      const resolvedProxyUrl = resolveProxyUrl(chip, chip.id);
      if (resolvedProxyUrl) {
        const { error: proxyError } = await supabase
          .from("disposable_chipset_proxy")
          .upsert({
            chip_id: chip.id,
            proxy_url: resolvedProxyUrl,
            updated_at: new Date().toISOString(),
          }, { onConflict: "chip_id" });

        if (proxyError) {
          console.error("Error saving chip proxy:", proxyError);
        }
      }

      return json({ ok: true, chip, proxy_url: resolvedProxyUrl });
    }

    if (action === "connect") {
      const { chip_id } = body;
      if (!chip_id) return json({ error: "chip_id required" }, 400);

      const { data: chip } = await supabase
        .from("disposable_chips")
        .select("*")
        .eq("id", chip_id)
        .single();
      if (!chip) return json({ error: "Chip não encontrado" }, 404);

      const serverUrl = chip.uazapi_server_url;
      const adminToken = chip.uazapi_admin_token;
      let instanceToken = chip.instance_token;
      let instanceName = chip.instance_name;
      const proxy = normalizeProxyConfig(chip);

      if (!instanceToken && adminToken) {
        try {
          instanceName = instanceName || `chip_${chip.collaborator_id.slice(0, 8)}_${chip.chip_index}`;
          instanceToken = await createUazapiInstance(serverUrl, adminToken, instanceName, proxy);

          await supabase.from("disposable_chips").update({
            instance_name: instanceName,
            instance_token: instanceToken,
            updated_at: new Date().toISOString(),
          }).eq("id", chip_id);
        } catch (e) {
          console.error("UAZAPI create error:", e);
          return json({ error: "Falha ao criar instância UAZAPI" }, 500);
        }
      }

      if (!instanceToken) {
        return json({ error: "Token da instância não disponível. Configure o admin token." }, 400);
      }

      try {
        const { data: chipProxy } = await supabase
          .from("disposable_chipset_proxy")
          .select("proxy_url")
          .eq("chip_id", chip_id)
          .maybeSingle();

        const resolvedProxyUrl = resolveProxyUrl(chip, chip_id, chipProxy?.proxy_url);
        const proxyPayload = resolvedProxyUrl
          ? { enabled: true, proxy: resolvedProxyUrl }
          : { enabled: false };

        if (resolvedProxyUrl && chipProxy?.proxy_url !== resolvedProxyUrl) {
          const { error: proxyError } = await supabase
            .from("disposable_chipset_proxy")
            .upsert({
              chip_id,
              proxy_url: resolvedProxyUrl,
              updated_at: new Date().toISOString(),
            }, { onConflict: "chip_id" });

          if (proxyError) {
            console.error("Error syncing chip proxy:", proxyError);
          }
        }

        await fetch(`${serverUrl}/instance/proxy`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "InstanceToken": instanceToken },
          body: JSON.stringify(proxyPayload),
        });

        const qrRes = await fetch(`${serverUrl}/instance/qrcode`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "InstanceToken": instanceToken },
        });
        const qrData = await qrRes.json();
        const qrCode = qrData?.qrcode || qrData?.qr_code || qrData?.base64 || null;

        if (qrCode) {
          await supabase.from("disposable_chips").update({
            qr_code: qrCode,
            status: "connecting",
            updated_at: new Date().toISOString(),
          }).eq("id", chip_id);
        }

        return json({
          ok: true,
          qr_code: qrCode,
          instance_token: instanceToken,
          status: "connecting",
          proxy_enabled: Boolean(resolvedProxyUrl),
          proxy_url: resolvedProxyUrl,
        });
      } catch (e) {
        console.error("UAZAPI QR error:", e);
        return json({ error: "Falha ao obter QR code" }, 500);
      }
    }

    if (action === "status") {
      const { chip_id } = body;
      if (!chip_id) return json({ error: "chip_id required" }, 400);

      const { data: chip } = await supabase
        .from("disposable_chips")
        .select("*")
        .eq("id", chip_id)
        .single();
      if (!chip) return json({ error: "Chip não encontrado" }, 404);

      if (!chip.instance_token) {
        return json({ status: "disconnected", phone: null });
      }

      try {
        const statusRes = await fetch(`${chip.uazapi_server_url}/instance/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "InstanceToken": chip.instance_token },
        });
        const statusData = await statusRes.json();

        const connected = statusData?.status === "connected" || statusData?.connected === true;
        const phone = statusData?.phone || statusData?.number || null;
        const qrCode = statusData?.qrcode || statusData?.qr_code || null;
        const qrExpired = statusData?.qr_expired === true;
        const newStatus = connected ? "connected" : (qrCode ? "connecting" : "disconnected");

        const updateData: Record<string, unknown> = {
          status: newStatus,
          updated_at: new Date().toISOString(),
        };
        if (phone) updateData.phone = phone;
        if (connected) updateData.qr_code = null;
        else if (qrCode) updateData.qr_code = qrCode;

        await supabase.from("disposable_chips").update(updateData).eq("id", chip_id);

        return json({ status: newStatus, phone, qr_code: qrCode, qr_expired: qrExpired });
      } catch (e) {
        console.error("UAZAPI status error:", e);
        return json({ status: chip.status, phone: chip.phone });
      }
    }

    if (action === "set_proxy") {
      const { chip_id, proxy_url } = body;
      if (!chip_id) return json({ error: "chip_id required" }, 400);

      const payload = {
        chip_id,
        proxy_url: typeof proxy_url === "string" && proxy_url.trim() ? proxy_url.trim() : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("disposable_chipset_proxy")
        .upsert(payload, { onConflict: "chip_id" });

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "delete") {
      const { chip_id } = body;
      if (!chip_id) return json({ error: "chip_id required" }, 400);

      const { data: chip, error: fetchError } = await supabase
        .from("disposable_chips")
        .select("*")
        .eq("id", chip_id)
        .single();

      if (fetchError || !chip) {
        if (fetchError?.code === "PGRST116") return json({ ok: true });
        return json({ error: "Chip não encontrado" }, 404);
      }

      if (chip.instance_token && chip.uazapi_admin_token && chip.uazapi_server_url) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          await fetch(`${chip.uazapi_server_url}/instance/delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "AdminToken": chip.uazapi_admin_token },
            body: JSON.stringify({ name: chip.instance_name }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
        } catch (e) {
          console.error("UAZAPI delete error (non-blocking):", e);
        }
      }

      try {
        await supabase.from("messages").update({ chip_id: null }).eq("chip_id", chip_id);
      } catch (e) {
        console.error("Error clearing messages chip_id:", e);
      }
      try {
        await supabase.from("prospection_messages").update({ chip_id: null }).eq("chip_id", chip_id);
      } catch (e) {
        console.error("Error clearing prospection_messages chip_id:", e);
      }

      const { error } = await supabase.from("disposable_chips").delete().eq("id", chip_id);
      if (error) {
        console.error("DB delete error:", error);
        if (error.code === "23503") {
          console.error("FK violation, attempting cleanup...");
          try {
            await supabase.from("messages").update({ chip_id: null }).eq("chip_id", chip_id);
            await supabase.from("prospection_messages").update({ chip_id: null }).eq("chip_id", chip_id);
            await supabase.from("conversations").update({ chip_id: null }).eq("chip_id", chip_id);
          } catch (cleanupErr) {
            console.error("Cleanup error:", cleanupErr);
          }
          const { error: retryError } = await supabase.from("disposable_chips").delete().eq("id", chip_id);
          if (retryError) return json({ error: "Erro ao remover chip: " + retryError.message }, 500);
        } else {
          return json({ error: "Erro ao remover chip: " + error.message }, 500);
        }
      }

      return json({ ok: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("Edge function error:", e);
    return json({ error: (e as Error).message || "Erro interno" }, 500);
  }
});
