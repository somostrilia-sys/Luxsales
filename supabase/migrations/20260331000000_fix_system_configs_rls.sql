-- ============================================================
-- FIX: system_configs — adicionar company_id + corrigir RLS
-- Problema: tabela criada sem company_id, RLS conflitante
-- (migration original permite authenticated, 006 restringe a admin)
-- ============================================================

BEGIN;

-- 1. Adicionar coluna company_id se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_configs' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE system_configs ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Criar índice composto para upsert por (key, company_id)
CREATE INDEX IF NOT EXISTS idx_system_configs_key_company
  ON system_configs(key, company_id);

-- 3. Adicionar constraint UNIQUE para suportar onConflict: "key,company_id"
-- Remover a UNIQUE anterior de apenas "key" se existir
DO $$
BEGIN
  -- Tentar dropar a constraint unique de key sozinho
  ALTER TABLE system_configs DROP CONSTRAINT IF EXISTS system_configs_key_key;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Constraint system_configs_key_key não encontrada: %', SQLERRM;
END $$;

-- Criar unique composta (key + company_id) — permite NULL em company_id para configs globais
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS system_configs_key_company_unique
    ON system_configs(key, COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::UUID));
EXCEPTION WHEN duplicate_table THEN
  RAISE NOTICE 'Index system_configs_key_company_unique já existe';
END $$;

-- 4. Dropar policies antigas conflitantes
DROP POLICY IF EXISTS "Authenticated users can read system_configs" ON system_configs;
DROP POLICY IF EXISTS "Authenticated users can update system_configs" ON system_configs;
DROP POLICY IF EXISTS system_configs_admin ON system_configs;
DROP POLICY IF EXISTS admin_all ON system_configs;
DROP POLICY IF EXISTS authenticated_all_system_configs ON system_configs;
DROP POLICY IF EXISTS authenticated_read ON system_configs;

-- 5. Criar novas policies multi-tenant
-- SELECT: usuário vê configs da sua empresa + configs globais (sem company_id)
CREATE POLICY system_configs_select ON system_configs FOR SELECT TO authenticated
  USING (
    company_id IS NULL
    OR company_id = (auth.jwt() ->> 'company_id')::UUID
    OR (auth.jwt() ->> 'is_super_admin')::BOOLEAN = true
  );

-- INSERT: usuário pode inserir configs da sua empresa ou globais (CEO/admin)
CREATE POLICY system_configs_insert ON system_configs FOR INSERT TO authenticated
  WITH CHECK (
    company_id IS NULL
    OR company_id = (auth.jwt() ->> 'company_id')::UUID
    OR (auth.jwt() ->> 'is_super_admin')::BOOLEAN = true
  );

-- UPDATE: mesma lógica
CREATE POLICY system_configs_update ON system_configs FOR UPDATE TO authenticated
  USING (
    company_id IS NULL
    OR company_id = (auth.jwt() ->> 'company_id')::UUID
    OR (auth.jwt() ->> 'is_super_admin')::BOOLEAN = true
  )
  WITH CHECK (
    company_id IS NULL
    OR company_id = (auth.jwt() ->> 'company_id')::UUID
    OR (auth.jwt() ->> 'is_super_admin')::BOOLEAN = true
  );

-- DELETE: apenas super_admin
CREATE POLICY system_configs_delete ON system_configs FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'is_super_admin')::BOOLEAN = true);

COMMIT;
