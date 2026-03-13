
CREATE TABLE public.disposable_chips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id uuid NOT NULL,
  chip_index integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'disconnected',
  qr_code text,
  uazapi_server_url text NOT NULL DEFAULT '',
  uazapi_admin_token text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.disposable_chips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read disposable_chips"
  ON public.disposable_chips FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert disposable_chips"
  ON public.disposable_chips FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update disposable_chips"
  ON public.disposable_chips FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete disposable_chips"
  ON public.disposable_chips FOR DELETE TO authenticated USING (true);
