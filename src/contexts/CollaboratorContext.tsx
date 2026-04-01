import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export interface Collaborator {
  id: string;
  auth_user_id: string;
  name: string;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  active: boolean;
  company_id: string;
  role_id: string;
  sector_id: string | null;
  unit_id: string | null;
  must_change_password: boolean;
  company: { id: string; name: string; slug: string; logo_url: string | null };
  role: { id: string; name: string; level: number };
  sector: { id: string; name: string } | null;
  unit: { id: string; name: string } | null;
}

interface CollaboratorContextType {
  collaborator: Collaborator | null;
  loading: boolean;
  error: string | null;
  roleLevel: number;
  isCEO: boolean;
  isDiretor: boolean;
  isGestor: boolean;
  isColaborador: boolean;
  refetch: () => Promise<void>;
}

const CollaboratorContext = createContext<CollaboratorContextType | undefined>(undefined);

export function CollaboratorProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [collaborator, setCollaborator] = useState<Collaborator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCollaborator = async () => {
    if (!user) {
      setCollaborator(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("collaborators")
      .select(`
        id, auth_user_id, name, email, phone, whatsapp, active, must_change_password,
        company_id, role_id, sector_id, unit_id,
        company:companies!collaborators_company_id_fkey(id, name, slug, logo_url),
        role:roles!collaborators_role_id_fkey(id, name, level),
        sector:sectors!collaborators_sector_id_fkey(id, name),
        unit:units!collaborators_unit_id_fkey(id, name)
      `)
      .eq("auth_user_id", user.id)
      .eq("active", true)
      .maybeSingle();

    if (fetchError) {
      setError("Erro ao carregar dados do colaborador.");
      setCollaborator(null);
    } else if (!data) {
      setError("Acesso não configurado. Contate o administrador.");
      setCollaborator(null);
    } else {
      setCollaborator(data as unknown as Collaborator);
    }
    setLoading(false);
  };

  const userIdRef = useState({ current: "" })[0];
  useEffect(() => {
    // Só re-fetch se o user ID realmente mudou (evita remount em token refresh)
    const newId = user?.id || "";
    if (newId === userIdRef.current && collaborator) return;
    userIdRef.current = newId;
    fetchCollaborator();
  }, [user]);

  const roleLevel = collaborator?.role?.level ?? 99;

  return (
    <CollaboratorContext.Provider
      value={{
        collaborator,
        loading,
        error,
        roleLevel,
        isCEO: roleLevel === 0,
        isDiretor: roleLevel === 1,
        isGestor: roleLevel === 2,
        isColaborador: roleLevel === 3,
        refetch: fetchCollaborator,
      }}
    >
      {children}
    </CollaboratorContext.Provider>
  );
}

export const useCollaborator = () => {
  const context = useContext(CollaboratorContext);
  if (!context) throw new Error("useCollaborator must be used within CollaboratorProvider");
  return context;
};
