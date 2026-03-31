/**
 * meta-rules
 * Consulta de regras Meta + Validação de templates pela IA
 *
 * Actions:
 *   list          — Lista regras por categoria
 *   search        — Busca regras por texto
 *   validate      — IA valida template contra as regras
 *   suggest       — IA sugere melhorias no template
 *   check-compliance — Verifica compliance geral da empresa
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
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "list":
        return await listRules(body);
      case "search":
        return await searchRules(body);
      case "validate":
        return await validateTemplate(body);
      case "suggest":
        return await suggestImprovements(body);
      case "check-compliance":
        return await checkCompliance(body);
      default:
        return json({ error: "Action inválida. Use: list, search, validate, suggest, check-compliance" }, 400);
    }
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});

/**
 * Listar regras por categoria
 */
async function listRules(body: any) {
  const { category, severity, region = "BR" } = body;

  let query = supabase
    .from("meta_rules")
    .select("*")
    .eq("is_active", true)
    .order("category")
    .order("severity");

  if (category) query = query.eq("category", category);
  if (severity) query = query.eq("severity", severity);

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 500);

  // Filtrar por região
  const filtered = (data || []).filter((r: any) =>
    !r.region || r.region.includes("ALL") || r.region.includes(region)
  );

  // Agrupar por categoria
  const grouped: Record<string, any[]> = {};
  for (const rule of filtered) {
    if (!grouped[rule.category]) grouped[rule.category] = [];
    grouped[rule.category].push(rule);
  }

  return json({ rules: filtered, grouped, total: filtered.length });
}

/**
 * Buscar regras por texto
 */
async function searchRules(body: any) {
  const { query: searchQuery } = body;

  if (!searchQuery) return json({ error: "query é obrigatório" }, 400);

  const { data } = await supabase
    .from("meta_rules")
    .select("*")
    .eq("is_active", true)
    .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
    .order("severity");

  return json({ rules: data || [], total: data?.length || 0 });
}

/**
 * IA valida template contra as regras Meta
 */
async function validateTemplate(body: any) {
  const { template_name, template_body, template_category, template_buttons, company_id } = body;

  if (!template_body || !template_category) {
    return json({ error: "template_body e template_category são obrigatórios" }, 400);
  }

  // Buscar todas regras ativas aplicáveis
  const { data: rules } = await supabase
    .from("meta_rules")
    .select("rule_key, title, description, severity, applies_to, category")
    .eq("is_active", true)
    .order("severity");

  // Filtrar regras aplicáveis à categoria
  const applicableRules = (rules || []).filter((r: any) =>
    r.applies_to?.includes("all") || r.applies_to?.includes(template_category.toLowerCase())
  );

  // Buscar config da empresa pra contexto
  let companyConfig: any = null;
  if (company_id) {
    const { data } = await supabase
      .from("company_config")
      .select("segment, forbidden_words, allowed_words")
      .eq("company_id", company_id)
      .maybeSingle();
    companyConfig = data;
  }

  // Buscar IA disponível
  const aiConfig = await getAvailableAI();

  if (!aiConfig) {
    // Fallback: validação sem IA (rule-based only)
    return ruleBasedValidation(template_body, template_category, template_buttons, applicableRules, companyConfig);
  }

  // Validação com IA
  const rulesText = applicableRules
    .map((r: any) => `[${r.severity.toUpperCase()}] ${r.title}: ${r.description}`)
    .join("\n");

  const prompt = `Você é um especialista em compliance da Meta WhatsApp Business API.

REGRAS OFICIAIS:
${rulesText}

${companyConfig ? `CONTEXTO DA EMPRESA:
- Segmento: ${companyConfig.segment}
- Palavras proibidas: ${JSON.stringify(companyConfig.forbidden_words || [])}
- Palavras permitidas: ${JSON.stringify(companyConfig.allowed_words || [])}` : ""}

TEMPLATE A VALIDAR:
- Nome: ${template_name || "não informado"}
- Categoria: ${template_category}
- Corpo: ${template_body}
- Botões: ${JSON.stringify(template_buttons || [])}

Analise o template e retorne um JSON com:
{
  "approved": true/false,
  "score": 0-100 (qualidade do template),
  "category_correct": true/false (a categoria está correta?),
  "suggested_category": "MARKETING" ou "UTILITY" ou "AUTHENTICATION",
  "violations": [
    {"rule_key": "xxx", "severity": "must/should", "message": "explicação"}
  ],
  "warnings": ["aviso 1", "aviso 2"],
  "suggestions": ["sugestão de melhoria 1", "sugestão 2"],
  "improved_body": "versão melhorada do corpo (se necessário)"
}

Responda APENAS com o JSON, sem markdown.`;

  try {
    const aiResult = await callAI(aiConfig, prompt);

    if (!aiResult.success) {
      const fb = await ruleBasedValidation(template_body, template_category, template_buttons, applicableRules, companyConfig);
      const fbData = await fb.json();
      return json({ ...fbData, ai_error: aiResult.error });
    }

    const aiText = aiResult.text;

    if (!aiText) {
      // Fallback rule-based
      const fb = await ruleBasedValidation(template_body, template_category, template_buttons, applicableRules, companyConfig);
      const fbData = await fb.json();
      return json({ ...fbData, ai_note: "IA retornou vazio, usando validação por regras" });
    }

    // Parse JSON da resposta
    let validation: any;
    try {
      validation = JSON.parse(aiText);
    } catch {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { validation = JSON.parse(jsonMatch[0]); } catch { validation = null; }
      }
    }

    if (!validation) {
      const fb = await ruleBasedValidation(template_body, template_category, template_buttons, applicableRules, companyConfig);
      const fbData = await fb.json();
      return json({ ...fbData, ai_raw: aiText.slice(0, 200) });
    }

    return json({
      validation,
      rules_checked: applicableRules.length,
      model: "claude-sonnet-4-20250514",
    });
  } catch (err) {
    // Fallback pra rule-based se IA falhar
    const fallback = await ruleBasedValidation(template_body, template_category, template_buttons, applicableRules, companyConfig);
    const fallbackData = await fallback.json();
    return json({ ...fallbackData, ai_error: (err as Error).message });
  }
}

/**
 * Validação baseada em regras (sem IA)
 */
async function ruleBasedValidation(
  body: string,
  category: string,
  buttons: any[],
  rules: any[],
  companyConfig: any
) {
  const violations: any[] = [];
  const warnings: string[] = [];
  const bodyLower = body.toLowerCase();

  // Verificar botão de opt-out em marketing
  if (category.toLowerCase() === "marketing") {
    const hasOptOut = buttons?.some((b: any) =>
      b.type === "QUICK_REPLY" && (
        b.text?.toLowerCase().includes("parar") ||
        b.text?.toLowerCase().includes("cancelar") ||
        b.text?.toLowerCase().includes("sair")
      )
    );
    if (!hasOptOut) {
      violations.push({
        rule_key: "tpl_optout_button",
        severity: "must",
        message: "Template de marketing deve ter botão de opt-out (ex: 'Parar de receber')",
      });
    }
  }

  // Verificar conteúdo proibido
  const prohibited = ["arma", "droga", "casino", "aposta", "loteria", "cigarro", "vape", "bebida alcoólica", "empréstimo fácil", "ganhe dinheiro rápido", "pirâmide", "multinível"];
  for (const word of prohibited) {
    if (bodyLower.includes(word)) {
      violations.push({
        rule_key: "tpl_no_prohibited_content",
        severity: "must",
        message: `Conteúdo proibido detectado: "${word}"`,
      });
    }
  }

  // Verificar palavras proibidas da empresa
  if (companyConfig?.forbidden_words) {
    for (const word of companyConfig.forbidden_words) {
      if (bodyLower.includes(word.toLowerCase())) {
        warnings.push(`Palavra proibida pela empresa: "${word}"`);
      }
    }
  }

  // Verificar se template é muito genérico
  if (!body.includes("{{") && category.toLowerCase() !== "authentication") {
    warnings.push("Template sem variáveis de personalização ({{1}}, {{2}}). Templates personalizados têm melhor performance.");
  }

  // Verificar tamanho
  if (body.length > 1024) {
    warnings.push("Template muito longo (>1024 chars). Templates concisos têm melhor taxa de leitura.");
  }

  if (body.length < 20) {
    warnings.push("Template muito curto (<20 chars). Pode ser rejeitado por falta de contexto.");
  }

  const approved = violations.filter(v => v.severity === "must").length === 0;

  return json({
    validation: {
      approved,
      score: approved ? (violations.length === 0 && warnings.length === 0 ? 90 : 70) : 30,
      category_correct: true,
      violations,
      warnings,
      suggestions: [],
      method: "rule-based",
    },
    rules_checked: rules.length,
  });
}

/**
 * IA sugere/gera templates inteligentes
 * Aceita: template_body (melhorar) OU intent (gerar do zero)
 * Otimiza pra menor custo (UTILITY quando possível)
 */
async function suggestImprovements(body: any) {
  const { template_body, template_category, company_id, intent } = body;

  if (!template_body && !intent) {
    return json({ error: "Informe template_body (pra melhorar) ou intent (pra gerar). Ex: intent='vender proteção veicular pra lead que já recebeu ligação'" }, 400);
  }

  // Buscar API key disponível (tentar Claude → OpenAI → Groq)
  const aiConfig = await getAvailableAI();

  if (!aiConfig) {
    return json({ error: "Nenhuma API key de IA configurada. Configure anthropic_api_key, openai_api_key ou groq_api_key em system_configs." }, 500);
  }

  // Buscar regras
  const { data: rules } = await supabase
    .from("meta_rules")
    .select("title, description")
    .eq("is_active", true)
    .in("category", ["template", "best_practice", "pricing"]);

  let companyContext = "";
  if (company_id) {
    const { data: config } = await supabase
      .from("company_config")
      .select("segment, persona_name, persona_role, persona_tone, product_data, allowed_words, forbidden_words")
      .eq("company_id", company_id)
      .maybeSingle();

    if (config) {
      companyContext = `
CONTEXTO DA EMPRESA:
- Segmento: ${config.segment}
- Persona: ${config.persona_name} (${config.persona_role})
- Tom: ${config.persona_tone}
- Palavras obrigatórias: ${JSON.stringify(config.allowed_words)}
- Palavras proibidas: ${JSON.stringify(config.forbidden_words)}
- Dados do produto: ${JSON.stringify(config.product_data)}`;
    }
  }

  // Montar prompt baseado no modo (melhorar vs gerar por intent)
  const isGenerate = !!intent && !template_body;

  const prompt = `Você é um especialista em compliance e otimização de custos da Meta WhatsApp Business API.

REGRAS E BOAS PRÁTICAS META 2026:
${(rules || []).map((r: any) => `- ${r.title}: ${r.description}`).join("\n")}

REGRA DE CUSTO CRÍTICA:
- MARKETING: ~$0.0625/msg (CARO) — usar SOMENTE quando for claramente promocional
- UTILITY: ~$0.0068/msg (BARATO) — usar SEMPRE QUE POSSÍVEL
- UTILITY dentro da janela 24h: GRÁTIS
- Service (resposta ao cliente): GRÁTIS
- ESTRATÉGIA: Enquadrar como UTILITY sempre que o template for transacional, confirmação, lembrete, atualização de status, follow-up de atendimento
${companyContext}

${isGenerate ? `
OBJETIVO: Gerar template do ZERO baseado nesta intenção:
"${intent}"

Gere 3 versões do template, priorizando UTILITY (menor custo) quando possível.
Se não for possível ser UTILITY (é claramente promocional), use MARKETING mas inclua botão de opt-out.

Para cada versão, explique:
- Por que escolheu aquela categoria
- Quanto custaria por envio
- Se poderia ser enquadrado como UTILITY
` : `
TEMPLATE ATUAL (categoria: ${template_category || "não definida"}):
${template_body}

Gere 3 versões melhoradas, otimizando pra menor custo (UTILITY quando possível).
`}

Cada versão DEVE:
1. Ter variáveis personalizáveis ({{1}} = nome do lead, {{2}} = dado relevante)
2. CTA claro e direto
3. Max 160 chars (ideal pra leitura rápida)
4. Tom da empresa (se disponível)
5. Botão de opt-out SE for MARKETING
6. PRIORIZAR UTILITY quando o conteúdo permitir

Retorne APENAS JSON (sem markdown):
{
  "analysis": "análise em 2 linhas",
  "suggestions": [
    {
      "version": 1,
      "body": "texto do template com {{1}} e {{2}}",
      "category": "UTILITY ou MARKETING",
      "cost_per_msg": "$0.0068 ou $0.0625",
      "cost_justification": "por que essa categoria",
      "buttons": [{"type":"QUICK_REPLY","text":"texto"}],
      "reason": "por que essa versão é boa",
      "variables": {"{{1}}": "nome do lead", "{{2}}": "dado relevante"}
    }
  ],
  "recommended_version": 1,
  "savings_tip": "dica de como economizar nos envios"
}`;

  const aiResult = await callAI(aiConfig, prompt);

  if (!aiResult.success) {
    return json({ error: "IA indisponível: " + aiResult.error, provider: aiConfig.provider }, 500);
  }

  let result: any;
  try {
    result = JSON.parse(aiResult.text);
  } catch {
    const jsonMatch = aiResult.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { result = JSON.parse(jsonMatch[0]); } catch { result = null; }
    }
  }

  return json({
    suggestions: result || { raw: aiResult.text },
    provider: aiConfig.provider,
    model: aiConfig.model,
  });
}

/**
 * Verificar compliance geral da empresa
 */
async function checkCompliance(body: any) {
  const { company_id } = body;

  if (!company_id) return json({ error: "company_id é obrigatório" }, 400);

  const checks: any[] = [];

  // 1. Verificar company_config existe
  const { data: config } = await supabase
    .from("company_config")
    .select("*")
    .eq("company_id", company_id)
    .maybeSingle();

  checks.push({
    item: "Company Config",
    status: config ? "ok" : "fail",
    detail: config ? `${config.company_name} — ${config.segment}` : "Configuração da empresa não encontrada",
  });

  // 2. Verificar credentials Meta
  const { data: cred } = await supabase
    .from("whatsapp_meta_credentials")
    .select("meta_access_token, meta_phone_number_id, quality_rating")
    .eq("company_id", company_id)
    .eq("is_active", true)
    .maybeSingle();

  checks.push({
    item: "Meta Credentials",
    status: cred?.meta_access_token ? "ok" : "fail",
    detail: cred ? `Phone: ${cred.meta_phone_number_id}, Quality: ${cred.quality_rating || "N/A"}` : "Sem credentials ativas",
  });

  // 3. Verificar templates aprovados
  const { count: approvedTemplates } = await supabase
    .from("whatsapp_meta_templates")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company_id)
    .eq("status", "APPROVED");

  checks.push({
    item: "Templates Aprovados",
    status: (approvedTemplates || 0) > 0 ? "ok" : "warning",
    detail: `${approvedTemplates || 0} templates aprovados`,
  });

  // 4. Verificar opt-ins
  const { count: activeOptIns } = await supabase
    .from("whatsapp_opt_ins")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company_id)
    .eq("status", "active");

  checks.push({
    item: "Opt-ins Ativos",
    status: (activeOptIns || 0) > 0 ? "ok" : "warning",
    detail: `${activeOptIns || 0} opt-ins ativos`,
  });

  // 5. Verificar CEO/dispatch permissions
  const { data: perms } = await supabase
    .from("dispatch_permissions")
    .select("role")
    .eq("company_id", company_id)
    .eq("is_active", true);

  const hasCeo = perms?.some((p: any) => p.role === "ceo");
  checks.push({
    item: "Permissões (CEO)",
    status: hasCeo ? "ok" : "fail",
    detail: `${perms?.length || 0} colaboradores, CEO: ${hasCeo ? "sim" : "NÃO"}`,
  });

  // 6. Verificar quality rating
  const { data: quality } = await supabase
    .from("meta_quality_tracking")
    .select("quality_rating, messaging_limit_tier")
    .eq("company_id", company_id)
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  checks.push({
    item: "Quality Rating",
    status: quality?.quality_rating === "GREEN" ? "ok" : quality?.quality_rating === "YELLOW" ? "warning" : quality ? "fail" : "unknown",
    detail: quality ? `${quality.quality_rating} — Tier: ${quality.messaging_limit_tier}` : "Sem dados de qualidade",
  });

  // 7. Verificar LGPD
  const lgpdChecks = [];
  if (!config) lgpdChecks.push("Sem config de empresa");
  if ((activeOptIns || 0) === 0) lgpdChecks.push("Sem opt-ins registrados");

  checks.push({
    item: "LGPD Compliance",
    status: lgpdChecks.length === 0 ? "ok" : "warning",
    detail: lgpdChecks.length === 0 ? "Básico OK" : lgpdChecks.join(", "),
  });

  // Score geral
  const okCount = checks.filter(c => c.status === "ok").length;
  const score = Math.round((okCount / checks.length) * 100);

  return json({
    compliance_score: score,
    checks,
    total_checks: checks.length,
    passed: okCount,
    warnings: checks.filter(c => c.status === "warning").length,
    failed: checks.filter(c => c.status === "fail").length,
  });
}

/**
 * Buscar API key disponível (Claude → OpenAI → Groq)
 */
async function getAvailableAI(): Promise<{ provider: string; key: string; model: string } | null> {
  const { data: configs } = await supabase
    .from("system_configs")
    .select("key, value")
    .in("key", ["anthropic_api_key", "openai_api_key", "groq_api_key"]);

  const cfg: Record<string, string> = {};
  for (const c of configs || []) cfg[c.key] = c.value;

  if (cfg.anthropic_api_key) {
    return { provider: "anthropic", key: cfg.anthropic_api_key, model: "claude-sonnet-4-20250514" };
  }
  if (cfg.openai_api_key) {
    return { provider: "openai", key: cfg.openai_api_key, model: "gpt-4o" };
  }
  if (cfg.groq_api_key) {
    return { provider: "groq", key: cfg.groq_api_key, model: "llama-3.3-70b-versatile" };
  }
  return null;
}

/**
 * Chamar IA (suporta Anthropic, OpenAI, Groq)
 */
async function callAI(config: { provider: string; key: string; model: string }, prompt: string): Promise<{ success: boolean; text: string; error?: string }> {
  try {
    if (config.provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": config.key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) return { success: false, text: "", error: `Anthropic ${res.status}` };
      const data = await res.json();
      return { success: true, text: data.content?.[0]?.text || "" };
    }

    if (config.provider === "openai" || config.provider === "groq") {
      const baseUrl = config.provider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.groq.com/openai/v1/chat/completions";

      const res = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) return { success: false, text: "", error: `${config.provider} ${res.status}` };
      const data = await res.json();
      return { success: true, text: data.choices?.[0]?.message?.content || "" };
    }

    return { success: false, text: "", error: "Provider desconhecido" };
  } catch (err) {
    return { success: false, text: "", error: (err as Error).message };
  }
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
