import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CollaboratorProvider } from "@/contexts/CollaboratorContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Colaboradores from "./pages/Colaboradores";
import AgentesManagement from "./pages/AgentesManagement";
import Extracao from "./pages/Extracao";
import BaseDados from "./pages/BaseDados";
import Empresas from "./pages/Empresas";
import Metricas from "./pages/Metricas";
import Configuracoes from "./pages/Configuracoes";
import MeusAgentes from "./pages/MeusAgentes";
import MeusLeads from "./pages/MeusLeads";
import MeuDesempenho from "./pages/MeuDesempenho";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <CollaboratorProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Protected routes - all levels */}
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/configuracoes" element={<ProtectedRoute minLevel={0}><Configuracoes /></ProtectedRoute>} />

              {/* CEO only (level 0) */}
              <Route path="/empresas" element={<ProtectedRoute minLevel={0}><Empresas /></ProtectedRoute>} />
              <Route path="/extracao" element={<ProtectedRoute minLevel={0}><Extracao /></ProtectedRoute>} />
              <Route path="/base-dados" element={<ProtectedRoute minLevel={0}><BaseDados /></ProtectedRoute>} />

              {/* CEO + Diretor + Gestor (level 0-2) */}
              <Route path="/colaboradores" element={<ProtectedRoute minLevel={2}><Colaboradores /></ProtectedRoute>} />
              <Route path="/agentes" element={<ProtectedRoute minLevel={2}><AgentesManagement /></ProtectedRoute>} />
              <Route path="/metricas" element={<ProtectedRoute minLevel={2}><Metricas /></ProtectedRoute>} />

              {/* Colaborador (level 3) */}
              <Route path="/meus-agentes" element={<ProtectedRoute><MeusAgentes /></ProtectedRoute>} />
              <Route path="/meus-leads" element={<ProtectedRoute><MeusLeads /></ProtectedRoute>} />
              <Route path="/meu-desempenho" element={<ProtectedRoute><MeuDesempenho /></ProtectedRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CollaboratorProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
