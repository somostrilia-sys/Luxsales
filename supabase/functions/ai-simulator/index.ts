/**
 * AI Simulator - Simula ligação real com IA
 * Aceita JSON ou multipart/form-data
 */

import { retryWithBackoff, fetchWithTimeout } from '../_shared/retry.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY')
const CARTESIA_API_KEY = Deno.env.get('CARTESIA_API_KEY')

interface ParsedRequest {
  messages: { role: string; content: string }[]
  system_prompt: string
  voice_key: string
  text: string
  audioBlob: Uint8Array | null
  audioContentType: string
  context: { vendor_name?: string; product?: string; tone?: string; objective?: string } | null
}

async function parseRequest(req: Request): Promise<ParsedRequest> {
  const ct = req.headers.get('content-type') || ''

  if (ct.includes('multipart/form-data')) {
    const form = await req.formData()
    const audioFile = form.get('audio') as File | null
    let audioBlob: Uint8Array | null = null
    let audioContentType = 'audio/webm'

    if (audioFile && audioFile.size > 0) {
      audioBlob = new Uint8Array(await audioFile.arrayBuffer())
      audioContentType = audioFile.type || 'audio/webm'
    }

    const historyRaw = form.get('history') as string | null
    const contextRaw = form.get('context') as string | null
    const voice_key = (form.get('voice_key') as string) || 'default'
    const system_prompt = (form.get('system_prompt') as string) || ''
    const text = (form.get('text') as string) || ''

    let messages: { role: string; content: string }[] = []
    if (historyRaw) {
      try {
        const parsed = JSON.parse(historyRaw)
        messages = Array.isArray(parsed) ? parsed.map((m: { role: string; text?: string; content?: string }) => ({
          role: m.role === 'agent' ? 'ai' : m.role === 'user' ? 'lead' : m.role,
          content: m.text || m.content || '',
        })) : []
      } catch { /* ignore */ }
    }

    let context = null
    if (contextRaw) {
      try { context = JSON.parse(contextRaw) } catch { /* ignore */ }
    }

    return { messages, system_prompt, voice_key, text, audioBlob, audioContentType, context }
  }

  // JSON fallback
  const body = await req.json()
  let audioBlob: Uint8Array | null = null
  if (body.audio_base64) {
    audioBlob = Uint8Array.from(atob(body.audio_base64), (c: string) => c.charCodeAt(0))
  }

  return {
    messages: body.messages || [],
    system_prompt: body.system_prompt || '',
    voice_key: body.voice_key || 'default',
    text: body.text || '',
    audioBlob,
    audioContentType: body.audio_content_type || 'audio/webm',
    context: null,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const parsed = await parseRequest(req)
    let { messages, voice_key, text, audioBlob, audioContentType, context } = parsed
    let system_prompt = parsed.system_prompt

    // Build system_prompt from context if not provided directly
    if (!system_prompt && context) {
      system_prompt = buildSystemPrompt(context)
    }

    if (!system_prompt) {
      return jsonResponse({ error: 'system_prompt ou context é obrigatório' }, 400)
    }

    // 1. STT if audio provided
    let leadText = text
    if (audioBlob && !text) {
      leadText = await transcribeAudioBytes(audioBlob, audioContentType)
      if (!leadText) {
        return jsonResponse({ error: 'Não foi possível transcrever o áudio. Tente novamente.' }, 400)
      }
    }

    if (!leadText && messages.length === 0) {
      return jsonResponse({ error: 'Envie áudio ou texto para iniciar a conversa' }, 400)
    }

    // 2. Build conversation for Claude
    const conversationMessages = messages.map((m) => ({
      role: m.role === 'lead' ? 'user' : m.role === 'ai' ? 'assistant' : m.role,
      content: m.content,
    }))

    if (leadText) {
      conversationMessages.push({ role: 'user', content: leadText })
    }

    // 3. Claude response
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

    // 4. TTS
    let audioBase64: string | null = null
    const vk = voice_key || 'default'

    if (CARTESIA_API_KEY) {
      audioBase64 = await generateCartesiaTTS(responseText, vk)
    }
    if (!audioBase64) {
      audioBase64 = await generateVoiceViaEdge(responseText, vk)
    }

    const audioUrl = audioBase64 ? `data:audio/mpeg;base64,${audioBase64}` : null

    return jsonResponse({
      user_text: leadText || '',
      text: responseText,
      audioUrl,
      audio_base64: audioBase64,
      // Legacy compat
      lead_transcript: leadText || '',
      response: responseText,
    })
  } catch (err) {
    console.error('Error:', err)
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})

function buildSystemPrompt(ctx: { vendor_name?: string; product?: string; tone?: string; objective?: string }): string {
  let p = `Você é ${ctx.vendor_name || 'Lucas'}, um vendedor(a) de ${ctx.product || 'proteção veicular'} em uma ligação telefônica.`
  if (ctx.tone) p += `\nTom de voz: ${ctx.tone}.`
  if (ctx.objective) p += `\nObjetivo: ${ctx.objective}.`
  p += `\n\nIMPORTANTE:\n- Fale em português brasileiro natural.\n- Respostas curtas: máximo 2-3 frases por vez.\n- NÃO use markdown, emojis, ou formatação.\n- Fale como se estivesse conversando por telefone.`
  return p
}

// ── STT: Transcrever áudio bytes diretamente com Deepgram ──
async function transcribeAudioBytes(audioBytes: Uint8Array, contentType: string): Promise<string> {
  if (!DEEPGRAM_API_KEY) {
    console.warn('DEEPGRAM_API_KEY not set')
    return ''
  }

  try {
    const res = await retryWithBackoff(() => fetchWithTimeout(
      'https://api.deepgram.com/v1/listen?model=nova-2&language=pt-BR&smart_format=true&punctuate=true',
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': contentType || 'audio/webm',
        },
        body: audioBytes as unknown as BodyInit,
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

// ── TTS: Cartesia ──
async function generateCartesiaTTS(text: string, voiceKey: string): Promise<string | null> {
  try {
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

// ── TTS: Fallback ──
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
      body: JSON.stringify({ action: 'generate', text, voice_key: voiceKey }),
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
