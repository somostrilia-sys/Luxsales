# LuxSales Backend

Plataforma comercial inteligente — **Digital Lux**

## Stack
- **Runtime:** Supabase Edge Functions (Deno)
- **Database:** Supabase PostgreSQL
- **WhatsApp:** Meta Business Cloud API (oficial)
- **TTS:** Fish Audio API
- **STT:** OpenAI Whisper
- **LLM:** Claude (Anthropic) / GPT-4o (OpenAI)

## Edge Functions

| Function | Description |
|----------|-------------|
| `generate-template` | IA para criação de templates WhatsApp estratégicos |
| `generate-voice` | Gera áudio TTS via Fish Audio |
| `make-call` | Inicia ligações via SIP Trunk |
| `send-meta-message` | Envia mensagens via Meta WhatsApp Cloud API |
| `simulate-call` | Simulador de ligação IA (STT→LLM→TTS) |
| `telegram-bot-webhook` | Webhook do bot Telegram |
| `vapi-tts-webhook` | Webhook TTS para Vapi |
| `whatsapp-meta-webhook` | Webhook oficial Meta WhatsApp |

## Deploy

```bash
npx supabase functions deploy <function-name> --no-verify-jwt --project-ref ecaduzwautlpzpvjognr
```

## Compliance
- ✅ Meta Business API compliant
- ✅ Opt-in tracking
- ✅ Template approval workflow
- ✅ Message status tracking (sent/delivered/read)
- ✅ Privacy Policy & Terms of Service

## License
Proprietary — Digital Lux © 2026
