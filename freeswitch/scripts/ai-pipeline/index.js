/**
 * Walk Agente Central Hub - AI Voice Pipeline
 *
 * Recebe áudio do FreeSWITCH via WebSocket (mod_audio_fork),
 * processa STT → LLM → TTS, e devolve áudio.
 *
 * Fluxo:
 * 1. FreeSWITCH abre WebSocket com áudio PCM 8kHz mono
 * 2. Pipeline acumula áudio e envia para STT (Deepgram streaming)
 * 3. Texto reconhecido vai para LLM (Claude) com contexto do script
 * 4. Resposta do LLM vai para TTS (Cartesia)
 * 5. Áudio TTS é enviado de volta pelo WebSocket para o FreeSWITCH
 * 6. Transcrição é enviada em tempo real para Supabase (Realtime)
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  ANTHROPIC_API_KEY,
  DEEPGRAM_API_KEY,
  CARTESIA_API_KEY,
  AI_PIPELINE_PORT = '3001',
} = process.env;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// Sessões ativas (callId → session)
const activeSessions = new Map();

// ============================================================
// WebSocket Server (recebe conexões do mod_audio_fork)
// ============================================================

const wss = new WebSocketServer({ port: parseInt(AI_PIPELINE_PORT) });

wss.on('connection', async (ws, req) => {
  // URL: /call/{callId}?company_id=xxx&script_id=yyy
  const url = new URL(req.url, `http://localhost:${AI_PIPELINE_PORT}`);
  const pathParts = url.pathname.split('/');
  const callId = pathParts[2];
  const companyId = url.searchParams.get('company_id');
  const scriptId = url.searchParams.get('script_id');

  console.log(`[AI] New call session: ${callId} (company: ${companyId}, script: ${scriptId})`);

  // Carregar script da IA do Supabase
  const script = await loadScript(scriptId, companyId);
  if (!script) {
    console.error(`[AI] Script ${scriptId} not found`);
    ws.close();
    return;
  }

  // Criar sessão
  const session = {
    callId,
    companyId,
    script,
    ws,
    conversationHistory: [],
    transcript: [],
    sttSocket: null,
    isProcessing: false,
    audioBuffer: Buffer.alloc(0),
    silenceMs: 0,
    lastAudioAt: Date.now(),
  };

  activeSessions.set(callId, session);

  // Conectar STT (Deepgram streaming)
  await connectSTT(session);

  // Enviar saudação inicial
  await speakResponse(session, script.opening_message || script.name);

  // Receber áudio do FreeSWITCH
  ws.on('message', (data) => {
    if (Buffer.isBuffer(data)) {
      handleAudioIn(session, data);
    }
  });

  ws.on('close', () => {
    console.log(`[AI] Session ended: ${callId}`);
    cleanupSession(session);
  });

  ws.on('error', (err) => {
    console.error(`[AI] WebSocket error for ${callId}:`, err.message);
    cleanupSession(session);
  });
});

// ============================================================
// Script Loading
// ============================================================

async function loadScript(scriptId, companyId) {
  if (scriptId) {
    const { data } = await supabase
      .from('ai_call_scripts')
      .select('*')
      .eq('id', scriptId)
      .single();
    return data;
  }

  // Se não tem scriptId, buscar script padrão da empresa
  const { data } = await supabase
    .from('ai_call_scripts')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .eq('is_default', true)
    .limit(1)
    .single();

  return data;
}

// ============================================================
// STT - Speech-to-Text (Deepgram Streaming)
// ============================================================

async function connectSTT(session) {
  const sttUrl = 'wss://api.deepgram.com/v1/listen?' + new URLSearchParams({
    model: 'nova-2',
    language: 'pt-BR',
    encoding: 'linear16',
    sample_rate: '8000',
    channels: '1',
    punctuate: 'true',
    interim_results: 'true',
    endpointing: '500',       // 500ms de silêncio = fim de frase
    utterance_end_ms: '1500', // 1.5s = fim de utterance
    smart_format: 'true',
  });

  session.sttSocket = new WebSocket(sttUrl, {
    headers: { 'Authorization': `Token ${DEEPGRAM_API_KEY}` },
  });

  session.sttSocket.on('open', () => {
    console.log(`[STT] Connected for ${session.callId}`);
  });

  session.sttSocket.on('message', async (data) => {
    const result = JSON.parse(data.toString());

    if (result.type === 'Results') {
      const transcript = result.channel?.alternatives?.[0]?.transcript;
      const isFinal = result.is_final;

      if (transcript && isFinal) {
        console.log(`[STT] ${session.callId}: "${transcript}"`);

        // Salvar na transcrição
        session.transcript.push({
          role: 'human',
          text: transcript,
          timestamp: new Date().toISOString(),
        });

        // Enviar transcrição em tempo real para Supabase
        await updateTranscript(session);

        // Processar com LLM
        await processWithLLM(session, transcript);
      }
    }

    if (result.type === 'UtteranceEnd') {
      // Silêncio prolongado - pode ser hora de falar
      if (!session.isProcessing && session.conversationHistory.length > 0) {
        console.log(`[STT] Utterance end for ${session.callId}`);
      }
    }
  });

  session.sttSocket.on('error', (err) => {
    console.error(`[STT] Error for ${session.callId}:`, err.message);
  });

  session.sttSocket.on('close', () => {
    console.log(`[STT] Disconnected for ${session.callId}`);
  });
}

// ============================================================
// Audio Handling
// ============================================================

function handleAudioIn(session, audioData) {
  session.lastAudioAt = Date.now();

  // Enviar áudio para STT
  if (session.sttSocket?.readyState === WebSocket.OPEN) {
    session.sttSocket.send(audioData);
  }
}

// ============================================================
// LLM - Language Model (Claude)
// ============================================================

async function processWithLLM(session, userText) {
  if (session.isProcessing) return;
  session.isProcessing = true;

  try {
    const script = session.script;

    // Montar system prompt com contexto do script
    const systemPrompt = buildSystemPrompt(script);

    // Adicionar mensagem do usuário
    session.conversationHistory.push({
      role: 'user',
      content: userText,
    });

    // Chamar Claude
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: systemPrompt,
      messages: session.conversationHistory,
    });

    const assistantText = response.content[0].text;
    console.log(`[LLM] ${session.callId}: "${assistantText}"`);

    // Adicionar resposta ao histórico
    session.conversationHistory.push({
      role: 'assistant',
      content: assistantText,
    });

    // Salvar na transcrição
    session.transcript.push({
      role: 'ai',
      text: assistantText,
      timestamp: new Date().toISOString(),
    });

    await updateTranscript(session);

    // Converter resposta em áudio (TTS) e enviar de volta
    await speakResponse(session, assistantText);

  } catch (err) {
    console.error(`[LLM] Error for ${session.callId}:`, err.message);
  } finally {
    session.isProcessing = false;
  }
}

function buildSystemPrompt(script) {
  let prompt = script.system_prompt || '';

  prompt += `\n\nVocê é ${script.personality || 'um assistente de vendas profissional'}.`;
  prompt += `\nVocê está em uma ligação telefônica. Seja conciso e natural.`;
  prompt += `\nFale em português brasileiro.`;
  prompt += `\nNÃO use markdown, emojis, ou formatação. Fale como se estivesse conversando.`;
  prompt += `\nRespostas curtas: máximo 2-3 frases por vez.`;

  if (script.compliance_disclaimers) {
    prompt += `\n\nIMPORTANTE - Disclaimers obrigatórios: ${JSON.stringify(script.compliance_disclaimers)}`;
  }

  if (script.objection_handlers) {
    prompt += `\n\nQuando encontrar objeções, use estas respostas:`;
    for (const [objection, response] of Object.entries(script.objection_handlers)) {
      prompt += `\n- "${objection}": ${response}`;
    }
  }

  if (script.qualification_criteria) {
    prompt += `\n\nCritérios de qualificação: ${JSON.stringify(script.qualification_criteria)}`;
  }

  if (script.fallback_action) {
    prompt += `\n\nSe o cliente pedir para falar com humano ou você não souber responder, diga que vai transferir.`;
  }

  return prompt;
}

// ============================================================
// TTS - Text-to-Speech (Cartesia)
// ============================================================

async function speakResponse(session, text) {
  try {
    // Buscar voice profile do script
    const voiceId = session.script.voice_profile_id;
    let cartesiaVoiceId = 'a0e99841-438c-4a64-b679-ae501e7d6091'; // Default: Portuguese male

    if (voiceId) {
      const { data: clone } = await supabase
        .from('ai_voice_clones')
        .select('provider_voice_id')
        .eq('voice_profile_id', voiceId)
        .eq('training_status', 'ready')
        .single();

      if (clone?.provider_voice_id) {
        cartesiaVoiceId = clone.provider_voice_id;
      }
    }

    // Chamar Cartesia TTS (streaming)
    const ttsResponse = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        'X-API-Key': CARTESIA_API_KEY,
        'Cartesia-Version': '2024-06-10',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: 'sonic-multilingual',
        transcript: text,
        voice: { mode: 'id', id: cartesiaVoiceId },
        language: 'pt',
        output_format: {
          container: 'raw',
          encoding: 'pcm_s16le',
          sample_rate: 8000,
        },
      }),
    });

    if (!ttsResponse.ok) {
      throw new Error(`Cartesia error: ${ttsResponse.status}`);
    }

    // Enviar áudio PCM de volta para o FreeSWITCH via WebSocket
    const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());

    // Enviar em chunks de 20ms (320 bytes @ 8kHz 16-bit mono)
    const chunkSize = 320;
    for (let i = 0; i < audioBuffer.length; i += chunkSize) {
      const chunk = audioBuffer.subarray(i, Math.min(i + chunkSize, audioBuffer.length));
      if (session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(chunk);
      }
    }

    console.log(`[TTS] Sent ${audioBuffer.length} bytes for ${session.callId}`);

  } catch (err) {
    console.error(`[TTS] Error for ${session.callId}:`, err.message);
  }
}

// ============================================================
// Supabase Updates
// ============================================================

async function updateTranscript(session) {
  try {
    await supabase
      .from('call_logs')
      .update({
        ai_transcript: session.transcript,
      })
      .eq('call_id', session.callId);
  } catch (err) {
    console.error(`[DB] Transcript update error:`, err.message);
  }
}

// ============================================================
// Cleanup
// ============================================================

function cleanupSession(session) {
  if (session.sttSocket?.readyState === WebSocket.OPEN) {
    // Enviar close frame para Deepgram
    session.sttSocket.send(JSON.stringify({ type: 'CloseStream' }));
    session.sttSocket.close();
  }

  activeSessions.delete(session.callId);
  console.log(`[AI] Cleaned up session ${session.callId}. Active sessions: ${activeSessions.size}`);
}

// ============================================================
// Start
// ============================================================

console.log(`[AI Pipeline] Walk Agente Central Hub - AI Voice Pipeline`);
console.log(`[AI Pipeline] Listening on ws://127.0.0.1:${AI_PIPELINE_PORT}`);
console.log(`[AI Pipeline] Flow: Audio → Deepgram STT → Claude LLM → Cartesia TTS → Audio`);
