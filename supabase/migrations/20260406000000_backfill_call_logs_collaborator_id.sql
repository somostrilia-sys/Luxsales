-- Backfill: preencher collaborator_id em call_logs a partir da tabela calls (via call_id)
UPDATE call_logs cl
SET collaborator_id = c.collaborator_id
FROM calls c
WHERE cl.call_id = c.id
  AND cl.collaborator_id IS NULL
  AND c.collaborator_id IS NOT NULL;
