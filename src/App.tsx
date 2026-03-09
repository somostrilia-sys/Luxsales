import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { EmpresaProvider } from "@/contexts/EmpresaContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Agentes from "./pages/Agentes";
import Consultores from "./pages/Consultores";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import MeusCanais from "./pages/MeusCanais";
import Prospeccao from "./pages/Prospeccao";
import MeuBot from "./pages/MeuBot";
import Conversas from "./pages/Conversas";
import MinhasMetricas from "./pages/MinhasMetricas";
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
        <EmpresaProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              
              {/* Protected routes */}
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/agentes" element={<ProtectedRoute><Agentes /></ProtectedRoute>} />
              <Route path="/consultores" element={<ProtectedRoute><Consultores /></ProtectedRoute>} />
              <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
              <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
              <Route path="/meus-canais" element={<ProtectedRoute><MeusCanais /></ProtectedRoute>} />
              <Route path="/prospeccao" element={<ProtectedRoute><Prospeccao /></ProtectedRoute>} />
              <Route path="/meu-bot" element={<ProtectedRoute><MeuBot /></ProtectedRoute>} />
              <Route path="/conversas" element={<ProtectedRoute><Conversas /></ProtectedRoute>} />
              <Route path="/minhas-metricas" element={<ProtectedRoute><MinhasMetricas /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </EmpresaProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
