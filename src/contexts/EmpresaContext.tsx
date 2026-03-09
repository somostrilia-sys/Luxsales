import { createContext, useContext, useState, type ReactNode } from "react";
import type { Empresa } from "@/lib/mock-data";

interface EmpresaContextType {
  empresa: Empresa;
  setEmpresa: (e: Empresa) => void;
}

const EmpresaContext = createContext<EmpresaContextType>({
  empresa: "Objetivo",
  setEmpresa: () => {},
});

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [empresa, setEmpresa] = useState<Empresa>("Objetivo");
  return (
    <EmpresaContext.Provider value={{ empresa, setEmpresa }}>
      {children}
    </EmpresaContext.Provider>
  );
}

export const useEmpresa = () => useContext(EmpresaContext);
