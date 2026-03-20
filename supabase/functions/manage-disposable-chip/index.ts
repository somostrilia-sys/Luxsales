/**
 * manage-disposable-chip
 *
 * Actions:
 *   create  → cria instância UAZAPI + salva no DB
 *   connect → busca QR code da instância UAZAPI
 *   status  → verifica status da instância UAZAPI
 *   delete  → remove instância UAZAPI + deleta do DB
 *   reconnect_all → reconecta todos os chips desconectados de um colaborador
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { action, chip_id, collaborator_id, uazapi_server_url, uazapi_admin_token, proxy_url } = body;

    if (action === "create") {
      if (!collaborator_id) return json({ error: "collaborator_id obrigatório" }, 400);

      // ── FIX: Contar chips REAIS existentes (COUNT), não baseado em chip_index ──
      const { count, error: countErr } = await supabase
        .from("disposable_chips")
        .select("id", { count: "exact", head: true })
        .eq("collaborator_id", collaborator_id);

      const realCount = count ?? 0;
      if (realCount >= 5) return json({ error: "Máximo de 5 chips por consultor" }, 400);

      // ── FIX: Calcular próximo chip_index disponível (preencher gaps) ──
      const { data: existing } = await supabase
        .from("disposable_chips")
        .select("chip_index")
        .eq("collaborator_id", collaborator_id)
        .order("chip_index", { ascending: true });

      const usedIndices = new Set((existing || []).map(e => e.chip_index));
      let nextIndex = 1;
      while (usedIndices.has(nextIndex) && nextIndex <= 5) nextIndex++;
      if (nextIndex > 5) return json({ error: "Máximo de 5 chips por consultor" }, 400);

      // Buscar nome do colaborador para nomear instância
      const { data: collab } = await supabase
        .from("collaborators")
        .select("name")
        .eq("id", collaborator_id)
        .single();

      // Buscar server padrão do system_configs
      const { data: cfgServer } = await supabase
        .from("system_configs").select("value").eq("key", "uazapi_disposable_server_url").single();
      const { data: cfgToken } = await supabase
        .from("system_configs").select("value").eq("key", "uazapi_disposable_admin_token").single();

      const defaultServer = cfgServer?.value || "https://walkholding.uazapi.com";
      const defaultToken = cfgToken?.value || "";

      const serverUrl = uazapi_server_url || defaultServer;
      const adminToken = uazapi_admin_token || defaultToken;

      if (!adminToken) return json({ error: "Admin Token do UAZAPI não configurado. Configure em system_configs." }, 400);

      // Gerar nome da instância: primeironome + chip_index + timestamp curto (evita colisão)
      const firstName = (collab?.name || "usuario").split(" ")[0];
      const safeName = firstName
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 20);
      const shortTs = Date.now().toString(36).slice(-4);
      const instanceName = `${safeName}${nextIndex}_${shortTs}`;

      // Criar instância no UAZAPI
      const uazResp = await fetch(`${serverUrl}/instance/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "admintoken": adminToken,
        },
        body: JSON.stringify({ name: instanceName, instanceName }),
      });

      if (!uazResp.ok) {
        const txt = await uazResp.text();
        return json({ error: `UAZAPI erro: ${uazResp.status} ${txt}` }, 502);
      }

      const uazData = await uazResp.json();
      const instanceToken = uazData?.token || uazData?.instance?.token || uazData?.data?.token;

      if (!instanceToken) return json({ error: "UAZAPI não retornou token", uazData }, 502);

      // Salvar no Supabase
      const { data: chip, error: dbErr } = await supabase
        .from("disposable_chips")
        .insert({
          collaborator_id,
          chip_index: nextIndex,
          instance_name: instanceName,
          instance_token: instanceToken,
          uazapi_server_url: serverUrl,
          uazapi_admin_token: adminToken,
          status: "disconnected",
        })
        .select()
        .single();

      if (dbErr) return json({ error: dbErr.message }, 500);

      // Configurar proxy se fornecido
      if (proxy_url) {
        await applyProxy(serverUrl, instanceToken, proxy_url);
        await supabase.from("disposable_chips")
          .update({ proxy_url })
          .eq("id", chip.id);
        chip.proxy_url = proxy_url;
      }

      return json({ ok: true, chip });
    }

    if (action === "set_proxy") {
      if (!chip_id) return json({ error: "chip_id obrigatório" }, 400);

      const { data: chip } = await supabase
        .from("disposable_chips").select("*").eq("id", chip_id).single();
      if (!chip) return json({ error: "Chip não encontrado" }, 404);

      const newProxy: string | null = proxy_url ?? null;

      await supabase.from("disposable_chips")
        .update({ proxy_url: newProxy, updated_at: new Date().toISOString() })
        .eq("id", chip_id);

      if (chip.instance_token && newProxy) {
        const proxyResult = await applyProxy(chip.uazapi_server_url, chip.instance_token, newProxy);
        return json({ ok: true, proxy_applied: proxyResult });
      }
      return json({ ok: true, proxy_applied: false, note: "Proxy salvo — será aplicado na próxima conexão" });
    }

    if (action === "connect") {
      if (!chip_id) return json({ error: "chip_id obrigatório" }, 400);

      const { data: chip } = await supabase
        .from("disposable_chips")
        .select("*")
        .eq("id", chip_id)
        .single();

      if (!chip) return json({ error: "Chip não encontrado" }, 404);

      // Se ainda não tem instância, criar primeiro
      if (!chip.instance_token || chip.instance_token.trim() === "") {
        const cfgServer = await supabase.from("system_configs").select("value").eq("key", "uazapi_disposable_server_url").single();
        const cfgToken = await supabase.from("system_configs").select("value").eq("key", "uazapi_disposable_admin_token").single();
        const autoServer = chip.uazapi_server_url || cfgServer.data?.value || "https://walkholding.uazapi.com";
        const autoToken = chip.uazapi_admin_token || cfgToken.data?.value || "";
        if (!autoToken) return json({ error: "Admin Token não configurado" }, 400);

        const { data: collabInfo } = await supabase.from("collaborators").select("name").eq("id", chip.collaborator_id).single();
        const collabFirstName = (collabInfo?.name || "usuario").split(" ")[0];
        const collabSafe = collabFirstName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").slice(0, 20);
        const shortTs = Date.now().toString(36).slice(-4);
        const autoName = `${collabSafe}_chip${chip.chip_index}_${shortTs}`;

        try {
          const createResp = await fetch(`${autoServer}/instance/init`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "admintoken": autoToken },
            body: JSON.stringify({ name: autoName }),
          });
          if (!createResp.ok) {
            const errText = await createResp.text();
            return json({ error: `UAZAPI create erro ${createResp.status}: ${errText.slice(0,200)}` }, 502);
          }
          const createData = await createResp.json();
          const newToken = createData?.token || createData?.instance?.token;
          if (!newToken) return json({ error: "UAZAPI não retornou token", detail: createData }, 502);

          await supabase.from("disposable_chips").update({
            instance_name: autoName,
            instance_token: newToken,
            uazapi_server_url: autoServer,
            uazapi_admin_token: autoToken,
            status: "disconnected",
          }).eq("id", chip_id);

          chip.instance_token = newToken;
          chip.uazapi_server_url = autoServer;
          chip.instance_name = autoName;
          await new Promise(r => setTimeout(r, 1500));
        } catch (createErr: any) {
          return json({ error: `Erro ao criar instância: ${createErr.message}` }, 502);
        }
      }

      // Aplicar proxy se configurado
      if (chip.proxy_url && chip.instance_token) {
        await applyProxy(chip.uazapi_server_url, chip.instance_token, chip.proxy_url);
      }

      // Solicitar QR code ao UAZAPI com timeout de 25s
      const connectAbort = new AbortController();
      const connectTimeout = setTimeout(() => connectAbort.abort(), 25000);
      let qrResp: Response;
      try {
        qrResp = await fetch(`${chip.uazapi_server_url}/instance/connect`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": chip.instance_token },
          body: JSON.stringify({}),
          signal: connectAbort.signal,
        });
      } catch (fetchErr: any) {
        clearTimeout(connectTimeout);
        await supabase.from("disposable_chips")
          .update({ status: "connecting", qr_code: null, updated_at: new Date().toISOString() })
          .eq("id", chip_id);
        return json({ ok: true, qr_code: null, status: "connecting", pending: true });
      }
      clearTimeout(connectTimeout);

      // Se token inválido (401/404), limpar e recriar instância automaticamente
      if (qrResp.status === 401 || qrResp.status === 404) {
        const cfgServer = await supabase.from("system_configs").select("value").eq("key", "uazapi_disposable_server_url").single();
        const cfgToken2 = await supabase.from("system_configs").select("value").eq("key", "uazapi_disposable_admin_token").single();
        const autoServer2 = chip.uazapi_server_url || cfgServer.data?.value || "https://walkholding.uazapi.com";
        const autoToken2 = chip.uazapi_admin_token || cfgToken2.data?.value || "";

        const { data: collabInfo2 } = await supabase.from("collaborators").select("name").eq("id", chip.collaborator_id).single();
        const collabFirstName2 = (collabInfo2?.name || "usuario").split(" ")[0];
        const collabSafe2 = collabFirstName2.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").slice(0, 20);
        const shortTs2 = Date.now().toString(36).slice(-4);
        const autoName2 = `${collabSafe2}_chip${chip.chip_index}_${shortTs2}`;

        const createResp2 = await fetch(`${autoServer2}/instance/init`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "admintoken": autoToken2 },
          body: JSON.stringify({ name: autoName2 }),
        });
        if (!createResp2.ok) {
          const errTxt = await createResp2.text();
          return json({ error: `Instância inválida. Recriação falhou: ${createResp2.status} ${errTxt.slice(0,150)}` }, 502);
        }
        const createData2 = await createResp2.json();
        const newToken2 = createData2?.token || createData2?.instance?.token;
        if (!newToken2) return json({ error: "UAZAPI não retornou token na recriação" }, 502);

        await supabase.from("disposable_chips").update({
          instance_name: autoName2,
          instance_token: newToken2,
          uazapi_server_url: autoServer2,
          uazapi_admin_token: autoToken2,
          status: "disconnected",
        }).eq("id", chip_id);

        chip.instance_token = newToken2;
        chip.uazapi_server_url = autoServer2;
        chip.instance_name = autoName2;

        await new Promise(r => setTimeout(r, 1500));

        qrResp = await fetch(`${chip.uazapi_server_url}/instance/connect`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": chip.instance_token },
          body: JSON.stringify({}),
        });
      }

      if (!qrResp.ok) {
        const txt = await qrResp.text();
        return json({ error: `UAZAPI connect erro: ${qrResp.status} ${txt}` }, 502);
      }

      const qrData = await qrResp.json();
      const qrCode = qrData?.instance?.qrcode || qrData?.qrcode || qrData?.qr || qrData?.data?.qrcode;

      await supabase
        .from("disposable_chips")
        .update({ status: "connecting", qr_code: qrCode || null, updated_at: new Date().toISOString() })
        .eq("id", chip_id);

      return json({ ok: true, qr_code: qrCode, status: "connecting" });
    }

    if (action === "status") {
      if (!chip_id) return json({ error: "chip_id obrigatório" }, 400);

      const { data: chip } = await supabase
        .from("disposable_chips")
        .select("*")
        .eq("id", chip_id)
        .single();

      if (!chip) return json({ error: "Chip não encontrado" }, 404);
      if (!chip.instance_token) return json({ status: "no_instance" });

      const stAbort = new AbortController();
      const stTimeout = setTimeout(() => stAbort.abort(), 15000);
      let stResp: Response;
      try {
        stResp = await fetch(`${chip.uazapi_server_url}/instance/status`, {
          headers: { "token": chip.instance_token },
          signal: stAbort.signal,
        });
      } catch (_) {
        clearTimeout(stTimeout);
        return json({ ok: true, status: chip.status, qr_code: chip.qr_code, timeout: true });
      }
      clearTimeout(stTimeout);

      if (!stResp.ok) return json({ error: `UAZAPI status erro: ${stResp.status}` }, 502);

      const stData = await stResp.json();
      const inst = stData?.instance || stData;
      const connected = stData?.status?.connected === true || inst?.status === "open" || stData?.connected === true;
      const phone = stData?.status?.jid || inst?.owner || stData?.phone || null;
      const freshQr = inst?.qrcode || stData?.qrcode || null;
      const disconnectReason = inst?.lastDisconnectReason || "";
      const isQrExpired = disconnectReason.toLowerCase().includes("qr") && disconnectReason.toLowerCase().includes("timeout");

      let newStatus: string;
      if (connected) {
        newStatus = "connected";
      } else if (freshQr && freshQr.length > 10) {
        newStatus = "connecting";
      } else {
        newStatus = "disconnected";
      }

      const updateData: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
      if (connected) {
        updateData.qr_code = null;
        if (phone) updateData.phone = phone;
      } else if (freshQr && freshQr.length > 10) {
        updateData.qr_code = freshQr;
      }

      await supabase.from("disposable_chips").update(updateData).eq("id", chip_id);

      // Auto-configure webhook when connected
      if (connected && chip.instance_token && chip.uazapi_server_url) {
        try {
          await fetch(`${chip.uazapi_server_url}/webhook`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "token": chip.instance_token,
            },
            body: JSON.stringify({
              webhookUrl: `${supabaseUrl}/functions/v1/whatsapp-webhook`,
              webhookEnabled: true,
            }),
          });
          console.log(`Webhook auto-configured for chip ${chip_id}`);
        } catch (e) {
          console.error("Failed to configure webhook:", e);
        }
      }

      return json({ ok: true, status: newStatus, phone, qr_code: freshQr, qr_expired: isQrExpired });
    }

    if (action === "delete") {
      if (!chip_id) return json({ error: "chip_id obrigatório" }, 400);

      const { data: chip } = await supabase
        .from("disposable_chips")
        .select("*")
        .eq("id", chip_id)
        .single();

      if (!chip) return json({ error: "Chip não encontrado" }, 404);

      // Deletar instância no UAZAPI (best effort)
      if (chip.instance_token && chip.uazapi_admin_token) {
        try {
          await fetch(`${chip.uazapi_server_url}/instance/delete`, {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              "admintoken": chip.uazapi_admin_token,
              "token": chip.instance_token,
            },
          });
        } catch (_) { /* ignora erro UAZAPI */ }
      }

      // ── FIX: Deletar do DB sem verificação extra ──
      const { error: delErr } = await supabase.from("disposable_chips").delete().eq("id", chip_id);
      if (delErr) return json({ error: `Erro ao deletar: ${delErr.message}` }, 500);

      return json({ ok: true });
    }

    if (action === "reconnect_all") {
      // Reconecta todos os chips desconectados de um colaborador
      if (!collaborator_id) return json({ error: "collaborator_id obrigatório" }, 400);

      const { data: disconnected } = await supabase
        .from("disposable_chips")
        .select("*")
        .eq("collaborator_id", collaborator_id)
        .eq("status", "disconnected");

      if (!disconnected || disconnected.length === 0) {
        return json({ ok: true, message: "Nenhum chip desconectado", reconnected: 0 });
      }

      const results: { chip_id: string; chip_index: number; status: string; error?: string }[] = [];

      for (const chip of disconnected) {
        try {
          // Tentar reconectar via connect
          if (!chip.instance_token) {
            results.push({ chip_id: chip.id, chip_index: chip.chip_index, status: "skipped", error: "Sem token" });
            continue;
          }

          const qrResp = await fetch(`${chip.uazapi_server_url}/instance/connect`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "token": chip.instance_token },
            body: JSON.stringify({}),
          });

          if (qrResp.status === 401 || qrResp.status === 404) {
            // Token inválido, precisa recriar
            results.push({ chip_id: chip.id, chip_index: chip.chip_index, status: "needs_recreate", error: "Token expirado" });
            continue;
          }

          if (qrResp.ok) {
            const qrData = await qrResp.json();
            const qrCode = qrData?.instance?.qrcode || qrData?.qrcode || qrData?.qr || null;
            await supabase.from("disposable_chips")
              .update({ status: "connecting", qr_code: qrCode, updated_at: new Date().toISOString() })
              .eq("id", chip.id);
            results.push({ chip_id: chip.id, chip_index: chip.chip_index, status: "connecting" });
          } else {
            results.push({ chip_id: chip.id, chip_index: chip.chip_index, status: "error", error: `HTTP ${qrResp.status}` });
          }
        } catch (e: any) {
          results.push({ chip_id: chip.id, chip_index: chip.chip_index, status: "error", error: e.message });
        }
      }

      return json({ ok: true, reconnected: results.filter(r => r.status === "connecting").length, results });
    }

    return json({ error: `Action desconhecida: ${action}` }, 400);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Configura proxy na instância UAZAPI via POST /instance/proxy
 */
async function applyProxy(serverUrl: string, instanceToken: string, proxyUrl: string): Promise<boolean> {
  try {
    const parsed = new URL(proxyUrl);
    const protocol = parsed.protocol.replace(":", "") || "http";
    const host = parsed.hostname;
    const port = parseInt(parsed.port || "8080");
    const username = parsed.username ? decodeURIComponent(parsed.username) : undefined;
    const password = parsed.password ? decodeURIComponent(parsed.password) : undefined;

    const proxyAbort = new AbortController();
    const proxyTimeout = setTimeout(() => proxyAbort.abort(), 10000);

    const resp = await fetch(`${serverUrl}/instance/proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: instanceToken },
      body: JSON.stringify({
        proxy: proxyUrl,
        host,
        port,
        protocol,
        ...(username ? { username, user: username } : {}),
        ...(password ? { password } : {}),
      }),
      signal: proxyAbort.signal,
    });
    clearTimeout(proxyTimeout);
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      console.error(`applyProxy failed: ${resp.status} ${txt}`);
      return false;
    }
    console.log(`Proxy ${host}:${port} configurado na instância`);
    return true;
  } catch (e: any) {
    console.error("applyProxy error:", e.message);
    return false;
  }
}
