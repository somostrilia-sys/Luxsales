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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { action } = body;

    // ── CREATE ──
    if (action === "create") {
      const { collaborator_id } = body;
      if (!collaborator_id) return json({ error: "collaborator_id required" }, 400);

      // Count existing chips
      const { data: existing } = await supabase
        .from("disposable_chips")
        .select("id")
        .eq("collaborator_id", collaborator_id);
      if ((existing || []).length >= 5) return json({ error: "Limite de 5 chips atingido" }, 400);

      const chipIndex = (existing || []).length + 1;

      // Get default UAZAPI config or use provided
      const serverUrl = body.uazapi_server_url || "https://walkholding.uazapi.com";
      const adminToken = body.uazapi_admin_token || "";

      // Try to get admin token from system_configs if not provided
      let finalAdminToken = adminToken;
      if (!finalAdminToken) {
        const { data: cfg } = await supabase
          .from("system_configs")
          .select("value")
          .eq("key", "uazapi_admin_token")
          .single();
        finalAdminToken = cfg?.value || "";
      }

      // Create instance on UAZAPI
      const instanceName = `chip_${collaborator_id.slice(0, 8)}_${chipIndex}`;
      let instanceToken = "";

      if (finalAdminToken) {
        try {
          const createRes = await fetch(`${serverUrl}/instance/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "AdminToken": finalAdminToken },
            body: JSON.stringify({ name: instanceName }),
          });
          const createData = await createRes.json();
          instanceToken = createData?.token || createData?.instance?.token || "";
        } catch (e) {
          console.error("UAZAPI create instance error:", e);
        }
      }

      // Insert chip record
      const { data: chip, error } = await supabase.from("disposable_chips").insert({
        collaborator_id,
        chip_index: chipIndex,
        uazapi_server_url: serverUrl,
        uazapi_admin_token: finalAdminToken,
        instance_name: instanceName,
        instance_token: instanceToken,
        status: "disconnected",
      }).select().single();

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, chip });
    }

    // ── CONNECT (get QR) ──
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

      // If no instance yet, create one
      if (!instanceToken && adminToken) {
        try {
          instanceName = instanceName || `chip_${chip.collaborator_id.slice(0, 8)}_${chip.chip_index}`;
          const createRes = await fetch(`${serverUrl}/instance/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "AdminToken": adminToken },
            body: JSON.stringify({ name: instanceName }),
          });
          const createData = await createRes.json();
          instanceToken = createData?.token || createData?.instance?.token || "";
          
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

      // Request QR code
      try {
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
        });
      } catch (e) {
        console.error("UAZAPI QR error:", e);
        return json({ error: "Falha ao obter QR code" }, 500);
      }
    }

    // ── STATUS ──
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

        // Update DB
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

    // ── DELETE ──
    if (action === "delete") {
      const { chip_id } = body;
      if (!chip_id) return json({ error: "chip_id required" }, 400);

      const { data: chip } = await supabase
        .from("disposable_chips")
        .select("*")
        .eq("id", chip_id)
        .single();
      if (!chip) return json({ error: "Chip não encontrado" }, 404);

      // Try to delete instance on UAZAPI
      if (chip.instance_token && chip.uazapi_admin_token) {
        try {
          await fetch(`${chip.uazapi_server_url}/instance/delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "AdminToken": chip.uazapi_admin_token },
            body: JSON.stringify({ name: chip.instance_name }),
          });
        } catch (e) {
          console.error("UAZAPI delete error:", e);
        }
      }

      const { error } = await supabase.from("disposable_chips").delete().eq("id", chip_id);
      if (error) return json({ error: error.message }, 500);

      return json({ ok: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("Edge function error:", e);
    return json({ error: e.message || "Erro interno" }, 500);
  }
});
