ALTER TABLE public.disposable_chips
ADD COLUMN IF NOT EXISTS proxy_host text,
ADD COLUMN IF NOT EXISTS proxy_port integer,
ADD COLUMN IF NOT EXISTS proxy_username text,
ADD COLUMN IF NOT EXISTS proxy_password text,
ADD COLUMN IF NOT EXISTS proxy_protocol text,
ADD COLUMN IF NOT EXISTS proxy_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS proxy_last_tested_at timestamp with time zone;

COMMENT ON COLUMN public.disposable_chips.proxy_host IS 'Hostname or IP do proxy dedicado do chip';
COMMENT ON COLUMN public.disposable_chips.proxy_port IS 'Porta do proxy dedicado do chip';
COMMENT ON COLUMN public.disposable_chips.proxy_username IS 'Usuário do proxy dedicado do chip';
COMMENT ON COLUMN public.disposable_chips.proxy_password IS 'Senha do proxy dedicado do chip';
COMMENT ON COLUMN public.disposable_chips.proxy_protocol IS 'Protocolo do proxy dedicado do chip (http, https, socks5)';
COMMENT ON COLUMN public.disposable_chips.proxy_enabled IS 'Define se o chip deve usar proxy dedicado';
COMMENT ON COLUMN public.disposable_chips.proxy_last_tested_at IS 'Última data/hora em que o proxy do chip foi testado';