import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { EDGE_BASE, SUPABASE_ANON_KEY } from "@/lib/constants";
import { supabase } from "@/lib/supabase";

export type WBRole = "ceo" | "director" | "manager" | "collaborator";

export interface UserPermissions {
  daily_dispatch_limit: number;
  daily_dispatches_used: number;
  allowed_templates: string[];
  can_dispatch: boolean;
}

export interface CompanyConfig {
  company_id: string;
  company_name: string;
  segment: string;
  persona_name: string;
  [key: string]: unknown;
}

interface CompanyContextType {
  company_id: string | null;
  company_name: string | null;
  segment: string | null;
  user_role: WBRole | null;
  user_permissions: UserPermissions | null;
  companyConfig: CompanyConfig | null;
  loading: boolean;
  error: string | null;
  needsSetup: boolean;
  refetch: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
  };
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { collaborator, loading: collabLoading } = useCollaborator();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [segment, setSegment] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<WBRole | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [companyConfig, setCompanyConfig] = useState<CompanyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user || collabLoading) return;

    // Use collaborator's company_id as primary source
    const baseCompanyId = collaborator?.company_id || null;

    setLoading(true);
    setError(null);
    setNeedsSetup(false);

    try {
      const headers = await getAuthHeaders();

      // 1. Fetch dispatch permissions
      let permData: any = null;
      try {
        const permRes = await fetch(`${EDGE_BASE}/dispatch-permissions`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            action: "get",
            company_id: baseCompanyId,
            collaborator_id: user.id,
          }),
        });
        if (permRes.ok) {
          const json = await permRes.json();
          permData = json?.data || json;
        }
      } catch {
        // Edge function may not exist yet — fall back to direct query
      }

      // Fallback: query dispatch_permissions table directly
      if (!permData?.role && user.id) {
        const { data: dpRow } = await supabase
          .from("dispatch_permissions")
          .select("*")
          .eq("collaborator_id", user.id)
          .eq("is_active", true)
          .maybeSingle();

        if (dpRow) {
          permData = {
            role: dpRow.role,
            company_id: dpRow.company_id,
            daily_dispatch_limit: dpRow.daily_dispatch_limit,
            daily_dispatches_used: dpRow.daily_dispatches_used,
            allowed_templates: dpRow.allowed_templates,
            can_dispatch: dpRow.can_dispatch,
          };
        }
      }

      // Determine company_id
      const resolvedCompanyId = permData?.company_id || baseCompanyId;

      // If no permissions and user is CEO (level 0), auto-create
      if (!permData?.role && collaborator && collaborator.role?.level === 0 && resolvedCompanyId) {
        try {
          const createRes = await fetch(`${EDGE_BASE}/dispatch-permissions`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              action: "set",
              company_id: resolvedCompanyId,
              collaborator_id: user.id,
              role: "ceo",
              daily_dispatch_limit: 9999,
              requester_role: "ceo",
            }),
          });
          if (createRes.ok) {
            permData = {
              role: "ceo",
              company_id: resolvedCompanyId,
              daily_dispatch_limit: 9999,
              daily_dispatches_used: 0,
              allowed_templates: [],
              can_dispatch: true,
            };
          }
        } catch {
          // Silent — CEO will still work with base role
        }
      }

      // Map collaborator role level to WBRole as fallback
      const roleFromLevel: Record<number, WBRole> = {
        0: "ceo",
        1: "director",
        2: "manager",
        3: "collaborator",
      };
      const finalRole: WBRole = permData?.role || roleFromLevel[collaborator?.role?.level ?? 3] || "collaborator";

      setCompanyId(resolvedCompanyId);
      setUserRole(finalRole);
      setUserPermissions({
        daily_dispatch_limit: permData?.daily_dispatch_limit ?? 0,
        daily_dispatches_used: permData?.daily_dispatches_used ?? 0,
        allowed_templates: permData?.allowed_templates ?? [],
        can_dispatch: permData?.can_dispatch ?? false,
      });

      // 2. Fetch company config
      if (resolvedCompanyId) {
        try {
          const cfgRes = await fetch(`${EDGE_BASE}/company-config`, {
            method: "POST",
            headers,
            body: JSON.stringify({ action: "get", company_id: resolvedCompanyId }),
          });
          if (cfgRes.ok) {
            const cfgJson = await cfgRes.json();
            const cfg = cfgJson?.data || cfgJson;
            setCompanyConfig(cfg);
            setCompanyName(cfg?.company_name || collaborator?.company?.name || null);
            setSegment(cfg?.segment || null);
            if (!cfg?.segment && finalRole === "ceo") {
              setNeedsSetup(true);
            }
          } else {
            // Edge function may not exist — use collaborator company data
            setCompanyName(collaborator?.company?.name || null);
            if (finalRole === "ceo") setNeedsSetup(true);
          }
        } catch {
          setCompanyName(collaborator?.company?.name || null);
        }
      } else {
        setCompanyName(collaborator?.company?.name || null);
      }
    } catch (err: any) {
      setError(err?.message || "Erro ao carregar dados da empresa");
    } finally {
      setLoading(false);
    }
  }, [user, collaborator, collabLoading]);

  useEffect(() => {
    if (!user) {
      setCompanyId(null);
      setCompanyName(null);
      setUserRole(null);
      setUserPermissions(null);
      setCompanyConfig(null);
      setLoading(false);
      return;
    }
    if (!collabLoading) {
      fetchAll();
    }
  }, [user, collabLoading, collaborator?.id]);

  return (
    <CompanyContext.Provider
      value={{
        company_id: companyId,
        company_name: companyName,
        segment,
        user_role: userRole,
        user_permissions: userPermissions,
        companyConfig,
        loading,
        error,
        needsSetup,
        refetch: fetchAll,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (!context) throw new Error("useCompany deve ser usado dentro de CompanyProvider");
  return context;
};
