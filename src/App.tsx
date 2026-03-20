import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CollaboratorProvider } from "@/contexts/CollaboratorContext";
import { CompanyFilterProvider } from "@/contexts/CompanyFilterContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

// Lazy-loaded pages
const Index = lazy(() => import("./pages/Index"));
const DashboardVoip = lazy(() => import("./pages/DashboardVoip"));
const Colaboradores = lazy(() => import("./pages/Colaboradores"));
const Cadastro = lazy(() => import("./pages/Cadastro"));
const Extracao = lazy(() => import("./pages/Extracao"));
const BaseDados = lazy(() => import("./pages/BaseDados"));
const Agentes = lazy(() => import("./pages/Agentes"));
const Metricas = lazy(() => import("./pages/Metricas"));
const Conversas = lazy(() => import("./pages/Conversas"));
const MeuBot = lazy(() => import("./pages/MeuBot"));
const Bots = lazy(() => import("./pages/Bots"));
const Proxy = lazy(() => import("./pages/Proxy"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const IdentidadeVisual = lazy(() => import("./pages/IdentidadeVisual"));
const CeoBolt = lazy(() => import("./pages/CeoBolt"));
const MotorLeads = lazy(() => import("./pages/MotorLeads"));
const AtendimentoLeads = lazy(() => import("./pages/AtendimentoLeads"));
const VoiceAI = lazy(() => import("./pages/VoiceAI"));
const CallCampaigns = lazy(() => import("./pages/CallCampaigns"));
const Discador = lazy(() => import("./pages/Discador"));
const LeadsDiscador = lazy(() => import("./pages/LeadsDiscador"));
const WhatsAppMeta = lazy(() => import("./pages/WhatsAppMeta"));
const RelatoriosVoz = lazy(() => import("./pages/RelatoriosVoz"));
const ComplianceVoz = lazy(() => import("./pages/ComplianceVoz"));
const ConfiguracoesVoz = lazy(() => import("./pages/ConfiguracoesVoz"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Registro = lazy(() => import("./pages/Registro"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <CollaboratorProvider>
          <CompanyFilterProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
                <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/extracao" element={<ProtectedRoute><Extracao /></ProtectedRoute>} />
          <Route path="/agentes" element={<ProtectedRoute minLevel={1}><Agentes /></ProtectedRoute>} />
          <Route path="/bots" element={<ProtectedRoute minLevel={0}><Bots /></ProtectedRoute>} />
          <Route path="/proxy" element={<ProtectedRoute minLevel={0}><Proxy /></ProtectedRoute>} />
          <Route path="/base-dados" element={<ProtectedRoute minLevel={2}><BaseDados /></ProtectedRoute>} />
          <Route path="/conversas" element={<ProtectedRoute><Conversas /></ProtectedRoute>} />
          <Route path="/meu-bot" element={<ProtectedRoute><MeuBot /></ProtectedRoute>} />
          <Route path="/metricas" element={<ProtectedRoute minLevel={1}><Metricas /></ProtectedRoute>} />
          <Route path="/colaboradores" element={<ProtectedRoute minLevel={0}><Colaboradores /></ProtectedRoute>} />
          <Route path="/cadastro" element={<ProtectedRoute minLevel={1}><Cadastro /></ProtectedRoute>} />
          <Route path="/configuracoes" element={<ProtectedRoute minLevel={1}><Configuracoes /></ProtectedRoute>} />
          <Route path="/identidade-visual" element={<ProtectedRoute minLevel={0}><IdentidadeVisual /></ProtectedRoute>} />
          <Route path="/ceo" element={<ProtectedRoute minLevel={0}><CeoBolt /></ProtectedRoute>} />
          <Route path="/motor-leads" element={<ProtectedRoute><MotorLeads /></ProtectedRoute>} />
          <Route path="/voice-ai" element={<ProtectedRoute minLevel={0}><VoiceAI /></ProtectedRoute>} />
          <Route path="/call-campaigns" element={<ProtectedRoute minLevel={1}><CallCampaigns /></ProtectedRoute>} />
          <Route path="/atendimento" element={<ProtectedRoute><AtendimentoLeads /></ProtectedRoute>} />

          <Route path="/dashboard-voip" element={<ProtectedRoute minLevel={1}><DashboardVoip /></ProtectedRoute>} />
          <Route path="/discador" element={<ProtectedRoute minLevel={2}><Discador /></ProtectedRoute>} />
          <Route path="/leads-discador" element={<ProtectedRoute minLevel={1}><LeadsDiscador /></ProtectedRoute>} />
          <Route path="/whatsapp-meta" element={<ProtectedRoute minLevel={0}><WhatsAppMeta /></ProtectedRoute>} />
          <Route path="/relatorios-voz" element={<ProtectedRoute minLevel={1}><RelatoriosVoz /></ProtectedRoute>} />
          <Route path="/compliance-voz" element={<ProtectedRoute minLevel={0}><ComplianceVoz /></ProtectedRoute>} />
          <Route path="/configuracoes-voz" element={<ProtectedRoute minLevel={0}><ConfiguracoesVoz /></ProtectedRoute>} />

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </CompanyFilterProvider>
        </CollaboratorProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
