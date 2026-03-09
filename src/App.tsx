import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { EmpresaProvider } from "@/contexts/EmpresaContext";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <EmpresaProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/agentes" element={<Agentes />} />
            <Route path="/consultores" element={<Consultores />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="/meus-canais" element={<MeusCanais />} />
            <Route path="/prospeccao" element={<Prospeccao />} />
            <Route path="/meu-bot" element={<MeuBot />} />
            <Route path="/conversas" element={<Conversas />} />
            <Route path="/minhas-metricas" element={<MinhasMetricas />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </EmpresaProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
