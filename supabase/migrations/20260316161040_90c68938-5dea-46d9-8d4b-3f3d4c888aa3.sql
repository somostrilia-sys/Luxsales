CREATE TABLE IF NOT EXISTS public.disposable_chipset_proxy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chip_id uuid NOT NULL UNIQUE REFERENCES public.disposable_chips(id) ON DELETE CASCADE,
  proxy_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.disposable_chipset_proxy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read disposable_chipset_proxy"
ON public.disposable_chipset_proxy
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert disposable_chipset_proxy"
ON public.disposable_chipset_proxy
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update disposable_chipset_proxy"
ON public.disposable_chipset_proxy
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete disposable_chipset_proxy"
ON public.disposable_chipset_proxy
FOR DELETE
TO authenticated
USING (true);

CREATE OR REPLACE FUNCTION public.set_disposable_chipset_proxy_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_disposable_chipset_proxy_updated_at ON public.disposable_chipset_proxy;
CREATE TRIGGER set_disposable_chipset_proxy_updated_at
BEFORE UPDATE ON public.disposable_chipset_proxy
FOR EACH ROW
EXECUTE FUNCTION public.set_disposable_chipset_proxy_updated_at();