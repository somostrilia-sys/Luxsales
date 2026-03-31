/**
 * template-intelligence
 * Evolução do generate-template com:
 * - Validador rigoroso de regras Meta
 * - Score de confiança (0-100)
 * - Feedback loop com rejeições anteriores
 * - Foco em UTILITY (não MARKETING)
 * - Knowledge base de regras Meta embutida
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const META_API = "https://graph.facebook.com/v22.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "generate":
        return await generateTemplates(body);
      case "validate":
        return await validateTemplate(body);
      case "submit":
        return await submitTemplate(body);
      case "list-approved":
        return await listApproved(body);
      case "rejection-history":
        return await rejectionHistory(body);
      default:
        return json({ error: "Action inválida" }, 400);
    }
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});

// ── REGRAS META (Knowledge Base — parte fixa) ──────────────────────────

const META_RULES_BASE = `
REGRAS ABSOLUTAS PARA TEMPLATES WHATSAPP META (UTILITY):

FORMATO:
- Body: máximo 1024 caracteres
- Header TEXT: máximo 60 caracteres
- Footer: máximo 60 caracteres
- Variáveis: formato {{1}}, {{2}}, {{3}} — sequenciais, sem pular
- Máximo 3 botões QUICK_REPLY (20 chars cada) OU 2 URL + 1 PHONE
- Examples obrigatórios para cada variável

CONTEÚDO UTILITY (obrigatório):
- Deve fornecer informação esperada/solicitada pelo usuário
- Relacionado a interação prévia (opt-in, compra, solicitação)
- Tom informativo, profissional mas acessível
- Call-to-action sutil permitido, mas foco em utilidade
- NÃO pode parecer MARKETING disfarçado

PROIBIDO:
- Linguagem urgente/pressionadora ("ÚLTIMA CHANCE", "CORRA", "SÓ HOJE")
- CAPS LOCK excessivo (máximo 3 palavras seguidas)
- Emojis excessivos (máximo 2 por template)
- URLs encurtadas (bit.ly, goo.gl, tinyurl)
- Promessas de desconto/promoção em UTILITY
- Conteúdo enganoso ou clickbait
- Spam keywords ("GRÁTIS", "GANHE", "PRÊMIO", "SORTEIO")

BOAS PRÁTICAS:
- Primeira frase personalizada com nome ({{1}})
- Tom como se fosse um consultor real escrevendo
- Frases curtas e diretas
- Footer com opção de sair: "Responda SAIR para não receber mais"
- Botões claros e descritivos
`;

// Palavras proibidas fixas (spam genérico)
const GLOBAL_FORBIDDEN_WORDS = [
  "grátis", "gratuito", "promoção", "desconto",
  "última chance", "corra", "só hoje", "urgente",
  "imperdível", "oferta", "liquidação", "sorteio",
  "exclusivo", "limitado",
];

/**
 * Buscar company_config e montar regras dinâmicas
 */
async function getSegmentRules(companyId: string) {
  const { data: config } = await supabase
    .from("company_config")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  // Palavras proibidas = globais + do segmento
  const segmentForbidden: string[] = config?.forbidden_words || [];
  const allForbidden = [...GLOBAL_FORBIDDEN_WORDS, ...segmentForbidden];

  // Montar regras dinâmicas
  let segmentRules = "";

  if (config) {
    const allowed = (config.allowed_words || []).join(", ");
    const forbidden = segmentForbidden.join('", "');

    segmentRules = `
SEGMENTO: ${config.segment_display_name || config.segment}
EMPRESA: ${config.persona_company}
PERSONA: ${config.persona_name} (${config.persona_role || "consultor"})
TOM: ${config.persona_tone}

${forbidden ? `PALAVRAS PROIBIDAS DO SEGMENTO (nunca use): "${forbidden}"` : ""}
${allowed ? `USE ESTAS PALAVRAS: ${allowed}` : ""}

${config.product_data ? `PRODUTO/SERVIÇO:\n${JSON.stringify(config.product_data, null, 2)}` : ""}

CAMPOS DISPONÍVEIS COMO VARIÁVEIS (extraction_schema):
${Object.entries(config.extraction_schema || {}).map(([k, v]: [string, any]) => `- ${k}: ${v.label} (${v.type})`).join("\n")}
`;
  }

  return {
    config,
    allForbidden,
    metaRules: META_RULES_BASE + segmentRules,
  };
}

/**
 * Gerar templates com IA + validação
 */
async function generateTemplates(body: any) {
  const {
    company_id,
    objective,        // "follow-up para quem recebeu proposta"
    count = 3,        // quantas variações
    category = "UTILITY",
    requester_role,
  } = body;

  if (requester_role !== "ceo") {
    return json({ error: "Apenas o CEO pode criar templates" }, 403);
  }

  if (!objective) {
    return json({ error: "Informe o objetivo do template" }, 400);
  }

  // Buscar regras do segmento
  const { config: companyConfig, allForbidden, metaRules } = await getSegmentRules(company_id);

  // Buscar extraction_schema pra sugerir variable_mapping
  const schemaFields = companyConfig?.extraction_schema
    ? Object.entries(companyConfig.extraction_schema)
        .map(([k, v]: [string, any]) => `${k} (${v.label})`)
        .join(", ")
    : "";

  // Buscar rejeições anteriores pra IA aprender
  const { data: rejections } = await supabase
    .from("template_rejection_log")
    .select("template_content, rejection_reason, ai_analysis")
    .eq("company_id", company_id)
    .order("rejected_at", { ascending: false })
    .limit(5);

  const rejectionsContext = rejections?.length
    ? `\n\nTEMPLATES REJEITADOS ANTERIORMENTE (aprenda com eles):\n${rejections
        .map(
          (r: any) =>
            `- Conteúdo: ${JSON.stringify(r.template_content)}\n  Motivo: ${r.rejection_reason}\n  Análise: ${r.ai_analysis || "N/A"}`
        )
        .join("\n")}`
    : "";

  // Buscar top templates por performance
  const { data: topTemplates } = await supabase
    .from("template_performance")
    .select("template_name, reply_rate, read_rate, performance_score")
    .eq("company_id", company_id)
    .order("performance_score", { ascending: false })
    .limit(3);

  const performanceContext = topTemplates?.length
    ? `\n\nTEMPLATES COM MELHOR PERFORMANCE:\n${topTemplates
        .map(
          (t: any) =>
            `- ${t.template_name}: score ${t.performance_score}, reply ${t.reply_rate}%, read ${t.read_rate}%`
        )
        .join("\n")}`
    : "";

  // Chamar LLM
  const apiKey =
    Deno.env.get("ANTHROPIC_API_KEY") ||
    (await getConfig("anthropic_api_key"));

  if (!apiKey) {
    return json({ error: "API key do Claude não configurada" }, 500);
  }

  const prompt = `Você é um especialista em templates WhatsApp Business API da Meta.
Crie ${count} variações de template para o seguinte objetivo:
"${objective}"

${metaRules}
${rejectionsContext}
${performanceContext}

Retorne um JSON array com cada template no formato:
[
  {
    "name": "nome_do_template_snake_case",
    "category": "${category}",
    "language": "pt_BR",
    "components": {
      "header": { "type": "TEXT", "text": "Header aqui (max 60 chars)" },
      "body": "Texto do body com {{1}} variáveis {{2}} (max 1024 chars)",
      "footer": "Responda SAIR para não receber mais",
      "buttons": [
        { "type": "QUICK_REPLY", "text": "Tenho interesse" },
        { "type": "QUICK_REPLY", "text": "Agora não" }
      ]
    },
    "examples": {
      "header": ["Exemplo header"],
      "body": ["João", "valor exemplo"]
    },
    "strategy_note": "Por que este template funciona",
    "suggested_slot": "pos_ligacao_principal|follow_up_48h|envio_proposta|etc",
    "variable_mapping": {
      "{{1}}": {"source": "lead_name"},
      "{{2}}": {"source": "extracted.campo_do_schema"}
    }
  }
]

${schemaFields ? `\nCAMPOS DISPONÍVEIS PARA VARIÁVEIS (use em variable_mapping com "extracted.campo"):\n${schemaFields}\nAlém disso: "lead_name", "product_data.base_price", "company_config.persona_name", "company_config.persona_company"` : ""}

SLOTS DISPONÍVEIS para suggested_slot:
pos_ligacao_principal, pos_ligacao_alternativo, follow_up_48h, follow_up_72h, envio_proposta, aviso_ligacao, confirmacao, pesquisa_satisfacao, reativacao, custom

APENAS o JSON, sem markdown nem explicação.`;

  const llmRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!llmRes.ok) {
    return json({ error: `LLM error: ${llmRes.status}` }, 500);
  }

  const llmData = await llmRes.json();
  const content = llmData.content?.[0]?.text || "";

  let templates: any[];
  try {
    // Extrair JSON do response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    templates = JSON.parse(jsonMatch ? jsonMatch[0] : content);
  } catch {
    return json({ error: "Erro ao parsear resposta da IA", raw: content }, 500);
  }

  // Validar cada template com palavras proibidas do segmento
  const results = templates.map((t: any) => {
    const validation = validateTemplateRules(t, allForbidden);
    return {
      ...t,
      validation,
      confidence_score: validation.score,
      recommendation:
        validation.score >= 85
          ? "SUBMETER"
          : validation.score >= 70
          ? "REVISAR"
          : "REESCREVER",
    };
  });

  return json({ templates: results, segment: companyConfig?.segment || "generic" });
}

/**
 * Validar template contra regras Meta (dinâmico por segmento)
 */
async function validateTemplate(body: any) {
  const { template, company_id } = body;
  if (!template) return json({ error: "Informe o template" }, 400);

  const { allForbidden } = company_id
    ? await getSegmentRules(company_id)
    : { allForbidden: GLOBAL_FORBIDDEN_WORDS };

  const validation = validateTemplateRules(template, allForbidden);
  return json({ validation });
}

/**
 * Submeter template pra Meta
 */
async function submitTemplate(body: any) {
  const { company_id, template, requester_role } = body;

  if (requester_role !== "ceo") {
    return json({ error: "Apenas o CEO pode submeter templates" }, 403);
  }

  // Validar antes
  const validation = validateTemplateRules(template);
  if (validation.score < 70) {
    return json({
      error: "Template não passou na validação",
      validation,
      suggestion: "Corrija os problemas listados e tente novamente",
    }, 400);
  }

  // Buscar credenciais
  const cfg = await getMetaConfig(company_id);
  if (!cfg.token || !cfg.wabaId) {
    return json({ error: "Credenciais Meta não configuradas" }, 400);
  }

  // Montar payload Meta
  const components: any[] = [];

  if (template.components.header) {
    components.push({
      type: "HEADER",
      format: template.components.header.type || "TEXT",
      text: template.components.header.text,
      example: template.examples?.header
        ? { header_text: template.examples.header }
        : undefined,
    });
  }

  components.push({
    type: "BODY",
    text: template.components.body,
    example: template.examples?.body
      ? { body_text: [template.examples.body] }
      : undefined,
  });

  if (template.components.footer) {
    components.push({
      type: "FOOTER",
      text: template.components.footer,
    });
  }

  if (template.components.buttons?.length) {
    components.push({
      type: "BUTTONS",
      buttons: template.components.buttons.map((b: any) => ({
        type: b.type,
        text: b.text,
        url: b.url,
        phone_number: b.phone_number,
      })),
    });
  }

  const payload = {
    name: template.name,
    category: template.category || "UTILITY",
    language: template.language || "pt_BR",
    components,
  };

  // Enviar pra Meta
  const res = await fetch(`${META_API}/${cfg.wabaId}/message_templates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await res.json();

  if (!res.ok) {
    // Salvar rejeição pra feedback loop
    await supabase.from("template_rejection_log").insert({
      company_id,
      template_name: template.name,
      template_content: template.components,
      category: template.category,
      rejection_reason: result.error?.message || "Unknown",
      meta_error_code: result.error?.code?.toString(),
      meta_error_message: result.error?.error_user_msg || result.error?.message,
    });

    return json({
      error: result.error?.message || "Meta rejeitou o template",
      meta_error: result.error,
      suggestion: "O template foi salvo no log de rejeições para melhorar futuras gerações",
    }, 400);
  }

  // Salvar template localmente
  await supabase.from("whatsapp_meta_templates").upsert(
    {
      company_id,
      meta_template_id: result.id,
      name: template.name,
      language: template.language || "pt_BR",
      category: template.category || "UTILITY",
      status: result.status || "PENDING",
      components: template.components,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id,name" }
  ).catch(() => {
    // Se não tem constraint, inserir
    supabase.from("whatsapp_meta_templates").insert({
      company_id,
      meta_template_id: result.id,
      name: template.name,
      language: template.language || "pt_BR",
      category: template.category || "UTILITY",
      status: result.status || "PENDING",
      components: template.components,
      last_synced_at: new Date().toISOString(),
    });
  });

  return json({
    success: true,
    meta_template_id: result.id,
    status: result.status || "PENDING",
    message: "Template submetido — aguardando aprovação da Meta",
  });
}

/**
 * Listar templates aprovados (pra vendedores escolherem)
 */
async function listApproved(body: any) {
  const { company_id, collaborator_id } = body;

  let approvedNames: string[] | null = null;

  // Se tem collaborator_id, filtrar pelos templates permitidos
  if (collaborator_id) {
    const { data: perm } = await supabase
      .from("dispatch_permissions")
      .select("allowed_templates, role")
      .eq("collaborator_id", collaborator_id)
      .eq("is_active", true)
      .maybeSingle();

    if (perm && perm.role !== "ceo") {
      try {
        approvedNames =
          typeof perm.allowed_templates === "string"
            ? JSON.parse(perm.allowed_templates)
            : perm.allowed_templates || [];
      } catch {
        approvedNames = [];
      }
    }
  }

  let query = supabase
    .from("whatsapp_meta_templates")
    .select("name, category, language, components, quality_score")
    .eq("company_id", company_id)
    .eq("status", "APPROVED")
    .order("name");

  if (approvedNames && approvedNames.length > 0) {
    query = query.in("name", approvedNames);
  }

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 500);

  // Enriquecer com performance
  const templateNames = (data || []).map((t: any) => t.name);
  const { data: perf } = await supabase
    .from("template_performance")
    .select("template_name, performance_score, reply_rate, read_rate")
    .eq("company_id", company_id)
    .in("template_name", templateNames);

  const perfMap: Record<string, any> = {};
  for (const p of perf || []) perfMap[p.template_name] = p;

  const enriched = (data || []).map((t: any) => ({
    ...t,
    performance: perfMap[t.name] || null,
  }));

  return json({ templates: enriched });
}

/**
 * Histórico de rejeições
 */
async function rejectionHistory(body: any) {
  const { company_id } = body;

  const { data } = await supabase
    .from("template_rejection_log")
    .select("*")
    .eq("company_id", company_id)
    .order("rejected_at", { ascending: false })
    .limit(20);

  return json({ rejections: data || [] });
}

// ── VALIDADOR DE REGRAS ──────────────────────────────────────────────────

function validateTemplateRules(template: any, forbiddenWords: string[] = GLOBAL_FORBIDDEN_WORDS) {
  const issues: { severity: "error" | "warning"; message: string }[] = [];
  let score = 100;

  const body = template.components?.body || "";
  const header = template.components?.header?.text || "";
  const footer = template.components?.footer || "";
  const buttons = template.components?.buttons || [];
  const name = template.name || "";

  // Nome
  if (!name.match(/^[a-z0-9_]+$/)) {
    issues.push({ severity: "error", message: "Nome deve ser snake_case (a-z, 0-9, _)" });
    score -= 20;
  }

  // Body
  if (body.length > 1024) {
    issues.push({ severity: "error", message: `Body excede 1024 chars (${body.length})` });
    score -= 30;
  }
  if (body.length < 10) {
    issues.push({ severity: "error", message: "Body muito curto" });
    score -= 30;
  }

  // Header
  if (header && header.length > 60) {
    issues.push({ severity: "error", message: `Header excede 60 chars (${header.length})` });
    score -= 20;
  }

  // Footer
  if (footer && footer.length > 60) {
    issues.push({ severity: "error", message: `Footer excede 60 chars (${footer.length})` });
    score -= 20;
  }

  // Variáveis sequenciais
  const varMatches = body.match(/\{\{(\d+)\}\}/g) || [];
  const varNumbers = varMatches.map((v: string) => parseInt(v.replace(/[{}]/g, "")));
  for (let i = 0; i < varNumbers.length; i++) {
    if (varNumbers[i] !== i + 1) {
      issues.push({ severity: "error", message: "Variáveis devem ser sequenciais: {{1}}, {{2}}, {{3}}" });
      score -= 15;
      break;
    }
  }

  // Examples
  if (varNumbers.length > 0 && (!template.examples?.body || template.examples.body.length < varNumbers.length)) {
    issues.push({ severity: "error", message: "Faltam examples para as variáveis" });
    score -= 15;
  }

  // Botões
  if (buttons.length > 3) {
    issues.push({ severity: "error", message: "Máximo 3 botões" });
    score -= 15;
  }
  for (const btn of buttons) {
    if (btn.type === "QUICK_REPLY" && btn.text?.length > 20) {
      issues.push({ severity: "error", message: `Botão "${btn.text}" excede 20 chars` });
      score -= 10;
    }
  }

  // Palavras proibidas (globais + segmento)
  const fullText = `${header} ${body} ${footer}`.toLowerCase();
  for (const word of forbiddenWords) {
    if (fullText.includes(word.toLowerCase())) {
      issues.push({ severity: "error", message: `Palavra proibida encontrada: "${word}"` });
      score -= 15;
    }
  }

  // CAPS LOCK excessivo
  const capsWords = fullText.match(/\b[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ]{4,}\b/g) || [];
  if (capsWords.length > 3) {
    issues.push({ severity: "warning", message: "CAPS LOCK excessivo (mais de 3 palavras)" });
    score -= 10;
  }

  // Emojis excessivos
  const emojiCount = (fullText.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2702}-\u{27B0}]/gu) || []).length;
  if (emojiCount > 2) {
    issues.push({ severity: "warning", message: `Muitos emojis (${emojiCount}) — máximo 2` });
    score -= 5;
  }

  // URLs encurtadas
  if (fullText.match(/bit\.ly|goo\.gl|tinyurl|short\.link/i)) {
    issues.push({ severity: "error", message: "URLs encurtadas não são permitidas" });
    score -= 15;
  }

  // UTILITY específico
  if (template.category === "UTILITY") {
    const marketingWords = ["promoção", "desconto", "oferta", "imperdível", "exclusivo"];
    for (const w of marketingWords) {
      if (fullText.includes(w)) {
        issues.push({ severity: "warning", message: `Template UTILITY com linguagem de marketing: "${w}"` });
        score -= 8;
      }
    }
  }

  // Footer com opt-out
  if (!footer.toLowerCase().includes("sair") && !footer.toLowerCase().includes("parar")) {
    issues.push({ severity: "warning", message: "Footer deveria ter opção de opt-out ('Responda SAIR...')" });
    score -= 3;
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    passed: score >= 70,
    issues,
    errors: issues.filter((i) => i.severity === "error").length,
    warnings: issues.filter((i) => i.severity === "warning").length,
  };
}

// ── HELPERS ──────────────────────────────────────────────────────────────

async function getConfig(key: string): Promise<string | null> {
  const { data } = await supabase
    .from("system_configs")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value || null;
}

async function getMetaConfig(companyId: string) {
  const { data: configs } = await supabase
    .from("system_configs")
    .select("key, value")
    .in("key", ["meta_whatsapp_token", "meta_waba_id"]);

  const cfg: Record<string, string> = {};
  for (const c of configs || []) cfg[c.key] = c.value;

  if (!cfg.meta_whatsapp_token || !cfg.meta_waba_id) {
    const { data: cred } = await supabase
      .from("whatsapp_meta_credentials")
      .select("access_token, waba_id")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .maybeSingle();

    if (cred) {
      cfg.meta_whatsapp_token = cfg.meta_whatsapp_token || cred.access_token;
      cfg.meta_waba_id = cfg.meta_waba_id || cred.waba_id;
    }
  }

  return { token: cfg.meta_whatsapp_token, wabaId: cfg.meta_waba_id };
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
