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
    const { action, search, technician_id, date_from, date_to, page, per_page, export_csv } = body;

    // === SEARCH: buscar prestadores por nome ===
    if (action === "search") {
      let query = supabase
        .from("technicians")
        .select("id, name, cpf, phone, city, state, status, service_rate, payment_period, pix_key");

      if (search) {
        query = query.ilike("name", `%${search}%`);
      }

      query = query.order("name");

      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);

      // Para cada prestador, contar atendimentos no período
      const enriched = [];
      for (const tech of data || []) {
        let countQuery = supabase
          .from("service_orders")
          .select("id", { count: "exact", head: true })
          .eq("technician_id", tech.id)
          .eq("status", "completed");

        if (date_from) countQuery = countQuery.gte("completed_at", date_from);
        if (date_to) countQuery = countQuery.lte("completed_at", date_to + "T23:59:59Z");

        const { count } = await countQuery;

        // Somar valor
        let sumQuery = supabase
          .from("service_orders")
          .select("service_rate")
          .eq("technician_id", tech.id)
          .eq("status", "completed");

        if (date_from) sumQuery = sumQuery.gte("completed_at", date_from);
        if (date_to) sumQuery = sumQuery.lte("completed_at", date_to + "T23:59:59Z");

        const { data: orders } = await sumQuery;
        const totalValue = (orders || []).reduce((sum: number, o: any) => sum + (Number(o.service_rate) || 0), 0);

        enriched.push({
          ...tech,
          total_atendimentos: count || 0,
          valor_total: totalValue,
        });
      }

      return json({ technicians: enriched });
    }

    // === DETAIL: ver atendimentos detalhados de um prestador ===
    if (action === "detail") {
      if (!technician_id) return json({ error: "technician_id obrigatório" }, 400);

      // Info do prestador
      const { data: tech } = await supabase
        .from("technicians")
        .select("*")
        .eq("id", technician_id)
        .single();

      if (!tech) return json({ error: "Prestador não encontrado" }, 404);

      // Atendimentos com filtro de período
      let query = supabase
        .from("service_orders")
        .select("*")
        .eq("technician_id", technician_id)
        .order("completed_at", { ascending: false });

      if (date_from) query = query.gte("completed_at", date_from);
      if (date_to) query = query.lte("completed_at", date_to + "T23:59:59Z");

      const limit = per_page || 50;
      const offset = ((page || 1) - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      const { data: orders, error, count } = await query;
      if (error) return json({ error: error.message }, 500);

      // Totais
      let totalQuery = supabase
        .from("service_orders")
        .select("service_rate, id", { count: "exact" })
        .eq("technician_id", technician_id)
        .eq("status", "completed");

      if (date_from) totalQuery = totalQuery.gte("completed_at", date_from);
      if (date_to) totalQuery = totalQuery.lte("completed_at", date_to + "T23:59:59Z");

      const { data: allOrders, count: totalCount } = await totalQuery;
      const totalValue = (allOrders || []).reduce((sum: number, o: any) => sum + (Number(o.service_rate) || 0), 0);

      return json({
        technician: tech,
        orders: orders || [],
        summary: {
          total_atendimentos: totalCount || 0,
          valor_total: totalValue,
          periodo: { de: date_from || "início", ate: date_to || "hoje" },
        },
        pagination: { page: page || 1, per_page: limit, total: totalCount || 0 },
      });
    }

    // === EXPORT: exportar CSV dos atendimentos ===
    if (action === "export") {
      if (!technician_id) return json({ error: "technician_id obrigatório" }, 400);

      const { data: tech } = await supabase
        .from("technicians")
        .select("name")
        .eq("id", technician_id)
        .single();

      let query = supabase
        .from("service_orders")
        .select("service_number, client_name, client_phone, client_city, client_state, vehicle_plate, vehicle_model, status, scheduled_at, completed_at, service_rate, notes")
        .eq("technician_id", technician_id)
        .order("completed_at", { ascending: false });

      if (date_from) query = query.gte("completed_at", date_from);
      if (date_to) query = query.lte("completed_at", date_to + "T23:59:59Z");

      const { data: orders } = await query;

      // Gerar CSV
      const headers = "Nº OS;Cliente;Telefone;Cidade;UF;Placa;Veículo;Status;Agendado;Concluído;Valor;Observações";
      const rows = (orders || []).map((o: any) =>
        [o.service_number, o.client_name, o.client_phone, o.client_city, o.client_state,
         o.vehicle_plate, o.vehicle_model, o.status,
         o.scheduled_at ? new Date(o.scheduled_at).toLocaleString("pt-BR") : "",
         o.completed_at ? new Date(o.completed_at).toLocaleString("pt-BR") : "",
         o.service_rate || "0", o.notes || ""].join(";")
      );

      const csv = [headers, ...rows].join("\n");

      return new Response(csv, {
        headers: {
          ...cors,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="atendimentos_${(tech?.name || "prestador").replace(/\s/g, "_")}.csv"`,
        },
      });
    }

    return json({ error: "action inválida. Use: search, detail, export" }, 400);

  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
