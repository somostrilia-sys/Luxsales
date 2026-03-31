/**
 * register-collaborator
 * Cria auth user + collaborator a partir de registro via convite (Register.tsx / Registro.tsx)
 * Diferente do accept-invite: recebe campos extras (phone, whatsapp, sector, units, reports_to)
 */
import { corsHeaders, json, corsResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";

interface RegisterRequest {
  name: string;
  email: string;
  phone?: string;
  whatsapp?: string;
  company_id: string;
  role_id: string;
  sector_id?: string;
  unit_id?: string;
  unit_ids?: string[];
  reports_to?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const body: RegisterRequest = await req.json();
    const { name, email, phone, whatsapp, company_id, role_id, sector_id, unit_id, unit_ids, reports_to } = body;

    if (!name || !email || !company_id || !role_id) {
      return json({ error: "Campos obrigatórios: name, email, company_id, role_id" }, 400);
    }

    const supabase = getServiceClient();

    // Check if email already exists as collaborator
    const { data: existing } = await supabase
      .from("collaborators")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return json({ error: "Este email já está cadastrado." }, 409);
    }

    // Generate a random password
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, company_id, role_id },
    });

    if (authError || !authData.user) {
      return json({ error: authError?.message || "Erro ao criar usuário." }, 400);
    }

    const userId = authData.user.id;

    // Insert collaborator record
    const collabData: Record<string, unknown> = {
      auth_user_id: userId,
      company_id,
      role_id,
      name,
      email,
      phone: phone || null,
      whatsapp: whatsapp || null,
      active: true,
    };

    if (sector_id) collabData.sector_id = sector_id;
    if (unit_id) collabData.unit_id = unit_id;
    if (unit_ids?.length) collabData.unit_ids = unit_ids;
    if (reports_to) collabData.reports_to = reports_to;

    const { data: newCollab, error: collabError } = await supabase
      .from("collaborators")
      .insert(collabData)
      .select("id")
      .single();

    if (collabError) {
      // Rollback auth user
      await supabase.auth.admin.deleteUser(userId);
      return json({ error: "Erro ao criar colaborador: " + collabError.message }, 500);
    }

    // Apply default permissions based on role level
    const { data: role } = await supabase
      .from("roles")
      .select("level")
      .eq("id", role_id)
      .maybeSingle();

    if (role && newCollab) {
      const level = role.level;
      const modules = ["leads", "dialer", "conversations", "templates", "queues", "reports", "config", "team", "whatsapp"];
      const perms = modules.map(mod => {
        const p: Record<string, unknown> = {
          collaborator_id: newCollab.id,
          company_id,
          module: mod,
          can_view: level <= 3,
          can_edit: level <= 2,
          can_delete: level <= 1,
        };
        return p;
      });

      await supabase.from("user_permissions").insert(perms);
    }

    return json({
      ok: true,
      collaborator_id: newCollab?.id,
      user_id: userId,
      password,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno.";
    return json({ error: msg }, 500);
  }
});
