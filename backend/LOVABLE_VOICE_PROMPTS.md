# LuxSales Voice — Prompts para Lovable UI

Instruções para o Alex implementar no Lovable (app.holdingwalk.com.br).
NÃO alterar código existente — apenas adicionar novas páginas/componentes.

---

## Tela 1: Discador (`/voice/dialer`)

**Prompt para Lovable:**

Crie uma página chamada "Discador" em `/voice/dialer` com:

1. **Header** com título "Discador LuxSales" e badge colorido mostrando status: verde "Rodando" / amarelo "Pausado" / cinza "Parado"

2. **Painel de controle** (cards no topo):
   - Card "Chamadas Ativas": número grande com ícone de telefone (máx 5)
   - Card "Fila de Leads": total de leads pendentes
   - Card "Modo": toggle "Simulação / Real" (vermelho quando real, azul quando simulação)

3. **Botões principais** (barra de ação):
   - Botão verde "▶ Iniciar Discagem" → POST /api/orchestrator/queue/start
   - Botão amarelo "⏸ Pausar" → POST /api/orchestrator/queue/pause
   - Botão azul "⚡ Despachar Próximo" → POST /api/orchestrator/dispatch

4. **Tabela "Fila de Leads"** com colunas:
   - Lead ID | Telefone | Empresa | Prioridade | Tentativas | Status
   - Dados de: GET /api/orchestrator/queue/status → campo `queue_items`

5. **Polling automático**: atualizar dados a cada 10 segundos enquanto a página estiver aberta

API base: `http://192.168.0.206:3002` (ou variável de ambiente ORCHESTRATOR_URL)

---

## Tela 2: Simulação (`/voice/simulate`)

**Prompt para Lovable:**

Crie uma página "Simulação" em `/voice/simulate` com:

1. **Toggle "Modo Simulação"** (switch grande, vermelho=real, azul=simulação):
   - ON → POST /api/orchestrator/queue/simulate com `{"enabled": true}`
   - OFF → POST /api/orchestrator/queue/simulate com `{"enabled": false}`
   - Mostrar aviso: "⚠️ Modo Real: chamadas reais serão feitas!" quando desligado

2. **Formulário "Disparar Teste"**:
   - Campo "Telefone" (formato: 11999999999)
   - Campo "Company ID" (select: "objetivo", ou campo livre)
   - Campo "Lead ID" (opcional)
   - Botão "🚀 Disparar Teste" → POST /api/orchestrator/dispatch

3. **Log em tempo real** (área de texto auto-scroll, últimas 50 linhas):
   - Buscar logs de: GET /api/orchestrator/queue/status a cada 3 segundos
   - Mostrar: timestamp, evento, resultado
   - Colorir por tipo: verde=sucesso, amarelo=simulado, vermelho=erro

4. **Card de Status** no topo:
   - Modo atual (Simulação/Real)
   - Chamadas ativas
   - Horário comercial: "✅ Horário comercial" / "🔴 Fora do horário"

API base: mesma do Discador

---

## Tela 3: Histórico de Chamadas (`/voice/calls`)

**Prompt para Lovable:**

Crie uma página "Chamadas" em `/voice/calls` com:

1. **Filtros no topo**:
   - Filtro por status: Todas | Simulado | Concluída | Falhou | Não Atendeu
   - Date picker: período (padrão: últimos 7 dias)
   - Campo busca por telefone

2. **Tabela principal** com colunas:
   - # | Lead | Telefone | Status | Duração | Data/Hora | Ações
   
   Status com cores:
   - `simulated` → badge azul "Simulado"
   - `completed` / `answered` → badge verde "Concluída"
   - `failed` → badge vermelho "Falhou"
   - `no_answer` → badge cinza "Não Atendeu"
   - `calling` → badge amarelo piscante "Em andamento"

3. **Coluna Ações**: botão "Ver Resumo" → abre modal com:
   - Nome do lead, telefone, duração
   - Campo "Resumo" (texto do campo `summary`)
   - Badge de sentimento: 😊 Interessado / 😐 Neutro / 😞 Sem interesse
   - Toggle "WhatsApp autorizado?" (read-only)

4. **Paginação**: 20 registros por página, total de registros

5. **Export CSV**: botão "⬇️ Exportar CSV" que baixa os dados filtrados

API: POST para Edge Function `dashboard-calls` com action `call-history`:
```json
{
  "action": "call-history",
  "company_id": "objetivo",
  "requester_role": "ceo",
  "limit": 20,
  "offset": 0
}
```
URL: `https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/dashboard-calls`
Headers: `Authorization: Bearer <SUPABASE_ANON_KEY>`

---

## Variáveis de Ambiente necessárias (Lovable)

Adicionar no painel de variáveis do Lovable:
- `VITE_ORCHESTRATOR_URL=http://192.168.0.206:3002`
- `VITE_SUPABASE_URL=https://ecaduzwautlpzpvjognr.supabase.co`
- `VITE_SUPABASE_ANON_KEY=<chave anon pública>`

---

## Notas de implementação

- O orquestrador roda na porta 3002 — o Lovable precisará de um proxy ou CORS configurado
- Recomendado: criar uma Edge Function `orchestrator-proxy` que repassa chamadas para 192.168.0.206:3002
- Alternativa: abrir porta 3002 no firewall e adicionar `192.168.0.206:3002` como allowed origin
- Os dados de chamadas vêm da Edge Function `dashboard-calls` (já deployada no Supabase)
- O campo `summary` é alias de `call_summary`, `duration` é alias de `duration_seconds`, `phone` é alias de `destination_number`
