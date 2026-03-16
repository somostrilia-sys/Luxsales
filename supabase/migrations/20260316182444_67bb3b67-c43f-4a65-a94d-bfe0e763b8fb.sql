ALTER TABLE public.disposable_chipset_proxy
ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS last_tested_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_success_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_error text,
ADD COLUMN IF NOT EXISTS last_http_status integer,
ADD COLUMN IF NOT EXISTS last_response_ms integer,
ADD COLUMN IF NOT EXISTS exit_ip text,
ADD COLUMN IF NOT EXISTS target_url text,
ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;