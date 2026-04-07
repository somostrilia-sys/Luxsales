-- Backfill: copiar call_summary para ai_summary onde está faltando
-- Isso corrige dados históricos onde o backend gravava apenas call_summary
UPDATE calls
SET ai_summary = call_summary
WHERE call_summary IS NOT NULL
  AND (ai_summary IS NULL OR ai_summary = '');
