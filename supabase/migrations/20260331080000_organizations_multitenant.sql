-- ============================================================
-- Multi-tenant: organizations, organization_members, RPC
-- NÃO altera nenhuma tabela existente
-- ============================================================

-- 1. organizations
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'external' CHECK (type IN ('internal', 'external')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'professional', 'enterprise')),
  max_companies INT NOT NULL DEFAULT 1,
  segment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. organization_members (liga user → org)
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- 3. organization_companies (liga org → company)
CREATE TABLE IF NOT EXISTS organization_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, company_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_companies_org ON organization_companies(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_companies_company ON organization_companies(company_id);

-- 4. RPC: get_user_organization — retorna orgs do user com company_ids
CREATE OR REPLACE FUNCTION get_user_organization(p_user_id UUID)
RETURNS TABLE (
  org_id UUID,
  org_name TEXT,
  org_slug TEXT,
  org_type TEXT,
  org_role TEXT,
  company_ids UUID[]
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    o.id       AS org_id,
    o.name     AS org_name,
    o.slug     AS org_slug,
    o.type     AS org_type,
    om.role    AS org_role,
    COALESCE(
      ARRAY_AGG(oc.company_id) FILTER (WHERE oc.company_id IS NOT NULL),
      '{}'::UUID[]
    ) AS company_ids
  FROM organizations o
  JOIN organization_members om ON om.organization_id = o.id
  LEFT JOIN organization_companies oc ON oc.organization_id = o.id
  WHERE om.user_id = p_user_id
    AND o.is_active = true
  GROUP BY o.id, o.name, o.slug, o.type, om.role
  ORDER BY o.type ASC, o.name ASC;
$$;

-- 5. RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_companies ENABLE ROW LEVEL SECURITY;

-- Service role bypass (edge functions usam service role)
CREATE POLICY "service_role_all" ON organizations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON organization_members FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON organization_companies FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users podem ler suas próprias orgs
CREATE POLICY "members_read_own_org" ON organizations FOR SELECT TO authenticated
  USING (id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "members_read_own_membership" ON organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "members_read_org_companies" ON organization_companies FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

-- Seed: Walk Holding como org interna (ajustar user_id do Alex depois se necessário)
INSERT INTO organizations (id, name, slug, type, is_active, plan, max_companies)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Walk Holding',
  'walk-holding',
  'internal',
  true,
  'enterprise',
  100
) ON CONFLICT (slug) DO NOTHING;

-- Associar as 4 empresas existentes à Walk Holding
INSERT INTO organization_companies (organization_id, company_id)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'd33b6a84-8f72-4441-b2eb-dd151a31ac12'),
  ('a0000000-0000-0000-0000-000000000001', '131d9cba-d49c-44d5-a9b3-baa84d34bd96'),
  ('a0000000-0000-0000-0000-000000000001', 'f96c0059-77fa-48c1-8eb4-9db207379053'),
  ('a0000000-0000-0000-0000-000000000001', '70967469-9a9b-4e29-a744-410e41eb47a5')
ON CONFLICT (organization_id, company_id) DO NOTHING;
