/**
 * telegram-bot-webhook
 * Bot pessoal direto — sem seleção de agente obrigatória
 * /agentes = acesso a agentes especializados (opcional)
 * Memória persistente por colaborador (bot_memory no banco)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// TTS module available but not active on bot agents
// import { generateTTS, sendVoiceTelegram, humanizeText } from "../_shared/tts.ts";

const TELEGRAM_BOT_TOKEN = "8666513435:AAH7Z1MhK7-LK3ttIw5e7CqkXEyAcqj8KOE";
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

serve(async (req) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const body = await req.json().catch(() => ({}));

  // Callback query (botões inline)
  const callbackQuery = body?.callback_query;
  if (callbackQuery) {
    const chatId = String(callbackQuery?.message?.chat?.id);
    const telegramId = String(callbackQuery?.from?.id);
    const callbackData = String(callbackQuery?.data || "");

    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id }),
    });

    // Processar como mensagem normal
    return handleMessage(supabase, chatId, telegramId, callbackData);
  }

  const message = body?.message;
  if (!message) return new Response("ok", { status: 200 });

  const chatId = String(message?.chat?.id);
  const telegramId = String(message?.from?.id);
  const text = String(message?.text || "").trim();

  if (!chatId || !telegramId || !text) return new Response("ok", { status: 200 });

  return handleMessage(supabase, chatId, telegramId, text);
});

// ── BUSCA PLACA — Consulta veicular real ──────────────────────────────────
const BUSCA_PLACA_ID = "6d958573-09ab-49c8-8e17-7b233acea6ae";
const PLATE_REGEX = /^([A-Z]{3})-?(\d[A-Z0-9]\d{2})$/i;

async function handleBuscaPlaca(
  supabase: ReturnType<typeof createClient>,
  chatId: string,
  text: string,
  conversationId: string,
): Promise<Response | null> {
  const cleanText = text.replace(/[\s-]/g, "").toUpperCase();
  const match = cleanText.match(/^([A-Z]{3})(\d[A-Z0-9]\d{2})$/);

  if (!match) {
    // Não é placa — deixar o Claude responder
    return null;
  }

  const plate = `${match[1]}${match[2]}`;
  const plateFormatted = `${match[1]}-${match[2]}`;

  await sendMessage(chatId, `🔍 Consultando ${plateFormatted}...`);

  // Salvar mensagem do usuário
  await supabase.from("agent_messages").insert({
    conversation_id: conversationId, role: "user", content: text,
  });

  let result = `🚗 CONSULTA VEICULAR\n📋 Placa: ${plateFormatted}\n\n`;

  // ── 1. API Placas (dados completos) ──────────────────────────────────
  const { data: cfgApiPlacas } = await supabase
    .from("system_configs")
    .select("value")
    .eq("key", "api_placas_token")
    .maybeSingle();
  const apiPlacasToken = cfgApiPlacas?.value || "";

  let vehicleData: any = null;
  if (apiPlacasToken) {
    try {
      const resp = await fetch(`https://wdapi2.com.br/consulta/${plate}/${apiPlacasToken}`);
      if (resp.ok) {
        vehicleData = await resp.json();
      }
    } catch (_) { /* silently fail */ }
  }

  if (vehicleData && vehicleData.MARCA) {
    result += `📊 DADOS DO VEICULO\n`;
    result += `▸ Marca: ${vehicleData.MARCA || "N/A"}\n`;
    result += `▸ Modelo: ${vehicleData.MODELO || "N/A"}\n`;
    result += `▸ Ano: ${vehicleData.ano || "N/A"}/${vehicleData.anoModelo || "N/A"}\n`;
    result += `▸ Cor: ${vehicleData.cor || "N/A"}\n`;
    result += `▸ Combustivel: ${vehicleData.combustivel || "N/A"}\n`;
    result += `▸ Municipio: ${vehicleData.municipio || "N/A"}/${vehicleData.uf || "N/A"}\n`;
    result += `▸ Chassi: ${vehicleData.chassi || "N/A"}\n`;
    if (vehicleData.extra?.renavam) {
      result += `▸ Renavam: ${vehicleData.extra.renavam}\n`;
    }
    result += `\n`;

    // Situação roubo/furto
    if (vehicleData.situacao?.includes("ROUBO") || vehicleData.situacao?.includes("FURTO")) {
      result += `🚨 ALERTA: ${vehicleData.situacao}\n`;
      result += `⚠️ Este veiculo possui registro de ROUBO ou FURTO!\n\n`;
    } else {
      result += `✅ SEM registro de roubo/furto\n`;
      result += `Situacao: ${vehicleData.situacao || "Normal"}\n\n`;
    }

    // Restrições
    if (vehicleData.extra?.restricao1 || vehicleData.extra?.restricao2) {
      result += `⚠️ RESTRICOES\n`;
      if (vehicleData.extra.restricao1) result += `▸ ${vehicleData.extra.restricao1}\n`;
      if (vehicleData.extra.restricao2) result += `▸ ${vehicleData.extra.restricao2}\n`;
      if (vehicleData.extra.restricao3) result += `▸ ${vehicleData.extra.restricao3}\n`;
      result += `\n`;
    }
  } else {
    result += `📊 DADOS DO VEICULO\n`;
    result += `⏳ API Placas: ${apiPlacasToken ? "Erro na consulta" : "Token pendente de configuracao"}\n\n`;
  }

  // ── 2. SINESP (roubo/furto nacional) ─────────────────────────────────
  if (!vehicleData || !vehicleData.MARCA) {
    try {
      const sinespResp = await fetch("https://cidadao.sinesp.gov.br/sinesp-cidadao/mobile/consultar-placa/v4", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placa: plate }),
      });
      if (sinespResp.ok) {
        const sinesp = await sinespResp.json();
        if (sinesp.marca) {
          result += `📊 DADOS SINESP\n`;
          result += `▸ Marca/Modelo: ${sinesp.marca || ""} ${sinesp.modelo || ""}\n`;
          result += `▸ Ano: ${sinesp.ano || "N/A"}/${sinesp.anoModelo || "N/A"}\n`;
          result += `▸ Cor: ${sinesp.cor || "N/A"}\n`;
          result += `▸ Municipio: ${sinesp.municipio || "N/A"}/${sinesp.uf || "N/A"}\n`;
          result += `▸ Situacao: ${sinesp.situacao || "N/A"}\n\n`;
        }
      }
    } catch (_) { /* SINESP pode estar offline */ }
  }

  // ── 3. FIPE (valor de mercado - API gratuita) ────────────────────────
  // FIPE requer marca/modelo para consulta, pular se não temos dados
  if (vehicleData && vehicleData.codigoFipe) {
    try {
      const fipeResp = await fetch(`https://parallelum.com.br/fipe/api/v2/cars/brands`);
      // FIPE API é complexa (precisa navegar marca > modelo > ano)
      // Simplificado: mostrar código FIPE se disponível
      result += `💰 TABELA FIPE\n`;
      result += `▸ Codigo FIPE: ${vehicleData.codigoFipe}\n`;
      result += `▸ Consulte em: https://veiculos.fipe.org.br\n\n`;
    } catch (_) { /* skip */ }
  }

  // ── 4. Links DETRAN pátio ────────────────────────────────────────────
  const uf = vehicleData?.uf || "";
  result += `🅿️ CONSULTA PATIO\n`;
  if (uf === "MG" || !uf) {
    result += `▸ MG: https://www.mg.gov.br/servico/consultar-veiculos-removidos-para-o-patio-credenciado\n`;
  }
  if (uf === "SP" || !uf) {
    result += `▸ SP: https://detran.sp.gov.br/live/\n`;
  }
  if (uf === "RJ" || !uf) {
    result += `▸ RJ: https://www.detran.rj.gov.br/\n`;
  }

  result += `\n---\nWalk Holding Corporation\nDigital Lux ⚡`;

  // Salvar resposta
  await supabase.from("agent_messages").insert({
    conversation_id: conversationId, role: "assistant", content: result,
  });

  const buttons = [[{ text: "🔍 Consultar outra placa", callback_data: "agent:" + BUSCA_PLACA_ID }],
                   [{ text: "↩️ Voltar ao assistente", callback_data: "/limpar" }]];
  await sendMessage(chatId, result, { reply_markup: { inline_keyboard: buttons } });

  return new Response("ok", { status: 200 });
}

async function handleMessage(
  supabase: ReturnType<typeof createClient>,
  chatId: string,
  telegramId: string,
  text: string
): Promise<Response> {

  // ── COMANDO /vincular EMAIL SENHA ──────────────────────────────────────────
  if (text.startsWith("/vincular")) {
    const parts = text.split(" ");
    if (parts.length < 3) {
      await sendMessage(chatId,
        "Para vincular sua conta, use:\n\n" +
        "/vincular seu@email.com SuaSenha\n\n" +
        "Exemplo: /vincular joao@holdingwalk.com.br Joao@2026\n\n" +
        "As credenciais sao as mesmas do painel: https://app.holdingwalk.com.br"
      );
      return new Response("ok", { status: 200 });
    }
    const email = parts[1].toLowerCase();
    const senha = parts[2];

    // Verificar credenciais via Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (authErr || !authData?.user) {
      await sendMessage(chatId, "Email ou senha incorretos. Tente novamente.");
      return new Response("ok", { status: 200 });
    }

    // Buscar colaborador
    const { data: collabData } = await supabase
      .from("collaborators")
      .select("id, name, active")
      .eq("auth_user_id", authData.user.id)
      .single();

    if (!collabData || !collabData.active) {
      await sendMessage(chatId, "Conta nao encontrada ou inativa. Fale com o administrador.");
      return new Response("ok", { status: 200 });
    }

    // Vincular telegram_id
    await supabase
      .from("collaborators")
      .update({ telegram_id: telegramId })
      .eq("id", collabData.id);

    const firstName = String(collabData.name).split(" ")[0];
    await sendMessage(chatId,
      `Conta vinculada com sucesso, ${firstName}!\n\n` +
      `Pode comecar a conversar. Sou seu assistente pessoal.\n` +
      `Use /agentes para acessar agentes especializados.\n` +
      `Use /ajuda para ver todos os comandos.`
    );
    return new Response("ok", { status: 200 });
  }

  // ── Identificar colaborador ────────────────────────────────────────────────
  const { data: collab } = await supabase
    .from("collaborators")
    .select("id, name, role_id, company_id, active, bot_training, bot_memory")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (!collab || !collab.active) {
    if (text === "/start") {
      await sendMessage(chatId,
        "Ola! Bem-vindo ao Walk Bot.\n\n" +
        "Para comecar, vincule sua conta:\n\n" +
        "/vincular seu@email.com SuaSenha\n\n" +
        `Seu ID Telegram: ${telegramId}`
      );
    } else {
      await sendMessage(chatId,
        "Sua conta ainda nao esta vinculada.\n\n" +
        "Use: /vincular seu@email.com SuaSenha"
      );
    }
    return new Response("ok", { status: 200 });
  }

  const firstName = String(collab.name).split(" ")[0];

  // ── Agentes permitidos ────────────────────────────────────────────────────
  const { data: roleAgents } = await supabase
    .from("role_agent_access").select("agent_id").eq("role_id", collab.role_id);
  const { data: overrides } = await supabase
    .from("collaborator_agent_access").select("agent_id, has_access").eq("collaborator_id", collab.id);

  const roleAgentIds = new Set((roleAgents || []).map((r: any) => r.agent_id as string));
  const overridesMap = new Map((overrides || []).map((o: any) => [o.agent_id as string, o.has_access as boolean]));
  const allowedIds = new Set<string>();
  roleAgentIds.forEach(id => { if (overridesMap.get(id) !== false) allowedIds.add(id); });
  overridesMap.forEach((hasAccess, agentId) => { if (hasAccess) allowedIds.add(agentId); });

  // ── Comandos especiais ────────────────────────────────────────────────────
  if (text === "/start") {
    await sendMessage(chatId,
      `Ola, ${firstName}! Estou aqui para te ajudar.\n\n` +
      `Pode me mandar qualquer mensagem diretamente.\n` +
      `Use /agentes para acessar agentes especializados.\n` +
      `Use /limpar para comecar uma nova conversa.\n` +
      `Use /ajuda para ver todos os comandos.`
    );
    return new Response("ok", { status: 200 });
  }

  if (text === "/agentes") {
    await showAgentMenu(supabase, chatId, collab, allowedIds);
    return new Response("ok", { status: 200 });
  }

  if (text === "/limpar") {
    // Fechar agente ativo se houver
    await supabase.from("agent_conversations")
      .update({ status: "closed" })
      .eq("collaborator_id", collab.id)
      .eq("status", "active");
    await sendMessage(chatId,
      `Conversa encerrada. Pode continuar conversando comigo normalmente, ${firstName}.`
    );
    return new Response("ok", { status: 200 });
  }

  if (text === "/ajuda" || text === "/help") {
    await sendMessage(chatId,
      "Comandos disponíveis:\n\n" +
      "/agentes — Escolher agente especializado\n" +
      "/limpar — Encerrar agente ativo e voltar ao assistente pessoal\n" +
      "/ajuda — Esta mensagem\n\n" +
      "Sem comandos: conversa direto com seu assistente pessoal."
    );
    return new Response("ok", { status: 200 });
  }

  // ── Seleção de agente via callback ────────────────────────────────────────
  if (text.startsWith("agent:")) {
    const agentId = text.replace("agent:", "");
    if (!allowedIds.has(agentId)) {
      await sendMessage(chatId, "Voce nao tem acesso a este agente.");
      return new Response("ok", { status: 200 });
    }
    await supabase.from("agent_conversations")
      .update({ status: "closed" })
      .eq("collaborator_id", collab.id)
      .eq("status", "active");
    await supabase.from("agent_conversations").insert({
      agent_id: agentId, collaborator_id: collab.id, status: "active",
    });
    const { data: agentInfo } = await supabase
      .from("agent_definitions").select("name, emoji, description").eq("id", agentId).single();
    await sendMessage(chatId,
      `${agentInfo?.emoji || "🤖"} ${agentInfo?.name || "Agente"} ativado!\n\n` +
      `Ola, ${firstName}! ${agentInfo?.description || "Pronto para te ajudar."}\n\n` +
      `Digite sua mensagem. Use /limpar para voltar ao assistente pessoal.`
    );
    return new Response("ok", { status: 200 });
  }

  // ── Verificar se tem agente especializado ativo ───────────────────────────
  const { data: activeConv } = await supabase
    .from("agent_conversations")
    .select("id, agent_id")
    .eq("collaborator_id", collab.id)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Mostrar "digitando..."
  await fetch(`${TELEGRAM_API}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  });

  // ── Buscar API key ────────────────────────────────────────────────────────
  const { data: cfgRows } = await supabase
    .from("system_configs")
    .select("key, value")
    .in("key", ["anthropic_api_key_meubot", "anthropic_api_key_ceo", "anthropic_api_key_conversas"]);
  const cfg: Record<string, string> = {};
  (cfgRows || []).forEach((c: any) => { cfg[c.key] = c.value; });
  const apiKey = cfg["anthropic_api_key_meubot"] || cfg["anthropic_api_key_ceo"] || cfg["anthropic_api_key_conversas"];

  let systemPrompt = "";
  let conversationId = "";
  let model = "claude-haiku-4-5";
  let useAgent = false;

  if (activeConv) {
    // ── Modo agente especializado ─────────────────────────────────────────
    const { data: agentDef } = await supabase
      .from("agent_definitions")
      .select("name, emoji, system_prompt, agent_type, slug")
      .eq("id", activeConv.agent_id)
      .single();

    // ── BUSCA PLACA: consulta real de veículos ────────────────────────────
    if (agentDef?.slug === "busca-placa") {
      const plateResult = await handleBuscaPlaca(supabase, chatId, text, activeConv.id);
      if (plateResult) return plateResult;
    }

    systemPrompt = String(agentDef?.system_prompt || "") +
      `\n\nVoce esta respondendo para ${collab.name}. Seja direto e objetivo. Nunca use asteriscos ou markdown.`;
    model = "claude-haiku-4-5";
    conversationId = activeConv.id;
    useAgent = true;
  } else {
    // ── Modo assistente pessoal ───────────────────────────────────────────
    const botTraining = String(collab.bot_training || "");
    const botMemory = String(collab.bot_memory || "");
    systemPrompt = `Voce e o assistente pessoal de ${collab.name}.` +
      ` Pode ajudar com qualquer assunto: trabalho, vendas, duvidas, planejamento ou conversa.` +
      ` Seja um parceiro genuino, direto e empatico.` +
      `${botTraining ? `\n\nContexto profissional:\n${botTraining}` : ""}` +
      (botMemory
        ? `\n\n=== REGISTRO DE CONVERSAS ANTERIORES ===\n${botMemory}\n=== FIM DO REGISTRO ===\n\nUse essas informacoes para personalizar suas respostas. Quando perguntarem sobre memoria, diga que sim, voce tem acesso ao historico de conversas anteriores carregado no inicio de cada sessao.`
        : `\n\nAinda nao ha historico de conversas anteriores com ${firstName}. Quando perguntarem sobre memoria, explique que o sistema salva automaticamente o contexto das conversas e que ira construindo esse historico ao longo do tempo.`) +
      `\n\nRegras: responda em portugues brasileiro. NUNCA use asteriscos, negrito, italico ou markdown. Texto puro apenas.`;

    // Buscar ou criar conversa pessoal
    const { data: personalConv } = await supabase
      .from("agent_conversations")
      .select("id")
      .eq("collaborator_id", collab.id)
      .eq("conversation_type", "telegram-personal")
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (personalConv) {
      conversationId = personalConv.id;
    } else {
      const { data: newConv } = await supabase
        .from("agent_conversations")
        .insert({ collaborator_id: collab.id, conversation_type: "telegram-personal", status: "active" })
        .select("id").single();
      conversationId = newConv?.id || "";
    }
  }

  // ── Buscar histórico ──────────────────────────────────────────────────────
  const { data: history } = await supabase
    .from("agent_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(20);
  const historyOrdered = (history || []).reverse();

  // Salvar mensagem do usuário
  if (conversationId) {
    await supabase.from("agent_messages").insert({ conversation_id: conversationId, role: "user", content: text });
  }

  // ── Chamar Anthropic ──────────────────────────────────────────────────────
  let reply = "Desculpe, nao consegui processar sua mensagem agora. Tente novamente.";

  if (apiKey && systemPrompt) {
    const messages = [
      ...historyOrdered.map((m: any) => ({ role: m.role as string, content: m.content as string })),
      { role: "user", content: text },
    ];

    const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 1024, system: systemPrompt, messages }),
    });

    const anthropicData = await anthropicResp.json().catch(() => ({}));
    if (anthropicData?.content?.[0]?.text) {
      reply = anthropicData.content[0].text;
    }
  }

  // ── Salvar resposta ───────────────────────────────────────────────────────
  if (conversationId) {
    await supabase.from("agent_messages").insert({ conversation_id: conversationId, role: "assistant", content: reply });
    await supabase.from("agent_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);
  }

  // ── Extrair e salvar memória (modo pessoal) ───────────────────────────────
  if (!useAgent && apiKey && historyOrdered.length >= 1 && historyOrdered.length % 3 === 0) {
    extractAndSaveMemory(supabase, apiKey, collab.id as string, String(collab.name), historyOrdered, text, reply, String(collab.bot_memory || ""))
      .catch(() => {});
  }

  // ── Enviar resposta ───────────────────────────────────────────────────────
  const buttons = useAgent
    ? [[{ text: "Voltar ao assistente pessoal", callback_data: "/limpar" }]]
    : [[{ text: "Agentes especializados", callback_data: "/agentes" }]];

  await sendMessage(chatId, reply, { reply_markup: { inline_keyboard: buttons } });

  // ── TTS desabilitado nos agentes do bot (apenas para chamadas telefônicas)
  // generateAndSendVoice(supabase, chatId, reply, activeConv?.agent_id || null)
  //   .catch((err) => console.error("TTS background error:", err));

  return new Response("ok", { status: 200 });
}

// ── TTS background: gerar e enviar voz ──────────────────────────────────────
async function generateAndSendVoice(
  supabase: ReturnType<typeof createClient>,
  chatId: string,
  text: string,
  agentId: string | null,
): Promise<void> {
  // Buscar config de TTS
  const { data: ttsConfigs } = await supabase
    .from("system_configs")
    .select("key, value")
    .in("key", ["fish_audio_api_key", "fish_audio_model_alex", "tts_provider"]);

  const ttsConfig: Record<string, string> = {};
  (ttsConfigs || []).forEach((c: any) => { ttsConfig[c.key] = c.value; });

  // Verificar se TTS está habilitado
  if (ttsConfig["tts_provider"] !== "fish_audio") return;
  const fishApiKey = ttsConfig["fish_audio_api_key"];
  const fishModelId = ttsConfig["fish_audio_model_alex"];
  if (!fishApiKey || !fishModelId) return;

  // Se é agente com voice_key, verificar se deve usar TTS
  if (agentId) {
    const { data: agentDef } = await supabase
      .from("agent_definitions")
      .select("voice_key")
      .eq("id", agentId)
      .single();
    // Só gerar voz se voice_key contém "fish" ou "alex"
    const vk = String(agentDef?.voice_key || "").toLowerCase();
    if (!vk.includes("fish") && !vk.includes("alex")) return;
  }

  // Humanizar texto para fala natural
  const spokenText = humanizeText(text);

  // Limitar: não gerar voz pra textos muito curtos ou muito longos
  if (spokenText.length < 20 || spokenText.length > 1000) return;

  // Gerar áudio
  const audioBuffer = await generateTTS({
    text: spokenText,
    apiKey: fishApiKey,
    modelId: fishModelId,
    format: "opus",
  });

  if (!audioBuffer) return;

  // Enviar como mensagem de voz
  await sendVoiceTelegram(TELEGRAM_BOT_TOKEN, chatId, audioBuffer);
}

// ── Exibir menu de agentes ────────────────────────────────────────────────
async function showAgentMenu(
  supabase: ReturnType<typeof createClient>,
  chatId: string,
  collab: Record<string, unknown>,
  allowedIds: Set<string>
) {
  if (allowedIds.size === 0) {
    await sendMessage(chatId, "Nenhum agente especializado disponivel para seu perfil.");
    return;
  }
  const { data: agents } = await supabase
    .from("agent_definitions")
    .select("id, name, emoji, description")
    .in("id", Array.from(allowedIds))
    .eq("active", true)
    .order("name").limit(30);

  if (!agents || agents.length === 0) {
    await sendMessage(chatId, "Nenhum agente especializado ativo no momento.");
    return;
  }

  const firstName = String(collab.name).split(" ")[0];
  const keyboard = [
    [{ text: "💬 Assistente Pessoal", callback_data: "/limpar" }],
    ...(agents as any[]).map(a => ([{ text: `${a.emoji || "🤖"} ${a.name}`, callback_data: `agent:${a.id}` }]))
  ];
  await sendMessage(chatId, `${firstName}, escolha com quem quer conversar:`, { reply_markup: { inline_keyboard: keyboard } });
}

// ── Extrair memória ───────────────────────────────────────────────────────
async function extractAndSaveMemory(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  collaboratorId: string,
  userName: string,
  history: any[],
  lastMessage: string,
  lastReply: string,
  currentMemory: string,
): Promise<void> {
  try {
    const conversationText = [
      ...history.slice(-10).map((h: any) => `${h.role === "user" ? userName : "Bot"}: ${h.content}`),
      `${userName}: ${lastMessage}`,
      `Bot: ${lastReply}`,
    ].join("\n");

    const extractRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 300,
        system: `Voce e um extrator de memorias. Analise a conversa e extraia fatos importantes e duraveis sobre ${userName} que um assistente pessoal deve lembrar: preferencias, projetos, metas, familia, conquistas, problemas, estilo de trabalho. Seja especifico. Maximo 300 palavras. Texto puro sem markdown. Se nao houver nada relevante novo, responda SKIP.`,
        messages: [{ role: "user", content: `Memoria atual:\n${currentMemory || "nenhuma"}\n\nConversa recente:\n${conversationText}\n\nO que deve ser adicionado/atualizado a memoria?` }]
      })
    });

    if (!extractRes.ok) return;
    const extractData = await extractRes.json();
    const newMemory = extractData.content?.[0]?.text || "";
    if (newMemory && newMemory !== "SKIP" && newMemory.length > 10) {
      const updatedMemory = currentMemory
        ? `${currentMemory}\n\n---\n${new Date().toLocaleDateString("pt-BR")}: ${newMemory}`.slice(-2000)
        : newMemory;
      await supabase.from("collaborators").update({ bot_memory: updatedMemory }).eq("id", collaboratorId);
    }
  } catch (_) { /* silently fail */ }
}

// ── Helper send ───────────────────────────────────────────────────────────
async function sendMessage(chatId: string, text: string, extra: Record<string, unknown> = {}) {
  return fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", ...extra }),
  });
}
