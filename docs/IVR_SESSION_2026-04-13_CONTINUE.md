# IVR Studio — Sessão 2026-04-13 (tarde) · Handoff pra continuar em casa

## TL;DR

Sessão remota terminou antes de alcançar o PC Gamer (192.168.0.206 — rede privada).
Tudo que era **código / GitHub / Supabase** foi feito e validado.
Resta só: **SSH no PC Gamer + patch call-api.py + teste E2E**.

---

## O que foi feito nesta sessão

| # | Ação | Estado |
|---|---|---|
| 1 | Clone local do repo `Luxsales` na branch `feat/ivr-studio` | ✅ `~/Luxsales` (Mac) |
| 2 | Patch `supabase/functions/make-call/index.ts` — aceita `route=\"ivr\"` e repassa + `voice_profile_id` | ✅ commit `b61047f` |
| 3 | Patch `src/pages/IvrStudio.tsx` — card "Testar ligação IVR" (input telefone + botão Discar) | ✅ commit `b61047f` |
| 4 | Doc `docs/IVR_CALL_API_PATCH.md` — instruções do patch pro PC Gamer | ✅ commit `e4ba50a` |
| 5 | Fix `src/pages/ConviteRedirect.tsx` — stub que quebrava build desde `3278842` | ✅ commit `8511601` |
| 6 | Push `feat/ivr-studio` | ✅ origin atualizada |
| 7 | Deploy `supabase functions deploy make-call --no-verify-jwt` | ✅ em produção |
| 8 | Build Vite local | ✅ passa (`npm run build`) |
| 9 | PR #1 `feat/ivr-studio` → `main` aberto | ✅ https://github.com/somostrilia-sys/Luxsales/pull/1 |

### Commits novos na `feat/ivr-studio`

```
8511601 fix(routing): add ConviteRedirect stub (/c/:code → /convite/:code)
e4ba50a docs(ivr): patch instructions for call-api.py route=ivr on PC Gamer
b61047f feat(ivr): botão "Testar ligação IVR" no IvrStudio + route=ivr no make-call
e793f69 docs(ivr): handoff completo da sessão 2026-04-13   ← estava aqui no início
```

### Smoke tests que rodaram

```bash
# Edge function ivr-classify — ok
curl -s -X POST https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/ivr-classify \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" \
  -d '{"company_id":"70967469-9a9b-4e29-a744-410e41eb47a5","voice_profile_id":"160e58e8-e525-432b-9290-5e90d968d92b","transcript":"tá muito caro"}'
# → {"intent_id":"obj_price","confidence":0.9,"reason":"fast_keyword_match",...}

# Bucket público — ok
curl -sI "https://ecaduzwautlpzpvjognr.supabase.co/storage/v1/object/public/ivr-audios/.../obj_price_v1.mp3"
# → HTTP/2 200, audio/mpeg, 134KB

# Edge function make-call (após deploy) — ok
curl -s -X POST https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/make-call \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" \
  -d '{"action":"pipeline-status"}'
# → {"pipeline":"livekit","status":"online","ok":true,"active_calls":11}
```

### PR #1 — estado

- **Mergeable**: `CONFLICTING` (branch está 47 commits atrás do `main`)
- Isso é esperado — prometido no handoff original
- NÃO mexi em main nem forcei merge; decisão sua

---

## O que ainda falta (em ordem)

### 1. SSH PC Gamer + patch `call-api.py` (crítico)

Você na rede de casa (onde o PC Gamer está ligado). Daí:

```bash
ssh pcgamer
# já configurado em ~/.ssh/config → HostName 192.168.0.206, User alex
```

Doc do patch está em:
`~/Luxsales/docs/IVR_CALL_API_PATCH.md`
ou
https://github.com/somostrilia-sys/Luxsales/blob/feat/ivr-studio/docs/IVR_CALL_API_PATCH.md

**Resumo do patch:**

Editar `/home/alex/walk-livekit/call-api.py`:

1. No handler `POST /call`, após parsear o body:
```python
route = (body.get("route") or "").strip().lower() or None
voice_profile_id = body.get("voice_profile_id")
```

2. Antes de `create_sip_participant(...)`:
```python
if route == "ivr":
    from livekit.api import AgentDispatchRequest
    metadata = {
        "voice_id": body.get("voice_id"),
        "agent_name": body.get("agent_name") or "Lucas",
        "company_id": body.get("company_id"),
        "voice_profile_id": voice_profile_id,
        "lead_id": body.get("lead_id"),
    }
    await lk.agent_dispatch.create_dispatch(
        AgentDispatchRequest(agent_name="ivr", room=room_name, metadata=json.dumps(metadata))
    )
    logger.info(f"[IVR] dispatched agent_name=ivr to room={room_name}")
```

3. Restart:
```bash
pm2 restart walk-livekit-stack
pm2 logs walk-livekit-stack --lines 30 --nostream
```

### 2. Teste E2E

No IvrStudio (Vercel preview), selecione Empresa + Voz, digita seu número no card "Testar ligação IVR" e clica "Discar".

Ou via curl:
```bash
curl -s -X POST https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/make-call \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" \
  -d '{
    "action":"dial",
    "route":"ivr",
    "to":"+55SEU_NUMERO",
    "company_id":"70967469-9a9b-4e29-a744-410e41eb47a5",
    "voice_profile_id":"160e58e8-e525-432b-9290-5e90d968d92b"
  }'
```

Logs pra monitorar no PC Gamer (em duas abas separadas):
```bash
pm2 logs walk-livekit-stack --lines 0        # deve ver "[IVR] dispatched"
pm2 logs walk-livekit-ivr   --lines 0        # deve ver "received job" + intents batendo
```

### 3. Resolver conflitos PR #1 e merge

Branch 47 commits atrás de `main`. Sugestão:

```bash
cd ~/Luxsales
git fetch origin main
git checkout feat/ivr-studio
git rebase origin/main
# resolve conflitos por arquivo (os IVR novos: IvrStudio.tsx, ivr-classify, make-call, migrations)
git push --force-with-lease origin feat/ivr-studio
gh pr merge 1 --squash
```

Arquivos que quase certo vão conflitar (tem 47 commits mexendo neles também):
- `src/App.tsx`, `src/components/AppSidebar.tsx`
- `src/pages/Discador.tsx`, `Historico.tsx`, `Ligacoes.tsx`, `VoiceSimulate.tsx`
- `supabase/functions/make-call/index.ts`, `conversation-engine`, `call-complete`

### 4. Deploy prod

```bash
cd ~/Luxsales
git checkout main && git pull
npx vercel --prod
```

---

## Credenciais úteis (copiadas do handoff original)

```bash
# LiveKit Cloud
export LIVEKIT_URL=wss://voz-ia-qqqy5qik.livekit.cloud
export LIVEKIT_API_KEY=API5i8HCXxYUNda
export LIVEKIT_API_SECRET=JZ55SEglenqpI4SjsyeflZyyEuHOUrqLaVeBoT8U7iAA

# Supabase LuxSales
PROJECT_REF=ecaduzwautlpzpvjognr
ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjYWR1endhdXRscHpwdmpvZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMDQ1MTcsImV4cCI6MjA4ODU4MDUxN30.LinR7PIoK7n79hWjbSJ3EgDwA_y6uN-HfQnOk7GgYi4"

# ElevenLabs
export ELEVENLABS_API_KEY=sk_795fae1f60b84b9543c92dc36cd1de829f83f57a7bfc8e1b

# Company IDs
OBJETIVO=70967469-9a9b-4e29-a744-410e41eb47a5
TRILIA=131d9cba-d49c-44d5-a9b3-baa84d34bd96

# Voice profiles v3
LUCAS_V3_PROFILE=160e58e8-e525-432b-9290-5e90d968d92b
CLEO_V3_PROFILE=c802b841-756d-415a-af07-ac6c633edfc0
```

---

## Estado em links

- PR: https://github.com/somostrilia-sys/Luxsales/pull/1
- Branch: https://github.com/somostrilia-sys/Luxsales/tree/feat/ivr-studio
- Handoff original: https://github.com/somostrilia-sys/Luxsales/blob/feat/ivr-studio/docs/IVR_HANDOFF_2026-04-13.md
- Patch call-api: https://github.com/somostrilia-sys/Luxsales/blob/feat/ivr-studio/docs/IVR_CALL_API_PATCH.md
- Supabase dashboard: https://supabase.com/dashboard/project/ecaduzwautlpzpvjognr/functions

---

## Repo local (Mac)

```
/Users/alexanderdonato/Luxsales          # shallow clone feat/ivr-studio (depth 50)
├─ node_modules                          # já instalado
├─ dist                                  # build local válido
└─ docs/
   ├─ IVR_HANDOFF_2026-04-13.md          # handoff inicial
   ├─ IVR_CALL_API_PATCH.md              # patch pro PC Gamer
   └─ IVR_SESSION_2026-04-13_CONTINUE.md # este arquivo
```

Pra remover e clonar fresh em casa se quiser:
```bash
rm -rf ~/Luxsales
gh repo clone somostrilia-sys/Luxsales
cd Luxsales && git checkout feat/ivr-studio && npm install
```
