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
    const { action } = body;

    // === DASHBOARD: resumo financeiro por período ===
    if (action === "dashboard") {
      const { date_from, date_to } = body;
      const from = date_from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
      const to = date_to || new Date().toISOString().slice(0, 10);

      // Total atendimentos no período
      const { data: orders, count: totalOrders } = await supabase
        .from("service_orders")
        .select("service_rate", { count: "exact" })
        .eq("status", "completed")
        .gte("completed_at", from)
        .lte("completed_at", to + "T23:59:59Z");

      const custoTotal = (orders || []).reduce((s: number, o: any) => s + (Number(o.service_rate) || 0), 0);

      // Custos operacionais
      const { data: custos } = await supabase
        .from("trilho_custos_operacionais")
        .select("categoria, valor")
        .gte("data", from)
        .lte("data", to);

      const custoOp = (custos || []).reduce((s: number, c: any) => s + (Number(c.valor) || 0), 0);
      const custosPorCategoria: Record<string, number> = {};
      for (const c of custos || []) {
        custosPorCategoria[c.categoria] = (custosPorCategoria[c.categoria] || 0) + Number(c.valor);
      }

      // Fechamentos
      const { data: fechamentos } = await supabase
        .from("trilho_fechamentos")
        .select("status, valor_liquido")
        .gte("date_from", from)
        .lte("date_to", to);

      const totalPago = (fechamentos || []).filter((f: any) => f.status === "pago").reduce((s: number, f: any) => s + Number(f.valor_liquido), 0);
      const totalAprovado = (fechamentos || []).filter((f: any) => f.status === "aprovado").reduce((s: number, f: any) => s + Number(f.valor_liquido), 0);
      const totalAberto = (fechamentos || []).filter((f: any) => f.status === "aberto").reduce((s: number, f: any) => s + Number(f.valor_liquido), 0);

      // Top 5 prestadores
      const { data: topTechs } = await supabase.rpc("show_limit").maybeSingle(); // fallback
      let topPrestadores: any[] = [];
      const { data: allOrders } = await supabase
        .from("service_orders")
        .select("technician_id, service_rate")
        .eq("status", "completed")
        .gte("completed_at", from)
        .lte("completed_at", to + "T23:59:59Z");

      const techTotals: Record<string, { count: number; value: number }> = {};
      for (const o of allOrders || []) {
        if (!o.technician_id) continue;
        if (!techTotals[o.technician_id]) techTotals[o.technician_id] = { count: 0, value: 0 };
        techTotals[o.technician_id].count++;
        techTotals[o.technician_id].value += Number(o.service_rate) || 0;
      }

      const sorted = Object.entries(techTotals).sort((a, b) => b[1].value - a[1].value).slice(0, 5);
      for (const [tid, totals] of sorted) {
        const { data: tech } = await supabase.from("technicians").select("name, city").eq("id", tid).single();
        topPrestadores.push({ id: tid, name: tech?.name, city: tech?.city, ...totals });
      }

      return json({
        periodo: { de: from, ate: to },
        atendimentos: { total: totalOrders || 0, custo_prestadores: custoTotal },
        custos_operacionais: { total: custoOp, por_categoria: custosPorCategoria },
        fechamentos: { pago: totalPago, aprovado: totalAprovado, aberto: totalAberto },
        top_prestadores: topPrestadores,
      });
    }

    // === GERAR_FECHAMENTO: gerar fechamento mensal de um prestador ===
    if (action === "gerar_fechamento") {
      const { technician_id, mes_referencia, date_from, date_to } = body;
      if (!technician_id || !mes_referencia || !date_from || !date_to) {
        return json({ error: "technician_id, mes_referencia, date_from, date_to obrigatórios" }, 400);
      }

      // Verificar se já existe
      const { data: existing } = await supabase
        .from("trilho_fechamentos")
        .select("id, status")
        .eq("technician_id", technician_id)
        .eq("mes_referencia", mes_referencia)
        .maybeSingle();

      if (existing) return json({ error: "Fechamento já existe para este mês", fechamento_id: existing.id, status: existing.status }, 409);

      // Buscar atendimentos do prestador no período
      const { data: orders } = await supabase
        .from("service_orders")
        .select("id, service_number, client_name, vehicle_plate, service_rate, completed_at")
        .eq("technician_id", technician_id)
        .eq("status", "completed")
        .gte("completed_at", date_from)
        .lte("completed_at", date_to + "T23:59:59Z")
        .order("completed_at");

      const totalAtendimentos = (orders || []).length;
      const valorTotal = (orders || []).reduce((s: number, o: any) => s + (Number(o.service_rate) || 0), 0);

      // Criar fechamento
      const { data: fechamento, error } = await supabase
        .from("trilho_fechamentos")
        .insert({
          technician_id,
          mes_referencia,
          date_from,
          date_to,
          total_atendimentos: totalAtendimentos,
          valor_total: valorTotal,
          valor_liquido: valorTotal, // sem descontos ainda
          status: "aberto",
        })
        .select()
        .single();

      if (error) return json({ error: error.message }, 500);

      // Criar items do fechamento (1 por atendimento)
      const items = (orders || []).map((o: any) => ({
        fechamento_id: fechamento.id,
        service_order_id: o.id,
        descricao: `OS ${o.service_number} - ${o.client_name} (${o.vehicle_plate})`,
        tipo: "atendimento",
        valor: Number(o.service_rate) || 0,
      }));

      if (items.length > 0) {
        await supabase.from("trilho_fechamento_items").insert(items);
      }

      return json({ ok: true, fechamento, total_items: items.length });
    }

    // === GERAR_TODOS: gerar fechamento de TODOS prestadores do período ===
    if (action === "gerar_todos") {
      const { mes_referencia, date_from, date_to } = body;
      if (!mes_referencia || !date_from || !date_to) {
        return json({ error: "mes_referencia, date_from, date_to obrigatórios" }, 400);
      }

      // Buscar todos prestadores ativos
      const { data: techs } = await supabase
        .from("technicians")
        .select("id, name")
        .eq("status", "active");

      let gerados = 0;
      let existentes = 0;
      const erros: string[] = [];

      for (const tech of techs || []) {
        const { data: existing } = await supabase
          .from("trilho_fechamentos")
          .select("id")
          .eq("technician_id", tech.id)
          .eq("mes_referencia", mes_referencia)
          .maybeSingle();

        if (existing) { existentes++; continue; }

        const { data: orders } = await supabase
          .from("service_orders")
          .select("id, service_number, client_name, vehicle_plate, service_rate")
          .eq("technician_id", tech.id)
          .eq("status", "completed")
          .gte("completed_at", date_from)
          .lte("completed_at", date_to + "T23:59:59Z");

        if (!orders || orders.length === 0) continue;

        const valorTotal = orders.reduce((s: number, o: any) => s + (Number(o.service_rate) || 0), 0);

        const { data: fech, error } = await supabase
          .from("trilho_fechamentos")
          .insert({ technician_id: tech.id, mes_referencia, date_from, date_to, total_atendimentos: orders.length, valor_total: valorTotal, valor_liquido: valorTotal, status: "aberto" })
          .select().single();

        if (error) { erros.push(tech.name + ": " + error.message); continue; }

        const items = orders.map((o: any) => ({
          fechamento_id: fech.id, service_order_id: o.id,
          descricao: `OS ${o.service_number} - ${o.client_name} (${o.vehicle_plate})`,
          tipo: "atendimento", valor: Number(o.service_rate) || 0,
        }));
        await supabase.from("trilho_fechamento_items").insert(items);
        gerados++;
      }

      return json({ ok: true, gerados, existentes, erros });
    }

    // === LISTAR_FECHAMENTOS: lista fechamentos com filtro ===
    if (action === "listar_fechamentos") {
      const { mes_referencia, status: filterStatus, search } = body;

      let query = supabase
        .from("trilho_fechamentos")
        .select("*, technicians(name, city, phone, pix_key)")
        .order("created_at", { ascending: false });

      if (mes_referencia) query = query.eq("mes_referencia", mes_referencia);
      if (filterStatus) query = query.eq("status", filterStatus);

      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);

      let result = data || [];
      if (search) {
        const s = search.toLowerCase();
        result = result.filter((f: any) => f.technicians?.name?.toLowerCase().includes(s));
      }

      const resumo = {
        total: result.length,
        aberto: result.filter((f: any) => f.status === "aberto").length,
        aprovado: result.filter((f: any) => f.status === "aprovado").length,
        pago: result.filter((f: any) => f.status === "pago").length,
        valor_total: result.reduce((s: number, f: any) => s + Number(f.valor_liquido), 0),
      };

      return json({ fechamentos: result, resumo });
    }

    // === APROVAR / PAGAR / CANCELAR ===
    if (action === "aprovar" || action === "pagar" || action === "cancelar") {
      const { fechamento_id, aprovado_por, comprovante_url, observacoes } = body;
      if (!fechamento_id) return json({ error: "fechamento_id obrigatório" }, 400);

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (action === "aprovar") {
        updates.status = "aprovado";
        updates.aprovado_por = aprovado_por || "admin";
        updates.aprovado_em = new Date().toISOString();
      } else if (action === "pagar") {
        updates.status = "pago";
        updates.pago_em = new Date().toISOString();
        if (comprovante_url) updates.comprovante_url = comprovante_url;
      } else {
        updates.status = "cancelado";
      }

      if (observacoes) updates.observacoes = observacoes;

      const { data, error } = await supabase
        .from("trilho_fechamentos")
        .update(updates)
        .eq("id", fechamento_id)
        .select()
        .single();

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, fechamento: data });
    }

    // === AJUSTAR: adicionar desconto/acréscimo a um fechamento ===
    if (action === "ajustar") {
      const { fechamento_id, tipo, descricao, valor } = body;
      if (!fechamento_id || !tipo || !valor) return json({ error: "fechamento_id, tipo, valor obrigatórios" }, 400);

      const { error: itemErr } = await supabase
        .from("trilho_fechamento_items")
        .insert({ fechamento_id, descricao: descricao || tipo, tipo, valor: Number(valor) });

      if (itemErr) return json({ error: itemErr.message }, 500);

      // Recalcular valor líquido
      const { data: items } = await supabase
        .from("trilho_fechamento_items")
        .select("tipo, valor")
        .eq("fechamento_id", fechamento_id);

      let total = 0;
      for (const item of items || []) {
        const v = Number(item.valor) || 0;
        if (item.tipo === "desconto" || item.tipo === "multa") total -= Math.abs(v);
        else total += v;
      }

      await supabase.from("trilho_fechamentos").update({
        valor_liquido: total,
        descontos: (items || []).filter((i: any) => i.tipo === "desconto" || i.tipo === "multa").reduce((s: number, i: any) => s + Math.abs(Number(i.valor)), 0),
        acrescimos: (items || []).filter((i: any) => i.tipo === "acrescimo" || i.tipo === "bonus").reduce((s: number, i: any) => s + Number(i.valor), 0),
        updated_at: new Date().toISOString(),
      }).eq("id", fechamento_id);

      return json({ ok: true, valor_liquido: total });
    }

    // === CUSTOS: registrar custo operacional ===
    if (action === "registrar_custo") {
      const { categoria, descricao, valor, data: dataStr, technician_id, service_order_id } = body;
      if (!categoria || !valor || !dataStr) return json({ error: "categoria, valor, data obrigatórios" }, 400);

      const { data, error } = await supabase
        .from("trilho_custos_operacionais")
        .insert({ categoria, descricao, valor: Number(valor), data: dataStr, technician_id, service_order_id })
        .select().single();

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, custo: data });
    }

    // === EXPORT_FECHAMENTOS: exportar CSV ===
    if (action === "export_fechamentos") {
      const { mes_referencia } = body;

      let query = supabase
        .from("trilho_fechamentos")
        .select("*, technicians(name, city, phone, pix_key)")
        .order("technicians(name)");

      if (mes_referencia) query = query.eq("mes_referencia", mes_referencia);

      const { data } = await query;

      const headers = "Prestador;Cidade;Telefone;PIX;Atendimentos;Valor Bruto;Descontos;Acréscimos;Valor Líquido;Status";
      const rows = (data || []).map((f: any) =>
        [f.technicians?.name, f.technicians?.city, f.technicians?.phone, f.technicians?.pix_key,
         f.total_atendimentos, f.valor_total, f.descontos, f.acrescimos, f.valor_liquido, f.status].join(";")
      );

      return new Response([headers, ...rows].join("\n"), {
        headers: { ...cors, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="fechamento_${mes_referencia || "geral"}.csv"` },
      });
    }

    return json({ error: "action inválida" }, 400);

  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
