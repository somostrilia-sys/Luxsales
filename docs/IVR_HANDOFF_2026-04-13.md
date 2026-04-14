# IVR Studio — Sessão 2026-04-13 · Handoff

## TL;DR

Fluxo IVR determinístico completo pra LuxSales (Objetivo + Trilia):
100 áudios v3 ElevenLabs cacheados + classificador semântico + studio UI + agent LiveKit paralelo pronto pra dispatch. Zero alteração no `agent.py` original. Aguardando teste E2E de ligação real.

---

## Estado atual de cada peça

### Supabase (`ecaduzwautlpzpvjognr`)

| Componente | Estado |
|---|---|
| Tabela `ivr_audio_scripts` | ✅ aplicada (102 rows: Objetivo 28 + Trilia 23 × 2 vozes) |
| Bucket `ivr-audios` (público) | ✅ 102 mp3 renderizados |
| Voice profiles `el-lucas-v3` / `el-cleo-v3` | ✅ |
| Edge function `ivr-classify` | ✅ deployada (OpenAI gpt-4o-mini) |
| View `v_ivr_tree` | ✅ |

### PC Gamer (`192.168.0.206`)

| Componente | Estado |
|---|---|
| `walk-livekit-stack` (PM2 #0) — agent.py + call-api.py | 🟢 online, **INTOCADO** |
| `walk-livekit-ivr` (PM2 #5) — agent-ivr.py + ivr-llm-proxy.py | 🟢 online, registrado na LiveKit Cloud com `agent_name=ivr` |
| `walk-livekit-tunnel` (PM2 #4) | 🟢 online |

### Frontend (`/home/alex/Luxsales`)

| Componente | Estado |
|---|---|
| Branch `feat/ivr-studio` | ✅ pushada (commits `3278842`, `6d82805`) |
| Preview Vercel | https://app-4s2x0d6he-holdingwalk.vercel.app |
| Rota `/voice/ivr-studio` + sidebar "IVR Studio" | ✅ |
| Merge + deploy prod | ⏳ pendente (13 arquivos WIP no `main` não mesclados) |

---

## Arquivos criados / modificados

### Luxsales (repo)

```
supabase/migrations/20260414000000_ivr_audio_scripts.sql        # tabela + seed
supabase/migrations/20260414010000_ivr_fixes_whatsapp_handoff.sql # fix SDR whats + "é IA"
supabase/functions/ivr-classify/index.ts                        # edge function classificador
scripts/render-ivr-audios.mjs                                    # batch render ElevenLabs v3
src/pages/IvrStudio.tsx                                          # página árvore + player + tester
src/App.tsx                                                      # +rota /voice/ivr-studio
src/components/AppSidebar.tsx                                    # +menu "IVR Studio"
```

### PC Gamer (`/home/alex/walk-livekit/`)

```
agent-ivr.py            # CÓPIA do agent.py + agent_name=ivr + port=8082 + base_url proxy
ivr-llm-proxy.py        # FastAPI :3010, intercepta /v1/chat/completions
start-stack-ivr.sh      # script PM2 (sobe proxy + agent-ivr)
agent.py                # INTOCADO — read-only conforme memory
```

---

## Arquitetura IVR

```
┌─────────────────────────────────────────────────────────────────┐
│  Lead (telefone)                                                │
│       ↓ SIP FoneTalk                                            │
│  LiveKit Cloud (voz-ia-qqqy5qik)                                │
│       ↓ dispatch agent_name=ivr                                 │
│  agent-ivr.py [PC Gamer :8082]                                  │
│   ├─ STT: Deepgram Nova-3 PT-BR (igual agent.py)               │
│   ├─ LLM: aponta pra http://localhost:3010/v1  ←── DIFERENÇA    │
│   └─ TTS: Cartesia Sonic-3 PVC (igual agent.py)                │
│           ↓                                                      │
│  ivr-llm-proxy.py [PC Gamer :3010]                              │
│   ├─ extrai último transcript do user                           │
│   ├─ chama edge function ivr-classify                           │
│   │      ↓                                                       │
│   │  Supabase ivr-classify:                                     │
│   │   ├─ fast regex match (>=8ch, word-boundary)                │
│   │   └─ fallback OpenAI gpt-4o-mini (paráfrases)               │
│   │      retorna {intent_id, confidence, text_raw, audio_url}   │
│   ├─ confidence >= 0.55 → responde completion sintética         │
│   └─ fallback → proxy transparente pro Groq                     │
└─────────────────────────────────────────────────────────────────┘
```

**Trade-off consciente v1**: TTS é Cartesia (não toca os mp3 v3 cacheados).
Ganha fluxo determinístico; perde qualidade ElevenLabs.
Os áudios v3 ficam como asset pra v2 (classe TTS custom buscando do bucket).

---

## Credenciais úteis

```bash
# LiveKit Cloud
export LIVEKIT_URL=wss://voz-ia-qqqy5qik.livekit.cloud
export LIVEKIT_API_KEY=API5i8HCXxYUNda
export LIVEKIT_API_SECRET=JZ55SEglenqpI4SjsyeflZyyEuHOUrqLaVeBoT8U7iAA

# Supabase LuxSales
PROJECT_REF=ecaduzwautlpzpvjognr
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjYWR1endhdXRscHpwdmpvZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMDQ1MTcsImV4cCI6MjA4ODU4MDUxN30.LinR7PIoK7n79hWjbSJ3EgDwA_y6uN-HfQnOk7GgYi4"

# ElevenLabs (achada em /home/alex/start_pvc_real.py)
export ELEVENLABS_API_KEY=sk_795fae1f60b84b9543c92dc36cd1de829f83f57a7bfc8e1b

# Company IDs
OBJETIVO=70967469-9a9b-4e29-a744-410e41eb47a5
TRILIA=131d9cba-d49c-44d5-a9b3-baa84d34bd96

# Voice profiles v3
LUCAS_V3_PROFILE=160e58e8-e525-432b-9290-5e90d968d92b  # voice_id=3OyE8NsXBydSqnJYK9WN
CLEO_V3_PROFILE=c802b841-756d-415a-af07-ac6c633edfc0   # voice_id=42GCrPr6rlUakKVMCcp2
```

---

## Comandos úteis

### Verificar status
```bash
# PM2
pm2 list
pm2 logs walk-livekit-ivr --lines 30 --nostream

# Proxy saudável?
curl -s http://localhost:3010/health | jq

# Agent IVR saudável?
curl -s http://localhost:8082/
```

### Reiniciar stack IVR
```bash
pm2 restart walk-livekit-ivr
```

### Rodar novo render (quando editar textos)
```bash
cd /home/alex/Luxsales
SUPABASE_SERVICE_ROLE_KEY="eyJhbGci...WlgrZNfRYCsgllWVEjCxcer4OMJzw5NEZoUlA-cG1Rc" \
ELEVENLABS_API_KEY="sk_795fae1f60b84b9543c92dc36cd1de829f83f57a7bfc8e1b" \
node scripts/render-ivr-audios.mjs [--limit N] [--only intent_id] [--dry]
```

### Testar classificador
```bash
ANON="eyJhbG...agui vai o anon"
curl -s -X POST "https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/ivr-classify" \
  -H "Authorization: Bearer $ANON" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"company_id":"70967469-9a9b-4e29-a744-410e41eb47a5","voice_profile_id":"160e58e8-e525-432b-9290-5e90d968d92b","transcript":"tá muito caro"}'
```

### Testar dispatch IVR (sem SIP)
```bash
export LIVEKIT_URL=wss://voz-ia-qqqy5qik.livekit.cloud
export LIVEKIT_API_KEY=API5i8HCXxYUNda
export LIVEKIT_API_SECRET=JZ55SEglenqpI4SjsyeflZyyEuHOUrqLaVeBoT8U7iAA

lk dispatch create --agent-name ivr \
  --room "test-ivr-$(date +%s)" \
  --metadata '{"voice_id":"af9005aa-35db-4bc2-82ee-4c90da1f8f3d","agent_name":"Lucas","company_id":"70967469-9a9b-4e29-a744-410e41eb47a5"}'

# Ver o agent recebendo o job:
pm2 logs walk-livekit-ivr --lines 20 --nostream | grep -E "job|PROMPT"
```

### Ligação IVR real (quando você topar testar)
```bash
# 1. Criar sala + dispatch
ROOM="ivr-test-$(date +%s)"
lk dispatch create --agent-name ivr --room "$ROOM" \
  --metadata '{"voice_id":"af9005aa-35db-4bc2-82ee-4c90da1f8f3d","agent_name":"Lucas","company_id":"70967469-9a9b-4e29-a744-410e41eb47a5"}'

# 2. Ligar pro teu número (substitui +5531XXXX)
lk sip participant create --trunk-id ST_qyAduWTydrDH \
  --call-to +5531XXXXXXXXX --room "$ROOM"
```

---

## Como continuar quando voltar

### 1. Validar estado rápido (2 min)
```bash
pm2 list                                     # walk-livekit-ivr precisa estar online
curl http://localhost:3010/health            # proxy ok
pm2 logs walk-livekit-ivr --lines 10         # registered worker + agent_name=ivr
```

### 2. Fazer primeiro teste E2E de ligação (te pede o número)
- Usar comando "Ligação IVR real" acima
- Gravar resultado: fluxo rolou? Lead teve respostas determinísticas?
- Log relevante: `pm2 logs walk-livekit-ivr --lines 100 --nostream | grep -E "IVR HIT|intent_id|received job"`

### 3. Se teste OK → integrar na `call-api.py`
Patch mínimo proposto (agent.py **continua intocado**):
- Aceitar `route: "ivr"` no body
- Antes de `create_sip_participant`, se route=ivr → chamar
  `lk.agent_dispatch.create_dispatch(AgentDispatchRequest(agent_name="ivr", room=room_name, metadata=...))`
- `make-call` edge function aceita `route` e repassa

### 4. Adicionar botão "Ligação IVR" no `IvrStudio.tsx`
Campo de número + botão que dispara `make-call` com `route=ivr` pro fluxo de teste individual (lead real validando o IVR).

### 5. Merge branch `feat/ivr-studio` → main
Você tem 13 arquivos WIP no `main` não mesclados. Antes do merge:
- Review os 2 commits (`3278842` IVR + `6d82805` fix whats/IA)
- Resolver conflitos com teus WIP (Discador, Historico etc)
- `npx vercel --prod` depois do merge

### 6. V2 futura: TTS custom tocando os mp3 v3
Criar classe `IVRTTS(tts.TTS)` em `agent-ivr.py` que:
- Recebe texto do LLM (vem do proxy)
- Se o texto tem tag `⟦intent_id⟧` no início → baixa mp3 do bucket `ivr-audios` e emite como AudioEmitter
- Senão → delega pra Cartesia TTS normal
Isso ativa os áudios v3 de verdade na ligação (ganho de qualidade ElevenLabs).

---

## Tree de intents

### Objetivo (28 intents) — handoff WhatsApp
```
opening_qualificacao / opening_reativacao
  ↓
pitch_discount_15 / pitch_condicao_unica
  ↓
ask_what_is / ask_how_works / ask_vehicle_type_q
  ↓
benefit_carro / benefit_moto / benefit_caminhao
  ↓
request_whatsapp_simple / request_whatsapp_soft_insist
  ↓
whatsapp_confirmation (TERMINAL)

objeções: obj_price / obj_no_time / obj_no_interest / obj_already_has / obj_no_want / obj_voce_e_ia (deflete)
redirects: redirect_price_to_whats / redirect_howworks_to_whats / redirect_think_to_whats
compliance: how_got_number
goodbyes: goodbye_after_2_no / goodbye_deixa_proxima / goodbye_thanks
edge: confusion_assume_yes / disambiguation_vehicle
```

### Trilia (23 intents) — handoff via WhatsApp pro SDR humano
```
opening_{medicos_dentistas, advogados_consultores, donos_empresa, estetica, generico}
  ↓
pitch_3_pilares (pergunta dor: vendas/marca/time)
  ↓
probe_crescer (se lead disse "tá tudo bem")
  ↓
transfer_to_sdr_offer (manda conversa no whats pro consultor)
  ↓
transfer_confirm_connecting (TERMINAL + action:send_whatsapp_sdr_handoff)

objeções: obj_no_time_1 / obj_me_liga_depois / obj_to_ocupado / obj_ja_tenho_consultoria /
          obj_nao_conheco / obj_nao_preciso / obj_manda_whats / obj_voce_e_ia (deflete) / obj_preco
compliance: how_got_number_trilia
goodbyes: goodbye_whats_yes / goodbye_whats_no / goodbye_no_answer
hard-rule: close_after_3_objections (ativado em objection_count>=3)
```

---

## Decisões registradas

**Regras absolutas** (também salvas como feedback memory pra Claude):
1. Agentes **NUNCA admitem ser IA/robô/assistente**. Deflete e redireciona pro fluxo.
2. Handoff é **SEMPRE via WhatsApp** (Objetivo: cotação; Trilia: consultor humano chama). Nunca transferência SIP live.
3. `agent.py` original é **read-only** (causa mudo — testado 6+ vezes). Toda mudança vai em cópia `agent-ivr.py`.

**Defaults IVR proxy (v1 single-tenant):**
- `IVR_COMPANY_ID` default = Objetivo
- `IVR_VOICE_PROFILE_ID` default = Lucas v3
- Multi-tenant funciona hoje via model string `ivr:<company_id>:<voice_profile_id>` (proxy já parseia — só precisa o agent-ivr.py setar `GROQ_MODEL` dinamicamente pelo room metadata antes de instanciar LLM)

---

## Coisas que deixei pendente

- [ ] Teste E2E com ligação real (aguarda seu número)
- [ ] Patch `call-api.py` pra aceitar `route=ivr`
- [ ] Botão "Disparar Ligação IVR" no IvrStudio
- [ ] `make-call` edge function aceitar `route`
- [ ] Merge `feat/ivr-studio` → `main` (depois de resolver seus WIP)
- [ ] Deploy Vercel produção
- [ ] Validar qualidade dos 102 áudios v3 (ouvir na UI IvrStudio)
- [ ] Multi-tenant dinâmico no agent-ivr.py (setar GROQ_MODEL pelo metadata)
- [ ] V2: classe TTS custom que toca os mp3 v3 do bucket em vez de Cartesia
