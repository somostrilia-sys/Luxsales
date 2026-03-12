

## Plan: Empresa Destino Cards & Filter for Base de Dados

### What changes

**Single file:** `src/pages/BaseDados.tsx`

1. **New state:** `filterDestino` (string, default `"all"`) and `destinoCounts` object with counts per destination.

2. **Destination resolver function** `getDestino(lead)` — maps leads to destination labels:
   - `"Objetivo Auto & Truck"` when `category` is `objetivo-transporte` or `objetivo-geral`
   - `"Trilia"` when `category` is `trilia-consultoria`
   - `"OLX - Veículos PF"` when `source` is `olx`
   - `"Google Maps"` when `source` is `google_maps`
   - `"Outros"` for anything else

3. **Destination counts** — fetched in `loadLeads` via a lightweight query (`select category, source` without pagination) to compute counts per destination group. Displayed as colored cards above existing stats.

4. **Top cards row** — 5 cards (Objetivo, Trilia, OLX PF, Google Maps, TOTAL) each with distinct accent color, clickable to set `filterDestino`. Active card gets a highlighted border.

5. **Filter integration** — when `filterDestino` is set (not `"all"`), the Supabase query adds `.or()` conditions matching the appropriate `category`/`source` values for that destination. This composes with existing filters.

6. **Table column** — add "Destino" column after "Categoria" showing the resolved destination label as a badge.

### Implementation details

- Destination filter applied server-side via Supabase `.or()`:
  - Objetivo: `category.eq.objetivo-transporte,category.eq.objetivo-geral`
  - Trilia: `category.eq.trilia-consultoria`
  - OLX PF: `source.eq.olx`
  - Google Maps: `source.eq.google_maps`
- Cards use `Building2`, `Briefcase`, `Car`, `MapPin`, `Database` icons from lucide-react
- Clicking a card toggles the filter (click again to deselect back to "all")
- Existing stats cards (Total, PF, PJ, etc.) remain below the new destination cards

