/**
 * conversation-engine
 * IA conversa com leads na janela 24h do WhatsApp
 *
 * Modos:
 * - AUTO: IA responde automaticamente
 * - MANUAL: Só notifica vendedor
 * - HYBRID: IA responde + notifica vendedor (pode assumir)
 *
 * Features:
 * - Contexto da ligação + mensagens anteriores
 * - Detecção de opt-out na conversa
 * - Handoff pra vendedor
 * - Detecção de "solicitar nova ligação"
 * - Resumo automático da conversa
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const META_API = "https://graph.facebook.com/v22.0";

const HANDOFF_KEYWORDS = [
  "falar com uma pessoa", "atendente", "humano", "gente de verdade",
  "quero falar com alguem", "pessoa real", "transferir", "supervisor",
  "gerente", "responsavel",
];

const CALL_REQUEST_KEYWORDS = [
  "me liga", "pode ligar", "prefiro ligação", "quero uma ligação",
  "liga pra mim", "ligar pra mim", "falar por telefone",
];

const OPT_OUT_KEYWORDS = [
  "sair", "parar", "para", "cancelar", "não quero mais",
  "bloquear", "remover", "não me mande", "nao quero", "pare", "stop",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, Authorization",
      },
    });
  }

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "respond":
        return await respondToLead(body);
      case "start":
        return await startConversation(body);
      case "handoff":
        return await handoffToHuman(body);
      case "send-manual":
        return await sendManualMessage(body);
      case "close":
        return await closeConversation(body);
      case "get-conversation":
        return await getConversation(body);
      case "list-active":
        return await listActive(body);
      case "check-stale":
        return await checkStaleLeads(body);
      case "continue_closer":
        return await continueCloser(body);
      default:
        return json({ error: "Action inválida" }, 400);
    }
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});

/**
 * IA responde ao lead (chamado pelo webhook quando msg inbound chega)
 */
async function respondToLead(body: any) {
  const { company_id, phone_number, conversation_id, user_message } = body;

  if (!phone_number || !user_message) {
    return json({ error: "phone_number e user_message obrigatórios" }, 400);
  }

  // Buscar conversa ativa
  let convId = conversation_id;
  let conv: any;

  if (convId) {
    const { data } = await supabase
      .from("whatsapp_ai_conversations")
      .select("*")
      .eq("id", convId)
      .maybeSingle();
    conv = data;
  }

  if (!conv) {
    const { data } = await supabase
      .from("whatsapp_ai_conversations")
      .select("*")
      .eq("company_id", company_id)
      .eq("phone_number", phone_number)
      .eq("status", "active")
      .maybeSingle();
    conv = data;
    convId = data?.id;
  }

  // Se não tem conversa ativa, criar uma
  if (!conv) {
    const createResult = await startConversation({
      company_id,
      phone_number,
      mode: "auto",
    });
    const created = await createResult.json();
    convId = created.conversation_id;
    conv = created.conversation;
  }

  // Se está em handoff, não responde pela IA
  if (conv?.status === "handed_off" || conv?.status === "handoff_requested") {
    return json({ skipped: true, reason: "Conversa transferida para humano" });
  }

  // Normalizar texto
  const normalizedMsg = user_message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  // Detectar opt-out
  if (OPT_OUT_KEYWORDS.some((k) => normalizedMsg.includes(k.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))) {
    await handleOptOut(company_id, phone_number, convId);
    // Enviar mensagem de despedida
    await sendWhatsAppMessage(
      company_id,
      phone_number,
      "Entendi, vou parar de enviar mensagens. Se precisar de algo, é só mandar uma mensagem. Valeu!"
    );
    return json({ action_taken: "opt_out", message: "Lead optou por sair" });
  }

  // Detectar pedido de handoff
  if (HANDOFF_KEYWORDS.some((k) => normalizedMsg.includes(k.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))) {
    await handoffToHuman({ company_id, phone_number, conversation_id: convId, reason: "Lead solicitou" });
    await sendWhatsAppMessage(
      company_id,
      phone_number,
      "Claro! Vou transferir pra um dos nossos consultores. Já já alguém te chama, beleza?"
    );
    return json({ action_taken: "handoff", message: "Transferido para humano" });
  }

  // Detectar pedido de ligação
  if (CALL_REQUEST_KEYWORDS.some((k) => normalizedMsg.includes(k.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))) {
    await supabase
      .from("lead_whatsapp_lifecycle")
      .update({
        next_call_requested: true,
        next_call_reason: "Lead solicitou ligação via WhatsApp",
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", company_id)
      .eq("phone_number", phone_number);

    await sendWhatsAppMessage(
      company_id,
      phone_number,
      "Beleza! Vou pedir pra um dos nossos consultores te ligar. Qual o melhor horário pra você?"
    );
    return json({ action_taken: "call_requested" });
  }

  // Buscar histórico da conversa
  const { data: history } = await supabase
    .from("whatsapp_ai_messages")
    .select("role, content")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true })
    .limit(20);

  // Buscar contexto do lifecycle
  const { data: lifecycle } = await supabase
    .from("lead_whatsapp_lifecycle")
    .select("conversation_summary, lead_interests, objections, lead_name, stage, sentiment")
    .eq("company_id", company_id)
    .eq("phone_number", phone_number)
    .maybeSingle();

  // Montar system prompt (dinâmico via company_config)
  const systemPrompt = await buildSystemPrompt(lifecycle, conv, company_id);

  // Montar mensagens pro LLM
  const messages = [
    { role: "user", content: systemPrompt },
    { role: "assistant", content: "Entendido, vou responder de forma natural como um consultor real." },
  ];

  for (const msg of history || []) {
    if (msg.role === "user" || msg.role === "assistant") {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  // Adicionar mensagem atual (se não foi salva ainda pelo webhook)
  const lastMsg = history?.[history.length - 1];
  if (!lastMsg || lastMsg.content !== user_message) {
    messages.push({ role: "user", content: user_message });
  }

  // Chamar LLM
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY") || await getConfig("anthropic_api_key");
  if (!apiKey) return json({ error: "API key não configurada" }, 500);

  const llmRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages,
    }),
  });

  if (!llmRes.ok) {
    const err = await llmRes.json();
    return json({ error: `LLM error: ${err.error?.message || llmRes.status}` }, 500);
  }

  const llmData = await llmRes.json();
  const aiResponse = llmData.content?.[0]?.text || "";
  const tokensUsed = (llmData.usage?.input_tokens || 0) + (llmData.usage?.output_tokens || 0);

  if (!aiResponse) {
    return json({ error: "IA não gerou resposta" }, 500);
  }

  // Salvar resposta no histórico
  await supabase.from("whatsapp_ai_messages").insert({
    conversation_id: convId,
    role: "assistant",
    content: aiResponse,
    message_type: "text",
    tokens_used: tokensUsed,
    model_used: "claude-haiku-4.5",
  });

  // Incrementar contador
  await supabase
    .from("whatsapp_ai_conversations")
    .update({
      messages_in_session: (conv?.messages_in_session || 0) + 2,
      updated_at: new Date().toISOString(),
    })
    .eq("id", convId);

  // Enviar via WhatsApp
  const sendResult = await sendWhatsAppMessage(company_id, phone_number, aiResponse);

  // Atualizar resumo a cada 5 mensagens
  if (((conv?.messages_in_session || 0) + 2) % 5 === 0) {
    updateConversationSummary(company_id, phone_number, convId).catch(() => {});
  }

  return json({
    success: true,
    ai_response: aiResponse,
    sent: sendResult.success,
    tokens_used: tokensUsed,
  });
}

/**
 * Iniciar conversa IA com lead
 */
async function startConversation(body: any) {
  const { company_id, phone_number, mode = "hybrid" } = body;

  // Buscar lifecycle
  const { data: lifecycle } = await supabase
    .from("lead_whatsapp_lifecycle")
    .select("id, conversation_summary, lead_interests")
    .eq("company_id", company_id)
    .eq("phone_number", phone_number)
    .maybeSingle();

  const windowExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: conv, error } = await supabase
    .from("whatsapp_ai_conversations")
    .insert({
      company_id,
      phone_number,
      lifecycle_id: lifecycle?.id,
      status: "active",
      system_prompt: mode,
      conversation_context: {
        mode,
        summary: lifecycle?.conversation_summary,
        interests: lifecycle?.lead_interests,
      },
      messages_in_session: 0,
      window_opened_at: new Date().toISOString(),
      window_expires_at: windowExpires,
    })
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);

  return json({
    success: true,
    conversation_id: conv.id,
    conversation: conv,
  });
}

/**
 * Handoff: IA → vendedor
 */
async function handoffToHuman(body: any) {
  const { company_id, phone_number, conversation_id, reason, collaborator_id } = body;

  const filter: Record<string, any> = { company_id, phone_number };
  if (conversation_id) filter.id = conversation_id;

  // Buscar vendedor responsável
  let handoffTo = collaborator_id;
  if (!handoffTo) {
    const { data: lifecycle } = await supabase
      .from("lead_whatsapp_lifecycle")
      .select("collaborator_id")
      .eq("company_id", company_id)
      .eq("phone_number", phone_number)
      .maybeSingle();
    handoffTo = lifecycle?.collaborator_id;
  }

  await supabase
    .from("whatsapp_ai_conversations")
    .update({
      status: "handed_off",
      handoff_reason: reason || "Solicitação do lead",
      handed_off_to: handoffTo,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", company_id)
    .eq("phone_number", phone_number)
    .eq("status", "active");

  // Salvar nota no histórico
  if (conversation_id) {
    await supabase.from("whatsapp_ai_messages").insert({
      conversation_id,
      role: "system",
      content: `[HANDOFF] Conversa transferida para humano. Motivo: ${reason || "Solicitação do lead"}`,
      message_type: "text",
    });
  }

  return json({ success: true, handed_off_to: handoffTo });
}

/**
 * Vendedor envia mensagem manual (session message na janela 24h)
 */
async function sendManualMessage(body: any) {
  const { company_id, collaborator_id, phone_number, message } = body;

  if (!message?.trim()) return json({ error: "Mensagem vazia" }, 400);

  // Verificar se janela está aberta
  const { data: lifecycle } = await supabase
    .from("lead_whatsapp_lifecycle")
    .select("window_open, window_expires_at, collaborator_id")
    .eq("company_id", company_id)
    .eq("phone_number", phone_number)
    .maybeSingle();

  if (!lifecycle?.window_open) {
    return json({
      error: "Janela de 24h fechada. Use um template aprovado.",
      code: "WINDOW_CLOSED",
    }, 403);
  }

  if (new Date(lifecycle.window_expires_at) < new Date()) {
    // Fechar janela expirada
    await supabase
      .from("lead_whatsapp_lifecycle")
      .update({ window_open: false, updated_at: new Date().toISOString() })
      .eq("company_id", company_id)
      .eq("phone_number", phone_number);

    return json({ error: "Janela expirou. Use um template.", code: "WINDOW_EXPIRED" }, 403);
  }

  // Verificar se é o vendedor deste lead
  if (lifecycle.collaborator_id && lifecycle.collaborator_id !== collaborator_id) {
    return json({ error: "Este lead não está atribuído a você", code: "NOT_ASSIGNED" }, 403);
  }

  // Se IA está ativa, pausar (vendedor assumiu)
  await supabase
    .from("whatsapp_ai_conversations")
    .update({ status: "handed_off", handoff_reason: "Vendedor assumiu", handed_off_to: collaborator_id, updated_at: new Date().toISOString() })
    .eq("company_id", company_id)
    .eq("phone_number", phone_number)
    .eq("status", "active");

  // Enviar via Meta API (session message = texto livre)
  const result = await sendWhatsAppMessage(company_id, phone_number, message);

  if (!result.success) {
    return json({ error: result.error }, 500);
  }

  // Salvar no histórico da conversa IA (se existir)
  const { data: conv } = await supabase
    .from("whatsapp_ai_conversations")
    .select("id")
    .eq("company_id", company_id)
    .eq("phone_number", phone_number)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (conv) {
    await supabase.from("whatsapp_ai_messages").insert({
      conversation_id: conv.id,
      role: "assistant",
      content: `[MANUAL - ${collaborator_id}] ${message}`,
      message_type: "text",
    });
  }

  return json({ success: true, meta_message_id: result.messageId });
}

/**
 * Fechar conversa
 */
async function closeConversation(body: any) {
  const { company_id, phone_number, conversation_id } = body;

  let query = supabase
    .from("whatsapp_ai_conversations")
    .update({ status: "closed", updated_at: new Date().toISOString() });

  if (conversation_id) {
    query = query.eq("id", conversation_id);
  } else {
    query = query.eq("company_id", company_id).eq("phone_number", phone_number).eq("status", "active");
  }

  await query;
  return json({ success: true });
}

/**
 * Buscar conversa com histórico
 */
async function getConversation(body: any) {
  const { company_id, phone_number, conversation_id } = body;

  let query = supabase.from("whatsapp_ai_conversations").select("*");

  if (conversation_id) {
    query = query.eq("id", conversation_id);
  } else {
    query = query
      .eq("company_id", company_id)
      .eq("phone_number", phone_number)
      .order("created_at", { ascending: false })
      .limit(1);
  }

  const { data: conv } = await query.maybeSingle();
  if (!conv) return json({ error: "Conversa não encontrada" }, 404);

  // Buscar mensagens
  const { data: messages } = await supabase
    .from("whatsapp_ai_messages")
    .select("role, content, message_type, created_at")
    .eq("conversation_id", conv.id)
    .order("created_at", { ascending: true });

  // Buscar lifecycle
  const { data: lifecycle } = await supabase
    .from("lead_whatsapp_lifecycle")
    .select("stage, sentiment, conversation_summary, lead_interests, objections, window_open, window_expires_at")
    .eq("company_id", company_id)
    .eq("phone_number", phone_number)
    .maybeSingle();

  return json({
    conversation: conv,
    messages: messages || [],
    lifecycle,
  });
}

/**
 * Listar conversas ativas (pra vendedor ou CEO)
 */
async function listActive(body: any) {
  const { company_id, collaborator_id, limit = 50 } = body;

  let query = supabase
    .from("whatsapp_ai_conversations")
    .select("*, lead_whatsapp_lifecycle(lead_name, stage, sentiment)")
    .eq("company_id", company_id)
    .in("status", ["active", "handed_off", "handoff_requested"])
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (collaborator_id) {
    // Filtrar por leads do vendedor via lifecycle
    const { data: myLeads } = await supabase
      .from("lead_distribution")
      .select("phone_number")
      .eq("collaborator_id", collaborator_id)
      .in("status", ["dispatched", "responded", "in_progress"]);

    const phones = (myLeads || []).map((l: any) => l.phone_number);
    if (phones.length === 0) return json({ conversations: [] });

    query = query.in("phone_number", phones);
  }

  const { data, error } = await query;
  if (error) {
    // Fallback sem join
    const { data: fallback } = await supabase
      .from("whatsapp_ai_conversations")
      .select("*")
      .eq("company_id", company_id)
      .in("status", ["active", "handed_off"])
      .order("updated_at", { ascending: false })
      .limit(limit);
    return json({ conversations: fallback || [] });
  }

  return json({ conversations: data || [] });
}

/**
 * Verificar leads sem resposta há 72h (pedir nova ligação)
 * Chamado por cron diário
 */
async function checkStaleLeads(body: any) {
  const { company_id } = body;

  const threeDaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

  const { data: stale } = await supabase
    .from("lead_whatsapp_lifecycle")
    .select("id, phone_number, lead_name, last_template_sent_at, last_inbound_at")
    .eq("company_id", company_id)
    .in("stage", ["first_contact", "engaged", "proposal_sent", "negotiating"])
    .eq("next_call_requested", false)
    .or(`last_inbound_at.is.null,last_inbound_at.lt.${threeDaysAgo}`)
    .not("last_template_sent_at", "is", null)
    .lt("last_template_sent_at", threeDaysAgo);

  if (!stale?.length) return json({ flagged: 0 });

  // Marcar para nova ligação
  const ids = stale.map((l: any) => l.id);
  await supabase
    .from("lead_whatsapp_lifecycle")
    .update({
      next_call_requested: true,
      next_call_reason: "Sem resposta no WhatsApp há 72h+",
      updated_at: new Date().toISOString(),
    })
    .in("id", ids);

  return json({
    flagged: stale.length,
    leads: stale.map((l: any) => ({
      phone: l.phone_number,
      name: l.lead_name,
      last_template: l.last_template_sent_at,
      last_response: l.last_inbound_at,
    })),
  });
}

// ── HELPERS ──────────────────────────────────────────────────────────────

async function buildSystemPrompt(lifecycle: any, conv: any, companyId?: string): Promise<string> {
  const name = lifecycle?.lead_name || "o lead";
  const stage = lifecycle?.stage || "desconhecido";
  const summary = lifecycle?.conversation_summary || "Sem contexto prévio";
  const interests = lifecycle?.lead_interests
    ? JSON.stringify(lifecycle.lead_interests)
    : "Não identificados";
  const objections = lifecycle?.objections
    ? JSON.stringify(lifecycle.objections)
    : "Nenhuma";
  const sentiment = lifecycle?.sentiment || "neutro";

  // Buscar company_config pra montar prompt dinâmico
  let config: any = null;
  if (companyId) {
    const { data } = await supabase
      .from("company_config")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    config = data;
  }

  // Se tem config, usar prompt dinâmico
  if (config) {
    // Se tem prompt customizado, usar ele
    if (config.whatsapp_system_prompt) {
      return config.whatsapp_system_prompt + `\n\nCONTEXTO DO LEAD:\n- Nome: ${name}\n- Estágio: ${stage}\n- Sentimento: ${sentiment}\n- Resumo: ${summary}\n- Interesses: ${interests}\n- Objeções: ${objections}`;
    }

    const forbidden = (config.forbidden_words || []).join('", "');
    const productInfo = config.product_data
      ? `\n\nPRODUTO/SERVIÇO:\n${JSON.stringify(config.product_data, null, 2)}`
      : "";

    return `Você é ${config.persona_name} da ${config.persona_company} respondendo pelo WhatsApp.

TOM: ${config.persona_tone}

${forbidden ? `NUNCA USE estas palavras: "${forbidden}"` : ""}

CONTEXTO DO LEAD:
- Nome: ${name}
- Estágio: ${stage}
- Sentimento: ${sentiment}
- Resumo da conversa anterior: ${summary}
- Interesses: ${interests}
- Objeções: ${objections}
${productInfo}

REGRAS:
1. Seja NATURAL — fale como um brasileiro real, coloquial mas profissional
2. Respostas CURTAS (max 2-3 frases no WhatsApp, ninguém lê textão)
3. Use contrações: "tá", "pra", "né", "vc"
4. NUNCA use frases de chatbot ("Como posso ajudá-lo?", "Fico feliz em ajudar")
5. Se não souber algo, diga "vou verificar" em vez de inventar
6. Se o lead pedir falar com humano, diga que vai transferir
7. Se o lead pedir ligação, diga que vai providenciar
8. Objetivo: avançar o lead no funil naturalmente, sem pressionar
9. Não use markdown, asteriscos ou formatação — texto puro do WhatsApp
10. Não use emojis em excesso (máximo 1 por mensagem)`;
  }

  // Fallback genérico (sem company_config)
  return `Você é um consultor respondendo pelo WhatsApp.

CONTEXTO DO LEAD:
- Nome: ${name}
- Estágio: ${stage}
- Sentimento: ${sentiment}
- Resumo da conversa anterior: ${summary}
- Interesses: ${interests}
- Objeções: ${objections}

REGRAS:
1. Respostas CURTAS (2-3 frases)
2. Natural e coloquial
3. Sem markdown — texto puro
4. Se não souber, diga "vou verificar"
5. Se pedir humano → transfira`;
}

async function sendWhatsAppMessage(
  companyId: string,
  phone: string,
  text: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const cfg: Record<string, string> = {};

  // 1. Buscar credenciais da empresa primeiro
  const { data: cred } = await supabase
    .from("whatsapp_meta_credentials")
    .select("meta_access_token, meta_phone_number_id, meta_display_phone")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .not("meta_access_token", "eq", "")
    .maybeSingle();

  if (cred) {
    cfg.meta_whatsapp_token = cred.meta_access_token;
    cfg.meta_phone_number_id = cred.meta_phone_number_id;
    cfg.meta_display_phone = cred.meta_display_phone || "";
  }

  // 2. Fallback: system_configs (global)
  if (!cfg.meta_whatsapp_token || !cfg.meta_phone_number_id) {
    const { data: config } = await supabase
      .from("system_configs")
      .select("key, value")
      .in("key", ["meta_whatsapp_token", "meta_phone_number_id"]);
    for (const c of config || []) {
      if (c.key === "meta_whatsapp_token" && !cfg.meta_whatsapp_token) cfg.meta_whatsapp_token = c.value;
      if (c.key === "meta_phone_number_id" && !cfg.meta_phone_number_id) cfg.meta_phone_number_id = c.value;
    }
  }

  if (!cfg.meta_whatsapp_token || !cfg.meta_phone_number_id) {
    return { success: false, error: "Credenciais Meta não configuradas" };
  }

  try {
    const res = await fetch(`${META_API}/${cfg.meta_phone_number_id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.meta_whatsapp_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: text },
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      return { success: false, error: result.error?.message || `${res.status}` };
    }

    const messageId = result.messages?.[0]?.id;

    // Salvar na tabela de mensagens
    await supabase
      .from("whatsapp_meta_messages")
      .insert({
        company_id: companyId,
        message_id: messageId,
        direction: "outbound",
        phone_from: (cfg.meta_display_phone || "").replace(/[^0-9]/g, "") || cfg.meta_phone_number_id,
        phone_to: phone.replace(/[^0-9]/g, ""),
        phone_number_id: cfg.meta_phone_number_id,
        type: "text",
        body: text,
        status: "sent",
        sent_at: new Date().toISOString(),
        conversation_origin: "business_initiated",
      })
      .catch(() => {});

    return { success: true, messageId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function handleOptOut(companyId: string, phone: string, convId?: string) {
  await supabase
    .from("whatsapp_opt_ins")
    .update({
      status: "opted_out",
      opt_out_at: new Date().toISOString(),
      opt_out_reason: "Solicitação via conversa WhatsApp",
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", companyId)
    .eq("phone_number", phone);

  await supabase
    .from("smart_dispatches")
    .update({ status: "cancelled", error_message: "Lead opted out" })
    .eq("phone_number", phone)
    .in("status", ["queued", "ready"]);

  if (convId) {
    await supabase
      .from("whatsapp_ai_conversations")
      .update({ status: "closed", updated_at: new Date().toISOString() })
      .eq("id", convId);
  }

  await supabase
    .from("lead_whatsapp_lifecycle")
    .update({
      stage: "closed_lost",
      sentiment: "negative",
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", companyId)
    .eq("phone_number", phone);
}

async function updateConversationSummary(companyId: string, phone: string, convId: string) {
  const { data: messages } = await supabase
    .from("whatsapp_ai_messages")
    .select("role, content")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true })
    .limit(30);

  if (!messages?.length) return;

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY") || await getConfig("anthropic_api_key");
  if (!apiKey) return;

  const transcript = messages
    .filter((m: any) => m.role !== "system")
    .map((m: any) => `${m.role === "user" ? "Lead" : "Consultor"}: ${m.content}`)
    .join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `Resuma esta conversa de WhatsApp em 2-3 frases. Identifique: interesses do lead, objeções, e próximo passo.

${transcript}

Retorne JSON: {"summary": "...", "interests": ["..."], "objections": ["..."], "sentiment": "positive|neutral|negative|interested|objecting"}`,
        },
      ],
    }),
  });

  if (!res.ok) return;

  const data = await res.json();
  const text = data.content?.[0]?.text || "";

  try {
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}");

    await supabase
      .from("lead_whatsapp_lifecycle")
      .update({
        conversation_summary: parsed.summary,
        lead_interests: parsed.interests,
        objections: parsed.objections,
        sentiment: parsed.sentiment,
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", companyId)
      .eq("phone_number", phone);
  } catch {
    // Ignorar erro de parse
  }
}


/**
 * Continua conversa de fechamento pós-ligação (usa wa_conversations + wa_messages)
 */
async function continueCloser(body: any) {
  const { phone: rawPhone, user_message, company_id } = body;
  const phone = rawPhone?.startsWith('+') ? rawPhone : '+' + rawPhone;

  if (!phone || !user_message) {
    return json({ error: "phone e user_message obrigatorios" }, 400);
  }

  // Buscar wa_conversation ativa
  const { data: conversation } = await supabase
    .from("wa_conversations")
    .select("*")
    .eq("phone", phone)
    .eq("status", "active")
    .eq("human_mode", false)
    .maybeSingle();

  if (!conversation) {
    return json({ skipped: true, reason: "Sem wa_conversation ativa para closer" });
  }

  // Verificar limite de turnos
  const turnCount = conversation.turn_count || 0;
  if (turnCount >= 10) {
    await supabase.from("wa_conversations").update({ status: "human_takeover", human_mode: true }).eq("id", conversation.id);
    return json({ action_taken: "human_takeover", reason: "Limite de 10 turnos atingido" });
  }

  // Buscar histórico de mensagens
  const { data: messages } = await supabase
    .from("wa_messages")
    .select("role, content")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .limit(20);

  // Mensagem do usuário já inserida pelo webhook (passo 6) — não duplicar

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY nao configurada" }, 500);

  // Montar histórico para Opus
  const historyMessages = (messages || []).map((m: any) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  // Adicionar mensagem atual se ainda não estiver no histórico
  const lastMsg = historyMessages[historyMessages.length - 1];
  if (!lastMsg || lastMsg.content !== user_message) {
    historyMessages.push({ role: "user", content: user_message });
  }

  // Chamar Opus
  const opusRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-4-5",
      max_tokens: 300,
      system: `Você é o Lucas, consultor de vendas da Objetivo Proteção Veicular.
Já ligou para este lead e está dando continuidade no WhatsApp.

PRODUTO:
- Proteção veicular associativa (alternativa ao seguro)
- 40-60% mais barato que seguro convencional
- Cobre: roubo, furto, colisão, assistência 24h
- +30 franquias, 26 mil veículos protegidos
- Sem burocracia, sem franquia no sinistro

REGRAS:
- Mensagens curtas (máx 3 linhas)
- Tom: profissional e próximo
- Não mencionar IA a menos que perguntado
- Se pedir humano: responda "Vou te conectar com um consultor agora!" e inclua [HUMAN_TAKEOVER] no final da resposta
- Máximo 10 turnos antes de escalar para humano`,
      messages: historyMessages,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!opusRes.ok) {
    const err = await opusRes.json();
    return json({ error: `Opus error: ${err.error?.message || opusRes.status}` }, 500);
  }

  const opusData = await opusRes.json();
  let aiResponse = opusData.content?.[0]?.text || "";

  if (!aiResponse) return json({ error: "Opus nao gerou resposta" }, 500);

  // Verificar se solicitou handoff
  const needsHandoff = aiResponse.includes("[HUMAN_TAKEOVER]");
  aiResponse = aiResponse.replace("[HUMAN_TAKEOVER]", "").trim();

  // Atualizar contador de turnos
  await supabase.from("wa_conversations").update({
    turn_count: turnCount + 1,
    updated_at: new Date().toISOString(),
    ...(needsHandoff ? { status: "human_takeover", human_mode: true } : {}),
  }).eq("id", conversation.id);

  // Enviar via sendWhatsAppMessage (insere em whatsapp_meta_messages → trigger sync_meta_to_wa → wa_messages)
  const sendResult = await sendWhatsAppMessage(company_id, phone, aiResponse);
  const sent = sendResult.success;

  return json({
    success: true,
    ai_response: aiResponse,
    sent,
    turn_count: turnCount + 1,
    human_takeover: needsHandoff,
  });
}

async function getConfig(key: string): Promise<string | null> {
  const { data } = await supabase
    .from("system_configs")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value || null;
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
