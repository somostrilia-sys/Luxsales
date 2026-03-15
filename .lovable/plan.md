

# Plan: Create "Walk Voice AI" Page + Sidebar Entry

## Changes

### 1. New page: `src/pages/VoiceAI.tsx`
- 4 tabs: Vozes (default), Gerar Áudio, Templates, Métricas
- Follow same DashboardLayout + dark card patterns from Agentes page
- All dummy data, no backend calls
- Tab 1: 3-column grid of voice cards with avatar, name, company badge, status badge, play/usar buttons
- Tab 2: Split layout (60/40) with textarea, voice select, generate button, audio preview area, history table
- Tab 3: Table with template rows + "Novo Template" button
- Tab 4: 4 stat cards + chart placeholder

### 2. Update `src/components/AppSidebar.tsx`
- Add `Mic` import from lucide-react
- Insert `{ title: "Voice AI", url: "/voice-ai", icon: Mic, levels: [0, 1] }` after "Agentes de IA" entry

### 3. Update `src/App.tsx`
- Add lazy import for VoiceAI
- Add route `/voice-ai` with `<ProtectedRoute minLevel={1}>`

