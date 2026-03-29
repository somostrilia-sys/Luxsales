import { corsHeaders, json, corsResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";

interface AcceptInviteRequest {
  token: string;
  name: string;
  email: string;
  password: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const body: AcceptInviteRequest = await req.json();
    const { token, name, email, password } = body;

    if (!token || !name || !email || !password) {
      return json({ ok: false, error: "Campos obrigatórios ausentes." }, 400);
    }

    const supabase = getServiceClient();

    // Validate the invite token
    const { data: invite, error: inviteError } = await supabase
      .from("invite_links")
      .select("id, company_id, role_id, unit_id, max_uses, used_count, expires_at, active, permissions")
      .eq("token", token)
      .eq("active", true)
      .maybeSingle();

    if (inviteError || !invite) {
      return json({ ok: false, error: "Convite inválido ou não encontrado." }, 404);
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return json({ ok: false, error: "Este convite expirou." }, 400);
    }

    if (invite.max_uses !== null && invite.used_count >= invite.max_uses) {
      return json({ ok: false, error: "Este convite atingiu o limite de usos." }, 400);
    }

    // Create the auth user via Admin API
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      const msg = authError?.message || "Erro ao criar usuário.";
      return json({ ok: false, error: msg }, 400);
    }

    const userId = authData.user.id;

    // Insert collaborator record
    const { error: collabError } = await supabase
      .from("collaborators")
      .insert({
        auth_user_id: userId,
        company_id: invite.company_id,
        role_id: invite.role_id,
        unit_id: invite.unit_id || null,
        name,
        email,
        active: true,
      });

    if (collabError) {
      // Rollback auth user
      await supabase.auth.admin.deleteUser(userId);
      return json({ ok: false, error: "Erro ao criar colaborador: " + collabError.message }, 500);
    }

    // Fetch the new collaborator id
    const { data: newCollab } = await supabase
      .from("collaborators")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();

    // Insert permissions from invite
    const permissions: Array<{ module: string; can_view?: boolean; can_edit?: boolean; can_delete?: boolean }> =
      invite.permissions || [];

    if (newCollab && permissions.length > 0) {
      const permRows = permissions.map((p) => ({
        collaborator_id: newCollab.id,
        company_id: invite.company_id,
        module: p.module,
        can_view: p.can_view ?? true,
        can_edit: p.can_edit ?? false,
        can_delete: p.can_delete ?? false,
      }));

      await supabase.from("user_permissions").insert(permRows);
    }

    // Increment used_count on the invite
    await supabase
      .from("invite_links")
      .update({ used_count: invite.used_count + 1 })
      .eq("id", invite.id);

    return json({ ok: true, user_id: userId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno.";
    return json({ ok: false, error: msg }, 500);
  }
});
