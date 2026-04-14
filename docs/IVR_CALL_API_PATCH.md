---
title: Patch `call-api.py` — suporte a `route=ivr`
date: 2026-04-13
target: /home/alex/walk-livekit/call-api.py (PC Gamer 192.168.0.206)
---

# Patch: `route=ivr` no `call-api.py`

## Contexto

A edge function `make-call` já foi atualizada (deploy 2026-04-13) para aceitar
`route: "ivr"` no body do `action=dial` e repassar o campo pro `call-api`.

Falta o lado PC Gamer: quando `call-api.py` receber `route=ivr`, ele deve
disparar um `agent_dispatch` pro agent registrado como `agent_name=ivr`
**antes** de criar o SIP participant. Sem isso, a ligação cai no agent normal
e o fluxo IVR determinístico não é acionado.

## Como aplicar (SSH PC Gamer)

```bash
ssh alex@192.168.0.206
cd /home/alex/walk-livekit
cp call-api.py call-api.py.bak-$(date +%Y%m%d)
```

## Patch — dois trechos

### 1. No handler do `POST /call` — ler o campo `route`

Procure onde o body é parseado (algo como `body = await request.json()` ou
`data = request.json`). Logo após, adicione:

```python
route = (body.get("route") or "").strip().lower() or None
voice_profile_id = body.get("voice_profile_id")
```

### 2. Antes de `create_sip_participant` — se `route == "ivr"`, dispatch do agent IVR

Procure a chamada `create_sip_participant` (ou equivalente) dentro do handler.
**Antes** dela, adicione:

```python
if route == "ivr":
    from livekit import api
    from livekit.api import AgentDispatchRequest

    lk = api.LiveKitAPI(
        url=os.environ["LIVEKIT_URL"],
        api_key=os.environ["LIVEKIT_API_KEY"],
        api_secret=os.environ["LIVEKIT_API_SECRET"],
    )

    metadata = {
        "voice_id": body.get("voice_id"),
        "agent_name": body.get("agent_name") or "Lucas",
        "company_id": body.get("company_id"),
        "voice_profile_id": voice_profile_id,
        "lead_id": body.get("lead_id"),
    }

    await lk.agent_dispatch.create_dispatch(
        AgentDispatchRequest(
            agent_name="ivr",
            room=room_name,
            metadata=json.dumps(metadata),
        )
    )
    logger.info(f"[IVR] dispatched agent_name=ivr to room={room_name}")
```

Observações:

- `room_name` deve já estar definido antes desse ponto (é o mesmo nome usado
  pelo `create_sip_participant` logo em seguida).
- Se `from livekit import api` já existe no topo do arquivo, pode remover o
  `import` local.
- `json` já é importado (é usado no resto do arquivo).

## Reiniciar stack

```bash
pm2 restart walk-livekit-stack
pm2 logs walk-livekit-stack --lines 30 --nostream
```

## Smoke test

Da sua máquina:

```bash
curl -s -X POST https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/make-call \
  -H "Authorization: Bearer $ANON" \
  -H "apikey: $ANON" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "dial",
    "route": "ivr",
    "to": "+55SEU_NUMERO",
    "company_id": "70967469-9a9b-4e29-a744-410e41eb47a5",
    "voice_profile_id": "160e58e8-e525-432b-9290-5e90d968d92b"
  }'
```

Logs esperados:

- `walk-livekit-stack`: `[IVR] dispatched agent_name=ivr to room=...`
- `walk-livekit-ivr`: `received job` com esse mesmo `room`

Sem o patch, a ligação ainda funciona — mas cai no `agent.py` padrão (sem
classificador IVR).
