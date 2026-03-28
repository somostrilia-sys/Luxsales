-- dispatch_permissions table for WhatsApp Business role-based access
CREATE TABLE IF NOT EXISTS public.dispatch_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'collaborator',
  daily_limit INTEGER NOT NULL DEFAULT 30,
  dispatches_today INTEGER NOT NULL DEFAULT 0,
  last_reset_at TIMESTAMPTZ DEFAULT now(),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(collaborator_id)
);

-- Validation trigger for role values
CREATE OR REPLACE FUNCTION public.validate_dispatch_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role NOT IN ('ceo', 'director', 'manager', 'collaborator') THEN
    RAISE EXCEPTION 'Invalid role: %. Must be ceo, director, manager, or collaborator', NEW.role;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_dispatch_role
  BEFORE INSERT OR UPDATE ON public.dispatch_permissions
  FOR EACH ROW EXECUTE FUNCTION public.validate_dispatch_role();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_dispatch_permissions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dispatch_permissions_updated_at
  BEFORE UPDATE ON public.dispatch_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_dispatch_permissions_updated_at();

-- RLS
ALTER TABLE public.dispatch_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own dispatch_permissions"
  ON public.dispatch_permissions FOR SELECT
  TO authenticated
  USING (collaborator_id = auth.uid());

CREATE POLICY "CEO can read all dispatch_permissions"
  ON public.dispatch_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dispatch_permissions dp
      WHERE dp.collaborator_id = auth.uid() AND dp.role = 'ceo'
    )
  );

CREATE POLICY "CEO can manage dispatch_permissions"
  ON public.dispatch_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dispatch_permissions dp
      WHERE dp.collaborator_id = auth.uid() AND dp.role = 'ceo'
    )
  );

-- Index
CREATE INDEX idx_dispatch_permissions_collaborator ON public.dispatch_permissions(collaborator_id);
CREATE INDEX idx_dispatch_permissions_company ON public.dispatch_permissions(company_id);