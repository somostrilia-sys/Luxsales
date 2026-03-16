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

type ProxyMonitorStatus = "unknown" | "healthy" | "degraded" | "error";
type ProxySource = "manual" | "chip" | "iproyal" | "none";

type ProxyMonitorRecord = {
  chip_id: string;
  proxy_url: string | null;
  source: ProxySource;
  status: ProxyMonitorStatus;
  last_tested_at: string;
  last_success_at?: string | null;
  last_error?: string | null;
  last_http_status?: number | null;
  last_response_ms?: number | null;
  exit_ip?: string | null;
  target_url?: string | null;
  metadata?: Record<string, unknown>;
  updated_at: string;
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

function parseProxyUrl(proxyUrl: string) {
  const trimmed = proxyUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const port = parsed.port ? Number(parsed.port) : null;
    if (!parsed.hostname || !port) return null;

    return {
      host: parsed.hostname,
      port,
      username: decodeURIComponent(parsed.username || ""),
      password: decodeURIComponent(parsed.password || ""),
      protocol: parsed.protocol.replace(":", "") || "http",
      enabled: true,
      last_tested_at: null,
    } satisfies ProxyConfig;
  } catch {
    return null;
  }
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

function resolveProxyTarget(
  chipLike: Record<string, unknown>,
  chipId: string,
  storedProxy?: { proxy_url?: string | null; source?: string | null } | null,
) {
  const storedUrl = storedProxy?.proxy_url?.trim();
  if (storedUrl) {
    return {
      proxy_url: storedUrl,
      source: (storedProxy?.source as ProxySource) || "manual",
    };
  }

  const normalized = normalizeProxyConfig(chipLike);
  const chipUrl = buildProxyUrlFromParts(normalized);
  if (chipUrl) {
    return { proxy_url: chipUrl, source: "chip" as ProxySource };
  }

  const fallback = buildDefaultIprRoyalProxyUrl(chipId);
  if (fallback) {
    return { proxy_url: fallback, source: "iproyal" as ProxySource };
  }

  return { proxy_url: null, source: "none" as ProxySource };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseResponseBody(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractExitIp(...values: unknown[]) {
  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    const record = value as Record<string, unknown>;
    const candidate = record.exit_ip || record.ip || record.proxy_ip || record.outbound_ip;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }

  return null;
}

async function saveProxyMonitor(supabase: ReturnType<typeof createClient>, monitor: ProxyMonitorRecord) {
  const payload = {
    chip_id: monitor.chip_id,
    proxy_url: monitor.proxy_url,
    source: monitor.source,
    status: monitor.status,
    last_tested_at: monitor.last_tested_at,
    last_success_at: monitor.last_success_at ?? null,
    last_error: monitor.last_error ?? null,
    last_http_status: monitor.last_http_status ?? null,
    last_response_ms: monitor.last_response_ms ?? null,
    exit_ip: monitor.exit_ip ?? null,
    target_url: monitor.target_url ?? null,
    metadata: monitor.metadata ?? {},
    updated_at: monitor.updated_at,
  };

  const { error } = await supabase.from("disposable_chipset_proxy").upsert(payload, { onConflict: "chip_id" });
  if (error) console.error("Error saving proxy monitor:", error);

  await supabase.from("disposable_chips").update({
    proxy_last_tested_at: monitor.last_tested_at,
    updated_at: monitor.updated_at,
  }).eq("id", monitor.chip_id);
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

  const createRes = await fetchWithTimeout(`${serverUrl}/instance/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "AdminToken": adminToken },
    body: JSON.stringify(payload),
  });

  const createData = await parseResponseBody(createRes);
  if (!createRes.ok) {
    throw new Error(
      typeof createData === "string"
        ? createData
        : (createData as Record<string, unknown> | null)?.message as string || `Falha ao criar instância (${createRes.status})`,
    );
  }

  return (createData as Record<string, unknown> | null)?.token
    || (createData as Record<string, unknown> | null)?.instance?.token
    || "";
}

async function ensureInstanceToken(
  supabase: ReturnType<typeof createClient>,
  chip: Record<string, unknown>,
) {
  let instanceToken = String(chip.instance_token || "").trim();
  let instanceName = String(chip.instance_name || "").trim();
  const serverUrl = String(chip.uazapi_server_url || "").trim();
  const adminToken = String(chip.uazapi_admin_token || "").trim();
  const chipId = String(chip.id);
  const collaboratorId = String(chip.collaborator_id || "");
  const chipIndex = Number(chip.chip_index || 1);

  if (instanceToken) {
    return { instanceToken, instanceName };
  }

  if (!serverUrl || !adminToken) {
    throw new Error("Instância sem configuração UAZAPI válida");
  }

  instanceName = instanceName || `chip_${collaboratorId.slice(0, 8)}_${chipIndex}`;
  const instanceProxy = normalizeProxyConfig(chip);
  instanceToken = await createUazapiInstance(serverUrl, adminToken, instanceName, instanceProxy);

  await supabase.from("disposable_chips").update({
    instance_name: instanceName,
    instance_token: instanceToken,
    updated_at: new Date().toISOString(),
  }).eq("id", chipId);

  return { instanceToken, instanceName };
}

async function runProxyMonitor(
  supabase: ReturnType<typeof createClient>,
  chip: Record<string, unknown>,
  options?: {
    includeQrProbe?: boolean;
    storedProxy?: { proxy_url?: string | null; source?: string | null } | null;
  },
) {
  const chipId = String(chip.id);
  const serverUrl = String(chip.uazapi_server_url || "").trim();
  const now = new Date().toISOString();
  const target = resolveProxyTarget(chip, chipId, options?.storedProxy);

  if (!target.proxy_url) {
    const failedMonitor: ProxyMonitorRecord = {
      chip_id: chipId,
      proxy_url: null,
      source: "none",
      status: "error",
      last_tested_at: now,
      last_error: "Nenhum proxy resolvido para este chip",
      target_url: `${serverUrl}/instance/proxy`,
      updated_at: now,
      metadata: { stage: "resolve" },
    };
    await saveProxyMonitor(supabase, failedMonitor);
    return { ok: false, ...failedMonitor };
  }

  const { instanceToken } = await ensureInstanceToken(supabase, chip);
  const startedAt = Date.now();
  const proxyRes = await fetchWithTimeout(`${serverUrl}/instance/proxy`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "InstanceToken": instanceToken },
    body: JSON.stringify({ enabled: true, proxy: target.proxy_url }),
  });
  const proxyBody = await parseResponseBody(proxyRes);
  const responseMs = Date.now() - startedAt;

  if (!proxyRes.ok) {
    const failedMonitor: ProxyMonitorRecord = {
      chip_id: chipId,
      proxy_url: target.proxy_url,
      source: target.source,
      status: "error",
      last_tested_at: now,
      last_error: typeof proxyBody === "string"
        ? proxyBody
        : (proxyBody as Record<string, unknown> | null)?.message as string || "Falha ao aplicar proxy na UAZAPI",
      last_http_status: proxyRes.status,
      last_response_ms: responseMs,
      target_url: `${serverUrl}/instance/proxy`,
      updated_at: now,
      metadata: { stage: "apply", response: proxyBody },
    };
    await saveProxyMonitor(supabase, failedMonitor);
    return { ok: false, ...failedMonitor };
  }

  const statusRes = await fetchWithTimeout(`${serverUrl}/instance/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "InstanceToken": instanceToken },
  });
  const statusBody = await parseResponseBody(statusRes);

  let qrCode: string | null = null;
  let qrProbeOk = false;
  let qrBody: unknown = null;

  if (options?.includeQrProbe) {
    const qrRes = await fetchWithTimeout(`${serverUrl}/instance/qrcode`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "InstanceToken": instanceToken },
    });
    qrBody = await parseResponseBody(qrRes);
    qrCode = (qrBody as Record<string, unknown> | null)?.qrcode as string
      || (qrBody as Record<string, unknown> | null)?.qr_code as string
      || (qrBody as Record<string, unknown> | null)?.base64 as string
      || null;
    qrProbeOk = qrRes.ok && Boolean(qrCode);
  }

  const connected = (statusBody as Record<string, unknown> | null)?.status === "connected"
    || (statusBody as Record<string, unknown> | null)?.connected === true;
  const phone = (statusBody as Record<string, unknown> | null)?.phone
    || (statusBody as Record<string, unknown> | null)?.number
    || null;
  const exitIp = extractExitIp(proxyBody, statusBody, qrBody);
  const healthy = proxyRes.ok && statusRes.ok && (connected || !options?.includeQrProbe || qrProbeOk);
  const monitorStatus: ProxyMonitorStatus = healthy ? "healthy" : (proxyRes.ok && statusRes.ok ? "degraded" : "error");
  const lastError = healthy
    ? null
    : !statusRes.ok
      ? `Status da instância falhou (${statusRes.status})`
      : options?.includeQrProbe && !qrProbeOk
        ? "Proxy aplicado, mas a instância não conseguiu gerar QR com o proxy"
        : "Proxy aplicado, mas sem confirmação operacional completa";

  const monitor: ProxyMonitorRecord = {
    chip_id: chipId,
    proxy_url: target.proxy_url,
    source: target.source,
    status: monitorStatus,
    last_tested_at: now,
    last_success_at: healthy ? now : null,
    last_error: lastError,
    last_http_status: proxyRes.status,
    last_response_ms: responseMs,
    exit_ip: exitIp,
    target_url: `${serverUrl}/instance/proxy`,
    updated_at: now,
    metadata: {
      connected,
      phone,
      include_qr_probe: Boolean(options?.includeQrProbe),
      qr_probe_ok: qrProbeOk,
      proxy_response: proxyBody,
      status_response: statusBody,
      qr_probe_response: qrBody,
    },
  };

  await saveProxyMonitor(supabase, monitor);

  return {
    ok: healthy,
    ...monitor,
    instance_token: instanceToken,
    qr_code: qrCode,
    connected,
    phone,
  };
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

      const parsedProxy = typeof body.proxy_url === "string" && body.proxy_url.trim()
        ? parseProxyUrl(body.proxy_url)
        : null;

      if (typeof body.proxy_url === "string" && body.proxy_url.trim() && !parsedProxy) {
        return json({ error: "Proxy URL inválida. Use o formato protocolo://usuario:senha@host:porta" }, 400);
      }

      const proxy = parsedProxy || normalizeProxyConfig(body);

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

      const resolvedTarget = resolveProxyTarget(chip, chip.id, parsedProxy ? { proxy_url: body.proxy_url, source: "manual" } : null);
      await saveProxyMonitor(supabase, {
        chip_id: chip.id,
        proxy_url: resolvedTarget.proxy_url,
        source: resolvedTarget.source,
        status: "unknown",
        last_tested_at: new Date().toISOString(),
        target_url: `${serverUrl}/instance/proxy`,
        updated_at: new Date().toISOString(),
        metadata: { stage: "create" },
      });

      return json({ ok: true, chip, proxy_url: resolvedTarget.proxy_url, proxy_source: resolvedTarget.source });
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

      const { data: storedProxy } = await supabase
        .from("disposable_chipset_proxy")
        .select("proxy_url, source")
        .eq("chip_id", chip_id)
        .maybeSingle();

      try {
        const monitor = await runProxyMonitor(supabase, chip, {
          storedProxy,
          includeQrProbe: true,
        });

        if (!monitor.qr_code) {
          return json({
            error: monitor.last_error || "Proxy aplicado, mas o QR não foi disponibilizado pela instância",
            proxy_status: monitor.status,
            proxy_url: monitor.proxy_url,
          }, 500);
        }

        await supabase.from("disposable_chips").update({
          qr_code: monitor.qr_code,
          status: "connecting",
          updated_at: new Date().toISOString(),
        }).eq("id", chip_id);

        return json({
          ok: true,
          qr_code: monitor.qr_code,
          instance_token: monitor.instance_token,
          status: "connecting",
          proxy_enabled: Boolean(monitor.proxy_url),
          proxy_url: monitor.proxy_url,
          proxy_status: monitor.status,
          proxy_source: monitor.source,
          proxy_last_tested_at: monitor.last_tested_at,
          proxy_response_ms: monitor.last_response_ms,
          proxy_exit_ip: monitor.exit_ip,
        });
      } catch (e) {
        console.error("UAZAPI QR error:", e);
        return json({ error: (e as Error).message || "Falha ao obter QR code" }, 500);
      }
    }

    if (action === "monitor_proxy") {
      const { chip_id, include_qr_probe } = body;
      if (!chip_id) return json({ error: "chip_id required" }, 400);

      const { data: chip } = await supabase
        .from("disposable_chips")
        .select("*")
        .eq("id", chip_id)
        .single();
      if (!chip) return json({ error: "Chip não encontrado" }, 404);

      const { data: storedProxy } = await supabase
        .from("disposable_chipset_proxy")
        .select("proxy_url, source")
        .eq("chip_id", chip_id)
        .maybeSingle();

      const monitor = await runProxyMonitor(supabase, chip, {
        storedProxy,
        includeQrProbe: include_qr_probe === true,
      });

      return json({
        ok: monitor.ok,
        proxy_url: monitor.proxy_url,
        proxy_source: monitor.source,
        proxy_status: monitor.status,
        proxy_last_tested_at: monitor.last_tested_at,
        proxy_last_success_at: monitor.last_success_at,
        proxy_response_ms: monitor.last_response_ms,
        proxy_http_status: monitor.last_http_status,
        proxy_exit_ip: monitor.exit_ip,
        proxy_error: monitor.last_error,
        qr_code: monitor.qr_code,
        connected: monitor.connected,
        phone: monitor.phone,
      }, monitor.ok ? 200 : 500);
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

      let proxySource: ProxySource = "manual";
      let normalizedProxyUrl: string | null = null;

      if (typeof proxy_url === "string" && proxy_url.trim()) {
        const parsed = parseProxyUrl(proxy_url);
        if (!parsed) {
          return json({ error: "Proxy URL inválida. Use o formato protocolo://usuario:senha@host:porta" }, 400);
        }
        normalizedProxyUrl = buildProxyUrlFromParts(parsed);
      } else {
        proxySource = "none";
      }

      const now = new Date().toISOString();
      const payload = {
        chip_id,
        proxy_url: normalizedProxyUrl,
        source: proxySource,
        status: "unknown",
        last_tested_at: now,
        last_success_at: null,
        last_error: null,
        last_http_status: null,
        last_response_ms: null,
        exit_ip: null,
        target_url: null,
        metadata: {},
        updated_at: now,
      };

      const { error } = await supabase
        .from("disposable_chipset_proxy")
        .upsert(payload, { onConflict: "chip_id" });

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, proxy_url: normalizedProxyUrl, proxy_source: proxySource });
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