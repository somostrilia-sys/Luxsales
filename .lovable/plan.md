

# Reestruturação Completa do Painel de Agentes

## Visao Geral

Reestruturar todo o frontend: novo design system (Inter, #2563EB primary, clean Notion/Linear), sidebar com navegacao baseada em RBAC, 4 paginas principais reescritas do zero, e uma Edge Function para extracao de leads.

## Mudancas por Arquivo

### 1. Design System (`src/index.css`)
- Trocar font para Inter (Google Fonts)
- Primary: #2563EB (blue-600), Secondary: #10B981 (emerald-500)
- Background: #F8FAFC, Cards: bg-white rounded-xl shadow-sm
- Remover gradientes KPI, adotar estilo flat/clean
- Remover AnimatedBackground

### 2. Sidebar (`src/components/AppSidebar.tsx`)
- Logo "WALK" no topo (bold, azul)
- Menu dinamico por role level:
  - Dashboard (todos), Extracao (gestor+), Base de Dados (gestor+), Conversas (colaborador+), Meu Bot (colaborador+), Metricas (gestor+), Colaboradores (ceo), Configuracoes (todos)
- Dropdown de empresa no header (CEO ve todas, outros veem so a sua)

### 3. Layout (`src/components/DashboardLayout.tsx`)
- Adicionar filtro de empresa no header (dropdown companies)
- Criar CompanyFilterContext para compartilhar empresa selecionada entre paginas

### 4. Rotas (`src/App.tsx`)
- Ajustar rotas: remover /empresas, /agentes, /meus-leads, /meu-desempenho
- Adicionar /conversas (chat com agentes, antigo MeusAgentes), /meu-bot (colaborador+)
- Extracao e Base de Dados: minLevel=2 (gestor+)
- Metricas: minLevel=2
- Colaboradores: minLevel=0

### 5. Dashboard (`src/pages/Index.tsx`) -- REESCRITA COMPLETA
- 4 KPI cards flat: Total Leads, Msgs Enviadas Hoje, Respostas, Taxa Conversao (de collaborator_metrics agregado)
- Grafico de linha (recharts LineChart): msgs enviadas por dia, ultimos 30d
- Grafico de barras: leads por source (count contact_leads.source group by)
- Ranking top 10 consultores (tabela: nome, msgs, respostas, fechamentos) via collaborator_metrics
- Cards leads por empresa (count contact_leads.company_target)
- Filtros: periodo (Hoje/7d/30d), empresa (do CompanyFilter)

### 6. Extracao por CEP (`src/pages/Extracao.tsx`) -- REESCRITA COMPLETA
- Campo CEP com mascara XXXXX-XXX, auto-preenche cidade/estado/bairro via fetch ViaCEP
- Dropdown empresa alvo (Todas, Objetivo, Trackit, Trilia)
- Checkboxes fontes: PJ Base, Google Maps, OLX, Instagram
- Slider raio (5/10/20/50km)
- Botao "Extrair Leads" azul grande
- Loading com barra de progresso por fonte
- Cards resultado: Total, PF, PJ, Com Email
- Tabela resultados com badges coloridos por fonte, score badges (verde/amarelo/cinza)
- Checkbox selecao multipla + botoes Distribuir/Exportar/Salvar
- Paginacao 50/pagina
- Chama Edge Function "unified-extract"

### 7. Edge Function (`supabase/functions/unified-extract/index.ts`)
- Recebe {cep, sources, company_target, radius_km}
- Resolve CEP via ViaCEP
- pj_base: busca cnpj_leads por prefixo CEP 5 digitos
- google_maps: geocodifica Nominatim, busca Overpass API nodes com tag phone
- olx: fetch OLX API busca por regiao (best effort, pode falhar)
- instagram: busca instagram_leads com telefone
- Dedup por telefone, scoring (instagram=80, pj=75, maps=70, olx=60)
- Upsert contact_leads on phone
- Log em extraction_logs
- CORS headers, verify_jwt=false com getClaims

### 8. Base de Dados (`src/pages/BaseDados.tsx`) -- ENRIQUECER
- Cards topo: Total, PF, PJ, Com Email, Com Telefone
- Tabela com colunas extras: Fonte (badge colorido), Score (badge), Categoria
- Filtros adicionais: tipo PF/PJ, fonte, score minimo, telefone busca
- Acoes em lote: Mudar Status, Excluir
- Paginacao 100/pagina (com offset server-side)

### 9. Colaboradores (`src/pages/Colaboradores.tsx`) -- ENRIQUECER
- Adicionar colunas Telefone e Acoes (editar)
- Modal com checkboxes de agentes (agent_definitions) -- pre-seleciona via role_agent_access, salva overrides em collaborator_agent_access
- Toggle ativo no modal

### 10. Metricas (`src/pages/Metricas.tsx`) -- ENRIQUECER
- Graficos recharts: linha msgs/dia, barras leads por fonte
- Ranking consultores
- Filtro periodo

### 11. Conversas (`src/pages/Conversas.tsx`) -- renomear MeusAgentes
- Mesmo chat, rename de rota

### 12. Paginas a remover
- `Empresas.tsx`, `AgentesManagement.tsx`, `MeusLeads.tsx`, `MeuDesempenho.tsx` (funcionalidades absorvidas pelo Dashboard e Metricas)
- `AnimatedBackground.tsx` (design clean sem animacoes de fundo)

### 13. Arquivos de suporte
- `supabase/config.toml`: adicionar [functions.unified-extract] verify_jwt = false

## Ordem de Implementacao

1. Design system + Layout + CompanyFilter context
2. Sidebar reestruturada
3. Rotas atualizadas
4. Dashboard com graficos recharts
5. Extracao por CEP (frontend)
6. Edge Function unified-extract
7. Base de Dados enriquecida
8. Colaboradores com agentes
9. Metricas com graficos
10. Conversas (rename)
11. Limpeza de arquivos removidos

