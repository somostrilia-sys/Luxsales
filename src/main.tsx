import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { CollaboratorProvider } from "@/contexts/CollaboratorContext";
import { CompanyFilterProvider } from "@/contexts/CompanyFilterContext";
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
          <CompanyFilterProvider>
            <App />
          </CompanyFilterProvider>
        </CollaboratorProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);
