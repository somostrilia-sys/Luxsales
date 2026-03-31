# Prompts Lovable — Dashboards + Leads Master

Execute na ordem. Cada prompt é independente.

---

## PROMPT 15: Dashboard Geral (/) — Tela Principal do CEO

```
Crie a página principal "/" como Dashboard Geral do CEO. Esta é a primeira tela que aparece ao logar.

DADOS: Chama a Edge Function "dashboard-geral":
POST https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/dashboard-geral
Body: { "action": "overview", "company_id": "[COMPANY_ID]", "requester_role": "ceo" }
Headers: { "Content-Type": "application/json", "Authorization": "Bearer [SUPABASE_ANON_KEY]" }

LAYOUT (grid responsivo):

LINHA 1 — Cards de manchete (6 cards horizontais):
- Total de Leads (headline.total_leads) — ícone Users, cor azul
- Leads Quentes (headline.leads_hot) — ícone Flame, cor vermelho
- Ligações Hoje (headline.calls_today) — ícone Phone, cor verde
- Disparos Hoje (headline.dispatches_today) — ícone Send, cor roxo
- Conversas Ativas (headline.active_conversations) — ícone MessageCircle, cor amarelo
- Conversões (headline.conversions) — ícone Trophy, cor dourado

LINHA 2 — 3 colunas:

COLUNA 1: Card "Ligações"
- Hoje: calls.today.total chamadas, calls.today.answered atendidas
- Taxa de atendimento: calls.answer_rate%
- Taxa de opt-in: calls.opt_in_rate%
- Barra de progresso visual pra cada taxa

COLUNA 2: Card "WhatsApp"
- Hoje: whatsapp.today.total disparos
- Entregues: whatsapp.delivery_rate%
- Lidos: whatsapp.read_rate%
- Respondidos: whatsapp.reply_rate%
- Barras de progresso

COLUNA 3: Card "Qualidade Meta"
- Badge com cor: GREEN=verde, YELLOW=amarelo, RED=vermelho
- Tier: meta_quality.messaging_limit_tier
- Uso: meta_quality.usage_pct% (progress bar)
- Se RED: mostrar alerta vermelho "Envios pausados"

LINHA 3 — 2 colunas:

COLUNA 1: Card "Equipe" (team)
- team.total membros ativos
- team.active_dispatchers disparando hoje
- team.total_dispatches_today / team.total_limit_today disparos usados
- Progress bar

COLUNA 2: Card "Alertas" (alerts)
- Lista de alertas do response.alerts[]
- Cada alerta com ícone e cor adequada
- Se vazio: "Tudo operando normalmente ✓"

LINHA 4: Card "Filas Ativas"
- Tabs: "Ligações" | "Disparos"
- Tab Ligações: lista queues.call_queues[] com nome, leads_called/total_leads, progress bar
- Tab Disparos: lista queues.dispatch_queues[] com nome, dispatched/total_leads, progress bar
- Se vazio: "Nenhuma fila ativa"

LINHA 5: Botão "Ver KPIs Semanais" → chama action: "kpis" e mostra modal com comparativos semana/mês

REFRESH: Auto-refresh a cada 60 segundos. Botão manual de refresh no header.

NAVEGAÇÃO: Clicar no card de Ligações → /calls, WhatsApp → /meta, Leads → /leads

Se der erro na API: toast com mensagem. Se não tem dados: empty state amigável.
```

---

## PROMPT 16: Dashboard de Ligações (/calls)

```
Crie a página "/calls" como Dashboard de Ligações IA.

DADOS: Chama a Edge Function "dashboard-calls":
POST https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/dashboard-calls
Headers: { "Content-Type": "application/json", "Authorization": "Bearer [SUPABASE_ANON_KEY]" }

SEÇÃO 1 — Overview (action: "overview", company_id, requester_role: "ceo")

LINHA 1 — Cards KPI:
- Ligações Hoje: today.total (destaque grande)
- Atendidas: today.answered
- Opt-in WhatsApp: today.whatsapp_authorized
- Duração Média: today.avg_duration_sec (formatar como "2m 30s")
- Sentimento+: today.sentiment_positive
- Callbacks Agendados: scheduled_callbacks

LINHA 2 — Card "Semana":
- Total: week.total_calls
- Taxa Atendimento: week.answer_rate%
- Taxa Opt-in: week.opt_in_rate%
- Comparação visual com barras

LINHA 3 — Card "Filas de Ligação" (active_queues):
- Tabela com: Nome, Status, Leads Chamados/Total, Atendidos, Opt-ins, Convertidos
- Progress bar por fila
- Botão "Gerenciar Filas" → /call-queues

SEÇÃO 2 — Performance (action: "performance", company_id, period: "30d")

GRÁFICO de linha (usar Recharts):
- Eixo X: datas (daily[].date)
- Linhas: total, answered, opted_in
- Seletor de período: 7d | 30d | 90d

Cards abaixo do gráfico:
- Total de chamadas: totals.calls
- Total de minutos: totals.total_minutes
- Sentimento positivo: totals.positive_sentiment_pct%

SEÇÃO 3 — Histórico (action: "call-history", company_id, limit: 20)

Tabela paginada:
| Data/Hora | Telefone | Nome | Status | Sentimento | Duração | WhatsApp | Resumo |
- Status com badges coloridos (completed=verde, no_answer=cinza, failed=vermelho)
- Sentimento com emoji (positive=😊, negative=😞, neutral=😐)
- WhatsApp: ícone ✓/✗
- Resumo: truncado, expandir ao clicar
- Filtros: status, data de/até
- Paginação

SEÇÃO 4 — Funil (action: "lead-funnel", company_id)

Funil visual (tipo Sankey ou barras horizontais empilhadas):
new → queued_call → called → opted_in → dispatched → engaged → converted

Com números e % de conversão entre cada etapa.

Cards de temperatura:
- 🔥 Hot: funnel.temperature.hot
- 🌡️ Warm: funnel.temperature.warm
- ❄️ Cold: funnel.temperature.cold

Auto-refresh a cada 60s.
```

---

## PROMPT 17: Dashboard Meta/WhatsApp (/meta)

```
Crie a página "/meta" como Dashboard de Qualidade Meta WhatsApp.

DADOS: Edge Function "quality-monitor":
POST https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/quality-monitor
Headers: { "Content-Type": "application/json", "Authorization": "Bearer [SUPABASE_ANON_KEY]" }

SEÇÃO 1 — Status Atual (action: "dashboard", company_id, requester_role: "ceo")

HEADER GRANDE com badge de qualidade:
- quality.quality = GREEN → badge verde "QUALIDADE VERDE"
- quality.quality = YELLOW → badge amarelo "QUALIDADE AMARELA — Reduzir volume"
- quality.quality = RED → badge vermelho "QUALIDADE VERMELHA — ENVIOS PAUSADOS"
- Nome verificado: quality.verified_name

Cards em linha:
- Tier: quality.tier (ex: "TIER_10K")
- Limite do Tier: quality.tier_limit (ex: 10.000)
- Uso em 24h: quality.conversations_24h
- Uso %: quality.usage_pct% — progress bar (verde <30%, amarelo 30-50%, vermelho >50%)
- Bloqueios 24h: quality.blocks_24h

SEÇÃO 2 — Disparos Hoje (dispatches_today)
Cards: total, sent, delivered, read, replied, failed
Com barras de progresso

SEÇÃO 3 — Performance de Templates (templates[])
Tabela:
| Template | Score | Entregas | Leituras | Respostas | Bloqueios | Quality Meta |
- Score com cor: >70 verde, 40-70 amarelo, <40 vermelho
- Quality Meta com badge GREEN/YELLOW/RED
- Ordenar por performance_score DESC

SEÇÃO 4 — Uso da Equipe (seller_usage[])
Tabela:
| Colaborador | Role | Usados/Limite | % |
- Progress bar por colaborador
- Destaque se próximo do limite (>80%)

SEÇÃO 5 — Histórico de Qualidade (action: "history", company_id, limit: 24)
Gráfico de linha (Recharts):
- Eixo X: checked_at (últimas 24 verificações)
- Linha: usage_pct
- Pontos coloridos por quality_rating

SEÇÃO 6 — Histórico de Tier (action: "tier-history", company_id)
Timeline vertical:
- Data, old_tier → new_tier, old_quality → new_quality
- Ícone ↑ verde se upgrade, ↓ vermelho se downgrade
- notes do evento

SEÇÃO 7 — Alertas
- Lista quality.alerts[] com ícones e cores
- Se templates pausados: lista com nomes

Auto-refresh a cada 5 minutos. Botão "Verificar Agora" chama action: "check".
```

---

## PROMPT 18: Leads Master (/leads)

```
Crie a página "/leads" como Gestão de Leads Master. Aqui o CEO vê e gerencia a base de 1.5M+ leads.

DADOS: Edge Function "lead-distributor":
POST https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/lead-distributor
Headers: { "Content-Type": "application/json", "Authorization": "Bearer [SUPABASE_ANON_KEY]" }

HEADER com stats (vem no response de list-master):
Cards: Total, Novos, Na Fila, Chamados, Opt-in, Disparados, Engajados, Convertidos, Perdidos
Cards temperatura: Hot 🔥, Warm 🌡️, Cold ❄️
Score médio

FILTROS (sidebar ou barra superior):
- Status: dropdown (new, queued_call, called, opted_in, dispatched, engaged, converted, lost, dnc, invalid)
- Temperatura: dropdown (hot, warm, cold, dead)
- Segmento: dropdown (protecao_veicular, clinica, imobiliaria, etc)
- Busca: texto livre (telefone ou nome)
- Ordenar: created_at, priority, lead_score

TABELA PRINCIPAL (action: "list-master", company_id, requester_role: "ceo"):
| Status | Telefone | Nome | Score | Temp | Segmento | Ligações | Último Contato | Ações |
- Status com badge colorido
- Score com barra 0-100
- Temperatura com emoji
- Ações: ▶ Ligar (POST make-call dial), 📤 Disparar (POST smart-dispatcher send), 👤 Distribuir, 📝 Editar

PAGINAÇÃO: 50 por página, infinite scroll ou botões Anterior/Próximo

AÇÕES EM LOTE (checkbox + barra de ações):
- Selecionar múltiplos leads
- "Enfileirar para Ligação" → POST lead-distributor { action: "queue-for-call", phone_numbers: [...] }
- "Enfileirar para Disparo" → POST lead-distributor { action: "queue-for-dispatch", phone_numbers: [...] }
- "Distribuir para Colaborador" → modal com select de colaborador → POST lead-distributor { action: "distribute", ... }
- "Alterar Prioridade" → modal com slider 1-10

DRAWER/MODAL de detalhes ao clicar num lead:
- Dados completos: telefone, nome, email, tags, segmento, dados extras
- Histórico de ligações (últimas 5)
- Histórico de disparos (últimos 5)
- Lifecycle stage (se existir)
- Botão editar cada campo

BOTÃO "Importar Leads" no header → /import
BOTÃO "Criar Fila de Ligação" → /call-queues
BOTÃO "Criar Fila de Disparo" → /dispatch-queues
```

---

## PROMPT 19: Importar Leads (/import)

```
Crie a página "/import" para importação de leads em massa.

DADOS: Edge Function "lead-distributor":
POST https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/lead-distributor
Body: { "action": "import", ... }

WIZARD DE 3 PASSOS:

PASSO 1: Upload do Arquivo
- Drag & drop de CSV/XLSX
- Ou colar dados de planilha (textarea)
- Preview das primeiras 5 linhas
- Detectar encoding automaticamente (UTF-8, Latin1)

PASSO 2: Mapeamento de Colunas
- Mostrar colunas detectadas do arquivo
- Para cada coluna do sistema, dropdown pra selecionar qual coluna do arquivo corresponde:
  - Telefone* (obrigatório) → phone_number
  - Nome → lead_name
  - Email → email
  - Cidade → city
  - Estado → state
  - Segmento → segment
  - Tags → tags (separadas por vírgula)
  - Dados extras → campos dinâmicos que viram extra_data JSON
- Preview com mapeamento aplicado

PASSO 3: Configurações
- Source: dropdown (import, purchased, facebook_ad, google_ad, etc)
- Descrição da fonte: texto livre
- Segmento padrão: dropdown
- Prioridade padrão: slider 1-10
- Tags adicionais: input de tags

BOTÃO "Importar":
- Processar CSV no frontend
- Enviar em batches de 500 leads via POST lead-distributor { action: "import", leads: [...] }
- Mostrar progress bar durante importação
- Resultado: "X importados, Y duplicatas, Z inválidos"
- Erros detalhados em accordion expansível

HISTÓRICO DE IMPORTAÇÕES:
- Tabela abaixo do wizard
- Buscar: SELECT * FROM lead_import_batches ORDER BY started_at DESC
- Colunas: Data, Arquivo, Total, Importados, Duplicatas, Inválidos, Status
```

---

## PROMPT 20: Filas de Ligação e Disparo (/call-queues e /dispatch-queues)

```
Crie duas páginas de gestão de filas:

PÁGINA /call-queues — Filas de Ligação

CRUD da tabela call_queues (via Supabase client direto):

LISTA:
- Cards por fila: nome, status (badge), leads_called/total_leads (progress bar)
- KPIs por fila: atendidos, opt-ins, conversões, taxa de conversão
- Botões: ▶ Ativar, ⏸ Pausar, ✏️ Editar, 🗑️ Excluir

FORMULÁRIO (criar/editar fila):
- Nome da fila*
- Segmento: dropdown
- Tags de filtro: input de tags (só leads com essas tags)
- Máximo de tentativas: number (default 3)
- Chamadas por hora: number (default 30)
- Máximo diário: number (default 200)
- Horário: time pickers (início/fim)
- Dias ativos: checkboxes (Seg-Dom)
- Retry: minutos após não atender (default 120), após ocupado (default 30)
- Voz: dropdown de voice_profiles (SELECT voice_key, voice_name FROM voice_profiles WHERE active = true)
- System prompt: textarea
- Script de abertura: textarea
- Prioridade min/max: sliders

BOTÃO "Iniciar Fila" → UPDATE call_queues SET status = 'active'
O processamento real é feito pelo queue-processor (cron).

---

PÁGINA /dispatch-queues — Filas de Disparo WhatsApp

CRUD da tabela dispatch_queues:

LISTA:
- Cards por fila: nome, status, dispatched/total_leads (progress bar)
- KPIs: entregues, lidos, respondidos
- Botões: ▶ Ativar, ⏸ Pausar, ✏️ Editar

FORMULÁRIO:
- Nome da fila*
- Template: dropdown (SELECT name, status FROM whatsapp_meta_templates WHERE status = 'APPROVED')
- Template slot: dropdown (pos_ligacao_principal, follow_up_48h, etc)
- Segmento: dropdown
- Tags de filtro
- Filtrar por temperatura: checkboxes (hot, warm)
- Máximo por hora: number (default 50)
- Máximo diário: number (default 500)
- Respeitar limite do tier: toggle (default true)
- Safety %: number (default 50 — não passar de 50% do tier)
- Horário e dias ativos

Mesma lógica: Ativar a fila, o queue-processor processa via cron.
```

---

## PROMPT 21: Navegação Unificada (Sidebar)

```
Atualize a sidebar/navegação da plataforma com as rotas corretas:

SEÇÃO "Visão Geral":
- 📊 Dashboard → /  (dashboard-geral)

SEÇÃO "Canais":
- 📞 Ligações → /calls (dashboard-calls)
- 💬 WhatsApp → /meta (quality-monitor)

SEÇÃO "Leads":
- 👥 Leads Master → /leads (1.5M+ leads)
- 📥 Importar → /import

SEÇÃO "Operação":
- 📋 Meus Leads → /my-leads (vendedor)
- 💬 Conversas → /conversations
- 📝 Templates → /templates

SEÇÃO "Filas":
- 📞 Filas Ligação → /call-queues
- 📤 Filas Disparo → /dispatch-queues

SEÇÃO "Gestão" (só CEO):
- 👥 Equipe → /team
- ✅ Opt-ins → /opt-ins
- ⚙️ Configuração → /config

REMOVER da sidebar qualquer rota antiga:
- /motor-leads, /atendimento-leads, /proxy, /bots
- Qualquer referência a UazAPI, chips, warmup

BADGE na sidebar:
- Ligações: mostrar número de chamadas hoje
- Conversas: mostrar número de conversas ativas
- Alertas: ponto vermelho se qualidade Meta não é GREEN

Navegação responsiva: em mobile, sidebar vira bottom tab bar com os 5 itens principais (Dashboard, Ligações, WhatsApp, Leads, Conversas).
```
