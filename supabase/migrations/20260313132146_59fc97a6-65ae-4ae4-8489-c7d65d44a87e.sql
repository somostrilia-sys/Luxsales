-- contact_leads table for the massive lead database
CREATE TABLE IF NOT EXISTS public.contact_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  phone text,
  email text,
  document text,
  tipo_pessoa text DEFAULT 'PF',
  city text,
  region text,
  state text,
  category text,
  subcategory text,
  source text,
  score integer DEFAULT 0,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Unique constraint on document for upsert
CREATE UNIQUE INDEX IF NOT EXISTS contact_leads_document_unique ON public.contact_leads (document) WHERE document IS NOT NULL;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_contact_leads_category ON public.contact_leads (category);
CREATE INDEX IF NOT EXISTS idx_contact_leads_source ON public.contact_leads (source);
CREATE INDEX IF NOT EXISTS idx_contact_leads_phone ON public.contact_leads (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contact_leads_city ON public.contact_leads (city);
CREATE INDEX IF NOT EXISTS idx_contact_leads_subcategory ON public.contact_leads (subcategory);

-- RLS
ALTER TABLE public.contact_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read contact_leads"
  ON public.contact_leads FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert contact_leads"
  ON public.contact_leads FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update contact_leads"
  ON public.contact_leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete contact_leads"
  ON public.contact_leads FOR DELETE TO authenticated USING (true);

-- Stats RPC function
CREATE OR REPLACE FUNCTION public.get_contact_leads_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'pf', COUNT(*) FILTER (WHERE tipo_pessoa = 'PF'),
    'pj', COUNT(*) FILTER (WHERE tipo_pessoa = 'PJ'),
    'com_email', COUNT(*) FILTER (WHERE email IS NOT NULL AND email <> ''),
    'com_telefone', COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone <> ''),
    'objetivo_transporte', COUNT(*) FILTER (WHERE category = 'objetivo-transporte'),
    'objetivo_geral', COUNT(*) FILTER (WHERE category = 'objetivo-geral'),
    'trilia', COUNT(*) FILTER (WHERE category = 'trilia-consultoria'),
    'olx', COUNT(*) FILTER (WHERE source = 'olx'),
    'google_maps', COUNT(*) FILTER (WHERE source = 'google_maps'),
    'motorista_app', COUNT(*) FILTER (WHERE subcategory = 'motorista-aplicativo')
  ) INTO result
  FROM public.contact_leads;
  
  RETURN result;
END;
$$;