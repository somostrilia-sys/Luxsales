import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface Organization {
  org_id: string;
  org_name: string;
  org_slug: string;
  org_type: "internal" | "external";
  org_role: "owner" | "admin" | "member";
  company_ids: string[];
}

interface OrganizationContextType {
  organization: Organization | null;
  loading: boolean;
  /** true se user é owner/admin de org interna (ex: Alex no Walk Holding) */
  isGroupOwner: boolean;
  /** true se user é owner/admin de org externa (CEO de empresa SaaS) */
  isExternalOwner: boolean;
  /** true se user é de org interna */
  isInternal: boolean;
  refetch: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrg = async () => {
    if (!user) {
      setOrganization(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc("get_user_organization", { p_user_id: user.id });

      if (error || !data?.length) {
        // Sem org — sistema legado, tratar como interno por default
        setOrganization(null);
      } else {
        setOrganization(data[0] as Organization);
      }
    } catch {
      setOrganization(null);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchOrg();
  }, [user]);

  const isInternal = organization?.org_type === "internal" || organization === null;
  const isGroupOwner = isInternal && (organization?.org_role === "owner" || organization?.org_role === "admin" || organization === null);
  const isExternalOwner = organization?.org_type === "external" && (organization?.org_role === "owner" || organization?.org_role === "admin");

  return (
    <OrganizationContext.Provider
      value={{
        organization,
        loading,
        isGroupOwner,
        isExternalOwner,
        isInternal,
        refetch: fetchOrg,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) throw new Error("useOrganization must be used within OrganizationProvider");
  return context;
};
