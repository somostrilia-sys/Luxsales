
CREATE TABLE public.system_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read system_configs"
  ON public.system_configs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update system_configs"
  ON public.system_configs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can insert system_configs"
  ON public.system_configs FOR INSERT TO authenticated WITH CHECK (true);

INSERT INTO public.system_configs (key, value, description) VALUES
  ('anthropic_api_key', '', 'API Key Anthropic para o CEO Bolt'),
  ('ceo_model', 'claude-opus-4-5', 'Modelo Claude do CEO'),
  ('ceo_name', 'Bolt', 'Nome do agente CEO');
