import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json();
    const { action, chip_id, collaborator_id } = body;

    // === CONNECT: gerar QR code para chip de disparo ===
    if (action === "connect") {
      if (!chip_id) return json({ error: "chip_id obrigatório" }, 400);

      const { data: chip } = await supabase
        .from("disposable_chips")
        .select("*")
        .eq("id", chip_id)
        .single();

      if (!chip) return json({ error: "Chip não encontrado" }, 404);

      const serverUrl = chip.uazapi_server_url;
      const adminToken = chip.uazapi_admin_token;

      // Se não tem token de instância, criar nova no UAZAPI
      if (!chip.instance_token || chip.instance_token.trim() === "") {
        if (!adminToken) return json({ error: "Admin token não configurado para este chip" }, 400);

        const instanceName = chip.instance_name || `chip_${chip.collaborator_id.slice(0,8)}_${chip.chip_index}`;

        const createResp = await fetch(`${serverUrl}/instance/init`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "admintoken": adminToken },
          body: JSON.stringify({ name: instanceName }),
        });

        if (!createResp.ok) {
          return json({ error: `UAZAPI init falhou: ${createResp.status}` }, 502);
        }

        const createData = await createResp.json();
        const newToken = createData?.token || createData?.instance?.token;
        if (!newToken) return json({ error: "UAZAPI não retornou token", detail: createData }, 502);

        // Atualizar DB
        await supabase.from("disposable_chips").update({
          instance_token: newToken,
          instance_name: instanceName,
          status: "connecting",
          updated_at: new Date().toISOString(),
        }).eq("id", chip_id);

        // Conectar pra gerar QR
        const connectResp = await fetch(`${serverUrl}/instance/connect`, {
          method: "POST",
          headers: { "token": newToken, "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const connectData = await connectResp.json();
        const qrCode = connectData?.qrcode || connectData?.instance?.qrcode || "";

        if (qrCode) {
          await supabase.from("disposable_chips").update({
            qr_code: qrCode, status: "connecting", updated_at: new Date().toISOString(),
          }).eq("id", chip_id);
        }

        return json({ ok: true, qr_code: qrCode || null, status: "connecting", instance_name: instanceName });
      }

      // Já tem token — reconectar pra gerar QR novo
      const connectResp = await fetch(`${serverUrl}/instance/connect`, {
        method: "POST",
        headers: { "token": chip.instance_token, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const connectData = await connectResp.json();
      const qrCode = connectData?.qrcode || connectData?.instance?.qrcode || "";

      if (qrCode) {
        await supabase.from("disposable_chips").update({
          qr_code: qrCode, status: "connecting", updated_at: new Date().toISOString(),
        }).eq("id", chip_id);
      }

      return json({ ok: true, qr_code: qrCode || null, status: "connecting" });
    }

    // === STATUS: verificar status do chip ===
    if (action === "status") {
      if (!chip_id) return json({ error: "chip_id obrigatório" }, 400);

      const { data: chip } = await supabase
        .from("disposable_chips")
        .select("*")
        .eq("id", chip_id)
        .single();

      if (!chip) return json({ error: "Chip não encontrado" }, 404);
      if (!chip.instance_token) return json({ status: "no_instance", connected: false });

      const statusResp = await fetch(`${chip.uazapi_server_url}/instance/status`, {
        headers: { "token": chip.instance_token },
      });
      const statusData = await statusResp.json();

      const connected = statusData?.status?.connected === true;
      const phone = statusData?.status?.jid?.split(":")[0] || statusData?.instance?.owner || null;
      const freshQr = statusData?.instance?.qrcode || null;
      const newStatus = connected ? "connected" : freshQr ? "connecting" : "disconnected";

      await supabase.from("disposable_chips").update({
        status: newStatus,
        phone: connected ? phone : chip.phone,
        qr_code: freshQr || null,
        updated_at: new Date().toISOString(),
      }).eq("id", chip_id);

      return json({ connected, status: newStatus, phone, qr_code: freshQr || null });
    }

    // === LIST: listar chips de um colaborador ===
    if (action === "list") {
      if (!collaborator_id) return json({ error: "collaborator_id obrigatório" }, 400);

      const { data: chips } = await supabase
        .from("disposable_chips")
        .select("id,chip_index,instance_name,status,phone,qr_code")
        .eq("collaborator_id", collaborator_id)
        .order("chip_index");

      return json({ chips: chips || [] });
    }

    // === RESET: deletar instância antiga e preparar para nova conexão ===
    if (action === "reset") {
      if (!chip_id) return json({ error: "chip_id obrigatório" }, 400);

      const { data: chip } = await supabase
        .from("disposable_chips")
        .select("*")
        .eq("id", chip_id)
        .single();

      if (!chip) return json({ error: "Chip não encontrado" }, 404);

      // Tentar deslogar no UAZAPI
      if (chip.instance_token) {
        try {
          await fetch(`${chip.uazapi_server_url}/instance/logout`, {
            method: "POST",
            headers: { "token": chip.instance_token, "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
        } catch {}
      }

      // Limpar dados
      await supabase.from("disposable_chips").update({
        instance_token: null,
        status: "disconnected",
        qr_code: null,
        phone: null,
        updated_at: new Date().toISOString(),
      }).eq("id", chip_id);

      return json({ ok: true, message: "Chip resetado. Use connect para gerar novo QR." });
    }

    return json({ error: "action inválida. Use: connect, status, list, reset" }, 400);

  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
