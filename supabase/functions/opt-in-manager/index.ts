import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePhone } from "../_shared/normalize-phone.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "register":
        return await registerOptIn(body);
      case "revoke":
        return await revokeOptIn(body);
      case "check":
        return await checkOptIn(body);
      case "list":
        return await listOptIns(body);
      case "register-from-call":
        return await registerFromCall(body);
      default:
        return json({ error: "Action inválida" }, 400);
    }
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});

/**
 * Registrar opt-in manualmente ou via formulário
 */
async function registerOptIn(body: any) {
  const { company_id, phone_number, lead_name, source, proof, proof_type } = body;

  if (!phone_number || !source) {
    return json({ error: "phone_number e source são obrigatórios" }, 400);
  }

  const normalized = normalizePhone(phone_number);
  if (!normalized) {
    return json({ error: "Número de telefone inválido" }, 400);
  }

  const validSources = ["ai_call", "inbound", "landing_page", "manual", "qr_code", "click_to_wa"];
  if (!validSources.includes(source)) {
    return json({ error: `Source inválido. Use: ${validSources.join(", ")}` }, 400);
  }

  const { data, error } = await supabase
    .from("whatsapp_opt_ins")
    .upsert(
      {
        company_id,
        phone_number: normalized,
        lead_name,
        opt_in_source: source,
        opt_in_proof: proof || null,
        opt_in_proof_type: proof_type || null,
        status: "active",
        opt_in_at: new Date().toISOString(),
        opt_out_at: null,
        opt_out_reason: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,phone_number" }
    )
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);

  // Criar lifecycle se não existir
  await supabase.from("lead_whatsapp_lifecycle").upsert(
    {
      company_id,
      phone_number: normalized,
      lead_name,
      opt_in_id: data.id,
      stage: "opted_in",
      stage_changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id,phone_number" }
  );

  return json({ success: true, opt_in: data });
}

/**
 * Registrar opt-in a partir de ligação com IA
 * Chamado automaticamente quando o lead autoriza no telefone
 */
async function registerFromCall(body: any) {
  const { company_id, phone_number, lead_name, call_id, call_summary } = body;

  if (!phone_number || !call_id) {
    return json({ error: "phone_number e call_id são obrigatórios" }, 400);
  }

  const normalized = normalizePhone(phone_number);
  if (!normalized) {
    return json({ error: "Número inválido" }, 400);
  }

  // Registrar opt-in com prova da ligação
  const { data, error } = await supabase
    .from("whatsapp_opt_ins")
    .upsert(
      {
        company_id,
        phone_number: normalized,
        lead_name,
        opt_in_source: "ai_call",
        opt_in_proof: call_id,
        opt_in_proof_type: "call_recording",
        status: "active",
        opt_in_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,phone_number" }
    )
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);

  // Criar lifecycle com contexto da ligação
  await supabase.from("lead_whatsapp_lifecycle").upsert(
    {
      company_id,
      phone_number: normalized,
      lead_name,
      opt_in_id: data.id,
      stage: "opted_in",
      stage_changed_at: new Date().toISOString(),
      last_call_at: new Date().toISOString(),
      total_calls: 1,
      conversation_summary: call_summary || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id,phone_number" }
  );

  return json({ success: true, opt_in: data });
}

/**
 * Revogar opt-in (lead pediu pra sair)
 */
async function revokeOptIn(body: any) {
  const { company_id, phone_number, reason } = body;

  const normalized = normalizePhone(phone_number);
  if (!normalized) return json({ error: "Número inválido" }, 400);

  const { data, error } = await supabase
    .from("whatsapp_opt_ins")
    .update({
      status: "opted_out",
      opt_out_at: new Date().toISOString(),
      opt_out_reason: reason || "Solicitação do lead",
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", company_id)
    .eq("phone_number", normalized)
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);

  // Cancelar disparos pendentes
  await supabase
    .from("smart_dispatches")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("phone_number", normalized)
    .in("status", ["queued", "ready"]);

  // Atualizar lifecycle
  await supabase
    .from("lead_whatsapp_lifecycle")
    .update({ stage: "closed_lost", updated_at: new Date().toISOString() })
    .eq("company_id", company_id)
    .eq("phone_number", normalized);

  return json({ success: true, opt_in: data });
}

/**
 * Checar se número tem opt-in ativo
 */
async function checkOptIn(body: any) {
  const { company_id, phone_number } = body;

  const normalized = normalizePhone(phone_number);
  if (!normalized) return json({ error: "Número inválido" }, 400);

  const { data } = await supabase
    .from("whatsapp_opt_ins")
    .select("*")
    .eq("company_id", company_id)
    .eq("phone_number", normalized)
    .eq("status", "active")
    .maybeSingle();

  return json({
    has_opt_in: !!data,
    opt_in: data,
  });
}

/**
 * Listar opt-ins com filtros
 */
async function listOptIns(body: any) {
  const { company_id, status, source, limit = 50, offset = 0 } = body;

  let query = supabase
    .from("whatsapp_opt_ins")
    .select("*", { count: "exact" })
    .eq("company_id", company_id)
    .order("opt_in_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (source) query = query.eq("opt_in_source", source);

  const { data, count, error } = await query;
  if (error) return json({ error: error.message }, 500);

  return json({ opt_ins: data, total: count });
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
