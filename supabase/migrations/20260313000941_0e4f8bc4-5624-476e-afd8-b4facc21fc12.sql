
-- Rename existing anthropic_api_key to anthropic_api_key_ceo
UPDATE public.system_configs SET key = 'anthropic_api_key_ceo', description = 'API Key Anthropic exclusiva do CEO Bolt' WHERE key = 'anthropic_api_key';

-- Insert new keys (ignore if already exist)
INSERT INTO public.system_configs (key, value, description) VALUES
  ('api_key_agent_1', '', 'API Key agente pool 1'),
  ('api_key_agent_2', '', 'API Key agente pool 2'),
  ('api_key_agent_3', '', 'API Key agente pool 3'),
  ('api_key_agent_4', '', 'API Key agente pool 4'),
  ('anthropic_api_key_staff', '', 'API Key Anthropic dos colaboradores')
ON CONFLICT (key) DO NOTHING;
