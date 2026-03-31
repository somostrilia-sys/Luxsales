/**
 * Walk Agente Central Hub - VoIP AI Bridge
 *
 * Edge Function para operações de IA relacionadas a chamadas:
 * - Análise pós-chamada (sentimento, qualificação, resumo)
 * - Transcrição de gravações
 * - Geração de insights de campanhas
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { retryWithBackoff, fetchWithTimeout } from '../_shared/retry.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const { action } = body

    switch (action) {
      case 'analyze_call': {
        // Análise pós-chamada com Claude
        const { call_id } = body

        // Buscar transcrição
        const { data: callLog } = await supabase
          .from('call_logs')
          .select('*, ai_call_scripts(*)')
          .eq('call_id', call_id)
          .single()

        if (!callLog?.ai_transcript || callLog.ai_transcript.length === 0) {
          return jsonResponse({ error: 'Sem transcrição para analisar' }, 400)
        }

        // Montar transcrição legível
        const transcriptText = callLog.ai_transcript
          .map((t: { role: string; text: string }) => `${t.role === 'ai' ? 'IA' : 'Cliente'}: ${t.text}`)
          .join('\n')

        // Analisar com Claude
        const analysis = await analyzeWithClaude(transcriptText, callLog.ai_call_scripts)

        // Atualizar call_log com análise
        await supabase
          .from('call_logs')
          .update({
            sentiment_overall: analysis.sentiment,
            sentiment_scores: analysis.sentiment_scores,
            detected_intents: analysis.intents,
            extracted_entities: analysis.entities,
            conversation_quality_score: analysis.quality_score,
            goal_achieved: analysis.goal_achieved,
            goal_details: analysis.goal_details,
            lead_temperature: analysis.lead_temperature,
            next_action: analysis.next_action,
            ai_summary: analysis.summary,
            ai_qualification: analysis.lead_temperature,
          })
          .eq('call_id', call_id)

        return jsonResponse({ ok: true, analysis })
      }

      case 'transcribe_recording': {
        // Transcrever gravação (chamado quando a gravação é processada)
        const { recording_id } = body

        const { data: recording } = await supabase
          .from('call_recordings')
          .select('*')
          .eq('id', recording_id)
          .single()

        if (!recording?.recording_url) {
          return jsonResponse({ error: 'Gravação não encontrada' }, 404)
        }

        // Marcar como em processamento
        await supabase
          .from('call_recordings')
          .update({ transcription_status: 'processing' })
          .eq('id', recording_id)

        // Chamar Deepgram para transcrição (com retry e timeout)
        const deepgramKey = Deno.env.get('DEEPGRAM_API_KEY')
        const dgResponse = await retryWithBackoff(() => fetchWithTimeout('https://api.deepgram.com/v1/listen?' + new URLSearchParams({
          model: 'nova-2',
          language: 'pt-BR',
          punctuate: 'true',
          diarize: 'true',
          smart_format: 'true',
          paragraphs: 'true',
        }), {
          method: 'POST',
          headers: {
            'Authorization': `Token ${deepgramKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: recording.recording_url }),
        }, 30000))

        if (!dgResponse.ok) {
          await supabase
            .from('call_recordings')
            .update({
              transcription_status: 'failed',
              transcription_error: `Deepgram error: ${dgResponse.status}`,
            })
            .eq('id', recording_id)

          return jsonResponse({ error: 'Transcription failed' }, 500)
        }

        const dgResult = await dgResponse.json()
        const transcript = dgResult.results?.channels?.[0]?.alternatives?.[0]

        // Salvar transcrição
        await supabase
          .from('call_recordings')
          .update({
            transcription_status: 'completed',
            transcription_text: transcript?.transcript || '',
            transcription_segments: transcript?.paragraphs?.paragraphs || [],
            transcription_confidence: transcript?.confidence || 0,
            transcription_provider: 'deepgram',
            transcription_language: 'pt-BR',
          })
          .eq('id', recording_id)

        return jsonResponse({ ok: true, transcript: transcript?.transcript })
      }

      case 'transcribe_and_analyze': {
        // Pipeline completo: transcrever → analisar → salvar em calls
        const { recording_id, call_id: taCallId, company_id: taCompanyId } = body

        const { data: recording } = await supabase
          .from('call_recordings')
          .select('*')
          .eq('id', recording_id)
          .single()

        if (!recording?.recording_url) {
          return jsonResponse({ error: 'Gravação não encontrada' }, 404)
        }

        // 1. Transcrever com Deepgram
        await supabase
          .from('call_recordings')
          .update({ transcription_status: 'processing' })
          .eq('id', recording_id)

        let transcriptText = ''
        const deepgramKey = Deno.env.get('DEEPGRAM_API_KEY')

        if (deepgramKey) {
          try {
            const dgResponse = await retryWithBackoff(() => fetchWithTimeout('https://api.deepgram.com/v1/listen?' + new URLSearchParams({
              model: 'nova-2',
              language: 'pt-BR',
              punctuate: 'true',
              diarize: 'true',
              smart_format: 'true',
              paragraphs: 'true',
            }), {
              method: 'POST',
              headers: {
                'Authorization': `Token ${deepgramKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ url: recording.recording_url }),
            }, 60000))

            if (dgResponse.ok) {
              const dgResult = await dgResponse.json()
              const transcript = dgResult.results?.channels?.[0]?.alternatives?.[0]
              transcriptText = transcript?.transcript || ''

              await supabase
                .from('call_recordings')
                .update({
                  transcription_status: 'completed',
                  transcription_text: transcriptText,
                  transcription_segments: transcript?.paragraphs?.paragraphs || [],
                  transcription_confidence: transcript?.confidence || 0,
                  transcription_provider: 'deepgram',
                  transcription_language: 'pt-BR',
                })
                .eq('id', recording_id)
            } else {
              await supabase
                .from('call_recordings')
                .update({ transcription_status: 'failed', transcription_error: `Deepgram: ${dgResponse.status}` })
                .eq('id', recording_id)
            }
          } catch (err) {
            console.error('[transcribe_and_analyze] Deepgram error:', err)
            await supabase
              .from('call_recordings')
              .update({ transcription_status: 'failed', transcription_error: String(err) })
              .eq('id', recording_id)
          }
        } else {
          console.warn('[transcribe_and_analyze] DEEPGRAM_API_KEY não configurada')
          await supabase
            .from('call_recordings')
            .update({ transcription_status: 'failed', transcription_error: 'DEEPGRAM_API_KEY não configurada' })
            .eq('id', recording_id)
        }

        // 2. Analisar com Claude (se transcrição ok)
        if (transcriptText.length > 20 && ANTHROPIC_API_KEY) {
          try {
            const analysis = await analyzeWithClaude(transcriptText, null)

            // Salvar análise na tabela calls (principal)
            await supabase
              .from('calls')
              .update({
                transcript: transcriptText,
                call_summary: analysis.summary,
                sentiment: analysis.sentiment,
                interest_detected: analysis.lead_temperature === 'hot' || analysis.lead_temperature === 'warm',
                ai_analysis: analysis,
              })
              .eq('id', taCallId)

            // Também salvar em call_logs se existir
            await supabase
              .from('call_logs')
              .update({
                sentiment_overall: analysis.sentiment,
                sentiment_scores: analysis.sentiment_scores,
                detected_intents: analysis.intents,
                extracted_entities: analysis.entities,
                conversation_quality_score: analysis.quality_score,
                goal_achieved: analysis.goal_achieved,
                goal_details: analysis.goal_details,
                lead_temperature: analysis.lead_temperature,
                next_action: analysis.next_action,
                ai_summary: analysis.summary,
                lucas_summary: analysis.summary,
              })
              .eq('call_id', taCallId)

            console.log(`[transcribe_and_analyze] Call ${taCallId} analyzed: ${analysis.sentiment}, ${analysis.lead_temperature}`)
          } catch (err) {
            console.error('[transcribe_and_analyze] Claude analysis error:', err)
          }
        }

        return jsonResponse({ ok: true, transcribed: transcriptText.length > 0 })
      }

      case 'campaign_insights': {
        // Gerar insights de uma campanha
        const { campaign_id, company_id } = body

        // Buscar últimas chamadas da campanha
        const { data: calls } = await supabase
          .from('call_logs')
          .select('ai_summary, lead_temperature, sentiment_overall, detected_intents, goal_achieved')
          .eq('campaign_id', campaign_id)
          .eq('company_id', company_id)
          .order('created_at', { ascending: false })
          .limit(50)

        if (!calls || calls.length === 0) {
          return jsonResponse({ error: 'Sem chamadas para analisar' }, 400)
        }

        // Gerar insights com Claude
        const insightsPrompt = `Analise estas ${calls.length} chamadas de uma campanha de vendas e gere insights:

${calls.map((c, i) => `Chamada ${i + 1}: ${c.ai_summary || 'sem resumo'} | Lead: ${c.lead_temperature} | Sentimento: ${c.sentiment_overall} | Meta: ${c.goal_achieved ? 'sim' : 'não'}`).join('\n')}

Retorne JSON com: { "summary": "resumo geral", "top_objections": ["..."], "recommendations": ["..."], "best_time_to_call": "...", "script_improvements": ["..."] }`

        const response = await retryWithBackoff(() => fetchWithTimeout('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': ANTHROPIC_API_KEY!,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1000,
            messages: [{ role: 'user', content: insightsPrompt }],
          }),
        }))

        const result = await response.json()
        const insights = JSON.parse(result.content[0].text)

        return jsonResponse({ ok: true, insights })
      }

      default:
        return jsonResponse({ error: `Ação desconhecida: ${action}` }, 400)
    }

  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ============================================================
// Claude Analysis
// ============================================================

async function analyzeWithClaude(transcript: string, script: Record<string, unknown> | null) {
  const prompt = `Analise esta transcrição de ligação de vendas e retorne JSON puro (sem markdown):

TRANSCRIÇÃO:
${transcript}

${script ? `OBJETIVO DO SCRIPT: ${script.name} - ${script.description}` : ''}

Retorne exatamente este JSON:
{
  "sentiment": "positive|neutral|negative|mixed",
  "sentiment_scores": {"positive": 0.0, "negative": 0.0, "neutral": 0.0},
  "intents": ["lista de intenções detectadas"],
  "entities": {"nomes": [], "empresas": [], "produtos": [], "valores": [], "datas": []},
  "quality_score": 0.0,
  "goal_achieved": true|false,
  "goal_details": {"description": "..."},
  "lead_temperature": "hot|warm|cold|dead",
  "next_action": "descrição da próxima ação recomendada",
  "summary": "resumo em 2-3 frases"
}`

  const response = await retryWithBackoff(() => fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    }),
  }))

  const result = await response.json()
  return JSON.parse(result.content[0].text)
}

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
