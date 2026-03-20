/**
 * Walk Agente Central Hub - ESL Controller
 *
 * Ponte entre Supabase e FreeSWITCH via Event Socket Layer.
 * Responsável por:
 * - Originar chamadas (outbound campaigns, manual dial)
 * - Receber eventos do FreeSWITCH (call start, answer, hangup, DTMF)
 * - Atualizar tabelas calls/call_logs no Supabase em tempo real
 * - Ativar mod_audio_fork para chamadas IA
 * - Gerenciar transferências e filas
 */

import { createClient } from '@supabase/supabase-js';
import esl from 'esl';

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  ESL_HOST = '127.0.0.1',
  ESL_PORT = '8021',
  ESL_PASSWORD = 'WalkVoIP2026!',
  AI_PIPELINE_WS = 'ws://127.0.0.1:3001',
  PUBLIC_IP,
} = process.env;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

let eslConnection = null;

// ============================================================
// ESL Connection
// ============================================================

function connectESL() {
  eslConnection = new esl.Connection(ESL_HOST, parseInt(ESL_PORT), ESL_PASSWORD);

  eslConnection.on('esl::ready', () => {
    console.log('[ESL] Connected to FreeSWITCH');

    // Assinar eventos relevantes
    eslConnection.subscribe([
      'CHANNEL_CREATE',
      'CHANNEL_ANSWER',
      'CHANNEL_HANGUP_COMPLETE',
      'DTMF',
      'RECORD_START',
      'RECORD_STOP',
      'CUSTOM',
    ]);

    console.log('[ESL] Subscribed to events');
  });

  eslConnection.on('esl::event::**', handleEvent);

  eslConnection.on('esl::end', () => {
    console.log('[ESL] Connection lost, reconnecting in 5s...');
    setTimeout(connectESL, 5000);
  });

  eslConnection.on('error', (err) => {
    console.error('[ESL] Error:', err.message);
  });
}

// ============================================================
// Event Handlers
// ============================================================

async function handleEvent(event) {
  const eventName = event.getHeader('Event-Name');
  const callId = event.getHeader('Unique-ID');

  switch (eventName) {
    case 'CHANNEL_CREATE':
      await onCallCreate(event, callId);
      break;
    case 'CHANNEL_ANSWER':
      await onCallAnswer(event, callId);
      break;
    case 'CHANNEL_HANGUP_COMPLETE':
      await onCallHangup(event, callId);
      break;
    case 'DTMF':
      await onDTMF(event, callId);
      break;
    case 'RECORD_STOP':
      await onRecordStop(event, callId);
      break;
  }
}

async function onCallCreate(event, callId) {
  const direction = event.getHeader('Call-Direction');
  const callerNumber = event.getHeader('Caller-Caller-ID-Number');
  const destNumber = event.getHeader('Caller-Destination-Number');
  const companyId = event.getHeader('variable_company_id');
  const trunkName = event.getHeader('variable_sip_gateway_name');

  console.log(`[CALL] ${direction} ${callId}: ${callerNumber} → ${destNumber}`);

  // Buscar trunk_id pelo nome
  let trunkId = null;
  if (trunkName) {
    const { data: trunk } = await supabase
      .from('sip_trunks')
      .select('id')
      .eq('name', trunkName)
      .single();
    trunkId = trunk?.id;
  }

  // Inserir na tabela calls
  await supabase.from('calls').insert({
    id: callId,
    company_id: companyId,
    direction,
    caller_number: callerNumber,
    destination_number: destNumber,
    status: 'ringing',
    trunk_id: trunkId,
    started_at: new Date().toISOString(),
  });
}

async function onCallAnswer(event, callId) {
  const aiMode = event.getHeader('variable_ai_mode');

  console.log(`[CALL] Answered ${callId}, AI mode: ${aiMode}`);

  // Atualizar status
  await supabase
    .from('calls')
    .update({
      status: 'in_progress',
      answered_at: new Date().toISOString(),
    })
    .eq('id', callId);

  // Se é chamada IA, ativar mod_audio_fork para stream de áudio
  if (aiMode === 'true') {
    await activateAudioFork(callId, event);
  }
}

async function onCallHangup(event, callId) {
  const hangupCause = event.getHeader('Hangup-Cause');
  const duration = event.getHeader('variable_duration');
  const billSec = event.getHeader('variable_billsec');
  const recordingFile = event.getHeader('variable_recording_file');

  console.log(`[CALL] Hangup ${callId}: ${hangupCause} (${billSec}s)`);

  // Determinar hangup_source
  let hangupSource = 'system';
  if (hangupCause === 'NORMAL_CLEARING') {
    const whoHungUp = event.getHeader('variable_sip_hangup_disposition');
    hangupSource = whoHungUp === 'send_bye' ? 'caller' : 'callee';
  }

  // Atualizar call
  await supabase
    .from('calls')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
      duration_seconds: parseInt(duration) || 0,
      billable_duration_sec: parseInt(billSec) || 0,
      hangup_source: hangupSource,
      hangup_cause: hangupCause,
    })
    .eq('id', callId);

  // Notificar webhook do Supabase para processamento pós-chamada
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/voip-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        event: 'call_ended',
        call_id: callId,
        hangup_cause: hangupCause,
        duration: parseInt(billSec) || 0,
        recording_file: recordingFile,
      }),
    });
  } catch (err) {
    console.error(`[WEBHOOK] Error notifying Supabase:`, err.message);
  }
}

async function onDTMF(event, callId) {
  const digit = event.getHeader('DTMF-Digit');
  console.log(`[DTMF] ${callId}: ${digit}`);

  // DTMF handling é feito pelo Lua script do IVR
  // Aqui só logamos para auditoria
}

async function onRecordStop(event, callId) {
  const recordingFile = event.getHeader('Record-File-Path');
  const duration = event.getHeader('variable_record_seconds');

  console.log(`[RECORDING] ${callId}: ${recordingFile} (${duration}s)`);

  // Salvar gravação no Supabase Storage e registrar
  // (upload acontece no processamento pós-chamada pelo voip-webhook)
}

// ============================================================
// Audio Fork (ponte com AI Pipeline)
// ============================================================

async function activateAudioFork(callId, event) {
  const companyId = event.getHeader('variable_company_id');
  const scriptId = event.getHeader('variable_script_id');

  console.log(`[AI] Activating audio fork for ${callId}, script: ${scriptId}`);

  // mod_audio_fork: envia áudio bidirecional via WebSocket para o AI Pipeline
  // O AI Pipeline recebe áudio, processa STT→LLM→TTS, e devolve áudio
  const wsUrl = `${AI_PIPELINE_WS}/call/${callId}?company_id=${companyId}&script_id=${scriptId}`;

  eslConnection.api(`uuid_audio_fork ${callId} start ${wsUrl} mono 8000`, (res) => {
    console.log(`[AI] Audio fork result:`, res.getBody());
  });
}

// ============================================================
// API: Originar chamadas (chamado pelas Edge Functions)
// ============================================================

import http from 'http';

const apiServer = http.createServer(async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end('Method not allowed');
    return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const data = JSON.parse(body);
      let result;

      switch (req.url) {
        case '/originate':
          result = await originateCall(data);
          break;
        case '/hangup':
          result = await hangupCall(data);
          break;
        case '/transfer':
          result = await transferCall(data);
          break;
        case '/status':
          result = await getStatus();
          break;
        default:
          res.writeHead(404);
          res.end('Not found');
          return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      console.error('[API] Error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});

async function originateCall({ phone, company_id, script_id, caller_id, campaign_id }) {
  // Verificar DNC antes de ligar
  const { data: isDnc } = await supabase.rpc('fn_check_dnc', {
    p_phone: phone,
    p_company_id: company_id,
  });

  if (isDnc) {
    return { success: false, error: 'Número está na lista DNC' };
  }

  // Buscar SIP trunk ativo da empresa
  const { data: trunk } = await supabase
    .from('sip_trunks')
    .select('*')
    .eq('company_id', company_id)
    .eq('is_active', true)
    .order('priority', { ascending: true })
    .limit(1)
    .single();

  if (!trunk) {
    return { success: false, error: 'Nenhum SIP trunk ativo' };
  }

  const callId = crypto.randomUUID();

  // Originar chamada via ESL
  const originateCmd = [
    `originate`,
    `{company_id=${company_id}`,
    `,script_id=${script_id || ''}`,
    `,campaign_id=${campaign_id || ''}`,
    `,ai_mode=${script_id ? 'true' : 'false'}`,
    `,outbound_caller_id=${caller_id || trunk.caller_id}`,
    `,origination_uuid=${callId}}`,
    `sofia/gateway/walk-sip-trunk/${phone}`,
    script_id ? `&lua(walk_ai_call.lua)` : `&park`,
  ].join('');

  return new Promise((resolve) => {
    eslConnection.api(originateCmd, (response) => {
      const body = response.getBody();
      if (body.includes('+OK')) {
        console.log(`[ORIGINATE] Success: ${callId} → ${phone}`);
        resolve({ success: true, call_id: callId });
      } else {
        console.error(`[ORIGINATE] Failed: ${body}`);
        resolve({ success: false, error: body });
      }
    });
  });
}

async function hangupCall({ call_id, cause }) {
  return new Promise((resolve) => {
    eslConnection.api(`uuid_kill ${call_id} ${cause || 'NORMAL_CLEARING'}`, (res) => {
      resolve({ success: true, result: res.getBody() });
    });
  });
}

async function transferCall({ call_id, destination, type }) {
  const cmd = type === 'blind'
    ? `uuid_transfer ${call_id} ${destination}`
    : `uuid_transfer ${call_id} ${destination} both`;

  return new Promise((resolve) => {
    eslConnection.api(cmd, (res) => {
      resolve({ success: true, result: res.getBody() });
    });
  });
}

async function getStatus() {
  return new Promise((resolve) => {
    eslConnection.api('show calls count', (res) => {
      const activeCalls = res.getBody();
      eslConnection.api('sofia status gateway walk-sip-trunk', (res2) => {
        const trunkStatus = res2.getBody();
        resolve({
          status: 'online',
          active_calls: activeCalls,
          trunk_status: trunkStatus,
        });
      });
    });
  });
}

// Iniciar
const API_PORT = 3000;
apiServer.listen(API_PORT, '127.0.0.1', () => {
  console.log(`[API] ESL Controller listening on 127.0.0.1:${API_PORT}`);
});

connectESL();
console.log('[ESL Controller] Walk Agente Central Hub - VoIP Controller started');
