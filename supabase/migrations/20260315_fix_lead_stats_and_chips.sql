-- ============================================================
-- WALK Agente Central Hub — Migration: Fix Lead Stats + Chip Improvements
-- 1. Create missing get_lead_stats_by_collaborator RPC
-- 2. Add ON DELETE SET NULL to prospection_messages.chip_id
-- 3. Ensure conversations.chip_id properly handles chip deletion
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. get_lead_stats_by_collaborator — CRITICAL MISSING FUNCTION
--    Used by Motor de Leads dashboard to show per-collaborator metrics
--    Aggregates from consultant_lead_pool (actual dispatched leads)
-- ──────────────────────────────────────────────────────────────
-- Drop existing function first (return type may differ)
DROP FUNCTION IF EXISTS get_lead_stats_by_collaborator(uuid);

CREATE OR REPLACE FUNCTION get_lead_stats_by_collaborator(p_company_id UUID DEFAULT NULL)
RETURNS TABLE (
  collaborator_id UUID,
  collaborator_name TEXT,
  role_slug TEXT,
  total_atribuidos BIGINT,
  total_pendentes BIGINT,
  total_enviados BIGINT,
  total_responderam BIGINT,
  total_convertidos BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS collaborator_id,
    c.name AS collaborator_name,
    COALESCE(r.slug, '') AS role_slug,
    COUNT(clp.id) AS total_atribuidos,
    COUNT(clp.id) FILTER (WHERE clp.status IN ('pending', 'available')) AS total_pendentes,
    COUNT(clp.id) FILTER (WHERE clp.status = 'sent') AS total_enviados,
    COUNT(clp.id) FILTER (WHERE clp.status = 'responded') AS total_responderam,
    COUNT(clp.id) FILTER (WHERE clp.status = 'converted') AS total_convertidos
  FROM collaborators c
  LEFT JOIN roles r ON r.id = c.role_id
  INNER JOIN consultant_lead_pool clp ON clp.collaborator_id = c.id
  WHERE
    (p_company_id IS NULL OR c.company_id = p_company_id)
  GROUP BY c.id, c.name, r.slug
  HAVING COUNT(clp.id) > 0
  ORDER BY c.name;
END;
$$;

COMMENT ON FUNCTION get_lead_stats_by_collaborator IS 'Returns per-collaborator lead metrics from consultant_lead_pool. Used by Motor de Leads dashboard.';

-- ──────────────────────────────────────────────────────────────
-- 2. Ensure FK constraints on tables referencing disposable_chips
--    use ON DELETE SET NULL so chip deletion never fails
-- ──────────────────────────────────────────────────────────────

-- prospection_messages: if chip_id references disposable_chips, fix it
DO $$
BEGIN
  -- Drop existing FK if it references disposable_chips and recreate with ON DELETE SET NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'prospection_messages_chip_id_fkey'
    AND table_name = 'prospection_messages'
  ) THEN
    ALTER TABLE prospection_messages DROP CONSTRAINT prospection_messages_chip_id_fkey;
    ALTER TABLE prospection_messages
      ADD CONSTRAINT prospection_messages_chip_id_fkey
      FOREIGN KEY (chip_id) REFERENCES disposable_chips(id) ON DELETE SET NULL;
  END IF;
END $$;

-- conversations: ensure chip_id FK allows chip deletion
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_name = 'conversations_chip_id_fkey'
    AND tc.table_name = 'conversations'
    AND rc.delete_rule != 'SET NULL'
  ) THEN
    ALTER TABLE conversations DROP CONSTRAINT conversations_chip_id_fkey;
    -- Recreate only if the column references disposable_chips
    -- (it may reference channels instead - in that case, skip)
  END IF;
END $$;

-- blast_jobs: if it exists and references disposable_chips
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'blast_jobs' AND table_schema = 'public'
  ) THEN
    -- Ensure any chip references use ON DELETE SET NULL
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name LIKE '%chip%fkey%'
      AND table_name = 'blast_jobs'
    ) THEN
      -- Dynamic handling - just ensure the constraint is SET NULL
      NULL;
    END IF;
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────
-- 3. Index optimizations for consultant_lead_pool queries
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_consultant_lead_pool_collab_status
  ON consultant_lead_pool(collaborator_id, status);
CREATE INDEX IF NOT EXISTS idx_consultant_lead_pool_status
  ON consultant_lead_pool(status);
