/**
 * company-config
 * CRUD de configuração por empresa/segmento
 * Define: persona, tom, vocabulário, schema de extração, produto, prompts
 * Tudo que muda entre segmentos vive aqui
 */
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
      case "get":
        return await getConfig(body);
      case "set":
        return await setConfig(body);
      case "set-slot":
        return await setSlot(body);
      case "list-slots":
        return await listSlots(body);
      case "remove-slot":
        return await removeSlot(body);
      case "build-call-prompt":
        return await buildCallPrompt(body);
      case "build-whatsapp-prompt":
        return await buildWhatsAppPrompt(body);
      default:
        return json({ error: "Action inválida" }, 400);
    }
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});

/**
 * Buscar config da empresa
 */
async function getConfig(body: any) {
  const { company_id } = body;

  const { data, error } = await supabase
    .from("company_config")
    .select("*")
    .eq("company_id", company_id)
    .maybeSingle();

  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: "Config não encontrada" }, 404);

  return json({ config: data });
}

/**
 * CEO configura empresa/segmento
 */
async function setConfig(body: any) {
  const { company_id, requester_role, ...configData } = body;

  if (requester_role !== "ceo") {
    return json({ error: "Apenas o CEO pode configurar" }, 403);
  }

  if (!company_id || !configData.company_name || !configData.segment || !configData.persona_name) {
    return json({ error: "company_id, company_name, segment e persona_name são obrigatórios" }, 400);
  }

  const record: Record<string, any> = {
    company_id,
    company_name: configData.company_name,
    segment: configData.segment,
    segment_display_name: configData.segment_display_name || configData.segment,
    persona_name: configData.persona_name,
    persona_role: configData.persona_role || null,
    persona_company: configData.persona_company || configData.company_name,
    persona_tone: configData.persona_tone || "profissional mas próximo",
    allowed_words: configData.allowed_words || [],
    forbidden_words: configData.forbidden_words || [],
    extraction_schema: configData.extraction_schema || {},
    product_data: configData.product_data || {},
    followup_hours_first: configData.followup_hours_first || 48,
    followup_hours_call: configData.followup_hours_call || 72,
    max_templates_before_call: configData.max_templates_before_call || 2,
    updated_at: new Date().toISOString(),
  };

  // Prompts customizados (se fornecidos)
  if (configData.call_system_prompt) record.call_system_prompt = configData.call_system_prompt;
  if (configData.whatsapp_system_prompt) record.whatsapp_system_prompt = configData.whatsapp_system_prompt;
  if (configData.summary_prompt) record.summary_prompt = configData.summary_prompt;

  const { data, error } = await supabase
    .from("company_config")
    .upsert(record, { onConflict: "company_id" })
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);
  return json({ success: true, config: data });
}

/**
 * Vincular template a um slot do funil
 */
async function setSlot(body: any) {
  const {
    company_id, slot, template_name, variable_mapping,
    use_condition, priority, slot_label, requester_role,
  } = body;

  if (requester_role !== "ceo") {
    return json({ error: "Apenas o CEO pode configurar slots" }, 403);
  }

  if (!slot || !template_name || !variable_mapping) {
    return json({ error: "slot, template_name e variable_mapping são obrigatórios" }, 400);
  }

  // Verificar que o template existe e está aprovado
  const { data: template } = await supabase
    .from("whatsapp_meta_templates")
    .select("id, status")
    .eq("company_id", company_id)
    .eq("name", template_name)
    .maybeSingle();

  if (!template) {
    return json({ error: `Template "${template_name}" não encontrado` }, 400);
  }
  if (template.status !== "APPROVED") {
    return json({ error: `Template "${template_name}" não está aprovado (status: ${template.status})` }, 400);
  }

  const { data, error } = await supabase
    .from("template_slots")
    .upsert(
      {
        company_id,
        slot,
        slot_label: slot_label || slot,
        template_name,
        template_id: template.id,
        variable_mapping,
        use_condition: use_condition || null,
        priority: priority || 1,
        is_active: true,
      },
      { onConflict: "company_id,slot,template_name" }
    )
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);
  return json({ success: true, slot: data });
}

/**
 * Listar slots configurados
 */
async function listSlots(body: any) {
  const { company_id } = body;

  const { data, error } = await supabase
    .from("template_slots")
    .select(`
      *,
      whatsapp_meta_templates:template_id (name, status, category, quality_score)
    `)
    .eq("company_id", company_id)
    .eq("is_active", true)
    .order("slot")
    .order("priority");

  if (error) {
    // Fallback sem join
    const { data: fallback } = await supabase
      .from("template_slots")
      .select("*")
      .eq("company_id", company_id)
      .eq("is_active", true)
      .order("slot");
    return json({ slots: fallback || [] });
  }

  return json({ slots: data || [] });
}

/**
 * Desativar slot
 */
async function removeSlot(body: any) {
  const { company_id, slot_id, requester_role } = body;

  if (requester_role !== "ceo") {
    return json({ error: "Apenas o CEO pode remover slots" }, 403);
  }

  const { error } = await supabase
    .from("template_slots")
    .update({ is_active: false })
    .eq("id", slot_id)
    .eq("company_id", company_id);

  if (error) return json({ error: error.message }, 500);
  return json({ success: true });
}

/**
 * Gerar system prompt pra ligação dinamicamente
 */
async function buildCallPrompt(body: any) {
  const { company_id } = body;

  const { data: config } = await supabase
    .from("company_config")
    .select("*")
    .eq("company_id", company_id)
    .maybeSingle();

  if (!config) return json({ error: "Config não encontrada" }, 404);

  // Se tem prompt customizado, usar ele
  if (config.call_system_prompt) {
    return json({ prompt: config.call_system_prompt });
  }

  // Gerar dinamicamente
  const schema = config.extraction_schema || {};
  const schemaDesc = Object.entries(schema)
    .map(([key, val]: [string, any]) => {
      const req = val.required ? " (obrigatório)" : "";
      const opts = val.options ? ` [${val.options.join(", ")}]` : "";
      return `- ${val.label || key}: ${val.type}${opts}${req}`;
    })
    .join("\n");

  const productDesc = config.product_data
    ? JSON.stringify(config.product_data, null, 2)
    : "Não configurado";

  const forbidden = (config.forbidden_words || []).join(", ");
  const allowed = (config.allowed_words || []).join(", ");

  const prompt = `Você é ${config.persona_name}, ${config.persona_role || "consultor"} da ${config.persona_company}.

TOM DE VOZ: ${config.persona_tone}

${forbidden ? `PALAVRAS PROIBIDAS (nunca use): ${forbidden}` : ""}
${allowed ? `PALAVRAS PREFERIDAS: ${allowed}` : ""}

DADOS QUE VOCÊ DEVE EXTRAIR NATURALMENTE DURANTE A CONVERSA:
${schemaDesc}

PRODUTO/SERVIÇO QUE VOCÊ OFERECE:
${productDesc}

REGRAS DE NATURALIDADE:
1. Fale como um brasileiro real — use "tá", "pra", "né", contrações naturais
2. Comece ~30% das respostas com hesitação: "Olha...", "Então...", "Ah..."
3. Não force perguntas — extraia dados conforme a conversa flui
4. Se o lead perguntar algo que você não sabe, diga "vou verificar"
5. Seja empático com objeções — não confronte, entenda

REGRA OBRIGATÓRIA — FINAL DA CONVERSA:
Nos últimos 30 segundos, SEMPRE pergunte:
"${config.persona_name === config.persona_name ? body.lead_name || "nome" : ""}, posso te mandar pelo WhatsApp os detalhes que a gente conversou?"

Se SIM → incluir no resumo: whatsapp_authorized: true
Se NÃO → incluir: whatsapp_authorized: false, perguntar: "Sem problema! Posso te ligar de novo na semana que vem?"

RESUMO FINAL:
Ao encerrar, gere JSON com: summary, lead_name, extracted_data (conforme schema acima), sentiment, whatsapp_authorized, suggested_template_slot, suggested_template_variables
NÃO inclua transcrição. APENAS o resumo estruturado.`;

  return json({ prompt });
}

/**
 * Gerar system prompt pra WhatsApp dinamicamente
 */
async function buildWhatsAppPrompt(body: any) {
  const { company_id, phone_number } = body;

  const { data: config } = await supabase
    .from("company_config")
    .select("*")
    .eq("company_id", company_id)
    .maybeSingle();

  if (!config) return json({ error: "Config não encontrada" }, 404);

  // Se tem prompt customizado, usar
  if (config.whatsapp_system_prompt) {
    return json({ prompt: config.whatsapp_system_prompt });
  }

  // Buscar lifecycle do lead pra contexto
  let lifecycleContext = "";
  if (phone_number) {
    const { data: lc } = await supabase
      .from("lead_whatsapp_lifecycle")
      .select("lead_name, stage, sentiment, conversation_summary, lead_interests, objections")
      .eq("company_id", company_id)
      .eq("phone_number", phone_number)
      .maybeSingle();

    if (lc) {
      lifecycleContext = `
CONTEXTO DO LEAD:
- Nome: ${lc.lead_name || "desconhecido"}
- Estágio: ${lc.stage}
- Sentimento: ${lc.sentiment || "neutro"}
- Resumo da ligação: ${lc.conversation_summary || "Sem ligação anterior"}
- Interesses: ${JSON.stringify(lc.lead_interests || [])}
- Objeções: ${JSON.stringify(lc.objections || [])}`;
    }
  }

  const forbidden = (config.forbidden_words || []).join(", ");
  const productDesc = config.product_data
    ? JSON.stringify(config.product_data, null, 2)
    : "";

  const prompt = `Você é ${config.persona_name} da ${config.persona_company} respondendo pelo WhatsApp.

TOM: ${config.persona_tone}

${forbidden ? `NUNCA USE: ${forbidden}` : ""}
${lifecycleContext}

${productDesc ? `PRODUTO/SERVIÇO:\n${productDesc}` : ""}

REGRAS:
1. Respostas CURTAS (2-3 frases, é WhatsApp)
2. Use contrações naturais (tá, pra, né, vc)
3. Se não souber algo, diga "vou verificar"
4. Se pedir humano → transfira
5. Se pedir ligação → providencie
6. Sem markdown, sem asteriscos — texto puro
7. Máximo 1 emoji por mensagem
8. Objetivo: avançar o lead no funil naturalmente`;

  return json({ prompt });
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
