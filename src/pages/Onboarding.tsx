import { useState, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { EDGE_BASE } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2, Building2, User, MessageSquare, CheckCircle, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Step = "empresa" | "whatsapp" | "done";

interface SetupResult {
  organization_id: string;
  company_id: string;
  owner_user_id: string | null;
}

export default function Onboarding() {
  const { collaborator } = useCollaborator();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("empresa");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SetupResult | null>(null);

  // Step 1: Empresa
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [segment, setSegment] = useState("");
  const [plan, setPlan] = useState("starter");

  // Step 2: WhatsApp
  const [waToken, setWaToken] = useState("");
  const [waPhoneId, setWaPhoneId] = useState("");
  const [waWabaId, setWaWabaId] = useState("");
  const [waPhone, setWaPhone] = useState("");

  const getHeaders = useCallback(async () => {
    const session = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.data.session?.access_token || ""}`,
    };
  }, []);

  const autoSlug = (value: string) => {
    setName(value);
    setSlug(
      value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    );
  };

  const handleCreateOrg = async () => {
    if (!name.trim() || !slug.trim()) {
      toast.error("Nome e slug são obrigatórios");
      return;
    }

    setLoading(true);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${EDGE_BASE}/onboarding`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "create-organization",
          name: name.trim(),
          slug: slug.trim(),
          owner_email: ownerEmail.trim() || undefined,
          owner_name: ownerName.trim() || undefined,
          segment: segment.trim() || undefined,
          plan,
          requester_role: "ceo",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Organização "${name}" criada!`);
        setResult({
          organization_id: data.organization_id,
          company_id: data.company_id,
          owner_user_id: data.owner_user_id,
        });
        setStep("whatsapp");
      } else {
        toast.error(data.error || "Erro ao criar organização");
      }
    } catch {
      toast.error("Erro de conexão");
    }
    setLoading(false);
  };

  const handleSetupWhatsApp = async () => {
    if (!result?.company_id || !waToken || !waPhoneId || !waWabaId) {
      toast.error("Preencha todos os campos");
      return;
    }

    setLoading(true);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${EDGE_BASE}/onboarding`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "setup-whatsapp",
          company_id: result.company_id,
          access_token: waToken,
          phone_number_id: waPhoneId,
          waba_id: waWabaId,
          display_phone: waPhone || undefined,
          requester_role: "ceo",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("WhatsApp configurado!");
        setStep("done");
      } else {
        toast.error(data.error || "Erro ao configurar WhatsApp");
      }
    } catch {
      toast.error("Erro de conexão");
    }
    setLoading(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6 max-w-2xl">
        <PageHeader
          title="Onboarding — Nova Empresa"
          description="Configure uma nova empresa externa na plataforma"
        />

        {/* Progress */}
        <div className="flex items-center gap-2 text-sm">
          <StepIndicator active={step === "empresa"} done={step !== "empresa"} label="1. Empresa" />
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <StepIndicator active={step === "whatsapp"} done={step === "done"} label="2. WhatsApp" />
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <StepIndicator active={step === "done"} done={false} label="3. Pronto" />
        </div>

        {/* Step 1: Empresa */}
        {step === "empresa" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" /> Dados da Empresa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome da empresa *</Label>
                  <Input value={name} onChange={(e) => autoSlug(e.target.value)} placeholder="Ex: Auto Protect SP" />
                </div>
                <div className="space-y-2">
                  <Label>Slug (URL) *</Label>
                  <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-protect-sp" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Segmento</Label>
                <Input value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="Ex: proteção veicular, imobiliário, saúde..." />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Email do dono</Label>
                  <Input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="ceo@empresa.com" />
                </div>
                <div className="space-y-2">
                  <Label>Nome do dono</Label>
                  <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="João Silva" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Plano</Label>
                <Select value={plan} onValueChange={setPlan}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter (1 empresa)</SelectItem>
                    <SelectItem value="professional">Professional (5 empresas)</SelectItem>
                    <SelectItem value="enterprise">Enterprise (ilimitado)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleCreateOrg} disabled={loading || !name.trim() || !slug.trim()} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Building2 className="h-4 w-4 mr-2" />}
                Criar Organização
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: WhatsApp */}
        {step === "whatsapp" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" /> Configurar WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure as credenciais da Meta Business API para esta empresa.
                Você pode pular e configurar depois.
              </p>

              <div className="space-y-2">
                <Label>Access Token (Meta)</Label>
                <Input value={waToken} onChange={(e) => setWaToken(e.target.value)} placeholder="EAAxxxxxxx..." />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Phone Number ID</Label>
                  <Input value={waPhoneId} onChange={(e) => setWaPhoneId(e.target.value)} placeholder="1234567890" />
                </div>
                <div className="space-y-2">
                  <Label>WABA ID</Label>
                  <Input value={waWabaId} onChange={(e) => setWaWabaId(e.target.value)} placeholder="1234567890" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Número de telefone (display)</Label>
                <Input value={waPhone} onChange={(e) => setWaPhone(e.target.value)} placeholder="+55 11 99999-9999" />
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("done")} className="flex-1">
                  Pular por agora
                </Button>
                <Button onClick={handleSetupWhatsApp} disabled={loading} className="flex-1">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}
                  Configurar WhatsApp
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Done */}
        {step === "done" && (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <CheckCircle className="h-16 w-16 text-green-400 mx-auto" />
              <h2 className="text-xl font-bold">Organização criada!</h2>
              <p className="text-muted-foreground">
                A empresa <strong>{name}</strong> está pronta para uso.
                {ownerEmail && (
                  <> O usuário <strong>{ownerEmail}</strong> foi criado como CEO.</>
                )}
              </p>
              <div className="flex gap-3 justify-center pt-4">
                <Button variant="outline" onClick={() => navigate("/organizations")}>
                  Ver Organizações
                </Button>
                <Button onClick={() => {
                  setStep("empresa");
                  setName("");
                  setSlug("");
                  setOwnerEmail("");
                  setOwnerName("");
                  setSegment("");
                  setResult(null);
                }}>
                  Criar Outra
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

function StepIndicator({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <span
      className={`text-xs px-2 py-1 rounded ${
        active
          ? "bg-primary/20 text-primary font-medium"
          : done
          ? "bg-green-500/20 text-green-400"
          : "text-muted-foreground"
      }`}
    >
      {done && <CheckCircle className="h-3 w-3 inline mr-1" />}
      {label}
    </span>
  );
}
