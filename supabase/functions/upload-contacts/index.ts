import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]/g, "_"));

  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = line.split(sep).map(v => v.trim().replace(/^["']+|["']+$/g, ""));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ""; });
    return obj;
  });
}

function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const full = digits.startsWith("55") ? digits : "55" + digits;
  return full.length >= 12 && full.length <= 13 ? full : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json();
    const { action, collaborator_id, company_id, csv_data, batch_name } = body;

    if (action === "template") {
      return json({
        template: {
          headers: ["nome", "telefone", "cidade", "estado", "fonte", "observacao"],
          example: [
            ["João Silva", "(11) 99999-1234", "São Paulo", "SP", "Indicação", "Cliente do Carlos"],
            ["Maria Santos", "11988887777", "Campinas", "SP", "Instagram", ""],
            ["Pedro Oliveira", "+55 13 98765-4321", "Santos", "SP", "Planilha antiga", "Já tem proteção"],
          ],
          notes: "Campos obrigatórios: nome, telefone. Aceita CSV (vírgula, ponto-e-vírgula ou tab).",
        }
      });
    }

    if (action === "upload") {
      if (!collaborator_id) return json({ error: "collaborator_id obrigatório" }, 400);
      if (!csv_data) return json({ error: "csv_data obrigatório" }, 400);

      const rows = parseCSV(csv_data);
      if (rows.length === 0) return json({ error: "Nenhum contato encontrado na planilha" }, 400);

      // Buscar company_id do colaborador se não informado
      let resolvedCompanyId = company_id;
      if (!resolvedCompanyId) {
        const { data: collab } = await supabase
          .from("collaborators")
          .select("company_id")
          .eq("id", collaborator_id)
          .single();
        resolvedCompanyId = collab?.company_id;
        if (!resolvedCompanyId) return json({ error: "Colaborador sem empresa vinculada" }, 400);
      }

      const { data: batch, error: batchErr } = await supabase
        .from("lead_batches")
        .insert({
          created_by: collaborator_id,
          assigned_to: collaborator_id,
          company_id: resolvedCompanyId,
          quantidade: rows.length,
          filtro_fonte: batch_name || "Upload planilha",
          status: "distribuido",
        })
        .select()
        .single();

      if (batchErr) return json({ error: "Erro ao criar batch: " + batchErr.message }, 500);

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];
      const inserts: any[] = [];

      for (const row of rows) {
        const nome = row.nome || row.name || row.cliente || "";
        const phoneRaw = row.telefone || row.phone || row.celular || row.whatsapp || row.fone || "";
        const cidade = row.cidade || row.city || "";
        const estado = row.estado || row.uf || row.state || "";
        const fonte = row.fonte || row.source || row.origem || batch_name || "Upload";

        const phone = normalizePhone(phoneRaw);
        if (!phone) {
          skipped++;
          if (errors.length < 10) errors.push("Telefone inválido: " + phoneRaw + " (" + (nome || "sem nome") + ")");
          continue;
        }

        inserts.push({
          batch_id: batch!.id,
          assigned_to: collaborator_id,
          company_id: resolvedCompanyId,
          nome: nome || "Sem nome",
          telefone: phone,
          cidade: cidade || null,
          estado: estado || null,
          ddd: phone.slice(2, 4),
          fonte: fonte,
          status: "disponivel",
        });
      }

      if (inserts.length > 0) {
        const { error: insertErr } = await supabase.from("lead_items").insert(inserts);
        if (insertErr) return json({ error: "Erro ao inserir leads: " + insertErr.message }, 500);
        imported = inserts.length;
      }

      await supabase.from("lead_batches").update({ quantidade: imported }).eq("id", batch!.id);

      return json({ ok: true, batch_id: batch!.id, imported, skipped, total: rows.length, errors });
    }

    return json({ error: "action inválida. Use: template, upload" }, 400);

  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
