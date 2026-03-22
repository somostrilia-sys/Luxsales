import { useEffect, useMemo, useRef, useState } from "react";
import CallSimulator from "@/components/simulator/CallSimulator";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { SUPABASE_URL, EDGE_BASE } from "@/lib/constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  AudioLines,
  Bot,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Mic,
  Pause,
  PhoneCall,
  Play,
  Plus,
  RotateCcw,
  Send,
  ShieldAlert,
  Trash2,
  Upload,
  User,
  Users,
  Volume2,
  Waves,
  X,
} from "lucide-react";

type Produto = "Objetivo" | "Trilia";
type TomVoz = "Informal" | "Semi-formal" | "Formal";
type ScriptTone = "natural_confident" | "formal_consultive" | "casual_friendly" | "direct_objective";
type ObjetivoLigacao = "Qualificar lead" | "Agendar apresentação" | "Informar promoção";

type ConversationExample = {
  id: string;
  lead_says: string;
  agent_responds: string;
};

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
  ai_transcript?: { role: string; text: string; timestamp?: string }[] | null;
};

// SimMessage and CallPhase types moved to CallSimulator component

type VoiceCloneForm = {
  name: string;
  consentChecked: boolean;
  files: File[];
  uploading: boolean;
  trainingStatus: "idle" | "uploading" | "training" | "ready" | "failed";
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

// SUPABASE_URL imported at top of file
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
  testPhone: "",
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

const formatBrazilPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 13);

  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
  if (digits.length <= 12) return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
};

const normalizePhoneDigits = (value: string) => value.replace(/\D/g, "").slice(0, 13);

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
  ai_transcript: Array.isArray(item.ai_transcript) ? item.ai_transcript : null,
});

async function fetchRestTable(table: string, _select = "*") {
  const { data, error } = await supabase.from(table).select(_select);
  if (error) throw new Error(error.message || `Erro ao carregar ${table}`);
  return data ?? [];
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
    body: JSON.stringify({ voice_key: voiceKey, text }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || "Não foi possível gerar o áudio.");
  }

  // Edge function returns: audioUrl, audio, audio_url
  const audioSrc = payload?.audioUrl || payload?.audio_url;
  if (audioSrc) return audioSrc;

  // Fallback: raw base64
  const b64 = payload?.audio || payload?.audioData;
  if (b64) return `data:audio/mpeg;base64,${b64}`;

  throw new Error("A função não retornou áudio.");
}

function buildSimulatorSystemPrompt(form: TrainingFormState): string {
  let prompt = `Você é ${form.aiSellerName}, um vendedor(a) de ${form.product} em uma ligação telefônica.`;
  prompt += `\nTom de voz: ${form.voiceTone}.`;
  prompt += `\nObjetivo da ligação: ${form.callGoal}.`;
  prompt += `\n\nScript de abertura: ${form.openingScript}`;
  prompt += `\nScript de desenvolvimento: ${form.developmentScript}`;
  prompt += `\nScript de fechamento: ${form.closingScript}`;
  prompt += `\n\nRegras: ${form.rules}`;
  if (form.objections.length > 0) {
    prompt += `\n\nQuando encontrar objeções, use estas respostas:`;
    for (const obj of form.objections) {
      if (obj.objection) prompt += `\n- "${obj.objection}": ${obj.response}`;
    }
  }
  prompt += `\n\nIMPORTANTE:`;
  prompt += `\n- Fale em português brasileiro natural.`;
  prompt += `\n- Respostas curtas: máximo 2-3 frases por vez.`;
  prompt += `\n- NÃO use markdown, emojis, ou formatação.`;
  prompt += `\n- Fale como se estivesse conversando por telefone.`;
  return prompt;
}

const initialVoiceCloneForm: VoiceCloneForm = {
  name: "",
  consentChecked: false,
  files: [],
  uploading: false,
  trainingStatus: "idle",
};

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
  const [testingQuickCall, setTestingQuickCall] = useState(false);
  const [previewingVoiceKey, setPreviewingVoiceKey] = useState<string | null>(null);

  // Script-level training state (ai_call_scripts)
  const [scriptId, setScriptId] = useState<string | null>(null);
  const [scriptTone, setScriptTone] = useState<ScriptTone>("natural_confident");
  const [forbiddenWords, setForbiddenWords] = useState<string[]>([]);
  const [forbiddenWordInput, setForbiddenWordInput] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [knowledgeBase, setKnowledgeBase] = useState("");
  const [salesTechniques, setSalesTechniques] = useState("");
  const [qualifyingQuestions, setQualifyingQuestions] = useState("");
  const [scriptObjections, setScriptObjections] = useState<ObjectionItem[]>([]);
  const [conversationExamples, setConversationExamples] = useState<ConversationExample[]>([]);
  const [savingScript, setSavingScript] = useState(false);

  // (Simulator state moved to CallSimulator component)

  // Call player state
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  const [playingCallId, setPlayingCallId] = useState<string | null>(null);
  const [callAudioProgress, setCallAudioProgress] = useState<number>(0);
  const callAudioRef = useRef<HTMLAudioElement>(null);

  // Voice clone state
  const [voiceCloneForm, setVoiceCloneForm] = useState<VoiceCloneForm>(initialVoiceCloneForm);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const [voicesRaw, campaignsRaw, logsRaw, scriptsRaw, analyticsRaw] = await Promise.all([
        fetchRestTable("voice_profiles", "*"),
        fetchRestTable("call_campaigns", "*"),
        fetchRestTable("call_logs", "*"),
        fetchRestTable("ai_call_scripts", "*"),
        fetchRestTable("ai_call_analytics", "*"),
      ]);

      const normalizedVoices = (voicesRaw ?? []).map(normalizeVoice).filter((item: VoiceProfile) => item.voice_key);
      const normalizedCampaigns = (campaignsRaw ?? []).map(normalizeCampaign);
      const normalizedLogs = (logsRaw ?? []).map(normalizeLog);
      // Load latest AI call script for training tabs
      const scripts = scriptsRaw ?? [];
      console.log(`Loaded: ${scripts.length} AI scripts, ${(analyticsRaw ?? []).length} analytics records`);
      if (scripts.length > 0) {
        const latest = scripts.sort((a: any, b: any) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""))[0] as any;
        setScriptId(latest.id);
        setScriptTone(latest.tone || "natural_confident");
        setForbiddenWords(Array.isArray(latest.forbidden_words) ? latest.forbidden_words : []);
        setSystemPrompt(latest.system_prompt || "");
        setKnowledgeBase(latest.knowledge_base || "");
        setSalesTechniques(latest.sales_techniques || "");
        setQualifyingQuestions(latest.qualifying_questions || "");
        setScriptObjections(
          Array.isArray(latest.objection_handlers)
            ? (latest.objection_handlers as any[]).map((o: any) => ({ id: crypto.randomUUID(), objection: o.objection ?? "", response: o.response ?? "" }))
            : []
        );
        setConversationExamples(
          Array.isArray(latest.conversation_examples)
            ? (latest.conversation_examples as any[]).map((e: any) => ({ id: crypto.randomUUID(), lead_says: e.lead_says ?? "", agent_responds: e.agent_responds ?? "" }))
            : []
        );
      }

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
          testPhone: "",
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

  const saveScript = async () => {
    setSavingScript(true);
    try {
      const payload: Record<string, unknown> = {
        tone: scriptTone,
        forbidden_words: forbiddenWords,
        system_prompt: systemPrompt,
        knowledge_base: knowledgeBase,
        sales_techniques: salesTechniques,
        qualifying_questions: qualifyingQuestions,
        objection_handlers: scriptObjections.map(({ objection, response }) => ({ objection, response })),
        conversation_examples: conversationExamples.map(({ lead_says, agent_responds }) => ({ lead_says, agent_responds })),
        company_id: collaborator?.company_id || null,
      };

      if (scriptId) {
        const { error } = await supabase.from("ai_call_scripts").update(payload as never).eq("id", scriptId);
        if (error) throw error;
      } else {
        payload.name = `Script IA - ${trainingForm.product}`;
        payload.flow = {};
        const { data, error } = await supabase.from("ai_call_scripts").insert(payload as never).select("id").single();
        if (error) throw error;
        if (data) setScriptId((data as any).id);
      }

      toast.success("Treinamento salvo com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar treinamento.");
    } finally {
      setSavingScript(false);
    }
  };

  const addForbiddenWord = () => {
    const word = forbiddenWordInput.trim();
    if (word && !forbiddenWords.includes(word)) {
      setForbiddenWords(prev => [...prev, word]);
    }
    setForbiddenWordInput("");
  };

  const removeForbiddenWord = (word: string) => {
    setForbiddenWords(prev => prev.filter(w => w !== word));
  };

  const addScriptObjection = () => {
    setScriptObjections(prev => [...prev, { id: crypto.randomUUID(), objection: "", response: "" }]);
  };

  const updateScriptObjection = (id: string, field: "objection" | "response", value: string) => {
    setScriptObjections(prev => prev.map(o => o.id === id ? { ...o, [field]: value } : o));
  };

  const removeScriptObjection = (id: string) => {
    setScriptObjections(prev => prev.filter(o => o.id !== id));
  };

  const addConversationExample = () => {
    setConversationExamples(prev => [...prev, { id: crypto.randomUUID(), lead_says: "", agent_responds: "" }]);
  };

  const updateConversationExample = (id: string, field: "lead_says" | "agent_responds", value: string) => {
    setConversationExamples(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const removeConversationExample = (id: string) => {
    setConversationExamples(prev => prev.filter(e => e.id !== id));
  };

  const testTrainingVoice = async () => {
    if (!selectedVoice) {
      toast.error("Selecione uma voz antes de testar.");
      return;
    }

    const loadingToast = toast.loading("Gerando áudio de teste...");
    setTestingTrainingVoice(true);
    try {
      const audioUrl = await generateVoiceAudio(trainingForm.openingScript, selectedVoice);
      setTrainingAudioUrl(audioUrl);
      toast.success("Áudio gerado! Em breve a ligação será iniciada.", { id: loadingToast });
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Erro ao testar a voz.", { id: loadingToast });
    } finally {
      setTestingTrainingVoice(false);
    }
  };

  const handleTestPhoneChange = (value: string) => {
    setTrainingForm((current) => ({ ...current, testPhone: formatBrazilPhone(value) }));
  };

  const handleQuickCall = async () => {
    if (!selectedVoice) {
      toast.error("Selecione uma voz antes de ligar.");
      return;
    }

    if (normalizePhoneDigits(trainingForm.testPhone).length < 12) {
      toast.error("Informe um número de teste válido.");
      return;
    }

    const loadingToast = toast.loading("Gerando áudio e iniciando ligação...");
    setTestingQuickCall(true);
    try {
      // Gerar audio preview
      const audioUrl = await generateVoiceAudio(trainingForm.openingScript, selectedVoice);
      setTrainingAudioUrl(audioUrl);

      // Montar número E.164
      const digits = normalizePhoneDigits(trainingForm.testPhone);
      const e164Number = digits.startsWith("55") ? "+" + digits : "+55" + digits;

      // Montar system prompt completo
      const systemPrompt = buildSimulatorSystemPrompt(trainingForm);

      // Chamar edge function make-call com action dial
      const { data, error } = await supabase.functions.invoke("make-call", {
        body: {
          action: "dial",
          to: e164Number,
          voice_key: selectedVoice,
          opening_script: trainingForm.openingScript,
          system_prompt: systemPrompt,
        },
      });

      if (error || !data?.success) {
        const errMsg = data?.error || data?.detail || error?.message || "Erro ao iniciar ligação.";
        toast.error(errMsg, { id: loadingToast });
        return;
      }

      toast.success("Ligação iniciada para " + e164Number + "! (VAPI: " + (data.vapi_call_id || "") + ")", { id: loadingToast });
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Erro ao iniciar teste.", { id: loadingToast });
    } finally {
      setTestingQuickCall(false);
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

  // ============ SIMULATOR — now in CallSimulator component ============

  // ============ CALL PLAYER FUNCTIONS ============

  const toggleCallPlayer = (logId: string) => {
    setExpandedCallId((prev) => (prev === logId ? null : logId));
    if (playingCallId === logId) {
      callAudioRef.current?.pause();
      setPlayingCallId(null);
    }
  };

  const playCallAudio = (log: CallLog) => {
    if (!log.recording_url || !callAudioRef.current) return;
    if (playingCallId === log.id) {
      callAudioRef.current.pause();
      setPlayingCallId(null);
      return;
    }
    callAudioRef.current.src = log.recording_url;
    callAudioRef.current.play().catch(() => {});
    setPlayingCallId(log.id);
  };

  // ============ VOICE CLONE FUNCTIONS ============

  const handleCloneFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setVoiceCloneForm((prev) => ({ ...prev, files: [...prev.files, ...files] }));
  };

  const removeCloneFile = (index: number) => {
    setVoiceCloneForm((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }));
  };

  const submitVoiceClone = async () => {
    if (!voiceCloneForm.name.trim()) {
      toast.error("Informe um nome para a voz.");
      return;
    }
    if (voiceCloneForm.files.length === 0) {
      toast.error("Envie pelo menos um arquivo de áudio.");
      return;
    }
    if (!voiceCloneForm.consentChecked) {
      toast.error("Você precisa aceitar o consentimento LGPD.");
      return;
    }

    setVoiceCloneForm((prev) => ({ ...prev, uploading: true, trainingStatus: "uploading" }));

    try {
      const uploadedPaths: string[] = [];
      for (const file of voiceCloneForm.files) {
        const filePath = `voice-clones/${crypto.randomUUID()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("voice-samples")
          .upload(filePath, file, { contentType: file.type });
        if (uploadError) throw uploadError;
        uploadedPaths.push(filePath);
      }

      const { error: insertError } = await supabase.from("ai_voice_clones").insert({
        clone_name: voiceCloneForm.name,
        sample_paths: uploadedPaths,
        training_status: "pending",
        lgpd_consent: true,
        lgpd_consent_at: new Date().toISOString(),
        company_id: collaborator?.company_id || null,
      } as never);

      if (insertError) throw insertError;

      setVoiceCloneForm({ ...initialVoiceCloneForm, trainingStatus: "training" });
      toast.success("Amostras enviadas! O treinamento da voz foi iniciado.");
    } catch (error) {
      console.error(error);
      setVoiceCloneForm((prev) => ({ ...prev, trainingStatus: "failed" }));
      toast.error("Erro ao enviar amostras de voz.");
    } finally {
      setVoiceCloneForm((prev) => ({ ...prev, uploading: false }));
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
          subtitle={`Treinamento, vozes e campanhas${collaborator?.company?.name ? ` · ${collaborator.company.name}` : ""}`}
        />

        <Tabs defaultValue="treinamento" className="space-y-6">
          <TabsList className="h-auto flex-wrap justify-start gap-2 rounded-xl border border-border/60 bg-secondary/40 p-1">
            <TabsTrigger value="treinamento">Treinamento da IA</TabsTrigger>
            <TabsTrigger value="vozes">Vozes</TabsTrigger>
            <TabsTrigger value="campanhas">Campanhas & Dashboard</TabsTrigger>
            <TabsTrigger value="simulador">Simulador</TabsTrigger>
          </TabsList>

          <TabsContent value="treinamento" className="space-y-6">
            <Card className="border-border/60 bg-card">
              <CardHeader>
                <CardTitle>Treinamento da IA</CardTitle>
                <CardDescription>Defina personalidade, conhecimento, técnicas de venda e exemplos de conversa.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Quick test section */}
                <Card className="border-border/60 bg-secondary/20">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                      <div className="grid flex-1 gap-3 md:grid-cols-[1.2fr,1fr]">
                        <div className="space-y-2">
                          <Label>Número de teste</Label>
                          <Input type="tel" inputMode="numeric" placeholder="5511999999999" value={trainingForm.testPhone} onChange={(e) => handleTestPhoneChange(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Voz para teste rápido</Label>
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
                      <Button type="button" onClick={handleQuickCall} disabled={testingQuickCall || !selectedVoice} className="bg-success text-success-foreground hover:bg-success/90">
                        {testingQuickCall ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PhoneCall className="mr-2 h-4 w-4" />}
                        Ligar
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* 4 Sub-Tabs */}
                <Tabs defaultValue="personalidade" className="space-y-4">
                  <TabsList className="h-auto flex-wrap justify-start gap-1 bg-secondary/30 p-1">
                    <TabsTrigger value="personalidade" className="text-xs sm:text-sm">🎭 Personalidade</TabsTrigger>
                    <TabsTrigger value="conhecimento" className="text-xs sm:text-sm">🧠 Conhecimento</TabsTrigger>
                    <TabsTrigger value="vendas" className="text-xs sm:text-sm">🎯 Vendas</TabsTrigger>
                    <TabsTrigger value="exemplos" className="text-xs sm:text-sm">💬 Exemplos</TabsTrigger>
                  </TabsList>

                  {/* === PERSONALIDADE === */}
                  <TabsContent value="personalidade" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Tom de Voz</Label>
                        <Select value={scriptTone} onValueChange={(v: ScriptTone) => setScriptTone(v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="natural_confident">Natural e confiante</SelectItem>
                            <SelectItem value="formal_consultive">Formal e consultivo</SelectItem>
                            <SelectItem value="casual_friendly">Casual e amigável</SelectItem>
                            <SelectItem value="direct_objective">Direto e objetivo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Palavras Proibidas</Label>
                        <div className="flex gap-2">
                          <Input
                            value={forbiddenWordInput}
                            onChange={(e) => setForbiddenWordInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addForbiddenWord(); } }}
                            placeholder="Digite e pressione Enter"
                          />
                          <Button type="button" variant="outline" size="sm" onClick={addForbiddenWord}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        {forbiddenWords.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {forbiddenWords.map((word) => (
                              <Badge key={word} variant="secondary" className="gap-1 pr-1">
                                {word}
                                <button type="button" onClick={() => removeForbiddenWord(word)} className="ml-1 rounded-full hover:bg-muted p-0.5">
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Prompt do Sistema</Label>
                      <Textarea
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        className="min-h-[200px]"
                        placeholder="Instruções gerais para o agente de IA: como se comportar, regras, limites..."
                      />
                    </div>
                  </TabsContent>

                  {/* === CONHECIMENTO === */}
                  <TabsContent value="conhecimento" className="space-y-4">
                    <div className="space-y-2">
                      <Label>Base de Conhecimento</Label>
                      <Textarea
                        value={knowledgeBase}
                        onChange={(e) => setKnowledgeBase(e.target.value)}
                        className="min-h-[300px]"
                        placeholder="Tudo que o agente precisa saber: produto, preço, FAQ, diferenciais, objeções comuns, informações sobre a empresa..."
                      />
                      <p className="text-xs text-muted-foreground">Quanto mais completa a base, melhor a performance do agente.</p>
                    </div>
                  </TabsContent>

                  {/* === VENDAS === */}
                  <TabsContent value="vendas" className="space-y-4">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Técnicas de Venda</Label>
                        <Textarea
                          value={salesTechniques}
                          onChange={(e) => setSalesTechniques(e.target.value)}
                          className="min-h-[180px]"
                          placeholder="Descreva as técnicas de venda que o agente deve usar: SPIN Selling, rapport, escassez, prova social..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Perguntas de Qualificação</Label>
                        <Textarea
                          value={qualifyingQuestions}
                          onChange={(e) => setQualifyingQuestions(e.target.value)}
                          className="min-h-[180px]"
                          placeholder="Perguntas que o agente deve fazer para qualificar o lead: orçamento, prazo, decisor, necessidade..."
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Objeções e Respostas</Label>
                          <p className="text-sm text-muted-foreground">Cadastre respostas padrão para as objeções mais comuns.</p>
                        </div>
                        <Button type="button" variant="outline" onClick={addScriptObjection}>
                          <Plus className="mr-2 h-4 w-4" />Adicionar objeção
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {scriptObjections.map((item, index) => (
                          <Card key={item.id} className="border-border/60 bg-secondary/20">
                            <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr,1.5fr,auto] md:items-start">
                              <div className="space-y-2">
                                <Label>Objeção {index + 1}</Label>
                                <Input value={item.objection} onChange={(e) => updateScriptObjection(item.id, "objection", e.target.value)} placeholder="Ex: Tá caro" />
                              </div>
                              <div className="space-y-2">
                                <Label>Resposta</Label>
                                <Textarea value={item.response} onChange={(e) => updateScriptObjection(item.id, "response", e.target.value)} className="min-h-[90px]" />
                              </div>
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeScriptObjection(item.id)} className="mt-7">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                        {scriptObjections.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma objeção cadastrada.</p>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  {/* === EXEMPLOS === */}
                  <TabsContent value="exemplos" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Exemplos de Conversa</Label>
                        <p className="text-sm text-muted-foreground">Adicione pares de fala do lead + resposta ideal do agente para guiar o comportamento da IA.</p>
                      </div>
                      <Button type="button" variant="outline" onClick={addConversationExample}>
                        <Plus className="mr-2 h-4 w-4" />Adicionar Exemplo
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {conversationExamples.map((ex, index) => (
                        <Card key={ex.id} className="border-border/60 bg-secondary/20">
                          <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr,1fr,auto] md:items-start">
                            <div className="space-y-2">
                              <Label className="flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                Lead diz (exemplo {index + 1})
                              </Label>
                              <Textarea value={ex.lead_says} onChange={(e) => updateConversationExample(ex.id, "lead_says", e.target.value)} placeholder="O que o lead diria..." className="min-h-[80px]" />
                            </div>
                            <div className="space-y-2">
                              <Label className="flex items-center gap-1.5">
                                <Bot className="h-3.5 w-3.5 text-primary" />
                                Agente responde
                              </Label>
                              <Textarea value={ex.agent_responds} onChange={(e) => updateConversationExample(ex.id, "agent_responds", e.target.value)} placeholder="Resposta ideal do agente..." className="min-h-[80px]" />
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeConversationExample(ex.id)} className="mt-7">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                      {conversationExamples.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">Nenhum exemplo cadastrado. Clique em "+ Adicionar Exemplo" para começar.</p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Save button */}
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button onClick={saveScript} disabled={savingScript}>
                    {savingScript ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Salvar Treinamento
                  </Button>
                  <Button variant="secondary" onClick={testTrainingVoice} disabled={testingTrainingVoice || !selectedVoice}>
                    {testingTrainingVoice ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                    Testar Voz
                  </Button>
                </div>
                {trainingAudioUrl ? <audio controls className="w-full" src={trainingAudioUrl} /> : null}
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
            {/* Voice Clone Training Card */}
            <Card className="border-border/60 bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="h-5 w-5 text-primary" />
                  Treinar Nova Voz
                </CardTitle>
                <CardDescription>
                  Envie amostras de áudio para criar um clone de voz personalizado.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome da voz</Label>
                  <Input
                    value={voiceCloneForm.name}
                    onChange={(e) =>
                      setVoiceCloneForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Ex: Maria - Atendente"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Amostras de áudio</Label>
                  <div
                    className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/60 bg-secondary/20 p-6 transition-colors hover:border-primary/40"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Clique para enviar arquivos .wav ou .mp3
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Recomendado: 3-5 amostras de 30s a 2min cada
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".wav,.mp3,audio/wav,audio/mpeg"
                      multiple
                      className="hidden"
                      onChange={handleCloneFileChange}
                    />
                  </div>
                  {voiceCloneForm.files.length > 0 && (
                    <div className="space-y-2 pt-2">
                      {voiceCloneForm.files.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/20 px-3 py-2"
                        >
                          <div className="flex items-center gap-2 text-sm">
                            <AudioLines className="h-4 w-4 text-primary" />
                            <span className="truncate max-w-[200px]">{file.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({(file.size / 1024 / 1024).toFixed(1)} MB)
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removeCloneFile(index)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="lgpd-consent"
                    checked={voiceCloneForm.consentChecked}
                    onCheckedChange={(checked) =>
                      setVoiceCloneForm((prev) => ({
                        ...prev,
                        consentChecked: checked === true,
                      }))
                    }
                  />
                  <Label htmlFor="lgpd-consent" className="text-sm leading-relaxed">
                    Declaro que possuo autorização expressa do titular da voz para
                    utilização das amostras de áudio conforme a LGPD (Lei Geral de
                    Proteção de Dados).
                  </Label>
                </div>

                {voiceCloneForm.trainingStatus !== "idle" && (
                  <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/20 px-3 py-2">
                    {voiceCloneForm.trainingStatus === "uploading" && (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-sm">Enviando amostras...</span>
                      </>
                    )}
                    {voiceCloneForm.trainingStatus === "training" && (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                        <span className="text-sm">Treinamento em andamento...</span>
                      </>
                    )}
                    {voiceCloneForm.trainingStatus === "ready" && (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm">Voz pronta para uso!</span>
                      </>
                    )}
                    {voiceCloneForm.trainingStatus === "failed" && (
                      <>
                        <ShieldAlert className="h-4 w-4 text-red-500" />
                        <span className="text-sm">Erro no treinamento. Tente novamente.</span>
                      </>
                    )}
                  </div>
                )}

                <Button
                  onClick={submitVoiceClone}
                  disabled={
                    voiceCloneForm.uploading ||
                    !voiceCloneForm.name.trim() ||
                    voiceCloneForm.files.length === 0 ||
                    !voiceCloneForm.consentChecked
                  }
                >
                  {voiceCloneForm.uploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Enviar e Treinar
                </Button>
              </CardContent>
            </Card>
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
                {/* Hidden audio element for call playback */}
                <audio
                  ref={callAudioRef}
                  className="hidden"
                  onTimeUpdate={() => {
                    if (callAudioRef.current && callAudioRef.current.duration) {
                      setCallAudioProgress(
                        (callAudioRef.current.currentTime / callAudioRef.current.duration) * 100
                      );
                    }
                  }}
                  onEnded={() => {
                    setPlayingCallId(null);
                    setCallAudioProgress(0);
                  }}
                />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Voz</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Sentimento</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Player</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {callLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">Nenhum registro de ligação encontrado.</TableCell>
                      </TableRow>
                    ) : callLogs.map((log: any) => (
                      <>
                        <TableRow key={log.id} className={expandedCallId === log.id ? "border-b-0" : ""}>
                          <TableCell>{log.lead_phone || "—"}</TableCell>
                          <TableCell>{log.voice_key || "—"}</TableCell>
                          <TableCell><Badge variant="outline">{log.status || "—"}</Badge></TableCell>
                          <TableCell>{log.duration_sec ? `${log.duration_sec}s` : "—"}</TableCell>
                          <TableCell>
                            {log.lead_temperature ? (
                              <Badge variant="outline" className={
                                log.lead_temperature === "hot" ? "bg-red-500/20 text-red-400" :
                                log.lead_temperature === "warm" ? "bg-yellow-500/20 text-yellow-400" :
                                "bg-blue-500/20 text-blue-400"
                              }>{log.lead_temperature?.toUpperCase()}</Badge>
                            ) : (log.result || "—")}
                          </TableCell>
                          <TableCell>
                            {log.sentiment_overall ? (
                              <Badge variant="outline" className={
                                log.sentiment_overall === "positive" ? "bg-emerald-500/20 text-emerald-400" :
                                log.sentiment_overall === "negative" ? "bg-red-500/20 text-red-400" :
                                "bg-muted text-muted-foreground"
                              }>{log.sentiment_overall}</Badge>
                            ) : "—"}
                          </TableCell>
                          <TableCell>{formatDate(log.created_at)}</TableCell>
                          <TableCell>
                            {log.recording_url ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleCallPlayer(log.id)}
                              >
                                {expandedCallId === log.id ? (
                                  <Waves className="mr-1 h-4 w-4 text-primary" />
                                ) : (
                                  <Play className="mr-1 h-4 w-4" />
                                )}
                                {expandedCallId === log.id ? "Fechar" : "Player"}
                              </Button>
                            ) : "—"}
                          </TableCell>
                        </TableRow>
                        {expandedCallId === log.id && (
                          <TableRow key={`${log.id}-player`}>
                            <TableCell colSpan={8} className="bg-secondary/20 p-4">
                              <div className="space-y-4">
                                {/* Audio Player Bar */}
                                <div className="flex items-center gap-3">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 shrink-0"
                                    onClick={() => playCallAudio(log)}
                                  >
                                    {playingCallId === log.id ? (
                                      <Pause className="h-4 w-4" />
                                    ) : (
                                      <Play className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <div className="flex-1">
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                                      <div
                                        className="h-full rounded-full bg-primary transition-all"
                                        style={{
                                          width: `${playingCallId === log.id ? callAudioProgress : 0}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                  <span className="text-xs text-muted-foreground shrink-0">
                                    {log.duration_sec ? `${Math.floor(log.duration_sec / 60)}:${String(log.duration_sec % 60).padStart(2, "0")}` : "0:00"}
                                  </span>
                                </div>

                                {/* Transcription */}
                                {log.ai_transcript && Array.isArray(log.ai_transcript) && log.ai_transcript.length > 0 ? (
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Transcrição</Label>
                                    <ScrollArea className="h-[200px] rounded-lg border border-border/60 bg-card p-3">
                                      <div className="space-y-2">
                                        {log.ai_transcript.map((segment: any, idx: number) => (
                                          <div
                                            key={idx}
                                            className={`rounded-lg px-3 py-2 text-sm ${
                                              segment.role === "ai"
                                                ? "bg-primary/10 text-foreground"
                                                : "bg-secondary text-foreground"
                                            }`}
                                          >
                                            <span className="font-semibold text-xs">
                                              {segment.role === "ai" ? "IA" : "Lead"}
                                            </span>
                                            {segment.timestamp && (
                                              <span className="ml-2 text-xs text-muted-foreground">
                                                {new Date(segment.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                              </span>
                                            )}
                                            <p className="mt-0.5">{segment.text}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </ScrollArea>
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">Sem transcrição disponível para esta ligação.</p>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ SIMULATOR TAB ============ */}
          <TabsContent value="simulador" className="space-y-6">
            <CallSimulator
              voiceProfiles={voiceProfiles}
              selectedVoice={selectedVoice}
              training={{
                aiSellerName: trainingForm.aiSellerName,
                product: trainingForm.product,
                voiceTone: trainingForm.voiceTone,
                callGoal: trainingForm.callGoal,
                openingScript: trainingForm.openingScript,
                developmentScript: trainingForm.developmentScript,
                closingScript: trainingForm.closingScript,
                rules: trainingForm.rules,
                objections: trainingForm.objections,
              }}
            />
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
