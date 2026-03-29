import { useCollaborator } from '@/contexts/CollaboratorContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface PermState {
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
  loading: boolean;
}

export function usePermission(module: string): PermState {
  const { collaborator, roleLevel } = useCollaborator();
  const [perm, setPerm] = useState<PermState>({ can_view: false, can_edit: false, can_delete: false, loading: true });

  useEffect(() => {
    if (!collaborator) return;
    // CEO/Admin: acesso total
    if (roleLevel === 0) {
      setPerm({ can_view: true, can_edit: true, can_delete: true, loading: false });
      return;
    }
    supabase
      .from('user_permissions')
      .select('can_view,can_edit,can_delete')
      .eq('collaborator_id', collaborator.id)
      .eq('module', module)
      .single()
      .then(({ data }) => {
        if (data) setPerm({ can_view: data.can_view, can_edit: data.can_edit, can_delete: data.can_delete, loading: false });
        else setPerm({ can_view: false, can_edit: false, can_delete: false, loading: false });
      });
  }, [collaborator?.id, module, roleLevel]);

  return perm;
}
