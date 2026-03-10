import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CollaboratorProvider } from "@/contexts/CollaboratorContext";
import { CompanyFilterProvider } from "@/contexts/CompanyFilterContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Colaboradores from "./pages/Colaboradores";
import Cadastro from "./pages/Cadastro";
import Extracao from "./pages/Extracao";
import BaseDados from "./pages/BaseDados";
import Agentes from "./pages/Agentes";
import Metricas from "./pages/Metricas";
import Conversas from "./pages/Conversas";
import MeuBot from "./pages/MeuBot";
import Configuracoes from "./pages/Configuracoes";
import IdentidadeVisual from "./pages/IdentidadeVisual";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Registro from "./pages/Registro";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <CollaboratorProvider>
          <CompanyFilterProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/registro" element={<Registro />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/extracao" element={<ProtectedRoute><Extracao /></ProtectedRoute>} />
                <Route path="/agentes" element={<ProtectedRoute minLevel={1}><Agentes /></ProtectedRoute>} />
                <Route path="/base-dados" element={<ProtectedRoute minLevel={2}><BaseDados /></ProtectedRoute>} />
                <Route path="/conversas" element={<ProtectedRoute><Conversas /></ProtectedRoute>} />
                <Route path="/meu-bot" element={<ProtectedRoute><MeuBot /></ProtectedRoute>} />
                <Route path="/metricas" element={<ProtectedRoute><Metricas /></ProtectedRoute>} />
                <Route path="/colaboradores" element={<ProtectedRoute minLevel={2}><Colaboradores /></ProtectedRoute>} />
                <Route path="/cadastro" element={<ProtectedRoute minLevel={1}><Cadastro /></ProtectedRoute>} />
                <Route path="/configuracoes" element={<ProtectedRoute minLevel={1}><Configuracoes /></ProtectedRoute>} />
                <Route path="/identidade-visual" element={<ProtectedRoute minLevel={0}><IdentidadeVisual /></ProtectedRoute>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </CompanyFilterProvider>
        </CollaboratorProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
