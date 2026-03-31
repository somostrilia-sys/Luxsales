import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "X-CORS-Version": "v2",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, Authorization",
      },
    });
  }

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "distribute":
        return await distributeLeads(body);
      case "redistribute":
        return await redistributeLead(body);
      case "return":
        return await returnLead(body);
      case "list-available":
        return await listAvailable(body);
      case "list-my-leads":
        return await listMyLeads(body);
      case "stats":
        return await getStats(body);
      case "list-master":
        return await listMaster(body);
      case "import":
        return await importLeads(body);
      case "queue-for-call":
        return await queueForCall(body);
      case "queue-for-dispatch":
        return await queueForDispatch(body);
      case "update-lead":
        return await updateLead(body);
      default:
        return json({ error: "Action inválida" }, 400);
    }
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});

/**
 * CEO distribui leads para um colaborador
 */
async function distributeLeads(body: any) {
  const { company_id, collaborator_id, phone_numbers, requester_role } = body;

  if (requester_role !== "ceo") {
    return json({ error: "Apenas o CEO pode distribuir leads" }, 403);
  }

  if (!collaborator_id || !phone_numbers?.length) {
    return json({ error: "collaborator_id e phone_numbers são obrigatórios" }, 400);
  }

  // Verificar se colaborador tem permissão ativa
  const { data: perm } = await supabase
    .from("dispatch_permissions")
    .select("id, is_active")
    .eq("company_id", company_id)
    .eq("collaborator_id", collaborator_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!perm) {
    return json({ error: "Colaborador sem permissão configurada" }, 400);
  }

  const results = { distributed: 0, skipped: 0, errors: [] as string[] };

  for (const phone of phone_numbers) {
    // Buscar lifecycle do lead
    const { data: lifecycle } = await supabase
      .from("lead_whatsapp_lifecycle")
      .select("id, lead_name, opt_in_id")
      .eq("company_id", company_id)
      .eq("phone_number", phone)
      .maybeSingle();

    if (!lifecycle) {
      results.errors.push(`${phone}: lead não encontrado no lifecycle`);
      results.skipped++;
      continue;
    }

    // Verificar opt-in
    if (!lifecycle.opt_in_id) {
      results.errors.push(`${phone}: sem opt-in registrado`);
      results.skipped++;
      continue;
    }

    // Verificar se já está distribuído e ativo
    const { data: existing } = await supabase
      .from("lead_distribution")
      .select("id, collaborator_id, status")
      .eq("company_id", company_id)
      .eq("phone_number", phone)
      .in("status", ["pending", "dispatched", "in_progress"])
      .maybeSingle();

    if (existing) {
      results.errors.push(`${phone}: já distribuído para outro colaborador`);
      results.skipped++;
      continue;
    }

    // Distribuir
    const { error } = await supabase.from("lead_distribution").insert({
      company_id,
      collaborator_id,
      lifecycle_id: lifecycle.id,
      phone_number: phone,
      lead_name: lifecycle.lead_name,
      distributed_by: body.requester_id || null,
      status: "pending",
    });

    if (error) {
      results.errors.push(`${phone}: ${error.message}`);
      results.skipped++;
    } else {
      // Atualizar lifecycle com collaborator_id
      await supabase
        .from("lead_whatsapp_lifecycle")
        .update({
          collaborator_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", lifecycle.id);

      results.distributed++;
    }
  }

  return json({ success: true, results });
}

/**
 * CEO redistribui lead para outro colaborador
 */
async function redistributeLead(body: any) {
  const { company_id, phone_number, new_collaborator_id, requester_role } = body;

  if (requester_role !== "ceo") {
    return json({ error: "Apenas o CEO pode redistribuir" }, 403);
  }

  // Fechar distribuição anterior
  await supabase
    .from("lead_distribution")
    .update({ status: "returned", result: "redistributed" })
    .eq("company_id", company_id)
    .eq("phone_number", phone_number)
    .in("status", ["pending", "dispatched", "in_progress"]);

  // Buscar lifecycle
  const { data: lifecycle } = await supabase
    .from("lead_whatsapp_lifecycle")
    .select("id, lead_name")
    .eq("company_id", company_id)
    .eq("phone_number", phone_number)
    .maybeSingle();

  if (!lifecycle) return json({ error: "Lead não encontrado" }, 404);

  // Nova distribuição
  const { data, error } = await supabase
    .from("lead_distribution")
    .insert({
      company_id,
      collaborator_id: new_collaborator_id,
      lifecycle_id: lifecycle.id,
      phone_number,
      lead_name: lifecycle.lead_name,
      distributed_by: body.requester_id,
      status: "pending",
    })
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);

  // Atualizar lifecycle
  await supabase
    .from("lead_whatsapp_lifecycle")
    .update({ collaborator_id: new_collaborator_id, updated_at: new Date().toISOString() })
    .eq("id", lifecycle.id);

  return json({ success: true, distribution: data });
}

/**
 * Colaborador devolve lead
 */
async function returnLead(body: any) {
  const { company_id, collaborator_id, phone_number, reason } = body;

  const { data, error } = await supabase
    .from("lead_distribution")
    .update({
      status: "returned",
      result: reason || "devolvido pelo colaborador",
    })
    .eq("company_id", company_id)
    .eq("collaborator_id", collaborator_id)
    .eq("phone_number", phone_number)
    .in("status", ["pending", "dispatched", "in_progress"])
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);

  // Limpar collaborator_id do lifecycle
  await supabase
    .from("lead_whatsapp_lifecycle")
    .update({ collaborator_id: null, updated_at: new Date().toISOString() })
    .eq("company_id", company_id)
    .eq("phone_number", phone_number);

  return json({ success: true, distribution: data });
}

/**
 * Listar leads com opt-in que ainda não foram distribuídos (CEO)
 */
async function listAvailable(body: any) {
  const { company_id, requester_role, limit = 50, offset = 0 } = body;

  if (requester_role !== "ceo") {
    return json({ error: "Apenas o CEO pode ver leads disponíveis" }, 403);
  }

  // Leads com opt-in ativo que não têm distribuição ativa
  const { data, count, error } = await supabase
    .from("lead_whatsapp_lifecycle")
    .select("*, whatsapp_opt_ins!inner(status)", { count: "exact" })
    .eq("company_id", company_id)
    .is("collaborator_id", null)
    .eq("whatsapp_opt_ins.status", "active")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    // Fallback sem join se der erro de FK
    const { data: fallback, count: cnt } = await supabase
      .from("lead_whatsapp_lifecycle")
      .select("*", { count: "exact" })
      .eq("company_id", company_id)
      .is("collaborator_id", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    return json({ leads: fallback || [], total: cnt });
  }

  return json({ leads: data, total: count });
}

/**
 * Colaborador lista seus leads distribuídos
 */
async function listMyLeads(body: any) {
  const { company_id, collaborator_id, status_filter, limit = 50, offset = 0 } = body;

  let query = supabase
    .from("lead_distribution")
    .select(
      `*, lead_whatsapp_lifecycle(
        stage, window_open, window_expires_at, last_inbound_at,
        last_template_sent_at, sentiment, conversation_summary,
        lead_interests, messages_sent, messages_received
      )`,
      { count: "exact" }
    )
    .eq("company_id", company_id)
    .eq("collaborator_id", collaborator_id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status_filter) {
    query = query.eq("status", status_filter);
  } else {
    // Por padrão, mostrar apenas leads ativos
    query = query.in("status", ["pending", "dispatched", "responded", "in_progress"]);
  }

  const { data, count, error } = await query;

  if (error) {
    // Fallback sem join
    const { data: fallback, count: cnt } = await supabase
      .from("lead_distribution")
      .select("*", { count: "exact" })
      .eq("company_id", company_id)
      .eq("collaborator_id", collaborator_id)
      .in("status", ["pending", "dispatched", "responded", "in_progress"])
      .range(offset, offset + limit - 1);

    return json({ leads: fallback || [], total: cnt });
  }

  return json({ leads: data, total: count });
}

/**
 * Métricas por colaborador (CEO vê todos, colaborador vê só o seu)
 */
async function getStats(body: any) {
  const { company_id, collaborator_id, requester_role } = body;

  // Se não é CEO e tenta ver de outro, bloqueia
  if (requester_role !== "ceo" && requester_role !== "director" && !collaborator_id) {
    return json({ error: "Informe collaborator_id" }, 400);
  }

  let query = supabase
    .from("lead_distribution")
    .select("status, result")
    .eq("company_id", company_id);

  if (collaborator_id) {
    query = query.eq("collaborator_id", collaborator_id);
  }

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 500);

  const stats = {
    total: data?.length || 0,
    pending: 0,
    dispatched: 0,
    responded: 0,
    in_progress: 0,
    completed: 0,
    returned: 0,
    sold: 0,
    lost: 0,
  };

  for (const d of data || []) {
    if (d.status in stats) (stats as any)[d.status]++;
    if (d.result === "sold") stats.sold++;
    if (d.result === "lost") stats.lost++;
  }

  return json({ stats });
}

/**
 * Listar leads do leads_master (CEO) — paginado com filtros
 */
async function listMaster(body: any) {
  const {
    company_id, requester_role,
    limit = 50, offset = 0,
    status_filter, temperature_filter, segment_filter,
    search, tags_filter, sort_by = "created_at", sort_order = "desc",
  } = body;

  if (requester_role !== "ceo" && requester_role !== "director") {
    return json({ error: "Apenas CEO/diretor pode acessar leads master" }, 403);
  }

  let query = supabase
    .from("leads_master")
    .select("*", { count: "exact" })
    .eq("company_id", company_id)
    .order(sort_by, { ascending: sort_order === "asc" })
    .range(offset, offset + limit - 1);

  if (status_filter) query = query.eq("status", status_filter);
  if (temperature_filter) query = query.eq("lead_temperature", temperature_filter);
  if (segment_filter) query = query.eq("segment", segment_filter);
  if (search) query = query.or(`phone_number.ilike.%${search}%,lead_name.ilike.%${search}%`);

  const { data, count, error } = await query;
  if (error) return json({ error: error.message }, 500);

  // Stats rápido
  let stats: any = null;
  try {
    const rpcResult = await supabase.rpc("leads_master_stats", { p_company_id: company_id });
    stats = rpcResult.data;
  } catch { /* ignore */ }

  return json({ leads: data, total: count, stats });
}

/**
 * Importar leads em lote no leads_master
 */
async function importLeads(body: any) {
  const { company_id, requester_role, leads, source = "import", source_detail, segment } = body;

  if (requester_role !== "ceo") {
    return json({ error: "Apenas o CEO pode importar leads" }, 403);
  }

  if (!leads?.length) {
    return json({ error: "Array 'leads' é obrigatório. Formato: [{phone_number, lead_name?, email?, tags?, extra_data?}]" }, 400);
  }

  // Criar batch
  const { data: batch, error: batchErr } = await supabase
    .from("lead_import_batches")
    .insert({
      company_id,
      source,
      total_rows: leads.length,
      imported_by: body.requester_id,
    })
    .select()
    .single();

  if (batchErr) return json({ error: `Erro ao criar batch: ${batchErr.message}` }, 500);

  const results = { imported: 0, duplicates: 0, invalid: 0, errors: [] as string[] };

  // Importar em chunks de 100
  const chunks = [];
  for (let i = 0; i < leads.length; i += 100) {
    chunks.push(leads.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    const rows = chunk
      .map((lead: any) => {
        let phone = (lead.phone_number || lead.phone || lead.telefone || "").toString().replace(/\D/g, "");
        if (!phone || phone.length < 10) {
          results.invalid++;
          return null;
        }
        // Normalizar pra E.164
        if (phone.length === 11) phone = "+55" + phone;
        else if (phone.length === 13 && phone.startsWith("55")) phone = "+" + phone;
        else if (!phone.startsWith("+")) phone = "+" + phone;

        return {
          company_id,
          phone_number: phone,
          lead_name: lead.lead_name || lead.name || lead.nome || null,
          email: lead.email || null,
          source,
          source_detail,
          segment: lead.segment || segment || null,
          tags: lead.tags || [],
          extra_data: lead.extra_data || lead.dados || {},
          city: lead.city || lead.cidade || null,
          state: lead.state || lead.estado || null,
          priority: lead.priority || 5,
          import_batch_id: batch.id,
          status: "new",
        };
      })
      .filter(Boolean);

    if (rows.length === 0) continue;

    const { data: inserted, error } = await supabase
      .from("leads_master")
      .upsert(rows, { onConflict: "company_id,phone_number", ignoreDuplicates: true })
      .select("id");

    if (error) {
      results.errors.push(error.message);
    } else {
      const insertedCount = inserted?.length || 0;
      results.imported += insertedCount;
      results.duplicates += rows.length - insertedCount;
    }
  }

  // Atualizar batch
  await supabase
    .from("lead_import_batches")
    .update({
      imported: results.imported,
      duplicates: results.duplicates,
      invalid: results.invalid,
      status: results.errors.length > 0 ? "partial" : "completed",
      completed_at: new Date().toISOString(),
      error_log: results.errors,
    })
    .eq("id", batch.id);

  return json({
    success: true,
    batch_id: batch.id,
    results,
  });
}

/**
 * Colocar leads na fila de ligação
 */
async function queueForCall(body: any) {
  const { company_id, requester_role, phone_numbers, filter, priority } = body;

  if (requester_role !== "ceo") {
    return json({ error: "Apenas o CEO pode enfileirar leads" }, 403);
  }

  let updated = 0;

  if (phone_numbers?.length) {
    // Enfileirar leads específicos
    const { count } = await supabase
      .from("leads_master")
      .update({
        status: "queued_call",
        status_changed_at: new Date().toISOString(),
        priority: priority || 5,
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", company_id)
      .in("phone_number", phone_numbers)
      .in("status", ["new", "called"]);

    updated = count || 0;
  } else if (filter) {
    // Enfileirar por filtro
    let query = supabase
      .from("leads_master")
      .update({
        status: "queued_call",
        status_changed_at: new Date().toISOString(),
        priority: priority || 5,
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", company_id)
      .in("status", ["new"]);

    if (filter.segment) query = query.eq("segment", filter.segment);
    if (filter.temperature) query = query.eq("lead_temperature", filter.temperature);
    if (filter.limit) query = query.limit(filter.limit);

    const { count } = await query;
    updated = count || 0;
  }

  return json({ success: true, queued: updated });
}

/**
 * Colocar leads na fila de disparo WhatsApp (só os que já têm opt-in)
 */
async function queueForDispatch(body: any) {
  const { company_id, requester_role, phone_numbers, filter } = body;

  if (requester_role !== "ceo") {
    return json({ error: "Apenas o CEO pode enfileirar disparos" }, 403);
  }

  let updated = 0;

  if (phone_numbers?.length) {
    const { count } = await supabase
      .from("leads_master")
      .update({
        status: "queued_dispatch",
        status_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", company_id)
      .in("phone_number", phone_numbers)
      .eq("status", "opted_in")
      .not("opt_in_id", "is", null);

    updated = count || 0;
  } else if (filter) {
    let query = supabase
      .from("leads_master")
      .update({
        status: "queued_dispatch",
        status_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", company_id)
      .eq("status", "opted_in")
      .not("opt_in_id", "is", null);

    if (filter.segment) query = query.eq("segment", filter.segment);
    if (filter.limit) query = query.limit(filter.limit);

    const { count } = await query;
    updated = count || 0;
  }

  return json({ success: true, queued: updated });
}

/**
 * Atualizar dados de um lead no master (após ligação, etc.)
 */
async function updateLead(body: any) {
  const { company_id, phone_number, updates } = body;

  if (!phone_number || !updates) {
    return json({ error: "phone_number e updates são obrigatórios" }, 400);
  }

  // Campos permitidos
  const allowed = [
    "status", "lead_name", "lead_score", "lead_temperature",
    "last_call_at", "last_call_result", "last_call_id",
    "total_call_attempts", "next_call_at",
    "opt_in_id", "lifecycle_id", "last_dispatch_at", "total_dispatches",
    "assigned_to", "assigned_at", "priority", "tags", "extra_data",
    "email", "city", "state", "segment",
  ];

  const sanitized: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in updates) sanitized[key] = updates[key];
  }
  if (updates.status) sanitized.status_changed_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("leads_master")
    .update(sanitized)
    .eq("company_id", company_id)
    .eq("phone_number", phone_number)
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);
  return json({ success: true, lead: data });
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
        "X-CORS-Version": "v2",
    },
  });
}
