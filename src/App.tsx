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
import Extracao from "./pages/Extracao";
import BaseDados from "./pages/BaseDados";
import Metricas from "./pages/Metricas";
import Conversas from "./pages/Conversas";
import MeuBot from "./pages/MeuBot";
import Configuracoes from "./pages/Configuracoes";
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
          <CompanyFilterProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/extracao" element={<ProtectedRoute minLevel={2}><Extracao /></ProtectedRoute>} />
                <Route path="/base-dados" element={<ProtectedRoute minLevel={2}><BaseDados /></ProtectedRoute>} />
                <Route path="/conversas" element={<ProtectedRoute><Conversas /></ProtectedRoute>} />
                <Route path="/meu-bot" element={<ProtectedRoute><MeuBot /></ProtectedRoute>} />
                <Route path="/metricas" element={<ProtectedRoute minLevel={2}><Metricas /></ProtectedRoute>} />
                <Route path="/colaboradores" element={<ProtectedRoute minLevel={0}><Colaboradores /></ProtectedRoute>} />
                <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />

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
