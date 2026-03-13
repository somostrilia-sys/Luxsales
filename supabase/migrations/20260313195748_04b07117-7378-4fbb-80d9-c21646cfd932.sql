-- First null out non-UUID role values and drop default
UPDATE public.invite_links SET role = NULL WHERE role IS NOT NULL AND role !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
ALTER TABLE public.invite_links ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.invite_links RENAME COLUMN role TO role_id;
ALTER TABLE public.invite_links ALTER COLUMN role_id TYPE uuid USING role_id::uuid;
ALTER TABLE public.invite_links RENAME COLUMN current_uses TO used_count;
ALTER TABLE public.invite_links RENAME COLUMN is_active TO active;