import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useCollaborator } from "@/contexts/CollaboratorContext";
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
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("all");

  useEffect(() => {
    if (!collaborator) return;
    if (isCEO) {
      supabase.from("companies").select("id, name").order("name").then(({ data }) => {
        setCompanies(data || []);
      });
    } else {
      setSelectedCompanyId(collaborator.company_id);
    }
  }, [collaborator, isCEO]);

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
