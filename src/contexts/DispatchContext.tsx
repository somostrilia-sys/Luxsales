import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export type DispatchRole = "ceo" | "director" | "manager" | "collaborator";

export interface DispatchPermission {
  id: string;
  collaborator_id: string;
  company_id: string | null;
  role: DispatchRole;
  daily_limit: number;
  dispatches_today: number;
  active: boolean;
}

interface DispatchContextType {
  permission: DispatchPermission | null;
  loading: boolean;
  error: string | null;
  role: DispatchRole | null;
  isCeo: boolean;
  isDirector: boolean;
  isManager: boolean;
  isCollaborator: boolean;
  canAccessCeoRoutes: boolean;
  refetch: () => Promise<void>;
}

const DispatchContext = createContext<DispatchContextType | undefined>(undefined);

export function DispatchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [permission, setPermission] = useState<DispatchPermission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermission = async () => {
    if (!user) {
      setPermission(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("dispatch_permissions")
      .select("id, collaborator_id, company_id, role, daily_limit, dispatches_today, active")
      .eq("collaborator_id", user.id)
      .eq("active", true)
      .maybeSingle();

    if (fetchError) {
      setError("Erro ao carregar permissões de disparo.");
      setPermission(null);
    } else if (!data) {
      // No dispatch permission found — not an error, user just doesn't have dispatch access
      setPermission(null);
    } else {
      setPermission(data as DispatchPermission);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPermission();
  }, [user]);

  const role = permission?.role ?? null;

  return (
    <DispatchContext.Provider
      value={{
        permission,
        loading,
        error,
        role,
        isCeo: role === "ceo",
        isDirector: role === "director",
        isManager: role === "manager",
        isCollaborator: role === "collaborator",
        canAccessCeoRoutes: role === "ceo",
        refetch: fetchPermission,
      }}
    >
      {children}
    </DispatchContext.Provider>
  );
}

export const useDispatch = () => {
  const context = useContext(DispatchContext);
  if (!context) throw new Error("useDispatch must be used within DispatchProvider");
  return context;
};
