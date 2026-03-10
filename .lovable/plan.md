

# Plan: Dark Mode + New Pages + Data Fixes + Permissions

This is a large set of changes touching theme, navigation, permissions, data queries, and a new page. Here is the implementation plan broken into logical groups.

---

## 1. Dark Mode Moderno (Fixed Dark Only)

**Files changed:** `src/index.css`, `src/main.tsx`, `src/components/ThemeToggle.tsx`, `src/components/DashboardLayout.tsx`

- Update CSS variables in `src/index.css` to use the specified dark palette as the **only** theme (remove `.dark` class variant, apply dark colors to `:root` directly):
  - `--background`: #0A0A0F
  - `--card` / `--sidebar-background`: #111118
  - `--border`: #1E1E2E
  - `--foreground`: #F1F1F3
  - `--muted-foreground`: #8B8B9E
  - `--primary`: #2563EB
  - `--success`: #10B981
  - `--destructive`: #EF4444
  - `--sidebar-accent`: gradient-compatible (#1A1A28)
  - `--input`: #0D0D15, input borders: #2A2A3C
  - Hover on cards: #1A1A28
- Add `class="dark"` to `<html>` in `index.html` or set it in `main.tsx`
- Remove `ThemeToggle` component usage from `DashboardLayout` header
- Delete or empty `ThemeToggle.tsx`
- Add custom button styling: `border-radius: 10px`, subtle blue shadow on hover
- Remove the light mode CSS variables entirely

## 2. New Page: `/cadastro` (Register Collaborator)

**Files created:** `src/pages/Cadastro.tsx`
**Files changed:** `src/App.tsx`, `src/components/AppSidebar.tsx`

- Add route `/cadastro` with `minLevel={1}` (CEO + Diretor)
- Add sidebar item "Cadastro" with `UserPlus` icon, `maxLevel: 1`
- Page has two tabs: **Individual** and **Em Massa** (CSV upload)
- Individual form fields: Nome, Email, Telefone, Senha (default: `PrimeiroNome@2026`), Empresa (select companies), Cargo (select roles filtered by company), Setor (select sectors filtered by company), Superior Direto (select collaborators from same company)
- On submit: `POST /functions/v1/register-collaborator` with Bearer token
- Show results with password in monospace, copy button, download CSV button
- Below form: table of existing collaborators (real query with JOIN on roles, sectors, companies)
- CSV tab: file upload, parse CSV, batch call the same edge function

## 3. Page: `/identidade-visual` (Already Exists - Minor Updates)

**Files changed:** `src/pages/IdentidadeVisual.tsx`

- Page already exists and is well-built. No major changes needed beyond ensuring it uses the new dark theme styling consistently.

## 4. Fix Data Queries (Remove Mocks, Fix Column Names)

### `/colaboradores` (Colaboradores.tsx)
- Fix `is_active` → `active` in query select, form state, display, and save payload
- Fix `agent_definitions` query: `is_active` → `active` (verify actual column name)
- Add Desativar/Excluir buttons (CEO only) calling `POST /functions/v1/manage-collaborator`

### `/base-dados` (BaseDados.tsx) 
- Fix `is_active` → `active` in the distribute dialog collaborator query (line 149)

### Dashboard (Index.tsx)
- Add KPIs: Agentes Ativos (count `agent_definitions` where `active = true`), Leads, Messages today (count `agent_messages` where `created_at >= today`)
- Update chart to group `contact_leads` by day

### `/meu-bot` (MeuBot.tsx)
- Replace placeholder with "Nenhum canal conectado - contate o administrador"

## 5. Sidebar Permissions by Role Level

**Files changed:** `src/components/AppSidebar.tsx`

Update the `allItems` array to match the specified permission matrix:
- Level 0 (CEO): Everything
- Level 1 (Diretor): Dashboard, Agentes(?), Colaboradores, Cadastro, Métricas, Configurações
- Level 2 (Gestor): Dashboard, Colaboradores, Métricas, + consultant area
- Level 3 (Consultor): Only Conversas, Extração (renamed Prospecção), Meu Bot, Métricas

Adjust `maxLevel` values accordingly and restructure sidebar groups.

## 6. Usage Limits (Lightweight)

**Files changed:** `src/pages/Index.tsx` (consultant dashboard)

- Query `roles.usage_limits` JSONB for the logged-in user's role
- Display usage bars on the consultant dashboard (e.g., "15/50 leads hoje")
- Block actions when limit reached (toast error)

## 7. Global Company Filter

Already implemented via `CompanyFilterContext`. Ensure all pages use `selectedCompanyId` from context. The filter is already in the header. No major changes needed — just verify each page respects it (most already do).

---

## Summary of Files to Create/Edit

| File | Action |
|------|--------|
| `src/index.css` | Rewrite CSS variables for dark-only theme |
| `index.html` | Add `class="dark"` to html tag |
| `src/main.tsx` | Force dark class on documentElement |
| `src/components/ThemeToggle.tsx` | Remove/empty |
| `src/components/DashboardLayout.tsx` | Remove ThemeToggle |
| `src/components/AppSidebar.tsx` | Update permissions, add Cadastro menu item |
| `src/App.tsx` | Add /cadastro route |
| `src/pages/Cadastro.tsx` | **Create** - full registration page |
| `src/pages/Colaboradores.tsx` | Fix `is_active`→`active`, add delete/deactivate |
| `src/pages/BaseDados.tsx` | Fix `is_active`→`active` |
| `src/pages/Index.tsx` | Real KPIs (agents, messages), daily chart |
| `src/pages/MeuBot.tsx` | Show "no channels" message |
| `src/pages/IdentidadeVisual.tsx` | Minor dark theme adjustments |
| `src/pages/Login.tsx` | Update styling for dark theme |

