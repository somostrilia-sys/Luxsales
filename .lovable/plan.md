

# Plan: Expand Voice AI + New Sidebar Section + CallCampaigns Page

## 1. Rewrite `src/pages/VoiceAI.tsx` — 6 Tabs

Replace current 4-tab page with 6 tabs, all dummy data:

**Tab 1 "Voice Lab"** (default): Voice profile cards grid. Each card has avatar initials, voice name, company badge, status badge (Ativa/Treinando/Inativa), sample count ("25 amostras"), duration ("35 min"), Play/Edit/Delete buttons. Green "Nova Voz" button top right. 3 dummy voices.

**Tab 2 "Gerar PTT"**: Split 60/40. Left: textarea, voice dropdown, speed slider (0.7-1.2), background noise toggle + volume slider, green "Gerar" button. Right: audio player with waveform placeholder, download button, "Enviar WhatsApp" button. Below: history table.

**Tab 3 "Templates"**: Table with columns Nome/Texto/Empresa/Categoria/Status. "Novo Template" button. 5 dummy PT-BR sales rows (Abertura, Follow-up, Qualificação, Reativação, Fechamento).

**Tab 4 "Campanhas de Ligação"**: Campaign table with Nome/Voz/Produto/Leads/Feitas/Atendidas/Convertidas/Status. "Nova Campanha" button. 2 dummy campaigns. Chart placeholder card.

**Tab 5 "Knowledge Base"**: Card grid for products. "Adicionar Produto" button. 2 cards: Objetivo (12 docs) and Trilia (8 docs) with doc count, last update, and manage button.

**Tab 6 "Métricas"**: 6 stat cards, 2 chart placeholder cards side by side, top consultores table (5 rows).

## 2. Update `src/components/AppSidebar.tsx`

- Remove "Voice AI" from `managementItems`
- Add new `voiceItems` array between management and consultant sections with label "Voz e Ligações":
  - `{ title: "Voice AI", url: "/voice-ai", icon: Mic, levels: [0, 1] }`
  - `{ title: "Ligações IA", url: "/call-campaigns", icon: PhoneCall, levels: [0, 1] }`
- Add `PhoneCall` to lucide imports
- Render new section between Gestão and Consultor

## 3. Create `src/pages/CallCampaigns.tsx`

New page with DashboardLayout containing:
- Header "Ligações IA" with subtitle
- 4 stat cards: Total Campanhas, Ligações Hoje, Taxa Atendimento, Taxa Conversão
- Campaigns table: Nome/Voz/Produto/Total Leads/Ligações Feitas/Atendidas/Convertidas/Status
- "Nova Campanha" green button
- 3 dummy campaign rows

## 4. Update `src/App.tsx`

- Add lazy import for `CallCampaigns`
- Add route `/call-campaigns` with `<ProtectedRoute minLevel={1}>`

