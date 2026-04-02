import { lazy, Suspense, Component, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Loader2, RefreshCw } from "lucide-react";

// Retry lazy import automaticamente (resolve tela escura por chunk fail)
function lazyRetry(importer: () => Promise<any>) {
  return lazy(() =>
    importer().catch(() =>
      new Promise((resolve) => {
        setTimeout(() => resolve(importer()), 1500);
      })
    )
  );
}

// Error Boundary pra capturar chunk load failures
class ChunkErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
          <p className="text-muted-foreground">Erro ao carregar página</p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" /> Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lazy-loaded pages
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const CriarConta = lazy(() => import("./pages/CriarConta"));
const Venda = lazy(() => import("./pages/Venda"));

// Dashboard & WB
const DashboardGeral = lazy(() => import("./pages/DashboardGeral"));
const DashboardWB = lazy(() => import("./pages/DashboardWB"));
const DashboardConsultor = lazy(() => import("./pages/DashboardConsultor"));
const MyLeads = lazy(() => import("./pages/MyLeads"));
const ConversationDetail = lazy(() => import("./pages/ConversationDetail"));
const Conversas = lazy(() => import("./pages/Conversas"));
const Templates = lazy(() => import("./pages/Templates"));
const TeamManagement = lazy(() => import("./pages/TeamManagement"));
const LeadDistribution = lazy(() => import("./pages/LeadDistribution"));
const LeadsMaster = lazy(() => import("./pages/LeadsMaster"));
const ImportLeads = lazy(() => import("./pages/ImportLeads"));
const CallQueues = lazy(() => import("./pages/CallQueues"));
const DispatchQueues = lazy(() => import("./pages/DispatchQueues"));
const OptIns = lazy(() => import("./pages/OptIns"));
const CompanySetup = lazy(() => import("./pages/CompanySetup"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));

// Voice / VoIP
const DashboardCalls = lazy(() => import("./pages/DashboardCalls"));
const DashboardMeta = lazy(() => import("./pages/DashboardMeta"));
const DashboardVoip = lazy(() => import("./pages/DashboardVoip"));
const Discador = lazy(() => import("./pages/Discador"));
const CallCampaigns = lazy(() => import("./pages/CallCampaigns"));
const LeadsDiscador = lazy(() => import("./pages/LeadsDiscador"));
const VoiceAI = lazy(() => import("./pages/VoiceAI"));
const VoiceDialer = lazy(() => import("./pages/VoiceDialer"));
const VoiceSimulate = lazy(() => import("./pages/VoiceSimulate"));
const VoiceCalls = lazy(() => import("./pages/VoiceCalls"));
const RelatoriosVoz = lazy(() => import("./pages/RelatoriosVoz"));
const ComplianceVoz = lazy(() => import("./pages/ComplianceVoz"));
const ConfiguracoesVoz = lazy(() => import("./pages/ConfiguracoesVoz"));
const WhatsAppMeta = lazy(() => import("./pages/WhatsAppMeta"));
const ConfigWhatsApp = lazy(() => import("./pages/ConfigWhatsApp"));
const MetaRules = lazy(() => import("./pages/MetaRules"));

const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const GestaoUsuarios = lazy(() => import("./pages/GestaoUsuarios"));
const AceitarConvite = lazy(() => import("./pages/AceitarConvite"));
const Ligacoes = lazy(() => import("./pages/Ligacoes"));
const Disparos = lazy(() => import("./pages/Disparos"));
const Historico = lazy(() => import("./pages/Historico"));

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
      <ChunkErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/criar-conta" element={<CriarConta />} />
          <Route path="/venda" element={<Venda />} />
          <Route path="/convite/:token" element={<AceitarConvite />} />

          {/* WB Core — CEO */}
          <Route path="/" element={<ProtectedRoute><DashboardGeral /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardGeral /></ProtectedRoute>} />
          <Route path="/dashboard-wb" element={<ProtectedRoute minLevel={0}><DashboardWB /></ProtectedRoute>} />
          <Route path="/meus-numeros" element={<ProtectedRoute><DashboardConsultor /></ProtectedRoute>} />
          <Route path="/templates" element={<ProtectedRoute minLevel={0}><Templates /></ProtectedRoute>} />
          <Route path="/team" element={<ProtectedRoute minLevel={0}><TeamManagement /></ProtectedRoute>} />
          <Route path="/lead-distribution" element={<ProtectedRoute minLevel={0}><LeadDistribution /></ProtectedRoute>} />
          <Route path="/leads" element={<ProtectedRoute minLevel={0}><LeadsMaster /></ProtectedRoute>} />
          <Route path="/import" element={<ProtectedRoute minLevel={0}><ImportLeads /></ProtectedRoute>} />
          {/* Ligacoes unificadas (Fase 2) */}
          <Route path="/ligacoes" element={<ProtectedRoute><Ligacoes /></ProtectedRoute>} />
          {/* Redirects para rotas antigas */}
          <Route path="/call-queues" element={<Navigate to="/ligacoes" replace />} />
          <Route path="/disparos" element={<ProtectedRoute><Disparos /></ProtectedRoute>} />
          <Route path="/dispatch-queues" element={<ProtectedRoute minLevel={0}><DispatchQueues /></ProtectedRoute>} />
          <Route path="/opt-ins" element={<ProtectedRoute minLevel={0}><OptIns /></ProtectedRoute>} />
          <Route path="/config" element={<ProtectedRoute minLevel={0}><CompanySetup /></ProtectedRoute>} />
          <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
          <Route path="/gestao-usuarios" element={<ProtectedRoute minLevel={1}><GestaoUsuarios /></ProtectedRoute>} />

          {/* WB — All roles */}
          <Route path="/my-leads" element={<ProtectedRoute><MyLeads /></ProtectedRoute>} />
          <Route path="/conversations" element={<ProtectedRoute><Conversas /></ProtectedRoute>} />
          <Route path="/historico" element={<Navigate to="/ligacoes" replace />} />

          {/* VoIP */}
          <Route path="/calls" element={<ProtectedRoute minLevel={0}><DashboardCalls /></ProtectedRoute>} />
          <Route path="/meta" element={<ProtectedRoute minLevel={0}><DashboardMeta /></ProtectedRoute>} />
          <Route path="/dashboard-voip" element={<ProtectedRoute minLevel={1}><DashboardVoip /></ProtectedRoute>} />
          <Route path="/discador" element={<ProtectedRoute minLevel={2}><Discador /></ProtectedRoute>} />
          <Route path="/call-campaigns" element={<ProtectedRoute minLevel={1}><CallCampaigns /></ProtectedRoute>} />
          <Route path="/leads-discador" element={<ProtectedRoute minLevel={1}><LeadsDiscador /></ProtectedRoute>} />
          <Route path="/voice-ai" element={<ProtectedRoute minLevel={0}><VoiceAI /></ProtectedRoute>} />
          <Route path="/whatsapp-meta" element={<ProtectedRoute minLevel={0}><WhatsAppMeta /></ProtectedRoute>} />
          <Route path="/config-whatsapp" element={<ProtectedRoute minLevel={0}><ConfigWhatsApp /></ProtectedRoute>} />
          <Route path="/relatorios-voz" element={<ProtectedRoute minLevel={1}><RelatoriosVoz /></ProtectedRoute>} />
          <Route path="/compliance-voz" element={<ProtectedRoute minLevel={0}><ComplianceVoz /></ProtectedRoute>} />
          <Route path="/configuracoes-voz" element={<ProtectedRoute minLevel={0}><ConfiguracoesVoz /></ProtectedRoute>} />
          <Route path="/knowledge-base" element={<ProtectedRoute minLevel={0}><KnowledgeBase /></ProtectedRoute>} />
          <Route path="/meta-rules" element={<ProtectedRoute minLevel={0}><MetaRules /></ProtectedRoute>} />
          <Route path="/voice/dialer" element={<Navigate to="/ligacoes" replace />} />
          <Route path="/voice/simulate" element={<ProtectedRoute minLevel={0}><VoiceSimulate /></ProtectedRoute>} />
          <Route path="/voice/calls" element={<ProtectedRoute minLevel={0}><VoiceCalls /></ProtectedRoute>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      </ChunkErrorBoundary>
    </BrowserRouter>
  </>
);

export default App;
