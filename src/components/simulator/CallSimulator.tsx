import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, Mic, MicOff, PhoneCall, RotateCcw, Send, Volume2 } from "lucide-react";

// ── Types ──

type SimMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: string;
  audioUrl?: string;
};

type CallPhase = "idle" | "ringing" | "connected" | "ai_speaking" | "listening" | "processing" | "ended";
type ProcessingStage = "transcribing" | "thinking" | "synthesizing" | "slow" | null;

type VoiceProfile = { id: string; voice_key: string; name: string };
type LLMProvider = { id: string; name: string; available: boolean };

interface TrainingContext {
  aiSellerName: string;
  product: string;
  voiceTone: string;
  callGoal: string;
  openingScript: string;
  developmentScript: string;
  closingScript: string;
  rules: string;
  objections: { objection: string; response: string }[];
}

interface CallSimulatorProps {
  voiceProfiles: VoiceProfile[];
  selectedVoice: string;
  training: TrainingContext;
}

// ── Helpers ──

function formatTime(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function now() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function buildSystemPrompt(t: TrainingContext): string {
  let p = `Você é ${t.aiSellerName}, um vendedor(a) de ${t.product} em uma ligação telefônica.`;
  p += `\nTom de voz: ${t.voiceTone}. Objetivo: ${t.callGoal}.`;
  p += `\n\nScript de abertura: ${t.openingScript}`;
  p += `\nScript de desenvolvimento: ${t.developmentScript}`;
  p += `\nScript de fechamento: ${t.closingScript}`;
  p += `\nRegras: ${t.rules}`;
  if (t.objections.length > 0) {
    p += `\n\nObjeções:`;
    for (const o of t.objections) {
      if (o.objection) p += `\n- "${o.objection}": ${o.response}`;
    }
  }
  p += `\n\nIMPORTANTE:\n- Fale em português brasileiro natural.\n- Respostas naturais de 2-4 frases, seja conversacional.\n- NÃO use markdown, emojis ou formatação.\n- Fale como numa conversa por telefone.\n- NUNCA repita a saudação se já se apresentou.\n- Mantenha o contexto de TODA a conversa anterior.`;
  return p;
}

const STAGE_LABELS: Record<string, string> = {
  transcribing: "Processando fala...",
  thinking: "Gerando resposta...",
  synthesizing: "Sintetizando voz...",
  slow: "Processamento demorado, aguarde...",
};

const DEFAULT_PROVIDERS: LLMProvider[] = [
  { id: "groq", name: "Groq (LLaMA 3.3 70B) - Rápido", available: true },
  { id: "openai", name: "OpenAI (GPT-4o-mini)", available: true },
  { id: "claude", name: "Claude (Sonnet 4) - Inteligente", available: true },
];

const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjYWR1endhdXRscHpwdmpvZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMDQ1MTcsImV4cCI6MjA4ODU4MDUxN30.LinR7PIoK7n79hWjbSJ3EgDwA_y6uN-HfQnOk7GgYi4";
const API_URL = "https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/ai-simulator";

// ── Component ──

export default function CallSimulator({ voiceProfiles, selectedVoice, training }: CallSimulatorProps) {
  const [voiceKey, setVoiceKey] = useState(selectedVoice || "");
  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [useText, setUseText] = useState(false);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>(null);
  const [llmProvider, setLlmProvider] = useState<string>("groq");
  const [providers, setProviders] = useState<LLMProvider[]>(DEFAULT_PROVIDERS);
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [micActive, setMicActive] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const messagesRef = useRef<SimMessage[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<CallPhase>("idle");
  const loadingRef = useRef(false);

  // Speech recognition — THE primary input method
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTextRef = useRef<string>("");

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, liveTranscript]);

  // Fetch providers
  useEffect(() => {
    (async () => {
      try {
        const headers = await getAuthHeaders();
        headers["Content-Type"] = "application/json";
        const res = await fetch(API_URL, {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "list-providers" }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.providers) setProviders(data.providers);
        }
      } catch { /* keep defaults */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      stopRecognition();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Auth ──

  async function getAuthHeaders(): Promise<Record<string, string>> {
    const session = await supabase.auth.getSession();
    const h: Record<string, string> = { apikey: ANON_KEY };
    if (session.data.session?.access_token) {
      h.Authorization = `Bearer ${session.data.session.access_token}`;
    }
    return h;
  }

  // ── Speech Recognition: continuous, handles everything ──

  function startRecognition() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Seu navegador não suporta reconhecimento de voz. Use Chrome.");
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* */ }
    }

    const recognition = new SR();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }

      // Show live transcript
      setLiveTranscript(interimText || finalText);

      if (finalText.trim().length > 2) {
        // Clear any pending silence timer
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        // Accumulate text (user might speak in multiple segments)
        pendingTextRef.current += (pendingTextRef.current ? " " : "") + finalText.trim();

        // Wait 1.2s of silence after final result before sending
        // This lets the user finish their full thought
        silenceTimerRef.current = setTimeout(() => {
          const text = pendingTextRef.current.trim();
          pendingTextRef.current = "";
          if (text.length > 2 && !loadingRef.current && phaseRef.current !== "ended") {
            setLiveTranscript("");
            // If AI is speaking, interrupt it
            if (phaseRef.current === "ai_speaking" && audioRef.current) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
              audioRef.current.onended = null;
            }
            sendVoiceText(text);
          }
        }, 1200);
      }
    };

    recognition.onerror = (e: any) => {
      console.log("[recognition error]", e.error);
      if (e.error === "not-allowed") {
        toast.error("Permissão do microfone negada.");
        setMicActive(false);
        return;
      }
      // Auto-restart on other errors
      if (phaseRef.current !== "ended" && phaseRef.current !== "idle") {
        setTimeout(() => {
          if (phaseRef.current !== "ended" && phaseRef.current !== "idle") {
            try { recognitionRef.current?.start(); } catch { /* */ }
          }
        }, 500);
      }
    };

    recognition.onend = () => {
      // Auto-restart if call is still active
      if (phaseRef.current !== "ended" && phaseRef.current !== "idle" && recognitionRef.current) {
        try { recognitionRef.current.start(); } catch { /* */ }
      } else {
        setMicActive(false);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setMicActive(true);
    } catch {
      toast.error("Erro ao iniciar microfone.");
    }
  }

  function stopRecognition() {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    pendingTextRef.current = "";
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* */ }
      recognitionRef.current = null;
    }
    setMicActive(false);
    setLiveTranscript("");
  }

  // ── Processing stages ──

  function startProcessingStages() {
    setProcessingStage("transcribing");
    const t1 = setTimeout(() => setProcessingStage("thinking"), 1500);
    const t2 = setTimeout(() => setProcessingStage("synthesizing"), 4000);
    const t3 = setTimeout(() => setProcessingStage("slow"), 12000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }

  // ── Send voice text (from speech recognition) ──

  async function sendVoiceText(text: string) {
    const userMsg: SimMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: now(),
    };

    const updated = [...messagesRef.current, userMsg];
    setMessages(updated);
    setPhase("processing");
    setLoading(true);
    const cleanupStages = startProcessingStages();

    try {
      const headers = await getAuthHeaders();
      headers["Content-Type"] = "application/json";

      const res = await fetch(API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "respond",
          text,
          system_prompt: buildSystemPrompt(training),
          voice_key: voiceKey || selectedVoice || "default",
          llm_provider: llmProvider,
          history: updated.map((m) => ({ role: m.role, text: m.content })),
          context: {
            vendor_name: training.aiSellerName,
            product: training.product,
            tone: training.voiceTone,
            objective: training.callGoal,
          },
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Erro na simulação");

      handleAIResponse(result);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro na simulação");
      setPhase("listening");
    } finally {
      setLoading(false);
      setProcessingStage(null);
      cleanupStages();
    }
  }

  // ── Send typed text ──

  async function sendText() {
    const text = textInput.trim();
    if (!text || loading) return;
    setTextInput("");
    await sendVoiceText(text);
  }

  // ── Handle AI response ──

  function handleAIResponse(result: Record<string, string | boolean | null>) {
    const ts = now();
    const agentText = (result.text || result.response || "") as string;
    const agentAudio = (result.audioUrl || result.audio_url
      || (result.audio ? `data:audio/mpeg;base64,${result.audio}` : undefined)
      || (result.audioData ? `data:audio/mpeg;base64,${result.audioData}` : undefined)
      || (result.audio_base64 ? `data:audio/mpeg;base64,${result.audio_base64}` : undefined)) as string | undefined;

    if (agentText) {
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: "agent",
        content: agentText,
        timestamp: ts,
        audioUrl: agentAudio || undefined,
      }]);
    }

    if (agentAudio && audioRef.current) {
      setPhase("ai_speaking");
      audioRef.current.src = agentAudio;
      audioRef.current.onended = () => {
        if (phaseRef.current !== "ended") {
          setPhase("listening");
        }
      };
      audioRef.current.onerror = () => setPhase("listening");
      audioRef.current.play().catch(() => setPhase("listening"));
    } else {
      setPhase("listening");
    }
  }

  // ── Start call ──

  async function startCall() {
    if (!voiceKey && !selectedVoice) {
      toast.error("Selecione uma voz antes de iniciar.");
      return;
    }

    setPhase("ringing");
    setMessages([]);
    setDuration(0);

    // Start speech recognition — this is the mic
    startRecognition();

    await new Promise((r) => setTimeout(r, 500));
    setPhase("connected");

    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);

    setPhase("ai_speaking");
    setLoading(true);

    try {
      const headers = await getAuthHeaders();
      headers["Content-Type"] = "application/json";

      const res = await fetch(API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "start",
          voice_key: voiceKey || selectedVoice || "default",
          script: training.openingScript || "",
          llm_provider: llmProvider,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Erro ao iniciar");

      handleAIResponse(result);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro ao iniciar chamada");
      setPhase("idle");
      stopRecognition();
    } finally {
      setLoading(false);
    }
  }

  // ── End call ──

  function endCall() {
    setPhase("ended");
    if (timerRef.current) clearInterval(timerRef.current);
    stopRecognition();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }

  function resetCall() {
    endCall();
    setPhase("idle");
    setMessages([]);
    setDuration(0);
    setLiveTranscript("");
  }

  function replayAudio(msg: SimMessage) {
    if (msg.audioUrl && audioRef.current) {
      audioRef.current.src = msg.audioUrl;
      audioRef.current.play().catch(() => {});
    }
  }

  // ── Render ──

  const agentName = training.aiSellerName || "Lucas";

  // PRE-CALL
  if (phase === "idle") {
    return (
      <Card className="border-border/60 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-primary" />
            Simulador de Ligação IA
          </CardTitle>
          <CardDescription>
            Simule uma ligação real com o Agente IA. Fale naturalmente — o microfone fica aberto e reconhece sua voz automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Voz do Agente</Label>
              <Select value={voiceKey || selectedVoice} onValueChange={setVoiceKey}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Selecione uma voz" />
                </SelectTrigger>
                <SelectContent>
                  {voiceProfiles.map((v) => (
                    <SelectItem key={v.id} value={v.voice_key}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Modelo de IA</Label>
              <Select value={llmProvider} onValueChange={setLlmProvider}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Selecione o modelo" />
                </SelectTrigger>
                <SelectContent>
                  {providers.filter(p => p.available).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Vendedor: {agentName}</Badge>
            <Badge variant="outline">Produto: {training.product}</Badge>
            <Badge variant="outline">Tom: {training.voiceTone}</Badge>
            <Badge variant="outline">Objetivo: {training.callGoal}</Badge>
          </div>
          <Button size="lg" className="w-full" onClick={startCall}>
            <PhoneCall className="mr-2 h-5 w-5" />
            Iniciar Ligação Simulada
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ACTIVE CALL / ENDED
  return (
    <>
      <Card className="border-border/60 bg-card overflow-hidden">
        {/* Status bar */}
        <div className={`px-6 py-3 flex items-center justify-between ${
          phase === "ended" ? "bg-muted" :
          phase === "ringing" ? "bg-yellow-500/10" : "bg-green-500/10"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${
              phase === "ended" ? "bg-muted-foreground" :
              phase === "ringing" ? "bg-yellow-500 animate-pulse" : "bg-green-500 animate-pulse"
            }`} />
            <span className="font-semibold text-sm">
              {phase === "ringing" && "Chamando..."}
              {phase === "connected" && "Conectado"}
              {phase === "ai_speaking" && `${agentName} falando...`}
              {phase === "listening" && "Fale agora..."}
              {phase === "processing" && (processingStage ? STAGE_LABELS[processingStage] : "Processando...")}
              {phase === "ended" && "Chamada encerrada"}
            </span>
            {micActive && phase !== "ended" && (
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Mic className="h-3 w-3 text-red-500 animate-pulse" />
                Mic ativo
              </Badge>
            )}
            {phase !== "ended" && phase !== "idle" && phase !== "ringing" && (
              <Badge variant="secondary" className="text-[10px]">
                {providers.find(p => p.id === llmProvider)?.name || llmProvider}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-mono text-muted-foreground">{formatTime(duration)}</span>
            {phase !== "ended" ? (
              <Button variant="destructive" size="sm" onClick={endCall}>
                <PhoneCall className="mr-1 h-4 w-4 rotate-[135deg]" />
                Desligar
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={resetCall}>
                <RotateCcw className="mr-1 h-4 w-4" />
                Nova ligação
              </Button>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div ref={scrollRef} className="h-[400px] overflow-y-auto p-4 space-y-3 bg-secondary/5">
          {phase === "ringing" && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center space-y-3">
                <div className="mx-auto h-16 w-16 rounded-full bg-yellow-500/10 flex items-center justify-center">
                  <PhoneCall className="h-8 w-8 text-yellow-500 animate-pulse" />
                </div>
                <p className="text-muted-foreground text-sm">Chamando lead simulado...</p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-card border border-border/60 text-foreground rounded-bl-md"
              }`}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold opacity-80">
                    {msg.role === "user" ? "Você (Lead)" : `${agentName} (IA)`}
                  </span>
                  <span className="text-xs opacity-50">{msg.timestamp}</span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                {msg.role === "agent" && msg.audioUrl && (
                  <Button variant="ghost" size="sm"
                    className="mt-1 h-7 px-2 text-xs opacity-70 hover:opacity-100"
                    onClick={() => replayAudio(msg)}>
                    <Volume2 className="mr-1 h-3 w-3" /> Ouvir novamente
                  </Button>
                )}
              </div>
            </div>
          ))}

          {/* Live transcription bubble */}
          {liveTranscript && (phase === "listening" || phase === "ai_speaking") && (
            <div className="flex justify-end">
              <div className="max-w-[75%] rounded-2xl px-4 py-2.5 bg-primary/30 text-primary-foreground rounded-br-md border border-primary/40">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold opacity-80">Você (ao vivo)</span>
                  <Mic className="h-3 w-3 animate-pulse text-red-400" />
                </div>
                <p className="text-sm leading-relaxed italic opacity-80">{liveTranscript}</p>
              </div>
            </div>
          )}

          {(loading || phase === "processing") && (
            <div className="flex justify-start">
              <div className="bg-card border border-border/60 rounded-2xl rounded-bl-md px-4 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {processingStage ? STAGE_LABELS[processingStage] : "Processando..."}
                  </span>
                </div>
                {processingStage && (
                  <Progress
                    value={
                      processingStage === "transcribing" ? 25 :
                      processingStage === "thinking" ? 55 :
                      processingStage === "synthesizing" ? 80 :
                      processingStage === "slow" ? 90 : 10
                    }
                    className="h-1.5 w-40"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        {phase !== "ended" && phase !== "ringing" && (
          <div className="border-t border-border/60 p-4">
            {!useText ? (
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs text-muted-foreground">
                  {phase === "ai_speaking" ? "Fale a qualquer momento para interromper" :
                   phase === "processing" ? "Processando..." :
                   loading ? "Aguarde..." :
                   "Microfone aberto — fale naturalmente"}
                </p>

                <div className="flex items-center gap-3">
                  <div className={`h-16 w-16 rounded-full flex items-center justify-center transition-all ${
                    micActive
                      ? "bg-green-500/20 ring-2 ring-green-500/50"
                      : "bg-muted"
                  }`}>
                    {micActive ? (
                      <Mic className="h-6 w-6 text-green-500 animate-pulse" />
                    ) : (
                      <MicOff className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                </div>
                <button className="text-xs text-muted-foreground underline" onClick={() => setUseText(true)}>
                  Ou digite texto
                </button>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); sendText(); }} className="flex gap-2">
                <Input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Fale como o lead responderia..."
                  disabled={loading || phase === "ai_speaking"}
                  className="flex-1"
                />
                <Button type="submit" disabled={!textInput.trim() || loading} size="icon">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
                <button type="button" className="text-xs text-muted-foreground underline px-2"
                  onClick={() => setUseText(false)}>
                  Usar mic
                </button>
              </form>
            )}
          </div>
        )}

        {/* Post-call summary */}
        {phase === "ended" && messages.length > 0 && (
          <div className="border-t border-border/60 p-4 bg-secondary/10">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge>Duração: {formatTime(duration)}</Badge>
              <Badge variant="outline">{messages.filter((m) => m.role === "agent").length} falas da IA</Badge>
              <Badge variant="outline">{messages.filter((m) => m.role === "user").length} falas do lead</Badge>
              <Badge variant="outline">
                Voz: {voiceProfiles.find((v) => v.voice_key === (voiceKey || selectedVoice))?.name || "—"}
              </Badge>
              <Badge variant="outline">
                Modelo: {providers.find(p => p.id === llmProvider)?.name || llmProvider}
              </Badge>
            </div>
          </div>
        )}
      </Card>

      <audio ref={audioRef} className="hidden" />
    </>
  );
}
