/**
 * Walk Agente Central Hub - AI Simulator
 *
 * Edge Function para simulação de conversas com IA.
 * Recebe histórico de mensagens + system prompt e retorna resposta da IA.
 * Opcionalmente gera áudio TTS da resposta.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
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
    const body = await req.json()
    const { messages, system_prompt, voice_key, generate_audio } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return jsonResponse({ error: 'messages é obrigatório e deve ser um array não vazio' }, 400)
    }

    if (!system_prompt) {
      return jsonResponse({ error: 'system_prompt é obrigatório' }, 400)
    }

    // Chamar Claude Haiku para resposta rápida
    const claudeResponse = await retryWithBackoff(() => fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: system_prompt,
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role === 'lead' ? 'user' : m.role === 'ai' ? 'assistant' : m.role,
          content: m.content,
        })),
      }),
    }, 20000))

    if (!claudeResponse.ok) {
      const errorBody = await claudeResponse.text()
      console.error('Claude error:', errorBody)
      return jsonResponse({ error: 'Erro ao gerar resposta da IA' }, 500)
    }

    const claudeResult = await claudeResponse.json()
    const responseText = claudeResult.content?.[0]?.text || ''

    const result: Record<string, unknown> = {
      response: responseText,
    }

    // Gerar áudio TTS se solicitado
    if (generate_audio && voice_key) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        const ttsResponse = await fetchWithTimeout(`${supabaseUrl}/functions/v1/generate-voice`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'generate',
            text: responseText,
            voice_key: voice_key,
          }),
        }, 15000)

        if (ttsResponse.ok) {
          const ttsResult = await ttsResponse.json()
          if (ttsResult?.audio_base64) {
            result.audio_base64 = ttsResult.audio_base64
          }
        }
      } catch (ttsErr) {
        console.error('TTS error (non-fatal):', ttsErr)
        // Continua sem áudio - não é fatal
      }
    }

    return jsonResponse(result)
  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
