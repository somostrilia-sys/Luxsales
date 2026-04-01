import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { CollaboratorProvider } from "@/contexts/CollaboratorContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { CompanyFilterProvider } from "@/contexts/CompanyFilterContext";
import { DispatchProvider } from "@/contexts/DispatchContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import App from "./App.tsx";
import "./index.css";

const queryClient = new QueryClient();

// Force dark mode
document.documentElement.classList.add("dark");

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <CollaboratorProvider>
          <OrganizationProvider>
            <CompanyFilterProvider>
              <CompanyProvider>
                <DispatchProvider>
                  <App />
                </DispatchProvider>
              </CompanyProvider>
            </CompanyFilterProvider>
          </OrganizationProvider>
        </CollaboratorProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);
