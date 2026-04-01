import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/lib/supabase";

interface Company {
  id: string;
  name: string;
}

interface CompanyFilterContextType {
  companies: Company[];
  selectedCompanyId: string;
  setSelectedCompanyId: (id: string) => void;
}

const CompanyFilterContext = createContext<CompanyFilterContextType | undefined>(undefined);

export function CompanyFilterProvider({ children }: { children: ReactNode }) {
  const { collaborator, isCEO } = useCollaborator();
  const { organization, isGroupOwner, isExternalOwner } = useOrganization();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("all");

  useEffect(() => {
    if (!collaborator) return;

    if (isCEO || isExternalOwner) {
      if (organization && organization.company_ids.length > 0) {
        // Carregar empresas da org (isolamento por organização)
        supabase
          .from("companies")
          .select("id, name")
          .in("id", organization.company_ids)
          .order("name")
          .then(({ data }) => {
            setCompanies(data || []);
            // CEO externo com 1 empresa → já seleciona
            if (!isGroupOwner && (data?.length || 0) === 1) {
              setSelectedCompanyId(data![0].id);
            }
          });
      } else {
        // Fallback: sem org configurada, carregar todas (legado)
        supabase.from("companies").select("id, name").order("name").then(({ data }) => {
          setCompanies(data || []);
        });
      }
    } else {
      // Colaborador: preso à empresa dele
      setSelectedCompanyId(collaborator.company_id);
    }
  }, [collaborator, isCEO, organization, isGroupOwner, isExternalOwner]);

  return (
    <CompanyFilterContext.Provider value={{ companies, selectedCompanyId, setSelectedCompanyId }}>
      {children}
    </CompanyFilterContext.Provider>
  );
}

export const useCompanyFilter = () => {
  const context = useContext(CompanyFilterContext);
  if (!context) throw new Error("useCompanyFilter must be used within CompanyFilterProvider");
  return context;
};
