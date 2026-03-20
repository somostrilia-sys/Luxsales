/**
 * Walk Agente Central Hub - VoIP Call Control
 *
 * Edge Function para originar, desligar e transferir chamadas.
 * Chamada pelo frontend (Discador.tsx, CallCampaigns.tsx).
 * Comunica com o ESL Controller no VPS via REST API.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// URL do ESL Controller no VPS
const ESL_API_URL = Deno.env.get('FREESWITCH_ESL_API_URL') || 'http://vps.holdingwalk.com.br:3000'
const ESL_API_TOKEN = Deno.env.get('FREESWITCH_ESL_API_TOKEN')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Buscar company_id do usuário
    const { data: collaborator } = await supabase
      .from('collaborators')
      .select('company_id, role_level')
      .eq('user_id', user.id)
      .single()

    if (!collaborator) {
      return new Response(JSON.stringify({ error: 'Colaborador não encontrado' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { action } = body

    let result

    switch (action) {
      case 'originate': {
        // Originar chamada (IA ou manual)
        const { phone, script_id, caller_id, campaign_id } = body

        if (!phone) {
          return new Response(JSON.stringify({ error: 'Telefone obrigatório' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Verificar DNC
        const { data: isDnc } = await supabase.rpc('fn_check_dnc', {
          p_phone: phone,
          p_company_id: collaborator.company_id,
        })

        if (isDnc) {
          return new Response(JSON.stringify({ error: 'Número bloqueado (DNC/Blacklist)' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Verificar horário permitido (Anatel: 8h-21h seg-sex, 10h-16h sáb)
        const now = new Date()
        const brasiliaHour = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getHours()
        const brasiliaDay = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getDay()

        if (brasiliaDay === 0) { // Domingo
          return new Response(JSON.stringify({ error: 'Ligações não permitidas aos domingos (Anatel)' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        if (brasiliaDay === 6 && (brasiliaHour < 10 || brasiliaHour >= 16)) { // Sábado
          return new Response(JSON.stringify({ error: 'Ligações aos sábados: 10h-16h (Anatel)' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        if (brasiliaDay >= 1 && brasiliaDay <= 5 && (brasiliaHour < 8 || brasiliaHour >= 21)) {
          return new Response(JSON.stringify({ error: 'Ligações seg-sex: 8h-21h (Anatel)' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Enviar para ESL Controller
        result = await callESL('/originate', {
          phone,
          company_id: collaborator.company_id,
          script_id,
          caller_id,
          campaign_id,
        })
        break
      }

      case 'hangup': {
        const { call_id, cause } = body
        result = await callESL('/hangup', { call_id, cause })
        break
      }

      case 'transfer': {
        const { call_id, destination, type } = body

        // Registrar transferência
        await supabase.from('call_transfers').insert({
          original_call_id: call_id,
          transfer_type: type || 'blind',
          from_agent_name: user.email,
          to_external_number: destination,
          status: 'initiated',
          company_id: collaborator.company_id,
        })

        result = await callESL('/transfer', { call_id, destination, type })
        break
      }

      case 'status': {
        result = await callESL('/status', {})
        break
      }

      default:
        return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function callESL(endpoint: string, data: Record<string, unknown>) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (ESL_API_TOKEN) {
    headers['Authorization'] = `Bearer ${ESL_API_TOKEN}`
  }

  const response = await fetch(`${ESL_API_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(`ESL API error: ${response.status} ${await response.text()}`)
  }

  return response.json()
}
