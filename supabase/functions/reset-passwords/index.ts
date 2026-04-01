import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
      },
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { secret } = await req.json();
    if (secret !== "walk-reset-2026") {
      return json({ error: "Unauthorized" }, 401);
    }

    const DEFAULT_PASSWORD = "Walk@2026";

    // Get all non-CEO active collaborators with auth_user_id
    const { data: collabs, error: fetchErr } = await supabase
      .from("collaborators")
      .select("auth_user_id, name, email, role:roles!collaborators_role_id_fkey(level)")
      .eq("active", true)
      .not("auth_user_id", "is", null);

    if (fetchErr) return json({ error: fetchErr.message }, 500);

    const nonCeo = (collabs || []).filter((c: any) => c.role?.level > 0);

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const c of nonCeo) {
      const { error: updateErr } = await supabase.auth.admin.updateUserById(
        c.auth_user_id,
        { password: DEFAULT_PASSWORD }
      );

      if (updateErr) {
        failed++;
        errors.push(`${c.name} (${c.email}): ${updateErr.message}`);
      } else {
        success++;
      }
    }

    // Set must_change_password for all non-CEO
    const ids = nonCeo.map((c: any) => c.auth_user_id);
    await supabase
      .from("collaborators")
      .update({ must_change_password: true })
      .in("auth_user_id", ids);

    return json({ ok: true, success, failed, errors, total: nonCeo.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return json({ error: msg }, 500);
  }
});
