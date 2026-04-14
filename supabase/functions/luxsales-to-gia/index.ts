/**
 * luxsales-to-gia — Bridge LuxSales → GIA Objetivo
 *
 * Actions:
 * - buscar-placa: Busca dados do veículo pela placa (via GIA edge function)
 * - criar-lead: Cria negociação no GIA a partir de lead LuxSales
 * - status: Verifica status de negociação no GIA
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// GIA Supabase (projeto separado)
const GIA_SUPABASE_URL = "https://dxuoppekxgvdqnytftho.supabase.co";
const GIA_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4dW9wcGVreGd2ZHFueXRmdGhvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDU0NjQ2OCwiZXhwIjoyMDkwMTIyNDY4fQ.I3dSRiTKnNwPhOfO0F_SsqWgRHcYUZSSyPTAlPg7y7k";
const GIA_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4dW9wcGVreGd2ZHFueXRmdGhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDY0NjgsImV4cCI6MjA5MDEyMjQ2OH0.zWd4BbybchXBh3oRBtI8AI_wFIyD9Yzbe_U4ultcJbU";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const luxSupa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const giaSupa = createClient(GIA_SUPABASE_URL, GIA_SERVICE_KEY);

  const body = await req.json().catch(() => ({}));
  const action = body.action;

  // ── BUSCAR PLACA ──────────────────────────────────────────────────
  if (action === "buscar-placa") {
    const placa = body.placa;
    if (!placa) return json({ error: "placa required" }, 400);

    try {
      const res = await fetch(`${GIA_SUPABASE_URL}/functions/v1/gia-buscar-placa`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GIA_ANON_KEY}`,
          apikey: GIA_ANON_KEY,
        },
        body: JSON.stringify({ acao: "placa", placa }),
      });
      const data = await res.json();
      return json(data);
    } catch (err) {
      return json({ error: "Erro ao buscar placa", detail: String(err) }, 502);
    }
  }

  // ── CRIAR LEAD NO GIA ─────────────────────────────────────────────
  if (action === "criar-lead") {
    const {
      lead_name,
      phone,
      email,
      placa,
      veiculo_marca,
      veiculo_modelo,
      veiculo_ano,
      valor_fipe,
      company_id,
      collaborator_id,
      luxsales_lead_id,
    } = body;

    if (!lead_name || !phone) {
      return json({ error: "lead_name e phone são obrigatórios" }, 400);
    }

    // 1. Buscar placa se fornecida
    let veiculoData: Record<string, unknown> = {};
    if (placa) {
      try {
        const res = await fetch(`${GIA_SUPABASE_URL}/functions/v1/gia-buscar-placa`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GIA_ANON_KEY}`,
            apikey: GIA_ANON_KEY,
          },
          body: JSON.stringify({ acao: "placa", placa }),
        });
        const pData = await res.json();
        if (pData && !pData.error) {
          const marca = pData.marca || pData.MARCA || veiculo_marca || "";
          const modelo = pData.modelo || pData.MODELO || veiculo_modelo || "";
          veiculoData = {
            veiculo_placa: placa.toUpperCase(),
            veiculo_modelo: `${marca} ${modelo}`.trim(),
            ano_modelo: pData.anoModelo || pData.ano || veiculo_ano || null,
            ano_fabricacao: pData.anoFabricacao || null,
            chassi: pData.chassi || null,
            renavam: pData.renavam || null,
            combustivel: pData.combustivel || pData.extra?.combustivel || null,
            cor: pData.cor || null,
            cache_fipe: pData.valorFipe ? { valor: pData.valorFipe, codigo: pData.codFipe || "" } : null,
          };
        }
      } catch {
        // Segue sem dados do veículo
      }
    }

    // 2. Criar negociação no GIA (company_id nullable no GIA)
    const negociacao: Record<string, unknown> = {
      lead_nome: lead_name,
      telefone: phone,
      email: email || null,
      stage: "novo_lead",
      origem: "luxsales",
      observacoes: `Origem: LuxSales (lead_id=${luxsales_lead_id || "manual"})`,
      ...veiculoData,
    };

    const { data: neg, error: negErr } = await giaSupa
      .from("negociacoes")
      .insert(negociacao)
      .select("id, stage, lead_nome, veiculo_placa, veiculo_modelo")
      .single();

    if (negErr) {
      return json({
        error: "Erro ao criar negociação no GIA",
        detail: negErr.message,
      }, 500);
    }

    // 4. Atualizar LuxSales — marcar lead como sincronizado com GIA
    if (luxsales_lead_id) {
      await luxSupa
        .from("leads_master")
        .update({
          synced_to_gia: true,
          gia_lead_id: neg.id,
        })
        .eq("id", luxsales_lead_id);
    }

    // 5. Gerar link da cotação pública (se tiver placa + valor FIPE)
    let cotacaoUrl = null;
    if (neg.id) {
      cotacaoUrl = `https://gia.app.br/cotacao/${neg.id}`;
    }

    return json({
      success: true,
      negociacao_id: neg.id,
      stage: neg.stage,
      veiculo: {
        placa: neg.veiculo_placa,
        modelo: neg.veiculo_modelo,
      },
      cotacao_url: cotacaoUrl,
      gia_url: `https://gia.app.br/vendas`,
    });
  }

  // ── STATUS ────────────────────────────────────────────────────────
  if (action === "status") {
    const negociacao_id = body.negociacao_id;
    if (!negociacao_id) return json({ error: "negociacao_id required" }, 400);

    const { data, error } = await giaSupa
      .from("negociacoes")
      .select("id, stage, lead_nome, veiculo_placa, veiculo_marca, veiculo_modelo, veiculo_valor_fipe, created_at")
      .eq("id", negociacao_id)
      .single();

    if (error) return json({ error: "Negociação não encontrada" }, 404);
    return json(data);
  }

  return json({ error: "action required: buscar-placa, criar-lead, status" }, 400);
});
