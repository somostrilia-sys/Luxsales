/**
 * generate-template
 * IA de criação de templates WhatsApp estratégicos
 * Gera templates de "utilidade" com abordagem comercial assertiva
 * Integra com OpenAI GPT-4o para geração inteligente
 * 
 * Actions: generate, suggest, optimize, list-categories
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const META_TEMPLATE_RULES = `
## Regras de Templates WhatsApp Meta (2026)

### Categorias:
1. **UTILITY** (Utilidade) — Confirmações, atualizações, lembretes, acompanhamento. MAIS BARATO e maior taxa de entrega.
2. **MARKETING** — Promoções, ofertas, novidades. MAIS CARO e pode ser bloqueado.
3. **AUTHENTICATION** — Códigos de verificação. Uso específico.

### Estratégia: UTILITY com inteligência comercial
- Templates de UTILIDADE podem conter CTA comercial desde que o CONTEXTO PRINCIPAL seja utilidade
- Ex: "Seu veículo está desprotegido há X dias" → é utilidade (alerta) mas vende
- Ex: "Confirmação de interesse em proteção veicular" → utilidade (confirmação) mas engaja
- Ex: "Atualização do seu orçamento de proteção" → utilidade (atualização) mas converte

### Regras da Meta:
- Máximo 1024 caracteres no body
- Variáveis: {{1}}, {{2}}, {{3}}... (posicionais)
- Header: texto, imagem, documento ou vídeo (opcional)
- Footer: texto curto (opcional, max 60 chars)
- Botões: até 3 (quick_reply ou call_to_action)
  - Quick reply: texto curto (max 25 chars)
  - CTA: URL ou telefone
- Sem linguagem agressiva, spam ou misleading
- Precisa de exemplo para cada variável
- Nome do template: snake_case, sem espaços

### Tom ideal para proteção veicular:
- Profissional mas próximo
- Urgência sem desespero
- Dados concretos (valores, %)
- Personalização com nome do cliente
`;

const BUSINESS_CONTEXT = `
### Contexto do Negócio:
- **Empresa:** Objetivo Proteção Veicular / Walk Holding / Digital Lux / Trilia
- **Produto principal:** Proteção veicular (associação, não seguro)
- **Diferencial:** Mais acessível que seguro tradicional, sem análise de perfil
- **Público:** Donos de veículos classe B/C/D
- **Palavras PROIBIDAS:** "seguro", "apólice", "sinistro" (usar: proteção, adesão, evento)
- **Ticket médio:** R$ 89-149/mês
- **Cobertura:** Roubo/furto, colisão, terceiros, assistência 24h, carro reserva
- **Objeções comuns:** "já tenho seguro", "tá caro", "não confio", "vou pensar"
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const body = await req.json().catch(() => ({}));
  const action = body.action;

  // Buscar API key
  const { data: configs } = await supabase
    .from("system_configs")
    .select("key, value")
    .in("key", ["openai_api_key", "anthropic_api_key"]);

  const cfg: Record<string, string> = {};
  (configs || []).forEach((c: any) => { cfg[c.key] = c.value; });

  const openaiKey = cfg["openai_api_key"];
  if (!openaiKey) {
    return new Response(
      JSON.stringify({ error: "OpenAI API key not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── LIST-CATEGORIES: listar categorias e exemplos ─────────────────────
  if (action === "list-categories") {
    return new Response(
      JSON.stringify({
        categories: [
          {
            id: "reativacao",
            name: "Reativação de Lead",
            description: "Leads que demonstraram interesse mas não fecharam",
            category: "UTILITY",
            examples: ["Lembrete de orçamento", "Atualização de condições", "Prazo especial expirando"],
          },
          {
            id: "pos_contato",
            name: "Pós-Contato",
            description: "Follow-up após primeira conversa",
            category: "UTILITY",
            examples: ["Confirmação de interesse", "Envio de proposta", "Agendamento de retorno"],
          },
          {
            id: "alerta",
            name: "Alerta de Proteção",
            description: "Avisos sobre riscos e proteção",
            category: "UTILITY",
            examples: ["Veículo desprotegido", "Índice de roubo na região", "Vencimento de proteção"],
          },
          {
            id: "boas_vindas",
            name: "Boas-vindas",
            description: "Primeiro contato com novo lead",
            category: "UTILITY",
            examples: ["Agradecimento por interesse", "Apresentação da empresa", "Próximos passos"],
          },
          {
            id: "pesquisa",
            name: "Pesquisa de Satisfação",
            description: "Feedback de clientes ativos",
            category: "UTILITY",
            examples: ["NPS", "Avaliação de atendimento", "Sugestões"],
          },
          {
            id: "evento",
            name: "Evento / Promoção",
            description: "Campanhas específicas (cuidado: pode ser MARKETING)",
            category: "MARKETING",
            examples: ["Condição especial", "Indicação premiada", "Campanha sazonal"],
          },
          {
            id: "cobranca",
            name: "Cobrança / Financeiro",
            description: "Lembretes de pagamento",
            category: "UTILITY",
            examples: ["Boleto disponível", "Lembrete de vencimento", "Confirmação de pagamento"],
          },
          {
            id: "suporte",
            name: "Suporte / Assistência",
            description: "Atendimento e suporte ao associado",
            category: "UTILITY",
            examples: ["Status de ocorrência", "Agendamento de vistoria", "Atualização cadastral"],
          },
        ],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── GENERATE: criar template com IA ───────────────────────────────────
  if (action === "generate") {
    const objective = body.objective || "reativação de lead";
    const category = body.category || "UTILITY";
    const tone = body.tone || "profissional e próximo";
    const product = body.product || "proteção veicular";
    const company = body.company || "Objetivo";
    const includeButtons = body.include_buttons !== false;
    const includeHeader = body.include_header || false;
    const headerType = body.header_type || "text";
    const quantity = Math.min(body.quantity || 3, 5);
    const customInstructions = body.custom_instructions || "";

    const prompt = `${META_TEMPLATE_RULES}

${BUSINESS_CONTEXT}

## Sua Tarefa:
Crie ${quantity} templates WhatsApp estratégicos para a Meta Business API.

**Objetivo:** ${objective}
**Categoria Meta:** ${category}
**Tom:** ${tone}
**Produto:** ${product}
**Empresa:** ${company}
**Incluir botões:** ${includeButtons ? "Sim (até 2 botões)" : "Não"}
**Incluir header:** ${includeHeader ? `Sim (tipo: ${headerType})` : "Não"}
${customInstructions ? `**Instruções extras:** ${customInstructions}` : ""}

## Formato de resposta (JSON array):
[
  {
    "name": "nome_do_template_snake_case",
    "category": "UTILITY" ou "MARKETING",
    "language": "pt_BR",
    "header": {
      "type": "TEXT" ou "IMAGE",
      "text": "Texto do header (se TEXT)" 
    } ou null,
    "body": "Texto do body com {{1}} para variáveis",
    "footer": "Texto do footer" ou null,
    "buttons": [
      {"type": "QUICK_REPLY", "text": "Texto do botão"},
      {"type": "URL", "text": "Ver detalhes", "url": "https://exemplo.com/{{1}}"}
    ] ou [],
    "example": {
      "body_text": [["João", "R$ 89,90", "Toyota Corolla"]],
      "header_text": ["Atualização importante"]
    },
    "strategy_notes": "Explicação de por que esse template funciona e como usar"
  }
]

IMPORTANTE:
- Foco em UTILITY que vende sem parecer marketing
- Cada template deve ter uma estratégia clara
- Use variáveis para personalização (nome, valor, veículo, data)
- Botões devem ter CTA claro
- Respeite limite de 1024 chars no body
- Templates devem ser aprovados pela Meta (sem spam/agressividade)
- Retorne APENAS o JSON array, sem markdown`;

    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Você é um especialista em WhatsApp Marketing e Meta Business API. Cria templates que maximizam aprovação pela Meta e conversão comercial. Responde APENAS em JSON válido.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 4000,
      }),
    });

    if (!gptRes.ok) {
      const err = await gptRes.text();
      return new Response(
        JSON.stringify({ error: `OpenAI error: ${err}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const gptData = await gptRes.json();
    const content = gptData.choices?.[0]?.message?.content || "[]";

    // Parse JSON (lidar com possível markdown wrapping)
    let templates;
    try {
      const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      templates = JSON.parse(cleaned);
    } catch {
      templates = [{ raw: content, error: "Failed to parse" }];
    }

    return new Response(
      JSON.stringify({
        templates,
        meta: {
          objective,
          category,
          quantity: templates.length,
          model: "gpt-4o",
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── SUGGEST: sugestões baseadas no funil ───────────────────────────────
  if (action === "suggest") {
    const funnel_stage = body.funnel_stage || "all";
    const lead_count = body.lead_count || 1000;

    const prompt = `${META_TEMPLATE_RULES}

${BUSINESS_CONTEXT}

## Tarefa:
Analise o funil de vendas de proteção veicular e sugira uma ESTRATÉGIA COMPLETA de templates WhatsApp.

**Estágio do funil:** ${funnel_stage === "all" ? "Todos os estágios" : funnel_stage}
**Base de leads:** ${lead_count} leads

Retorne um JSON com a estratégia:
{
  "strategy": {
    "name": "Nome da estratégia",
    "description": "Descrição geral",
    "expected_conversion": "X-Y%",
    "estimated_reach": ${lead_count}
  },
  "funnel": [
    {
      "stage": "awareness|interest|consideration|decision|retention",
      "stage_name": "Nome em PT-BR",
      "template_suggestions": [
        {
          "name": "nome_snake_case",
          "objective": "O que esse template faz",
          "category": "UTILITY",
          "timing": "Quando enviar (ex: D+1 após primeiro contato)",
          "body_preview": "Preview curto do texto...",
          "expected_open_rate": "X%",
          "priority": "alta|media|baixa"
        }
      ]
    }
  ],
  "sequence_recommendation": "Ordem ideal de envio dos templates",
  "tips": ["Dica 1", "Dica 2"]
}

Retorne APENAS JSON válido.`;

    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Você é um estrategista de growth hacking especializado em WhatsApp Business e proteção veicular no Brasil. Pensa em funil, conversão e automação. Responde APENAS em JSON válido.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    const gptData = await gptRes.json();
    const content = gptData.choices?.[0]?.message?.content || "{}";

    let strategy;
    try {
      const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      strategy = JSON.parse(cleaned);
    } catch {
      strategy = { raw: content, error: "Failed to parse" };
    }

    return new Response(
      JSON.stringify(strategy),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── OPTIMIZE: otimizar template existente ─────────────────────────────
  if (action === "optimize") {
    const template_body = body.template_body || "";
    const current_category = body.current_category || "MARKETING";
    const goal = body.goal || "converter de MARKETING para UTILITY mantendo a intenção comercial";

    if (!template_body) {
      return new Response(
        JSON.stringify({ error: "template_body is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `${META_TEMPLATE_RULES}

## Template atual:
Categoria: ${current_category}
Body: "${template_body}"

## Objetivo: ${goal}

Otimize este template e retorne JSON:
{
  "original": "${template_body}",
  "optimized": [
    {
      "body": "Texto otimizado",
      "category": "UTILITY",
      "changes": ["O que mudou e por quê"],
      "approval_probability": "alta|media|baixa",
      "reasoning": "Por que essa versão é melhor"
    }
  ],
  "tips": ["Dicas gerais"]
}

Retorne APENAS JSON válido.`;

    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Você é especialista em aprovação de templates WhatsApp pela Meta. Otimiza templates para máxima aprovação e conversão. Responde APENAS em JSON válido.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 2000,
      }),
    });

    const gptData = await gptRes.json();
    const content = gptData.choices?.[0]?.message?.content || "{}";

    let result;
    try {
      const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      result = { raw: content, error: "Failed to parse" };
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── SUBMIT: submeter template pra Meta ────────────────────────────────
  if (action === "submit") {
    const template = body.template;
    if (!template || !template.name || !template.body) {
      return new Response(
        JSON.stringify({ error: "template with name and body is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar token da Meta
    const { data: cred } = await supabase
      .from("whatsapp_meta_credentials")
      .select("meta_access_token, meta_waba_id")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!cred?.meta_access_token || !cred?.meta_waba_id) {
      return new Response(
        JSON.stringify({ error: "Meta credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Montar payload da Meta
    const components: any[] = [];

    // Header
    if (template.header) {
      const headerComp: any = {
        type: "HEADER",
        format: template.header.type || "TEXT",
      };
      if (template.header.type === "TEXT") {
        headerComp.text = template.header.text;
        if (template.example?.header_text) {
          headerComp.example = { header_text: template.example.header_text };
        }
      }
      components.push(headerComp);
    }

    // Body
    const bodyComp: any = {
      type: "BODY",
      text: template.body,
    };
    if (template.example?.body_text) {
      bodyComp.example = { body_text: template.example.body_text };
    }
    components.push(bodyComp);

    // Footer
    if (template.footer) {
      components.push({
        type: "FOOTER",
        text: template.footer,
      });
    }

    // Buttons
    if (template.buttons?.length) {
      const buttons = template.buttons.map((b: any) => {
        if (b.type === "QUICK_REPLY") {
          return { type: "QUICK_REPLY", text: b.text };
        }
        if (b.type === "URL") {
          return { type: "URL", text: b.text, url: b.url };
        }
        if (b.type === "PHONE_NUMBER") {
          return { type: "PHONE_NUMBER", text: b.text, phone_number: b.phone_number };
        }
        return b;
      });
      components.push({ type: "BUTTONS", buttons });
    }

    const metaPayload = {
      name: template.name,
      category: template.category || "UTILITY",
      language: template.language || "pt_BR",
      components,
    };

    const metaRes = await fetch(
      `https://graph.facebook.com/v22.0/${cred.meta_waba_id}/message_templates`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${cred.meta_access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metaPayload),
      }
    );

    const metaData = await metaRes.json();

    if (!metaRes.ok) {
      return new Response(
        JSON.stringify({ error: "Meta rejected template", details: metaData }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Salvar no banco
    await supabase.from("whatsapp_meta_templates").upsert({
      company_id: (await supabase.from("whatsapp_meta_credentials").select("company_id").eq("is_active", true).limit(1).maybeSingle()).data?.company_id,
      name: template.name,
      category: template.category || "UTILITY",
      language: template.language || "pt_BR",
      status: "PENDING",
      body_text: template.body,
      header_type: template.header?.type || null,
      header_text: template.header?.text || null,
      footer_text: template.footer || null,
      buttons: template.buttons || [],
      meta_template_id: metaData.id,
    }, { onConflict: "name,language" }).catch(() => {});

    return new Response(
      JSON.stringify({
        success: true,
        meta_template_id: metaData.id,
        status: metaData.status,
        template_name: template.name,
        message: "Template submetido para aprovação da Meta",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── PRE-GENERATE: gerar 6 templates estratégicos pós-ligação ─────────
  if (action === "pre-generate") {
    const templateDefs = getStrategicTemplates();

    // Buscar credenciais Meta
    const { data: cred } = await supabase
      .from("whatsapp_meta_credentials")
      .select("meta_access_token, meta_waba_id, company_id")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!cred?.meta_access_token || !cred?.meta_waba_id) {
      return new Response(
        JSON.stringify({ error: "Meta credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const template of templateDefs) {
      const components: any[] = [];

      if (template.header) {
        const headerComp: any = { type: "HEADER", format: template.header.type };
        if (template.header.type === "TEXT") {
          headerComp.text = template.header.text;
          if (template.example?.header_text) {
            headerComp.example = { header_text: template.example.header_text };
          }
        }
        components.push(headerComp);
      }

      const bodyComp: any = { type: "BODY", text: template.body };
      if (template.example?.body_text) {
        bodyComp.example = { body_text: template.example.body_text };
      }
      components.push(bodyComp);

      if (template.footer) {
        components.push({ type: "FOOTER", text: template.footer });
      }

      if (template.buttons?.length) {
        components.push({
          type: "BUTTONS",
          buttons: template.buttons.map((b: any) => {
            if (b.type === "QUICK_REPLY") return { type: "QUICK_REPLY", text: b.text };
            if (b.type === "URL") return { type: "URL", text: b.text, url: b.url };
            return b;
          }),
        });
      }

      const metaPayload = {
        name: template.name,
        category: template.category,
        language: template.language,
        components,
      };

      try {
        const metaRes = await fetch(
          `https://graph.facebook.com/v22.0/${cred.meta_waba_id}/message_templates`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${cred.meta_access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(metaPayload),
          }
        );

        const metaData = await metaRes.json();

        // Salvar no banco independente do resultado da Meta
        await supabase.from("whatsapp_meta_templates").upsert({
          company_id: cred.company_id,
          name: template.name,
          category: template.category,
          language: template.language,
          status: metaRes.ok ? "PENDING" : "REJECTED",
          body_text: template.body,
          header_type: template.header?.type || null,
          header_text: template.header?.text || null,
          footer_text: template.footer || null,
          buttons: template.buttons || [],
          meta_template_id: metaData.id || null,
          rejection_reason: metaRes.ok ? null : JSON.stringify(metaData.error || metaData),
        }, { onConflict: "name,language" });

        results.push({
          name: template.name,
          success: metaRes.ok,
          meta_id: metaData.id,
          status: metaRes.ok ? "PENDING_APPROVAL" : "REJECTED",
          error: metaRes.ok ? null : metaData.error?.message,
        });
      } catch (e) {
        results.push({ name: template.name, success: false, error: String(e) });
      }
    }

    const submitted = results.filter((r) => r.success).length;
    return new Response(
      JSON.stringify({
        success: true,
        submitted,
        failed: results.length - submitted,
        results,
        message: `${submitted}/${results.length} templates submetidos para aprovação Meta`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      error: "Invalid action",
      available: ["generate", "suggest", "optimize", "submit", "list-categories", "pre-generate"],
    }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

// ── Templates estratégicos pós-ligação ─────────────────────────────────────
function getStrategicTemplates() {
  return [
    {
      name: "pos_ligacao_interesse_alto",
      category: "UTILITY",
      language: "pt_BR",
      header: { type: "TEXT", text: "Objetivo Proteção Veicular" },
      body: "Olá {{1}}! Acabei de falar com você sobre proteção para seu {{2}}. Como prometido, aqui estão os detalhes:\n\n✅ Roubo e furto cobertos\n✅ Colisão e terceiros\n✅ Assistência 24h + guincho\n✅ Carro reserva por até 7 dias\n✅ Rastreador incluso\n\nA partir de R$ 89/mês, sem análise de perfil.\n\nPosso te mandar uma simulação personalizada para o seu veículo?",
      footer: "Objetivo Proteção Veicular",
      buttons: [
        { type: "QUICK_REPLY", text: "Sim, quero simulação" },
        { type: "QUICK_REPLY", text: "Ligar depois" },
      ],
      example: { body_text: [["João", "Corolla 2020"]], header_text: ["Objetivo Proteção Veicular"] },
    },
    {
      name: "pos_ligacao_interesse_medio",
      category: "UTILITY",
      language: "pt_BR",
      header: { type: "TEXT", text: "Seu veículo está protegido?" },
      body: "Oi {{1}}, aqui é o Lucas da Objetivo! Tivemos uma conversa hoje e quero deixar algumas informações úteis sobre proteção veicular para você avaliar com calma.\n\nProteção cooperativa é bem diferente do seguro tradicional — mais acessível e sem burocracia.\n\nSeu {{2}} pode estar protegido por menos do que você imagina. Posso te enviar os valores?",
      footer: "Responda SIM para receber",
      buttons: [
        { type: "QUICK_REPLY", text: "Ver valores" },
        { type: "QUICK_REPLY", text: "Não tenho interesse" },
      ],
      example: { body_text: [["Maria", "Gol 2019"]], header_text: ["Seu veículo está protegido?"] },
    },
    {
      name: "pos_ligacao_atendeu",
      category: "UTILITY",
      language: "pt_BR",
      body: "Olá {{1}}! Obrigado por atender minha ligação hoje. Sou Lucas da Objetivo Proteção Veicular.\n\nEntendo que pode não ter sido o melhor momento para conversar. Deixo aqui um resumo rápido do que oferecemos:\n\n🛡️ Proteção completa para seu {{2}}\n💰 A partir de R$ 89/mês\n📱 Sem burocracia, tudo pelo WhatsApp\n\nSe tiver interesse em saber mais, é só responder aqui!",
      footer: "Objetivo Proteção Veicular",
      buttons: [{ type: "QUICK_REPLY", text: "Quero saber mais" }],
      example: { body_text: [["Carlos", "veículo"]] },
    },
    {
      name: "pos_ligacao_simulacao",
      category: "UTILITY",
      language: "pt_BR",
      header: { type: "TEXT", text: "Simulação personalizada" },
      body: "{{1}}, preparei uma simulação exclusiva para o seu {{2}} {{3}}:\n\n📋 Cobertura completa: Roubo, Furto, Colisão, Terceiros\n🚗 Assistência 24h + Carro reserva\n📡 Rastreador incluso sem custo\n\n💰 Sua proteção: a partir de R$ {{4}}/mês\n\nEssa condição é especial e válida por 48h. Quer prosseguir com a adesão?",
      footer: "Condição válida por 48h",
      buttons: [
        { type: "QUICK_REPLY", text: "Quero aderir" },
        { type: "QUICK_REPLY", text: "Tenho dúvidas" },
      ],
      example: { body_text: [["Ana", "HB20", "2021", "99,90"]], header_text: ["Simulação personalizada"] },
    },
    {
      name: "pos_ligacao_nao_quis",
      category: "UTILITY",
      language: "pt_BR",
      body: "Olá {{1}}, tudo bem? Aqui é o Lucas da Objetivo Proteção Veicular.\n\nRespeitamos sua decisão de hoje. Só queria deixar registrado que, caso mude de ideia ou precise de uma proteção acessível para seu veículo no futuro, estamos à disposição.\n\nCuriosidade: sabia que 1 em cada 4 veículos no Brasil fica sem proteção? Se um dia precisar, lembre de nós. 😊",
      footer: "Objetivo Proteção Veicular",
      buttons: [{ type: "QUICK_REPLY", text: "Quero saber mais" }],
      example: { body_text: [["Pedro"]] },
    },
    {
      name: "reengajamento_7dias",
      category: "UTILITY",
      language: "pt_BR",
      header: { type: "TEXT", text: "Ainda pensando na proteção?" },
      body: "{{1}}, passaram 7 dias desde nossa última conversa sobre proteção para seu {{2}}.\n\nNossa proteção cooperativa continua disponível e as condições seguem as mesmas. Posso tirar alguma dúvida ou enviar a simulação atualizada?",
      footer: "Objetivo Proteção Veicular",
      buttons: [
        { type: "QUICK_REPLY", text: "Ver simulação" },
        { type: "QUICK_REPLY", text: "Não tenho interesse" },
      ],
      example: { body_text: [["Lucas", "veículo"]], header_text: ["Ainda pensando na proteção?"] },
    },
  ];
}
