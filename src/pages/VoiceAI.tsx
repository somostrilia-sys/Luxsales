import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  AudioLines,
  Loader2,
  Mic,
  PhoneCall,
  Play,
  Plus,
  ShieldAlert,
  Trash2,
  User,
  Users,
  Volume2,
  Waves,
} from "lucide-react";

type Produto = "Objetivo" | "Trilia";
type TomVoz = "Informal" | "Semi-formal" | "Formal";
type ObjetivoLigacao = "Qualificar lead" | "Agendar apresentação" | "Informar promoção";

type ObjectionItem = {
  id: string;
  objection: string;
  response: string;
};

type VoiceProfile = {
  id: string;
  voice_key: string;
  name: string;
  gender: string | null;
  description: string | null;
  speed: string | null;
};

type Campaign = {
  id: string;
  name: string;
  voice_key: string | null;
  product: string | null;
  status: string | null;
  daily_limit: number | null;
  created_at: string | null;
  ai_seller_name?: string | null;
  voice_tone?: string | null;
  opening_script?: string | null;
  development_script?: string | null;
  closing_script?: string | null;
  objections?: unknown;
  rules?: string | null;
  call_goal?: string | null;
  schedule_start?: string | null;
  schedule_end?: string | null;
};

type CallLog = {
  id: string;
  lead_phone: string | null;
  voice_key: string | null;
  status: string | null;
  duration_sec: number | null;
  result: string | null;
  created_at: string | null;
  recording_url?: string | null;
};

type TrainingFormState = {
  product: Produto;
  aiSellerName: string;
  voiceTone: TomVoz;
  openingScript: string;
  developmentScript: string;
  closingScript: string;
  objections: ObjectionItem[];
  rules: string;
  callGoal: ObjetivoLigacao;
  testPhone: string;
};

type CampaignFormState = {
  name: string;
  product: Produto;
  voiceKey: string;
  dailyLimit: string;
  scheduleStart: string;
  scheduleEnd: string;
};

const SUPABASE_URL = "https://ecaduzwautlpzpvjognr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjYWR1endhdXRscHpwdmpvZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMDQ1MTcsImV4cCI6MjA4ODU4MDUxN30.LinR7PIoK7n79hWjbSJ3EgDwA_y6uN-HfQnOk7GgYi4";
const REST_HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};
const DEFAULT_SAMPLE_TEXT = "Boa tarde, tudo bem? Meu nome é Lucas, da proteção veicular Objetivo.";

const initialObjections = (): ObjectionItem[] => [
  {
    id: crypto.randomUUID(),
    objection: "Já tenho seguro",
    response: "Entendo! Mas proteção veicular é diferente de seguro e pode trazer uma alternativa mais acessível e flexível para você.",
  },
  {
    id: crypto.randomUUID(),
    objection: "Tá caro",
    response: "Posso te mostrar que cabe no seu bolso e que existem opções pensadas para o seu perfil antes de qualquer decisão.",
  },
  {
    id: crypto.randomUUID(),
    objection: "Não tenho interesse",
    response: "Sem problemas! Só pra você saber, em menos de um minuto eu consigo te explicar a proposta e você decide se vale avançar com um consultor.",
  },
];

const initialTrainingState = (): TrainingFormState => ({
  product: "Objetivo",
  aiSellerName: "Lucas",
  voiceTone: "Semi-formal",
  openingScript: "Boa tarde! Meu nome é Lucas e estou entrando em contato para falar rapidamente sobre proteção veicular.",
  developmentScript: "Quero entender seu momento, validar se faz sentido para o seu perfil e apresentar de forma simples como funciona a proteção veicular.",
  closingScript: "Perfeito! Posso agendar uma conversa rápida com um consultor humano para te passar os próximos detalhes?",
  objections: initialObjections(),
  rules: "Nunca diga 'seguro', sempre use 'proteção veicular'. Não feche venda, apenas agende com consultor humano.",
  callGoal: "Qualificar lead",
});

const initialCampaignForm: CampaignFormState = {
  name: "",
  product: "Objetivo",
  voiceKey: "",
  dailyLimit: "50",
  scheduleStart: "08:00",
  scheduleEnd: "18:00",
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
};

const normalizeVoice = (item: any): VoiceProfile => ({
  id: String(item.id ?? item.voice_key ?? crypto.randomUUID()),
  voice_key: String(item.voice_key ?? item.key ?? item.id ?? ""),
  name: item.name ?? item.voice_name ?? "Voz sem nome",
  gender: item.gender ?? null,
  description: item.description ?? item.notes ?? null,
  speed: item.speed != null ? String(item.speed) : null,
});

const normalizeCampaign = (item: any): Campaign => ({
  id: String(item.id),
  name: item.name ?? item.nome ?? "Campanha sem nome",
  voice_key: item.voice_key ?? null,
  product: item.product ?? item.produto ?? null,
  status: item.status ?? "draft",
  daily_limit: typeof item.daily_limit === "number" ? item.daily_limit : Number(item.daily_limit ?? 0),
  created_at: item.created_at ?? null,
  ai_seller_name: item.ai_seller_name ?? null,
  voice_tone: item.voice_tone ?? null,
  opening_script: item.opening_script ?? null,
  development_script: item.development_script ?? null,
  closing_script: item.closing_script ?? null,
  objections: item.objections ?? null,
  rules: item.rules ?? null,
  call_goal: item.call_goal ?? null,
  schedule_start: item.schedule_start ?? null,
  schedule_end: item.schedule_end ?? null,
});

const normalizeLog = (item: any): CallLog => ({
  id: String(item.id),
  lead_phone: item.lead_phone ?? null,
  voice_key: item.voice_key ?? null,
  status: item.status ?? null,
  duration_sec: typeof item.duration_sec === "number" ? item.duration_sec : Number(item.duration_sec ?? 0),
  result: item.result ?? null,
  created_at: item.created_at ?? null,
  recording_url: item.recording_url ?? null,
});

async function fetchRestTable(table: string, select = "*") {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`, {
    headers: REST_HEADERS,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Erro ao carregar ${table}`);
  }

  return response.json();
}

async function generateVoiceAudio(text: string, voiceKey: string) {
  const session = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (session.data.session?.access_token) {
    headers.Authorization = `Bearer ${session.data.session.access_token}`;
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-voice`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "generate", text, voice_key: voiceKey }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || "Não foi possível gerar o áudio.");
  }

  if (!payload?.audio_base64) {
    throw new Error("A função não retornou áudio.");
  }

  return `data:audio/mpeg;base64,${payload.audio_base64}`;
}

export default function VoiceAI() {
  const { collaborator, roleLevel } = useCollaborator();
  const [trainingForm, setTrainingForm] = useState<TrainingFormState>(initialTrainingState);
  const [campaignForm, setCampaignForm] = useState<CampaignFormState>(initialCampaignForm);
  const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfile[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [customPreviewText, setCustomPreviewText] = useState(DEFAULT_SAMPLE_TEXT);
  const [trainingAudioUrl, setTrainingAudioUrl] = useState<string | null>(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [savingTraining, setSavingTraining] = useState(false);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [testingTrainingVoice, setTestingTrainingVoice] = useState(false);
  const [previewingVoiceKey, setPreviewingVoiceKey] = useState<string | null>(null);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const callsToday = callLogs.filter((item) => item.created_at && new Date(item.created_at).toDateString() === today).length;
    const attended = callLogs.filter((item) => ["answered", "completed", "connected"].includes((item.status ?? "").toLowerCase())).length;
    const qualified = callLogs.filter((item) => ["qualificado", "qualified", "agendado", "scheduled"].includes((item.result ?? "").toLowerCase())).length;
    const attendanceRate = callLogs.length ? `${Math.round((attended / callLogs.length) * 100)}%` : "0%";

    return [
      { label: "Total Campanhas", value: String(campaigns.length), icon: PhoneCall },
      { label: "Ligações Hoje", value: String(callsToday), icon: Waves },
      { label: "Taxa Atendimento", value: attendanceRate, icon: Users },
      { label: "Leads Qualificados", value: String(qualified), icon: AudioLines },
    ];
  }, [campaigns.length, callLogs]);

  const selectedVoiceName = useMemo(
    () => voiceProfiles.find((item) => item.voice_key === selectedVoice)?.name ?? selectedVoice,
    [selectedVoice, voiceProfiles],
  );

  const loadData = async () => {
    setLoadingData(true);
    try {
      const [voicesRaw, campaignsRaw, logsRaw] = await Promise.all([
        fetchRestTable("voice_profiles", "*"),
        fetchRestTable("call_campaigns", "*"),
        fetchRestTable("call_logs", "*"),
      ]);

      const normalizedVoices = (voicesRaw ?? []).map(normalizeVoice).filter((item: VoiceProfile) => item.voice_key);
      const normalizedCampaigns = (campaignsRaw ?? []).map(normalizeCampaign);
      const normalizedLogs = (logsRaw ?? []).map(normalizeLog);

      setVoiceProfiles(normalizedVoices);
      setCampaigns(normalizedCampaigns);
      setCallLogs(normalizedLogs);

      if (normalizedVoices.length > 0) {
        setSelectedVoice((current) => current || normalizedVoices[0].voice_key);
        setCampaignForm((current) => ({ ...current, voiceKey: current.voiceKey || normalizedVoices[0].voice_key }));
      }

      const latestTraining = normalizedCampaigns.find((item) => item.opening_script || item.development_script || item.closing_script);
      if (latestTraining) {
        setTrainingForm({
          product: (latestTraining.product as Produto) || "Objetivo",
          aiSellerName: latestTraining.ai_seller_name || "Lucas",
          voiceTone: (latestTraining.voice_tone as TomVoz) || "Semi-formal",
          openingScript: latestTraining.opening_script || initialTrainingState().openingScript,
          developmentScript: latestTraining.development_script || initialTrainingState().developmentScript,
          closingScript: latestTraining.closing_script || initialTrainingState().closingScript,
          objections: Array.isArray(latestTraining.objections)
            ? latestTraining.objections.map((item: any) => ({
                id: crypto.randomUUID(),
                objection: item.objection ?? "",
                response: item.response ?? "",
              }))
            : initialObjections(),
          rules: latestTraining.rules || initialTrainingState().rules,
          callGoal: (latestTraining.call_goal as ObjetivoLigacao) || "Qualificar lead",
        });
      }
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível carregar os dados reais de voz e campanhas.");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const saveTraining = async () => {
    setSavingTraining(true);
    try {
      const payload = {
        name: `Treinamento IA - ${trainingForm.product}`,
        product: trainingForm.product,
        ai_seller_name: trainingForm.aiSellerName,
        voice_tone: trainingForm.voiceTone,
        opening_script: trainingForm.openingScript,
        development_script: trainingForm.developmentScript,
        closing_script: trainingForm.closingScript,
        objections: trainingForm.objections.map(({ objection, response }) => ({ objection, response })),
        rules: trainingForm.rules,
        call_goal: trainingForm.callGoal,
        voice_key: selectedVoice || null,
        status: "draft",
      };

      const { error } = await supabase.from("call_campaigns").insert(payload as never);
      if (error) throw error;

      toast.success("Treinamento salvo com sucesso.");
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível salvar o treinamento.");
    } finally {
      setSavingTraining(false);
    }
  };

  const testTrainingVoice = async () => {
    if (!selectedVoice) {
      toast.error("Selecione uma voz antes de testar.");
      return;
    }

    setTestingTrainingVoice(true);
    try {
      const audioUrl = await generateVoiceAudio(trainingForm.openingScript, selectedVoice);
      setTrainingAudioUrl(audioUrl);
      toast.success("Áudio gerado com sucesso.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Erro ao testar a voz.");
    } finally {
      setTestingTrainingVoice(false);
    }
  };

  const previewVoice = async (voiceKey: string, text: string) => {
    setPreviewingVoiceKey(voiceKey);
    try {
      const audioUrl = await generateVoiceAudio(text, voiceKey);
      setPreviewAudioUrl(audioUrl);
      setSelectedVoice(voiceKey);
      toast.success("Amostra pronta para reprodução.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Erro ao gerar amostra.");
    } finally {
      setPreviewingVoiceKey(null);
    }
  };

  const createCampaign = async () => {
    setSavingCampaign(true);
    try {
      const payload = {
        name: campaignForm.name,
        product: campaignForm.product,
        voice_key: campaignForm.voiceKey,
        daily_limit: Number(campaignForm.dailyLimit || 0),
        schedule_start: campaignForm.scheduleStart,
        schedule_end: campaignForm.scheduleEnd,
        status: "draft",
      };

      const { error } = await supabase.from("call_campaigns").insert(payload as never);
      if (error) throw error;

      toast.success("Campanha criada com sucesso.");
      setCampaignForm({ ...initialCampaignForm, voiceKey: selectedVoice || campaignForm.voiceKey });
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível criar a campanha.");
    } finally {
      setSavingCampaign(false);
    }
  };

  const updateObjection = (id: string, field: "objection" | "response", value: string) => {
    setTrainingForm((current) => ({
      ...current,
      objections: current.objections.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  };

  const addObjection = () => {
    setTrainingForm((current) => ({
      ...current,
      objections: [...current.objections, { id: crypto.randomUUID(), objection: "", response: "" }],
    }));
  };

  const removeObjection = (id: string) => {
    setTrainingForm((current) => ({
      ...current,
      objections: current.objections.filter((item) => item.id !== id),
    }));
  };

  if (roleLevel > 1) {
    return (
      <DashboardLayout>
        <Card className="border-border/60 bg-card">
          <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-4 text-center">
            <ShieldAlert className="h-10 w-10 text-primary" />
            <div className="space-y-1">
              <h1 className="text-xl font-semibold text-foreground">Acesso restrito</h1>
              <p className="text-sm text-muted-foreground">Esta página é visível apenas para usuários com roleLevel 0 ou 1.</p>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Ligações IA"
          subtitle={`Treinamento, vozes e campanhas com dados do projeto ecaduzwautlpzpvjognr${collaborator?.company?.name ? ` · ${collaborator.company.name}` : ""}`}
        />

        <Tabs defaultValue="treinamento" className="space-y-6">
          <TabsList className="h-auto flex-wrap justify-start gap-2 rounded-xl border border-border/60 bg-secondary/40 p-1">
            <TabsTrigger value="treinamento">Treinamento da IA</TabsTrigger>
            <TabsTrigger value="vozes">Vozes</TabsTrigger>
            <TabsTrigger value="campanhas">Campanhas & Dashboard</TabsTrigger>
          </TabsList>

          <TabsContent value="treinamento" className="space-y-6">
            <Card className="border-border/60 bg-card">
              <CardHeader>
                <CardTitle>Treinamento da IA</CardTitle>
                <CardDescription>Defina identidade, abordagem, regras e objetivo das ligações automatizadas.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Produto</Label>
                    <Select value={trainingForm.product} onValueChange={(value: Produto) => setTrainingForm((current) => ({ ...current, product: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Objetivo">Objetivo</SelectItem>
                        <SelectItem value="Trilia">Trilia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nome do vendedor IA</Label>
                    <Input value={trainingForm.aiSellerName} onChange={(e) => setTrainingForm((current) => ({ ...current, aiSellerName: e.target.value }))} placeholder="Ex: Lucas" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tom de voz</Label>
                    <Select value={trainingForm.voiceTone} onValueChange={(value: TomVoz) => setTrainingForm((current) => ({ ...current, voiceTone: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Informal">Informal</SelectItem>
                        <SelectItem value="Semi-formal">Semi-formal</SelectItem>
                        <SelectItem value="Formal">Formal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Objetivo da ligação</Label>
                    <Select value={trainingForm.callGoal} onValueChange={(value: ObjetivoLigacao) => setTrainingForm((current) => ({ ...current, callGoal: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Qualificar lead">Qualificar lead</SelectItem>
                        <SelectItem value="Agendar apresentação">Agendar apresentação</SelectItem>
                        <SelectItem value="Informar promoção">Informar promoção</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="space-y-2 lg:col-span-1">
                    <Label>Script de abertura</Label>
                    <Textarea value={trainingForm.openingScript} onChange={(e) => setTrainingForm((current) => ({ ...current, openingScript: e.target.value }))} className="min-h-[180px]" />
                  </div>
                  <div className="space-y-2 lg:col-span-1">
                    <Label>Script de desenvolvimento</Label>
                    <Textarea value={trainingForm.developmentScript} onChange={(e) => setTrainingForm((current) => ({ ...current, developmentScript: e.target.value }))} className="min-h-[180px]" />
                  </div>
                  <div className="space-y-2 lg:col-span-1">
                    <Label>Script de fechamento</Label>
                    <Textarea value={trainingForm.closingScript} onChange={(e) => setTrainingForm((current) => ({ ...current, closingScript: e.target.value }))} className="min-h-[180px]" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Objeções e respostas</Label>
                      <p className="text-sm text-muted-foreground">Cadastre respostas padrão para as objeções mais comuns.</p>
                    </div>
                    <Button type="button" variant="outline" onClick={addObjection}>
                      <Plus className="mr-2 h-4 w-4" />Adicionar objeção
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {trainingForm.objections.map((item, index) => (
                      <Card key={item.id} className="border-border/60 bg-secondary/20">
                        <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr,1.5fr,auto] md:items-start">
                          <div className="space-y-2">
                            <Label>Objeção {index + 1}</Label>
                            <Input value={item.objection} onChange={(e) => updateObjection(item.id, "objection", e.target.value)} placeholder="Ex: Tá caro" />
                          </div>
                          <div className="space-y-2">
                            <Label>Resposta</Label>
                            <Textarea value={item.response} onChange={(e) => updateObjection(item.id, "response", e.target.value)} className="min-h-[110px]" />
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeObjection(item.id)} className="mt-7">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Regras</Label>
                    <Textarea value={trainingForm.rules} onChange={(e) => setTrainingForm((current) => ({ ...current, rules: e.target.value }))} className="min-h-[140px]" />
                  </div>
                  <div className="space-y-4 rounded-xl border border-border/60 bg-secondary/20 p-4">
                    <div className="space-y-2">
                      <Label>Voz selecionada para teste</Label>
                      <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                        <SelectTrigger><SelectValue placeholder="Selecione uma voz" /></SelectTrigger>
                        <SelectContent>
                          {voiceProfiles.map((voice) => (
                            <SelectItem key={voice.id} value={voice.voice_key}>{voice.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button onClick={saveTraining} disabled={savingTraining}>
                        {savingTraining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Salvar Treinamento
                      </Button>
                      <Button variant="secondary" onClick={testTrainingVoice} disabled={testingTrainingVoice || !selectedVoice}>
                        {testingTrainingVoice ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                        Testar Voz
                      </Button>
                    </div>
                    {trainingAudioUrl ? <audio controls className="w-full" src={trainingAudioUrl} /> : null}
                    <p className="text-xs text-muted-foreground">A voz de teste usa o script de abertura e a voz selecionada para a campanha.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vozes" className="space-y-6">
            <Card className="border-border/60 bg-card">
              <CardHeader>
                <CardTitle>Vozes</CardTitle>
                <CardDescription>Selecione, teste e compare perfis de voz disponíveis.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[1.5fr,1fr]">
                  <div className="space-y-2">
                    <Label>Texto personalizado para ouvir</Label>
                    <Input value={customPreviewText} onChange={(e) => setCustomPreviewText(e.target.value)} placeholder="Digite um texto para teste" />
                  </div>
                  <div className="space-y-2">
                    <Label>Voz selecionada</Label>
                    <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                      <SelectTrigger><SelectValue placeholder="Selecione uma voz" /></SelectTrigger>
                      <SelectContent>
                        {voiceProfiles.map((voice) => (
                          <SelectItem key={voice.id} value={voice.voice_key}>{voice.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" disabled={!selectedVoice || !customPreviewText.trim() || previewingVoiceKey === selectedVoice} onClick={() => previewVoice(selectedVoice, customPreviewText.trim())}>
                    {previewingVoiceKey === selectedVoice ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Volume2 className="mr-2 h-4 w-4" />}
                    Ouvir texto personalizado
                  </Button>
                  <Badge variant="outline" className="px-3 py-2 text-sm">Campanha atual: {selectedVoiceName || "Nenhuma voz selecionada"}</Badge>
                </div>
                {previewAudioUrl ? <audio controls className="w-full" src={previewAudioUrl} /> : null}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              {voiceProfiles.map((voice) => {
                const isSelected = selectedVoice === voice.voice_key;
                const isPreviewing = previewingVoiceKey === voice.voice_key;
                const isFemale = (voice.gender ?? "").toLowerCase().includes("f");
                return (
                  <Card key={voice.id} className={isSelected ? "border-primary/60 bg-card" : "border-border/60 bg-card"}>
                    <CardContent className="space-y-4 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {isFemale ? <User className="h-4 w-4 text-primary" /> : <Mic className="h-4 w-4 text-primary" />}
                            <h3 className="text-lg font-semibold text-foreground">{voice.name}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground">{voice.description || "Perfil de voz pronto para campanhas automatizadas."}</p>
                        </div>
                        <Badge variant="outline">Velocidade {voice.speed || "1.0"}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{isFemale ? "Feminina" : "Masculina"}</Badge>
                        <Badge variant="outline">{voice.voice_key}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Button variant="secondary" onClick={() => previewVoice(voice.voice_key, DEFAULT_SAMPLE_TEXT)} disabled={isPreviewing}>
                          {isPreviewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                          Ouvir Amostra
                        </Button>
                        <Button variant={isSelected ? "default" : "outline"} onClick={() => setSelectedVoice(voice.voice_key)}>
                          Selecionar para Campanha
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="campanhas" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {stats.map((item) => (
                <Card key={item.label} className="border-border/60 bg-card">
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className="rounded-xl bg-secondary p-3">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{item.value}</p>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-border/60 bg-card">
              <CardHeader>
                <CardTitle>Criar campanha</CardTitle>
                <CardDescription>Configure uma nova campanha de ligações com limite diário e horário operacional.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={campaignForm.name} onChange={(e) => setCampaignForm((current) => ({ ...current, name: e.target.value }))} placeholder="Ex: Reativação Objetivo Março" />
                </div>
                <div className="space-y-2">
                  <Label>Produto</Label>
                  <Select value={campaignForm.product} onValueChange={(value: Produto) => setCampaignForm((current) => ({ ...current, product: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Objetivo">Objetivo</SelectItem>
                      <SelectItem value="Trilia">Trilia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Voz</Label>
                  <Select value={campaignForm.voiceKey} onValueChange={(value) => setCampaignForm((current) => ({ ...current, voiceKey: value }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione a voz" /></SelectTrigger>
                    <SelectContent>
                      {voiceProfiles.map((voice) => (
                        <SelectItem key={voice.id} value={voice.voice_key}>{voice.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Limite diário</Label>
                  <Input type="number" value={campaignForm.dailyLimit} onChange={(e) => setCampaignForm((current) => ({ ...current, dailyLimit: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Horário início</Label>
                  <Input type="time" value={campaignForm.scheduleStart} onChange={(e) => setCampaignForm((current) => ({ ...current, scheduleStart: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Horário fim</Label>
                  <Input type="time" value={campaignForm.scheduleEnd} onChange={(e) => setCampaignForm((current) => ({ ...current, scheduleEnd: e.target.value }))} />
                </div>
                <div className="md:col-span-2 xl:col-span-3">
                  <Button onClick={createCampaign} disabled={savingCampaign || !campaignForm.name || !campaignForm.voiceKey}>
                    {savingCampaign ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Criar campanha
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card">
              <CardHeader>
                <CardTitle>Campanhas</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Voz</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Limite diário</TableHead>
                      <TableHead>Criada em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma campanha encontrada.</TableCell>
                      </TableRow>
                    ) : campaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell className="font-medium">{campaign.name}</TableCell>
                        <TableCell>{campaign.voice_key || "—"}</TableCell>
                        <TableCell>{campaign.product || "—"}</TableCell>
                        <TableCell><Badge variant="outline">{campaign.status || "draft"}</Badge></TableCell>
                        <TableCell>{campaign.daily_limit ?? "—"}</TableCell>
                        <TableCell>{formatDate(campaign.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card">
              <CardHeader>
                <CardTitle>Histórico de ligações</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Voz</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Gravação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {callLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum registro de ligação encontrado.</TableCell>
                      </TableRow>
                    ) : callLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{log.lead_phone || "—"}</TableCell>
                        <TableCell>{log.voice_key || "—"}</TableCell>
                        <TableCell><Badge variant="outline">{log.status || "—"}</Badge></TableCell>
                        <TableCell>{log.duration_sec ? `${log.duration_sec}s` : "—"}</TableCell>
                        <TableCell>{log.result || "—"}</TableCell>
                        <TableCell>{formatDate(log.created_at)}</TableCell>
                        <TableCell>
                          {log.recording_url ? <audio controls className="max-w-[220px]" src={log.recording_url} /> : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {loadingData ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando dados reais do Supabase...
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
