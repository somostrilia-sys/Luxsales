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
    const { action, collaborator_id, messages } = body;

    if (action === "save") {
      if (!collaborator_id) return json({ error: "collaborator_id obrigatório" }, 400);
      if (!messages || !Array.isArray(messages) || messages.length > 5) {
        return json({ error: "messages deve ser array com até 5 mensagens" }, 400);
      }

      const { data, error } = await supabase
        .from("blast_messages")
        .upsert({
          collaborator_id,
          message_1: messages[0] || null,
          message_2: messages[1] || null,
          message_3: messages[2] || null,
          message_4: messages[3] || null,
          message_5: messages[4] || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "collaborator_id" })
        .select()
        .single();

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, config: data });
    }

    if (action === "load") {
      if (!collaborator_id) return json({ error: "collaborator_id obrigatório" }, 400);

      const { data } = await supabase
        .from("blast_messages")
        .select("*")
        .eq("collaborator_id", collaborator_id)
        .maybeSingle();

      if (!data) {
        return json({
          messages: [
            "Olá! Tudo bem? Estou entrando em contato porque temos uma oportunidade especial de proteção veicular para você. Posso te explicar rapidinho?",
            "Oi! Vi que você tem interesse em proteção para seu veículo. Aqui na Objetivo temos planos a partir de R$ 89/mês com cobertura completa. Quer saber mais?",
            "E aí, tudo certo? Passando pra te falar sobre nossa proteção veicular. Cobrimos roubo, furto, colisão e ainda tem assistência 24h. Posso te enviar uma cotação?",
            "Boa tarde! Sou consultor da Objetivo Proteção Veicular. Temos planos com o melhor custo-benefício da região. Posso te ajudar com uma cotação sem compromisso?",
            "Olá! Você sabia que pode proteger seu veículo por menos de R$ 3/dia? Sem análise de perfil e sem fidelidade. Quer conhecer nossos planos?"
          ],
          is_default: true
        });
      }

      return json({
        messages: [data.message_1, data.message_2, data.message_3, data.message_4, data.message_5].filter(Boolean),
        is_default: false,
        updated_at: data.updated_at,
      });
    }

    return json({ error: "action inválida. Use: save, load" }, 400);

  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
