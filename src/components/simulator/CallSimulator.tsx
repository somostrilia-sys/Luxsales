import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { EDGE_BASE } from "@/lib/constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Mic, PhoneCall, RotateCcw, Send, Volume2 } from "lucide-react";

// ── Types ──

type SimMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: string;
  audioUrl?: string;
};

type CallPhase = "idle" | "ringing" | "connected" | "ai_speaking" | "listening" | "processing" | "ended";

type VoiceProfile = {
  id: string;
  voice_key: string;
  name: string;
};

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
  p += `\n\nIMPORTANTE:\n- Fale em português brasileiro natural.\n- Respostas curtas: máximo 2-3 frases.\n- NÃO use markdown, emojis ou formatação.\n- Fale como numa conversa por telefone.`;
  return p;
}

// ── Component ──

export default function CallSimulator({ voiceProfiles, selectedVoice, training }: CallSimulatorProps) {
  const [voiceKey, setVoiceKey] = useState(selectedVoice || "");
  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [duration, setDuration] = useState(0);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [useText, setUseText] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<CallPhase>("idle");

  // Keep phaseRef in sync
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      releaseMic();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mic helpers ──

  const releaseMic = useCallback(() => {
    if (recorderRef.current?.state !== "inactive") {
      try { recorderRef.current?.stop(); } catch { /* */ }
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    setRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        const blob = new Blob(chunksRef.current, { type: "audio/webm;codecs=opus" });
        // Release mic immediately
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        if (blob.size > 0 && phaseRef.current !== "ended") {
          sendAudio(blob);
        }
      };

      recorder.start(250); // collect in 250ms chunks for silence detection
      setRecording(true);

      // 3-second silence auto-send
      silenceTimerRef.current = setTimeout(() => {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
          setRecording(false);
        }
      }, 3000);
    } catch {
      toast.error("Não foi possível acessar o microfone.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (recording) {
      stopRecording();
    } else {
      // If agent is speaking, interrupt
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      startRecording();
    }
  }, [recording, stopRecording, startRecording]);

  // ── Auth header ──

  const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjYWR1endhdXRscHpwdmpvZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMDQ1MTcsImV4cCI6MjA4ODU4MDUxN30.LinR7PIoK7n79hWjbSJ3EgDwA_y6uN-HfQnOk7GgYi4";
  const API_URL = "https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/ai-simulator";

  async function getAuthHeaders(): Promise<Record<string, string>> {
    const session = await supabase.auth.getSession();
    const h: Record<string, string> = { apikey: ANON_KEY };
    if (session.data.session?.access_token) {
      h.Authorization = `Bearer ${session.data.session.access_token}`;
    }
    return h;
  }

  // ── Send audio as multipart/form-data ──

  async function sendAudio(blob: Blob) {
    setPhase("processing");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      formData.append("voice_key", voiceKey || selectedVoice || "default");
      formData.append("system_prompt", buildSystemPrompt(training));
      formData.append("history", JSON.stringify(
        messages.map((m) => ({ role: m.role, text: m.content }))
      ));
      formData.append("context", JSON.stringify({
        vendor_name: training.aiSellerName,
        product: training.product,
        tone: training.voiceTone,
        objective: training.callGoal,
      }));

      const headers = await getAuthHeaders();
      const res = await fetch(`${EDGE_BASE}/ai-simulator`, {
        method: "POST",
        headers,
        body: formData,
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
    }
  }

  // ── Send text (fallback) ──

  async function sendText() {
    const text = textInput.trim();
    if (!text || loading) return;

    const userMsg: SimMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: now(),
    };

    const updated = [...messages, userMsg];
    setMessages(updated);
    setTextInput("");
    setPhase("processing");
    setLoading(true);

    try {
      const headers = await getAuthHeaders();
      headers["Content-Type"] = "application/json";

      const res = await fetch(`${EDGE_BASE}/ai-simulator`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: updated.map((m) => ({ role: m.role === "user" ? "lead" : "ai", content: m.content })),
          system_prompt: buildSystemPrompt(training),
          voice_key: voiceKey || selectedVoice || "default",
          text,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Erro na simulação");

      // Don't add user bubble again — already added above
      handleAIResponse(result, true);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro na simulação");
      setPhase("listening");
    } finally {
      setLoading(false);
    }
  }

  // ── Handle AI response ──

  function handleAIResponse(result: Record<string, string | null>, skipUserBubble = false) {
    const ts = now();
    const newMsgs: SimMessage[] = [];

    // User transcription bubble
    const userText = result.user_text || result.lead_transcript;
    if (userText && !skipUserBubble) {
      newMsgs.push({
        id: crypto.randomUUID(),
        role: "user",
        content: userText,
        timestamp: ts,
      });
    }

    // Agent response bubble
    const agentText = result.text || result.response || "";
    const agentAudio = result.audioUrl || result.audio_url
      || (result.audio_base64 ? `data:audio/mpeg;base64,${result.audio_base64}` : undefined);

    if (agentText) {
      newMsgs.push({
        id: crypto.randomUUID(),
        role: "agent",
        content: agentText,
        timestamp: ts,
        audioUrl: agentAudio || undefined,
      });
    }

    setMessages((prev) => [...prev, ...newMsgs]);

    // Play agent audio, then activate mic
    if (agentAudio && audioRef.current) {
      setPhase("ai_speaking");
      audioRef.current.src = agentAudio;
      audioRef.current.onended = () => {
        if (phaseRef.current !== "ended") {
          setPhase("listening");
        }
      };
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

    await new Promise((r) => setTimeout(r, 1500));
    setPhase("connected");

    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);

    // Agent opening
    setPhase("ai_speaking");
    setLoading(true);

    try {
      const headers = await getAuthHeaders();
      headers["Content-Type"] = "application/json";

      const res = await fetch(`${EDGE_BASE}/ai-simulator`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: [{ role: "lead", content: "(chamada atendida, o lead disse alô)" }],
          system_prompt: buildSystemPrompt(training),
          voice_key: voiceKey || selectedVoice || "default",
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Erro ao iniciar");

      handleAIResponse(result, true);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro ao iniciar chamada");
      setPhase("idle");
    } finally {
      setLoading(false);
    }
  }

  // ── End call ──

  function endCall() {
    setPhase("ended");
    if (timerRef.current) clearInterval(timerRef.current);
    releaseMic();
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
  }

  // ── Replay audio ──

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
            Simule uma ligação real com o Agente IA. Fale pelo microfone e ouça a resposta em áudio.
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
              {phase === "listening" && "Sua vez de falar"}
              {phase === "processing" && "Processando..."}
              {phase === "ended" && "Chamada encerrada"}
            </span>
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

          {(loading || phase === "processing") && (
            <div className="flex justify-start">
              <div className="bg-card border border-border/60 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {phase === "processing" ? "Transcrevendo e processando..." : "IA pensando..."}
                  </span>
                </div>
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
                  {recording ? "Gravando... clique para enviar" :
                   phase === "ai_speaking" ? "Aguarde a IA terminar ou clique para interromper" :
                   phase === "processing" ? "Processando seu áudio..." :
                   "Clique para falar"}
                </p>
                <Button
                  size="lg"
                  variant={recording ? "destructive" : "default"}
                  className={`h-16 w-16 rounded-full transition-all ${
                    recording ? "animate-pulse ring-4 ring-destructive/30" : ""
                  }`}
                  disabled={phase === "processing" || loading}
                  onClick={toggleRecording}
                >
                  <Mic className={`h-6 w-6 ${recording ? "text-white" : ""}`} />
                </Button>
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
            </div>
          </div>
        )}
      </Card>

      <audio ref={audioRef} className="hidden" />
    </>
  );
}
