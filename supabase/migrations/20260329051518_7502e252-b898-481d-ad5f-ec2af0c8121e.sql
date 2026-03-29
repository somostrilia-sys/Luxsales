-- Drop all existing policies on dispatch_permissions
DROP POLICY IF EXISTS "CEO can manage dispatch_permissions" ON public.dispatch_permissions;
DROP POLICY IF EXISTS "CEO can read all dispatch_permissions" ON public.dispatch_permissions;
DROP POLICY IF EXISTS "Users can read own dispatch_permissions" ON public.dispatch_permissions;
DROP POLICY IF EXISTS "authenticated_read" ON public.dispatch_permissions;

-- Create a security definer function to check CEO role without triggering RLS
CREATE OR REPLACE FUNCTION public.is_dispatch_ceo(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.dispatch_permissions
    WHERE collaborator_id = _user_id
      AND role = 'ceo'
      AND is_active = true
  )
$$;

-- Users can read their own permissions
CREATE POLICY "Users can read own dispatch_permissions"
ON public.dispatch_permissions FOR SELECT
TO authenticated
USING (collaborator_id = auth.uid());

-- CEO can read all permissions
CREATE POLICY "CEO can read all dispatch_permissions"
ON public.dispatch_permissions FOR SELECT
TO authenticated
USING (public.is_dispatch_ceo(auth.uid()));

-- CEO can manage (insert/update/delete) all permissions
CREATE POLICY "CEO can manage dispatch_permissions"
ON public.dispatch_permissions FOR ALL
TO authenticated
USING (public.is_dispatch_ceo(auth.uid()))
WITH CHECK (public.is_dispatch_ceo(auth.uid()));