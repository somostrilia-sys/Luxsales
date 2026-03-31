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

    // Guard: se chamado sem action (ex: Lovable explorando a API), retornar dados seguros
    if (!action) {
      return new Response(JSON.stringify({ permissions: null, allowed: false, message: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    switch (action) {
      case "set":
        return await setPermission(body);
      case "get":
        return await getPermission(body);
      case "list":
        return await listPermissions(body);
      case "check-dispatch":
        return await checkDispatch(body);
      case "update-limit":
        return await updateLimit(body);
      case "set-templates":
        return await setAllowedTemplates(body);
      case "deactivate":
        return await deactivate(body);
      default:
        return json({ error: "Action inválida" }, 400);
    }
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});

/**
 * CEO define permissão de um colaborador
 */
async function setPermission(body: any) {
  const {
    company_id,
    collaborator_id,
    role,
    daily_dispatch_limit = 0,
    allowed_templates = [],
    requester_role,
  } = body;

  if (requester_role !== "ceo") {
    return json({ error: "Apenas o CEO pode definir permissões" }, 403);
  }

  if (!collaborator_id || !role) {
    return json({ error: "collaborator_id e role são obrigatórios" }, 400);
  }

  const validRoles = ["ceo", "director", "manager", "collaborator"];
  if (!validRoles.includes(role)) {
    return json({ error: `Role inválido. Use: ${validRoles.join(", ")}` }, 400);
  }

  const isCeo = role === "ceo";
  const isDirector = role === "director";

  const { data, error } = await supabase
    .from("dispatch_permissions")
    .upsert(
      {
        company_id,
        collaborator_id,
        role,
        daily_dispatch_limit,
        daily_dispatches_used: 0,
        last_reset_at: new Date().toISOString().split("T")[0],
        allowed_templates: JSON.stringify(allowed_templates),
        can_create_templates: isCeo,
        can_edit_templates: isCeo,
        can_view_config: isCeo,
        can_manage_opt_ins: isCeo,
        can_view_quality: isCeo || isDirector,
        can_distribute_leads: isCeo,
        can_dispatch: true,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,collaborator_id" }
    )
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);
  return json({ success: true, permission: data });
}

/**
 * Buscar permissão de um colaborador
 */
async function getPermission(body: any) {
  const { company_id, collaborator_id } = body;

  // Validar UUID
  if (!collaborator_id || collaborator_id === "null" || collaborator_id === null) {
    return json({ error: "collaborator_id inválido", permissions: null }, 200);
  }

  const { data, error } = await supabase
    .from("dispatch_permissions")
    .select("*")
    .eq("company_id", company_id)
    .eq("collaborator_id", collaborator_id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: "Sem permissão configurada" }, 404);

  // Reset diário se necessário
  const today = new Date().toISOString().split("T")[0];
  if (data.last_reset_at < today) {
    await supabase
      .from("dispatch_permissions")
      .update({ daily_dispatches_used: 0, last_reset_at: today })
      .eq("id", data.id);
    data.daily_dispatches_used = 0;
  }

  return json({ permission: data });
}

/**
 * Listar todas permissões da empresa (CEO only)
 */
async function listPermissions(body: any) {
  const { company_id, requester_role } = body;

  if (requester_role !== "ceo" && requester_role !== "director") {
    return json({ error: "Sem acesso" }, 403);
  }

  const { data, error } = await supabase
    .from("dispatch_permissions")
    .select("*")
    .eq("company_id", company_id)
    .eq("is_active", true)
    .order("role");

  if (error) return json({ error: error.message }, 500);
  return json({ permissions: data });
}

/**
 * Verificar se colaborador pode disparar
 * Chamado pelo smart-dispatcher antes de cada envio
 */
async function checkDispatch(body: any) {
  const { collaborator_id, template_name } = body;

  // Usar RPC do banco que já tem toda lógica
  const { data, error } = await supabase.rpc("can_collaborator_dispatch", {
    p_collaborator_id: collaborator_id,
    p_template_name: template_name || null,
  });

  if (error) return json({ error: error.message }, 500);
  return json(data);
}

/**
 * Atualizar limite diário (CEO only)
 */
async function updateLimit(body: any) {
  const { company_id, collaborator_id, daily_dispatch_limit, requester_role } = body;

  if (requester_role !== "ceo") {
    return json({ error: "Apenas o CEO pode alterar limites" }, 403);
  }

  const { data, error } = await supabase
    .from("dispatch_permissions")
    .update({
      daily_dispatch_limit,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", company_id)
    .eq("collaborator_id", collaborator_id)
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);
  return json({ success: true, permission: data });
}

/**
 * CEO define quais templates o colaborador pode usar
 */
async function setAllowedTemplates(body: any) {
  const { company_id, collaborator_id, allowed_templates, requester_role } = body;

  if (requester_role !== "ceo") {
    return json({ error: "Apenas o CEO pode definir templates" }, 403);
  }

  // Validar que todos os templates existem e estão aprovados
  const { data: templates } = await supabase
    .from("whatsapp_meta_templates")
    .select("name, status")
    .eq("company_id", company_id)
    .in("name", allowed_templates);

  const approvedNames = (templates || [])
    .filter((t: any) => t.status === "APPROVED")
    .map((t: any) => t.name);

  const rejected = allowed_templates.filter(
    (t: string) => !approvedNames.includes(t)
  );

  if (rejected.length > 0) {
    return json({
      error: `Templates não aprovados ou inexistentes: ${rejected.join(", ")}`,
    }, 400);
  }

  const { data, error } = await supabase
    .from("dispatch_permissions")
    .update({
      allowed_templates: JSON.stringify(approvedNames),
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", company_id)
    .eq("collaborator_id", collaborator_id)
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);
  return json({ success: true, permission: data, approved_templates: approvedNames });
}

/**
 * Desativar colaborador
 */
async function deactivate(body: any) {
  const { company_id, collaborator_id, requester_role } = body;

  if (requester_role !== "ceo") {
    return json({ error: "Apenas o CEO pode desativar" }, 403);
  }

  const { error } = await supabase
    .from("dispatch_permissions")
    .update({ is_active: false, can_dispatch: false, updated_at: new Date().toISOString() })
    .eq("company_id", company_id)
    .eq("collaborator_id", collaborator_id);

  if (error) return json({ error: error.message }, 500);
  return json({ success: true });
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
