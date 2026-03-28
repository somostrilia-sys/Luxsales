import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Registro = lazy(() => import("./pages/Registro"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const CriarConta = lazy(() => import("./pages/CriarConta"));
const Venda = lazy(() => import("./pages/Venda"));

// Dashboard & WB
const DashboardWB = lazy(() => import("./pages/DashboardWB"));
const MyLeads = lazy(() => import("./pages/MyLeads"));
const ConversationDetail = lazy(() => import("./pages/ConversationDetail"));
const Conversas = lazy(() => import("./pages/Conversas"));
const Templates = lazy(() => import("./pages/Templates"));
const TeamManagement = lazy(() => import("./pages/TeamManagement"));
const LeadDistribution = lazy(() => import("./pages/LeadDistribution"));
const OptIns = lazy(() => import("./pages/OptIns"));
const CompanySetup = lazy(() => import("./pages/CompanySetup"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));

// Voice / VoIP
const DashboardVoip = lazy(() => import("./pages/DashboardVoip"));
const Discador = lazy(() => import("./pages/Discador"));
const CallCampaigns = lazy(() => import("./pages/CallCampaigns"));
const LeadsDiscador = lazy(() => import("./pages/LeadsDiscador"));
const VoiceAI = lazy(() => import("./pages/VoiceAI"));
const RelatoriosVoz = lazy(() => import("./pages/RelatoriosVoz"));
const ComplianceVoz = lazy(() => import("./pages/ComplianceVoz"));
const ConfiguracoesVoz = lazy(() => import("./pages/ConfiguracoesVoz"));
const WhatsAppMeta = lazy(() => import("./pages/WhatsAppMeta"));

const NotFound = lazy(() => import("./pages/NotFound"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

const App = () => (
  <>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/criar-conta" element={<CriarConta />} />
          <Route path="/venda" element={<Venda />} />

          {/* WB Core — CEO */}
          <Route path="/" element={<ProtectedRoute><DashboardWB /></ProtectedRoute>} />
          <Route path="/dashboard-wb" element={<ProtectedRoute minLevel={0}><DashboardWB /></ProtectedRoute>} />
          <Route path="/templates" element={<ProtectedRoute minLevel={0}><Templates /></ProtectedRoute>} />
          <Route path="/team" element={<ProtectedRoute minLevel={0}><TeamManagement /></ProtectedRoute>} />
          <Route path="/lead-distribution" element={<ProtectedRoute minLevel={0}><LeadDistribution /></ProtectedRoute>} />
          <Route path="/opt-ins" element={<ProtectedRoute minLevel={0}><OptIns /></ProtectedRoute>} />
          <Route path="/config" element={<ProtectedRoute minLevel={0}><CompanySetup /></ProtectedRoute>} />
          <Route path="/configuracoes" element={<ProtectedRoute minLevel={0}><Configuracoes /></ProtectedRoute>} />

          {/* WB — All roles */}
          <Route path="/my-leads" element={<ProtectedRoute><MyLeads /></ProtectedRoute>} />
          <Route path="/conversas" element={<ProtectedRoute><Conversas /></ProtectedRoute>} />
          <Route path="/conversations/:phone" element={<ProtectedRoute><ConversationDetail /></ProtectedRoute>} />

          {/* VoIP */}
          <Route path="/dashboard-voip" element={<ProtectedRoute minLevel={1}><DashboardVoip /></ProtectedRoute>} />
          <Route path="/discador" element={<ProtectedRoute minLevel={2}><Discador /></ProtectedRoute>} />
          <Route path="/call-campaigns" element={<ProtectedRoute minLevel={1}><CallCampaigns /></ProtectedRoute>} />
          <Route path="/leads-discador" element={<ProtectedRoute minLevel={1}><LeadsDiscador /></ProtectedRoute>} />
          <Route path="/voice-ai" element={<ProtectedRoute minLevel={0}><VoiceAI /></ProtectedRoute>} />
          <Route path="/whatsapp-meta" element={<ProtectedRoute minLevel={0}><WhatsAppMeta /></ProtectedRoute>} />
          <Route path="/relatorios-voz" element={<ProtectedRoute minLevel={1}><RelatoriosVoz /></ProtectedRoute>} />
          <Route path="/compliance-voz" element={<ProtectedRoute minLevel={0}><ComplianceVoz /></ProtectedRoute>} />
          <Route path="/configuracoes-voz" element={<ProtectedRoute minLevel={0}><ConfiguracoesVoz /></ProtectedRoute>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </>
);

export default App;
