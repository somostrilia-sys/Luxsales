# FreeSWITCH - Walk Agente Central Hub

## Arquitetura de Integração

```
                    ┌─────────────────────────────────────────────────┐
                    │              Walk Agente Central Hub            │
                    │         app.holdingwalk.com.br (React)          │
                    │                                                 │
                    │  ┌──────────┐ ┌──────────┐ ┌───────────────┐   │
                    │  │Discador  │ │Dashboard │ │ ConfigVoz     │   │
                    │  │(Softphone│ │  VoIP    │ │ (SIP Trunks)  │   │
                    │  │  WebRTC) │ │          │ │               │   │
                    │  └────┬─────┘ └────┬─────┘ └───────┬───────┘   │
                    └───────┼────────────┼───────────────┼───────────┘
                            │            │               │
                    ┌───────▼────────────▼───────────────▼───────────┐
                    │              Supabase (Backend)                 │
                    │                                                 │
                    │  ┌─────────────────────────────────────────┐   │
                    │  │ Edge Functions                           │   │
                    │  │  • voip-call-control (originar/desligar) │   │
                    │  │  • voip-webhook (eventos do FreeSWITCH)  │   │
                    │  │  • voip-ai-bridge (orquestrar IA)        │   │
                    │  └──────────────────┬──────────────────────┘   │
                    │                     │                           │
                    │  ┌─────────────────┐│┌────────────────────┐    │
                    │  │ Tables          │││ Realtime            │    │
                    │  │ sip_trunks      │││ calls channel       │    │
                    │  │ calls/call_logs │││ transcript channel  │    │
                    │  │ ai_call_scripts │││                     │    │
                    │  └─────────────────┘│└────────────────────┘    │
                    └─────────────────────┼──────────────────────────┘
                                          │
                          HTTPS (REST API) │
                                          │
                    ┌─────────────────────▼──────────────────────────┐
                    │           VPS (FreeSWITCH Server)              │
                    │           ex: vps.holdingwalk.com.br           │
                    │                                                 │
                    │  ┌──────────────────────────────────────────┐   │
                    │  │ FreeSWITCH 1.10+                         │   │
                    │  │                                          │   │
                    │  │  ┌────────────┐  ┌───────────────────┐   │   │
                    │  │  │ SIP Module │  │ mod_verto (WebRTC)│   │   │
                    │  │  │  Inbound ◄─┼──┼── Softphone Web   │   │   │
                    │  │  │  Outbound  │  │                   │   │   │
                    │  │  └─────┬──────┘  └───────────────────┘   │   │
                    │  │        │                                  │   │
                    │  │  ┌─────▼──────────────────────────────┐   │   │
                    │  │  │ Dialplan XML                       │   │   │
                    │  │  │  • Inbound → IVR / AI Agent        │   │
                    │  │  │  • Outbound → Campaign Dialer      │   │   │
                    │  │  │  • Internal → Extension routing     │   │
                    │  │  └─────┬──────────────────────────────┘   │   │
                    │  │        │                                  │   │
                    │  │  ┌─────▼──────────────────────────────┐   │   │
                    │  │  │ mod_audio_fork (WebSocket)          │   │   │
                    │  │  │  Áudio bidirecional ←→ AI Pipeline │   │   │
                    │  │  └─────┬──────────────────────────────┘   │   │
                    │  │        │                                  │   │
                    │  │  ┌─────▼──────────────────────────────┐   │   │
                    │  │  │ Event Socket (ESL)                  │   │   │
                    │  │  │  Node.js controller ←→ Supabase    │   │   │
                    │  │  └────────────────────────────────────┘   │   │
                    │  └──────────────────────────────────────────┘   │
                    │                                                 │
                    │  ┌──────────────────────────────────────────┐   │
                    │  │ AI Pipeline (Node.js)                    │   │
                    │  │                                          │   │
                    │  │  Audio In ──► STT (Whisper/Deepgram)     │   │
                    │  │                    │                      │   │
                    │  │              ▼                            │   │
                    │  │         LLM (Claude/GPT)                 │   │
                    │  │         + ai_call_scripts context        │   │
                    │  │                    │                      │   │
                    │  │              ▼                            │   │
                    │  │         TTS (Cartesia/ElevenLabs)        │   │
                    │  │                    │                      │   │
                    │  │         Audio Out ──► FreeSWITCH         │   │
                    │  └──────────────────────────────────────────┘   │
                    │                                                 │
                    └────────────────┬───────────────────────────────┘
                                     │
                          SIP Trunk   │
                      (Nvoip/Vono)    │
                                     │
                    ┌────────────────▼───────────────────────────────┐
                    │              PSTN (Rede Telefônica)             │
                    │         Números DID brasileiros                 │
                    │         +55 (11) XXXX-XXXX etc                  │
                    └────────────────────────────────────────────────┘
```

## Fluxo de uma Ligação IA (Outbound)

1. **Frontend** (Discador.tsx) → clica "Ligar"
2. **Edge Function** `voip-call-control` → POST para FreeSWITCH ESL API
3. **FreeSWITCH** origina chamada via SIP Trunk (Nvoip/Vono)
4. **Atendeu** → FreeSWITCH ativa `mod_audio_fork` → WebSocket para AI Pipeline
5. **AI Pipeline**: áudio → STT → LLM (com script do Supabase) → TTS → áudio de volta
6. **Durante a ligação**: transcrição em tempo real → Supabase Realtime → Frontend
7. **Desligou** → FreeSWITCH notifica webhook → Edge Function salva call_log
8. **Pós-chamada**: análise de sentimento, qualificação do lead, custos

## Fluxo de uma Ligação Inbound

1. **PSTN** → SIP Trunk → **FreeSWITCH**
2. **Dialplan** verifica horário comercial (pbx_config)
3. **Dentro do horário** → IVR menu (ivr_menus) → opções
4. **Opção IA** → mod_audio_fork → AI Pipeline com script específico
5. **Opção Ramal** → transfere para extension (sip_extensions)
6. **Fora do horário** → after_hours_action (voicemail/mensagem)

## Requisitos do VPS

- **OS:** Ubuntu 22.04+ ou Debian 12
- **RAM:** 4GB mínimo (8GB recomendado para IA local)
- **CPU:** 2+ vCPUs
- **Disco:** 40GB+ (gravações ocupam espaço)
- **Rede:** IP fixo, portas: 5060/UDP (SIP), 5061/TCP (SIP-TLS), 8021/TCP (ESL), 8082/TCP (Verto/WebRTC), 16384-32768/UDP (RTP)
- **Provedores recomendados:** Hetzner (melhor custo), DigitalOcean, AWS Lightsail

## Custos Estimados

| Item | Custo Mensal |
|------|-------------|
| VPS Hetzner CX31 (4GB/2CPU) | ~R$45 |
| SIP Trunk Nvoip (DID + minutos) | ~R$50-80 |
| STT (Deepgram) | ~R$0.004/min |
| LLM (Claude Haiku) | ~R$0.001/chamada |
| TTS (Cartesia) | ~R$0.006/min |
| **Total estimado** | **~R$100-150/mês** |
