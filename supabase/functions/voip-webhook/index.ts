/**
 * Walk Agente Central Hub - VoIP Webhook
 *
 * Recebe eventos do FreeSWITCH ESL Controller:
 * - call_started: nova chamada
 * - call_answered: chamada atendida
 * - call_ended: chamada finalizada → processa gravação, custos, analytics
 * - inbound_call: chamada entrante → rotear para IVR/agente
 * - transfer_complete: transferência concluída
 * - recording_ready: gravação pronta para upload
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
    const { event, call_id } = body

    console.log(`[VoIP Webhook] Event: ${event}, Call: ${call_id}`)

    switch (event) {
      case 'inbound_call': {
        // Chamada entrante - buscar roteamento
        const { caller, destination, trunk } = body

        // Buscar empresa pelo DID (número de destino)
        const { data: trunkData } = await supabase
          .from('sip_trunks')
          .select('company_id')
          .eq('is_active', true)
          .single()

        if (!trunkData) {
          return jsonResponse({ action: 'reject', reason: 'No company found' })
        }

        const companyId = trunkData.company_id

        // Verificar horário comercial
        const { data: pbx } = await supabase
          .from('pbx_config')
          .select('*')
          .eq('company_id', companyId)
          .single()

        const isBusinessHours = checkBusinessHours(pbx?.business_hours)

        if (!isBusinessHours && pbx?.after_hours_action) {
          return jsonResponse({
            action: pbx.after_hours_action,
            company_id: companyId,
            message: pbx.after_hours_message,
          })
        }

        // Buscar IVR menu padrão
        const { data: ivr } = await supabase
          .from('ivr_menus')
          .select('*')
          .eq('company_id', companyId)
          .eq('is_active', true)
          .is('parent_menu_id', null)
          .single()

        return jsonResponse({
          action: 'ivr',
          company_id: companyId,
          ivr_menu: ivr,
          recording_policy: pbx?.recording_policy || 'all',
        })
      }

      case 'call_ended': {
        const { hangup_cause, duration, recording_file } = body

        // Buscar dados da chamada
        const { data: call } = await supabase
          .from('calls')
          .select('*, company_id')
          .eq('id', call_id)
          .single()

        if (!call) {
          console.error(`Call ${call_id} not found`)
          return jsonResponse({ ok: true })
        }

        // Calcular custo (exemplo: R$0.05/min)
        const costPerMinute = 0.05
        const minutes = Math.ceil((duration || 0) / 60)
        const costBrl = minutes * costPerMinute

        // Atualizar call com custos
        await supabase
          .from('calls')
          .update({
            cost_brl: costBrl,
            billable_duration_sec: duration,
          })
          .eq('id', call_id)

        // Registrar no billing_usage
        await supabase.from('billing_usage').insert({
          company_id: call.company_id,
          usage_type: 'voip_minutes',
          quantity: minutes,
          unit_cost_brl: costPerMinute,
          total_cost_brl: costBrl,
          reference_id: call_id,
          reference_type: 'call',
          description: `Chamada ${call.direction}: ${call.destination_number} (${duration}s)`,
        })

        // Se tem gravação, registrar e disparar transcrição
        if (recording_file) {
          const { data: rec } = await supabase.from('call_recordings').insert({
            call_id,
            company_id: call.company_id,
            recording_url: recording_file,
            duration_seconds: duration,
            format: 'wav',
            sample_rate: 8000,
            channels: 2,
            transcription_status: 'pending',
          }).select('id').single()

          // Trigger automático de transcrição + análise
          if (rec?.id && duration >= 10) {
            const baseUrl = Deno.env.get('SUPABASE_URL')!
            const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

            // Transcrição assíncrona (fire-and-forget)
            fetch(`${baseUrl}/functions/v1/voip-ai-bridge`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                action: 'transcribe_and_analyze',
                recording_id: rec.id,
                call_id,
                company_id: call.company_id,
              }),
            }).catch(err => console.error('[VoIP Webhook] Erro ao disparar transcrição:', err))
          }
        }

        // Atualizar analytics diário
        await updateDailyAnalytics(supabase, call)

        return jsonResponse({ ok: true, cost_brl: costBrl })
      }

      case 'recording_ready': {
        // Gravação foi processada e está pronta para upload ao Supabase Storage
        const { recording_url, file_size, call_id: recCallId } = body

        // Upload da gravação para Supabase Storage
        // (Na prática, o ESL Controller faz o upload e nos notifica)
        await supabase
          .from('call_recordings')
          .update({
            recording_url,
            file_size_bytes: file_size,
          })
          .eq('call_id', recCallId)

        return jsonResponse({ ok: true })
      }

      case 'transfer_complete': {
        const { transfer_id, status, new_call_id } = body

        await supabase
          .from('call_transfers')
          .update({
            status,
            new_call_id,
            completed_at: new Date().toISOString(),
          })
          .eq('id', transfer_id)

        return jsonResponse({ ok: true })
      }

      default:
        console.log(`[VoIP Webhook] Unknown event: ${event}`)
        return jsonResponse({ ok: true })
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
// Helpers
// ============================================================

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function checkBusinessHours(businessHours: Record<string, unknown> | null): boolean {
  if (!businessHours) return true // sem config = sempre aberto

  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const day = now.getDay() // 0=Dom, 1=Seg...
  const hour = now.getHours()
  const minute = now.getMinutes()
  const currentMinutes = hour * 60 + minute

  const bh = businessHours as { days?: number[], start?: string, end?: string }
  if (!bh.days?.includes(day === 0 ? 7 : day)) return false

  if (bh.start && bh.end) {
    const [startH, startM] = bh.start.split(':').map(Number)
    const [endH, endM] = bh.end.split(':').map(Number)
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes
  }

  return true
}

async function updateDailyAnalytics(
  supabase: any,
  call: Record<string, unknown>
) {
  const today = new Date().toISOString().split('T')[0]
  const companyId = call.company_id as string

  const { data: existing } = await supabase
    .from('ai_call_analytics')
    .select('*')
    .eq('company_id', companyId)
    .eq('analytics_date', today)
    .is('script_id', null)
    .is('campaign_id', null)
    .single()

  if (existing) {
    await supabase
      .from('ai_call_analytics')
      .update({
        total_calls: ((existing as any).total_calls || 0) + 1,
        completed_calls: call.status === 'completed' ? ((existing as any).completed_calls || 0) + 1 : (existing as any).completed_calls,
        total_duration_seconds: ((existing as any).total_duration_seconds || 0) + ((call.billable_duration_sec as number) || 0),
        total_cost_brl: ((existing as any).total_cost_brl || 0) + ((call.cost_brl as number) || 0),
      } as any)
      .eq('id', (existing as any).id)
  } else {
    await supabase.from('ai_call_analytics').insert({
      company_id: companyId,
      analytics_date: today,
      total_calls: 1,
      completed_calls: call.status === 'completed' ? 1 : 0,
      total_duration_seconds: (call.billable_duration_sec as number) || 0,
      total_cost_brl: (call.cost_brl as number) || 0,
    } as any)
  }
}
