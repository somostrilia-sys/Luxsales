CREATE TABLE IF NOT EXISTS public.proxy_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chip_id uuid NOT NULL REFERENCES public.disposable_chips(id) ON DELETE CASCADE,
  action text NOT NULL,
  proxy_url text,
  success boolean NOT NULL DEFAULT false,
  ip text,
  city text,
  region text,
  country text,
  status text,
  error_message text,
  response_time_ms integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.proxy_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'proxy_logs' AND policyname = 'Authenticated users can read proxy_logs'
  ) THEN
    CREATE POLICY "Authenticated users can read proxy_logs"
    ON public.proxy_logs
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_proxy_logs_chip_id_created_at
ON public.proxy_logs (chip_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_proxy_logs_created_at
ON public.proxy_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_proxy_logs_success
ON public.proxy_logs (success);

CREATE INDEX IF NOT EXISTS idx_proxy_logs_action
ON public.proxy_logs (action);