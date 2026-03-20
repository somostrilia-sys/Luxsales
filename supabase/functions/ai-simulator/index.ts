/**
 * Walk Agente Central Hub - AI Simulator
 *
 * Simula uma ligação real com IA:
 * 1. Recebe áudio do lead (base64) → transcreve via Deepgram STT
 * 2. Ou recebe texto direto (fallback)
 * 3. Gera resposta com Claude Haiku
 * 4. Gera áudio TTS da resposta (sempre, para simular ligação)
 * 5. Retorna texto + áudio base64
 */

import { retryWithBackoff, fetchWithTimeout } from '../_shared/retry.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY')
const CARTESIA_API_KEY = Deno.env.get('CARTESIA_API_KEY')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const {
      messages,
      system_prompt,
      voice_key,
      audio_base64,      // áudio do lead (gravado pelo mic)
      audio_content_type, // ex: "audio/webm;codecs=opus"
      text,               // texto direto (fallback se não tiver áudio)
    } = body

    if (!system_prompt) {
      return jsonResponse({ error: 'system_prompt é obrigatório' }, 400)
    }

    // 1. Transcrever áudio do lead se enviado
    let leadText = text || ''
    if (audio_base64 && !text) {
      leadText = await transcribeAudio(audio_base64, audio_content_type)
      if (!leadText) {
        return jsonResponse({ error: 'Não foi possível transcrever o áudio. Tente novamente.' }, 400)
      }
    }

    if (!leadText && (!messages || messages.length === 0)) {
      return jsonResponse({ error: 'Envie áudio ou texto para iniciar a conversa' }, 400)
    }

    // 2. Montar histórico de conversa
    const conversationMessages = (messages || []).map((m: { role: string; content: string }) => ({
      role: m.role === 'lead' ? 'user' : m.role === 'ai' ? 'assistant' : m.role,
      content: m.content,
    }))

    // Adicionar mensagem atual do lead
    if (leadText) {
      conversationMessages.push({ role: 'user', content: leadText })
    }

    // 3. Gerar resposta com Claude
    const claudeResponse = await retryWithBackoff(() => fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: system_prompt,
        messages: conversationMessages,
      }),
    }, 20000))

    if (!claudeResponse.ok) {
      const errorBody = await claudeResponse.text()
      console.error('Claude error:', errorBody)
      return jsonResponse({ error: 'Erro ao gerar resposta da IA' }, 500)
    }

    const claudeResult = await claudeResponse.json()
    const responseText = claudeResult.content?.[0]?.text || ''

    // 4. Gerar áudio TTS da resposta (sempre — é uma simulação de ligação)
    let audioBase64: string | null = null
    const vk = voice_key || 'default'

    // Tentar Cartesia primeiro
    if (CARTESIA_API_KEY) {
      audioBase64 = await generateCartesiaTTS(responseText, vk)
    }

    // Fallback: chamar edge function generate-voice
    if (!audioBase64) {
      audioBase64 = await generateVoiceViaEdge(responseText, vk)
    }

    return jsonResponse({
      lead_transcript: leadText,
      response: responseText,
      audio_base64: audioBase64,
    })
  } catch (err) {
    console.error('Error:', err)
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})

// ── STT: Transcrever áudio com Deepgram ──
async function transcribeAudio(base64Audio: string, contentType?: string): Promise<string> {
  if (!DEEPGRAM_API_KEY) {
    console.warn('DEEPGRAM_API_KEY not set')
    return ''
  }

  try {
    const audioBuffer = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0))

    const res = await retryWithBackoff(() => fetchWithTimeout(
      'https://api.deepgram.com/v1/listen?model=nova-2&language=pt-BR&smart_format=true&punctuate=true',
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': contentType || 'audio/webm',
        },
        body: audioBuffer,
      },
      15000
    ), 2)

    if (!res.ok) {
      console.error('Deepgram error:', await res.text())
      return ''
    }

    const result = await res.json()
    return result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''
  } catch (err) {
    console.error('STT error:', err)
    return ''
  }
}

// ── TTS: Cartesia direta ──
async function generateCartesiaTTS(text: string, voiceKey: string): Promise<string | null> {
  try {
    // Buscar voice_id do Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.49.1')
    const sb = createClient(supabaseUrl, supabaseKey)

    const { data: voice } = await sb
      .from('voice_profiles')
      .select('provider, voice_key')
      .eq('voice_key', voiceKey)
      .maybeSingle()

    const cartesiaVoiceId = voice?.voice_key || voiceKey

    const res = await fetchWithTimeout('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        'X-API-Key': CARTESIA_API_KEY!,
        'Cartesia-Version': '2024-06-10',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: 'sonic-multilingual',
        transcript: text,
        voice: { mode: 'id', id: cartesiaVoiceId },
        output_format: { container: 'mp3', bit_rate: 128000, sample_rate: 44100 },
        language: 'pt',
      }),
    }, 15000)

    if (!res.ok) {
      console.error('Cartesia error:', await res.text())
      return null
    }

    const audioBytes = new Uint8Array(await res.arrayBuffer())
    // Convert to base64
    let binary = ''
    for (let i = 0; i < audioBytes.length; i++) {
      binary += String.fromCharCode(audioBytes[i])
    }
    return btoa(binary)
  } catch (err) {
    console.error('Cartesia TTS error:', err)
    return null
  }
}

// ── TTS: Fallback via edge function ──
async function generateVoiceViaEdge(text: string, voiceKey: string): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const res = await fetchWithTimeout(`${supabaseUrl}/functions/v1/generate-voice`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'generate',
        text,
        voice_key: voiceKey,
      }),
    }, 15000)

    if (res.ok) {
      const result = await res.json()
      return result?.audio_base64 || null
    }
    return null
  } catch {
    return null
  }
}

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
