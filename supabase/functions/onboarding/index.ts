/**
 * onboarding — Edge Function
 * Gerencia organizações multi-tenant: CRUD de orgs, setup WhatsApp
 * Actions: list-organizations, create-organization, update-organization, setup-whatsapp
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, Authorization",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Extrai user_id do JWT Bearer */
async function getUserFromToken(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );
  const { data } = await authClient.auth.getUser(token);
  return data?.user?.id ?? null;
}

/** Verifica se user é CEO/director (role level <= 1) */
async function isCeoOrDirector(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("collaborators")
    .select("role_id, is_super_admin, roles!inner(level)")
    .eq("auth_user_id", userId)
    .eq("active", true)
    .limit(1)
    .single();
  if (!data) return false;
  if (data.is_super_admin) return true;
  return (data as any).roles?.level != null && (data as any).roles.level <= 1;
}

/** Verifica se user é owner/admin da org interna */
async function isInternalAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("organization_members")
    .select("role, organizations!inner(type)")
    .eq("user_id", userId)
    .in("role", ["owner", "admin"]);
  return data?.some((m: any) => m.organizations?.type === "internal") ?? false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // Auth: extrair user do token
    const userId = await getUserFromToken(req);
    if (!userId) {
      return json({ error: "Não autenticado" }, 401);
    }

    // Verificar permissão: CEO/director ou admin de org interna
    const [ceo, intAdmin] = await Promise.all([
      isCeoOrDirector(userId),
      isInternalAdmin(userId),
    ]);
    if (!ceo && !intAdmin) {
      return json({ error: "Sem permissão. Apenas CEO/admin pode gerenciar organizações." }, 403);
    }

    switch (action) {
      case "list-organizations":
        return await listOrganizations(userId);
      case "create-organization":
        return await createOrganization(body);
      case "update-organization":
        return await updateOrganization(body);
      case "setup-whatsapp":
        return await setupWhatsApp(body);
      default:
        return json({ error: `Action inválida: ${action}` }, 400);
    }
  } catch (err: any) {
    return json({ error: err.message || "Erro interno" }, 500);
  }
});

// ─── LIST ORGANIZATIONS ────────────────────────────────────────────

async function listOrganizations(_userId: string) {
  // Busca todas as orgs (CEO interno vê tudo)
  const { data: orgs, error } = await supabase
    .from("organizations")
    .select("*")
    .order("type", { ascending: true })
    .order("name", { ascending: true });

  if (error) return json({ error: error.message }, 500);

  // Enriquecer com contagens
  const enriched = await Promise.all(
    (orgs || []).map(async (org: any) => {
      const [companiesRes, membersRes, waRes] = await Promise.all([
        supabase
          .from("organization_companies")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org.id),
        supabase
          .from("organization_members")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org.id),
        supabase
          .from("organization_companies")
          .select("company_id")
          .eq("organization_id", org.id)
          .limit(100),
      ]);

      // Checar se alguma company tem WhatsApp
      let hasWhatsapp = false;
      const companyIds = (waRes.data || []).map((c: any) => c.company_id);
      if (companyIds.length > 0) {
        const { data: creds } = await supabase
          .from("whatsapp_meta_credentials")
          .select("id")
          .in("company_id", companyIds)
          .limit(1);
        hasWhatsapp = (creds?.length ?? 0) > 0;
      }

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        type: org.type,
        is_active: org.is_active,
        plan: org.plan,
        max_companies: org.max_companies,
        created_at: org.created_at,
        company_count: companiesRes.count ?? 0,
        member_count: membersRes.count ?? 0,
        has_whatsapp: hasWhatsapp,
      };
    })
  );

  return json({ organizations: enriched });
}

// ─── CREATE ORGANIZATION ───────────────────────────────────────────

async function createOrganization(body: any) {
  const { name, slug, owner_email, owner_name, segment, plan = "starter" } = body;

  if (!name || !slug) {
    return json({ error: "name e slug são obrigatórios" }, 400);
  }

  // Verificar slug único
  const { data: existing } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existing) {
    return json({ error: `Slug "${slug}" já está em uso` }, 409);
  }

  // Determinar max_companies pelo plano
  const maxMap: Record<string, number> = { starter: 1, professional: 5, enterprise: 100 };

  // 1. Criar organização
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name,
      slug,
      type: "external",
      plan,
      max_companies: maxMap[plan] ?? 1,
      segment: segment || null,
    })
    .select()
    .single();

  if (orgError) return json({ error: orgError.message }, 500);

  // 2. Criar company associada
  const { data: company, error: compError } = await supabase
    .from("companies")
    .insert({
      name,
      segment: segment || null,
      is_active: true,
    })
    .select()
    .single();

  if (compError) return json({ error: compError.message }, 500);

  // 3. Associar company → org
  await supabase.from("organization_companies").insert({
    organization_id: org.id,
    company_id: company.id,
  });

  // 4. Se owner_email fornecido, criar user + collaborator + member
  let ownerUserId: string | null = null;
  if (owner_email) {
    // Verificar se user já existe
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u: any) => u.email?.toLowerCase() === owner_email.toLowerCase()
    );

    if (existingUser) {
      ownerUserId = existingUser.id;
    } else {
      // Criar user com senha temporária
      const tempPass = `Lux${Date.now().toString(36)}!`;
      const { data: newUser, error: userError } = await supabase.auth.admin.createUser({
        email: owner_email,
        password: tempPass,
        email_confirm: true,
        user_metadata: { full_name: owner_name || name },
      });
      if (userError) {
        return json({ error: `Erro ao criar usuário: ${userError.message}` }, 500);
      }
      ownerUserId = newUser.user.id;
    }

    // Criar collaborator se não existe
    const { data: existingCollab } = await supabase
      .from("collaborators")
      .select("id")
      .eq("auth_user_id", ownerUserId)
      .eq("company_id", company.id)
      .single();

    if (!existingCollab) {
      // Buscar ou criar role CEO para a empresa
      let ceoRoleId: string | null = null;
      const { data: ceoRole } = await supabase
        .from("roles")
        .select("id")
        .eq("company_id", company.id)
        .eq("level", 0)
        .limit(1)
        .single();
      if (ceoRole) {
        ceoRoleId = ceoRole.id;
      } else {
        const { data: newRole } = await supabase
          .from("roles")
          .insert({ company_id: company.id, name: "CEO", slug: "ceo", level: 0, active: true })
          .select("id")
          .single();
        ceoRoleId = newRole?.id ?? null;
      }

      await supabase.from("collaborators").insert({
        name: owner_name || owner_email,
        email: owner_email,
        auth_user_id: ownerUserId,
        company_id: company.id,
        role_id: ceoRoleId,
        active: true,
      });
    }

    // Adicionar como owner da org
    await supabase.from("organization_members").insert({
      organization_id: org.id,
      user_id: ownerUserId,
      role: "owner",
    });
  }

  return json({
    success: true,
    organization_id: org.id,
    company_id: company.id,
    owner_user_id: ownerUserId,
  });
}

// ─── UPDATE ORGANIZATION ───────────────────────────────────────────

async function updateOrganization(body: any) {
  const { organization_id, is_active } = body;

  if (!organization_id) {
    return json({ error: "organization_id é obrigatório" }, 400);
  }

  const updates: Record<string, unknown> = {};
  if (typeof is_active === "boolean") updates.is_active = is_active;

  if (Object.keys(updates).length === 0) {
    return json({ error: "Nenhum campo para atualizar" }, 400);
  }

  const { error } = await supabase
    .from("organizations")
    .update(updates)
    .eq("id", organization_id);

  if (error) return json({ error: error.message }, 500);

  return json({ success: true });
}

// ─── SETUP WHATSAPP ────────────────────────────────────────────────

async function setupWhatsApp(body: any) {
  const { company_id, access_token, phone_number_id, waba_id, display_phone } = body;

  if (!company_id || !access_token || !phone_number_id || !waba_id) {
    return json({ error: "company_id, access_token, phone_number_id e waba_id são obrigatórios" }, 400);
  }

  // Upsert credenciais WhatsApp
  const { error } = await supabase
    .from("whatsapp_meta_credentials")
    .upsert(
      {
        company_id,
        access_token,
        phone_number_id,
        waba_id,
        display_phone: display_phone || null,
        is_active: true,
      },
      { onConflict: "company_id" }
    );

  if (error) return json({ error: error.message }, 500);

  return json({ success: true });
}
