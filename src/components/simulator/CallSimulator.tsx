import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
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

type ProcessingStage = "transcribing" | "thinking" | "synthesizing" | "slow" | null;

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

// ── Constants ──

const SILENCE_THRESHOLD_DB = -50;
const SILENCE_DURATION_MS = 500;
const MIN_RECORDING_MS = 800;
const MAX_RECORDING_MS = 60000;
const LOW_VOLUME_WARN_MS = 5000;
const SPEECH_DETECTED_DB = -48;

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

const STAGE_LABELS: Record<string, string> = {
  transcribing: "Transcrevendo áudio...",
  thinking: "Gerando resposta...",
  synthesizing: "Sintetizando voz...",
  slow: "Processamento demorado, aguarde...",
};

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
  const [recDuration, setRecDuration] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [lowVolumeWarn, setLowVolumeWarn] = useState(false);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<CallPhase>("idle");

  // Web Audio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const lowVolStartRef = useRef<number | null>(null);
  const recStartTimeRef = useRef<number>(0);
  const animFrameRef = useRef<number>(0);
  const speechDetectedRef = useRef(false);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // ── AUTO-START recording when phase becomes "listening" (hands-free mode) ──
  const autoStartRef = useRef(false);
  const startRecordingRef = useRef<() => void>(() => {});

  useEffect(() => {
    return () => {
      releaseMic();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mic helpers ──

  const releaseMic = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    if (recorderRef.current?.state !== "inactive") {
      try { recorderRef.current?.stop(); } catch { /* */ }
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current?.state !== "closed") {
      try { audioCtxRef.current?.close(); } catch { /* */ }
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    gainNodeRef.current = null;
    silenceStartRef.current = null;
    lowVolStartRef.current = null;
    setRecording(false);
    setRecDuration(0);
    setVolumeLevel(0);
    setLowVolumeWarn(false);
  }, []);

  const stopAndSendRecording = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    setRecording(false);
    setRecDuration(0);
    setVolumeLevel(0);
    setLowVolumeWarn(false);
  }, []);

  const monitorAudio = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const dataArray = new Float32Array(analyser.fftSize);

    const loop = () => {
      if (!analyserRef.current) return;
      analyser.getFloatTimeDomainData(dataArray);

      // Calculate RMS → dB
      let sumSq = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sumSq += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sumSq / dataArray.length);
      const db = rms > 0 ? 20 * Math.log10(rms) : -100;

      // Normalize volume 0-100 for display (map -60dB..0dB → 0..100)
      const normalized = Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
      setVolumeLevel(normalized);

      const elapsed = Date.now() - recStartTimeRef.current;
      const isAboveThreshold = db > SILENCE_THRESHOLD_DB;
      const isSpeech = db > SPEECH_DETECTED_DB;

      // Track if speech was ever detected in this recording
      if (isSpeech && !speechDetectedRef.current) {
        speechDetectedRef.current = true;
      }

      // Low volume warning — only below 5% (very quiet)
      if (normalized < 5) {
        if (!lowVolStartRef.current) lowVolStartRef.current = Date.now();
        if (Date.now() - lowVolStartRef.current > LOW_VOLUME_WARN_MS) {
          setLowVolumeWarn(true);
        }
      } else {
        lowVolStartRef.current = null;
        setLowVolumeWarn(false);
      }

      // Silence detection — only after MIN_RECORDING_MS
      if (elapsed >= MIN_RECORDING_MS) {
        if (isAboveThreshold) {
          // Voice detected → reset silence timer
          silenceStartRef.current = null;
        } else {
          if (!silenceStartRef.current) {
            silenceStartRef.current = Date.now();
          } else if (Date.now() - silenceStartRef.current >= SILENCE_DURATION_MS && speechDetectedRef.current) {
            // 1.5s consecutive silence after speech detected → auto-stop and send
            stopAndSendRecording();
            return;
          }
        }
      }

      // Max recording safety limit
      if (elapsed >= MAX_RECORDING_MS) {
        stopAndSendRecording();
        return;
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
  }, [stopAndSendRecording]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;
      chunksRef.current = [];
      silenceStartRef.current = null;
      lowVolStartRef.current = null;
      speechDetectedRef.current = false;
      recStartTimeRef.current = Date.now();

      // Web Audio API setup for monitoring + gain
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;
      analyserRef.current = analyser;

      // Gain node for audio normalization (boost input by 1.5x)
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 1.5;
      gainNodeRef.current = gainNode;

      source.connect(gainNode);
      gainNode.connect(analyser);
      // Note: we don't connect analyser to destination (no feedback)

      // Determine MIME type
      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/webm";
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = "audio/wav";
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (recTimerRef.current) clearInterval(recTimerRef.current);

        const blob = new Blob(chunksRef.current, { type: mimeType });
        // Release mic immediately
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (audioCtxRef.current?.state !== "closed") {
          try { audioCtxRef.current?.close(); } catch { /* */ }
        }
        audioCtxRef.current = null;

        const recElapsed = Date.now() - recStartTimeRef.current;
        if (blob.size > 0 && speechDetectedRef.current && phaseRef.current !== "ended") {
          sendAudio(blob);
        } else if (!speechDetectedRef.current && recElapsed >= MIN_RECORDING_MS) {
          // Long recording but no speech — restart listening
          if (phaseRef.current !== "ended" && autoStartRef.current) {
            goListening(); // triggers auto-restart
          } else if (phaseRef.current !== "ended") {
            toast.info("Nenhuma fala detectada. Tente novamente.");
            goListening();
          }
        } else if (recElapsed < MIN_RECORDING_MS && !speechDetectedRef.current) {
          if (phaseRef.current !== "ended") goListening();
        }
      };

      recorder.start(250);
      setRecording(true);
      setRecDuration(0);

      // Recording duration timer
      recTimerRef.current = setInterval(() => {
        setRecDuration((d) => d + 1);
      }, 1000);

      // Start audio monitoring loop
      monitorAudio();
    } catch {
      toast.error("Não foi possível acessar o microfone.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monitorAudio]);

  // Keep ref in sync for auto-start
  startRecordingRef.current = startRecording;

  // VAD during AI playback — detect user speaking and interrupt
  const vadStreamRef = useRef<MediaStream | null>(null);
  const vadFrameRef = useRef<number>(0);

  function startVADDuringPlayback() {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      vadStreamRef.current = stream;
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);

      const data = new Float32Array(analyser.fftSize);
      let speechFrames = 0;

      const check = () => {
        if (phaseRef.current !== "ai_speaking") {
          stream.getTracks().forEach(t => t.stop());
          ctx.close().catch(() => {});
          vadStreamRef.current = null;
          return;
        }
        analyser.getFloatTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const db = 20 * Math.log10(Math.sqrt(sum / data.length) || 1e-10);

        if (db > -35) {
          speechFrames++;
          if (speechFrames > 10) { // ~170ms of speech detected → interrupt
            stream.getTracks().forEach(t => t.stop());
            ctx.close().catch(() => {});
            vadStreamRef.current = null;
            // Interrupt AI and start recording
            if (audioRef.current && !audioRef.current.paused) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
              audioRef.current.onended = null;
            }
            setPhase("listening");
            startRecordingRef.current();
            return;
          }
        } else {
          speechFrames = Math.max(0, speechFrames - 1);
        }
        vadFrameRef.current = requestAnimationFrame(check);
      };
      vadFrameRef.current = requestAnimationFrame(check);
    }).catch(() => {}); // mic permission denied — ignore
  }

  // Helper: go to listening phase and auto-start mic if hands-free
  function goListening() {
    setPhase("listening");
    if (autoStartRef.current) {
      setTimeout(() => {
        if (phaseRef.current === "listening" && !recorderRef.current) {
          startRecordingRef.current();
        }
      }, 400);
    }
  }

  const toggleRecording = useCallback(() => {
    if (recording) {
      stopAndSendRecording();
    } else {
      // Interrupt AI speaking immediately
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.onended = null; // prevent goListening from firing
      }
      setPhase("listening");
      startRecording();
    }
  }, [recording, stopAndSendRecording, startRecording]);

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

  // ── Processing stage simulation ──

  function startProcessingStages() {
    setProcessingStage("transcribing");
    const t1 = setTimeout(() => setProcessingStage("thinking"), 3000);
    const t2 = setTimeout(() => setProcessingStage("synthesizing"), 7000);
    const t3 = setTimeout(() => setProcessingStage("slow"), 15000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }

  // ── Send audio as multipart/form-data ──

  async function sendAudio(blob: Blob) {
    setPhase("processing");
    setLoading(true);
    const cleanupStages = startProcessingStages();

    try {
      const formData = new FormData();
      formData.append("audio", blob, "audio.webm");
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
      const res = await fetch(API_URL, {
        method: "POST",
        headers,
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Erro na simulação");

      // Check for hallucination / no speech / silence
      if (result.silence === true) {
        // Silent recording — just go back to listening (no toast in hands-free mode)
        goListening();
        return;
      }
      if (result.hallucination === true || result.error === "No speech detected" || result.no_speech) {
        // Only show warning if user manually recorded (not hands-free)
        if (!autoStartRef.current) {
          toast.warning("Não consegui entender. Tente falar mais alto e próximo ao microfone.", { duration: 4000 });
        }
        goListening();
        return;
      }

      handleAIResponse(result);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro na simulação");
      goListening();
    } finally {
      setLoading(false);
      setProcessingStage(null);
      cleanupStages();
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
    const cleanupStages = startProcessingStages();

    try {
      const headers = await getAuthHeaders();
      headers["Content-Type"] = "application/json";

      const res = await fetch(API_URL, {
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

      handleAIResponse(result, true);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro na simulação");
      goListening();
    } finally {
      setLoading(false);
      setProcessingStage(null);
      cleanupStages();
    }
  }

  // ── Handle AI response ──

  function handleAIResponse(result: Record<string, string | boolean | null>, skipUserBubble = false) {
    const ts = now();
    const newMsgs: SimMessage[] = [];

    const userText = (result.user_text || result.lead_transcript) as string | undefined;
    if (userText && !skipUserBubble) {
      newMsgs.push({
        id: crypto.randomUUID(),
        role: "user",
        content: userText,
        timestamp: ts,
      });
    }

    const agentText = (result.text || result.response || "") as string;
    const agentAudio = (result.audioUrl || result.audio_url
      || (result.audio ? `data:audio/mpeg;base64,${result.audio}` : undefined)
      || (result.audioData ? `data:audio/mpeg;base64,${result.audioData}` : undefined)
      || (result.audio_base64 ? `data:audio/mpeg;base64,${result.audio_base64}` : undefined)) as string | undefined;

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

    if (agentAudio && audioRef.current) {
      setPhase("ai_speaking");
      audioRef.current.src = agentAudio;
      audioRef.current.onended = () => {
        if (phaseRef.current !== "ended") {
          goListening();
        }
      };
      audioRef.current.onerror = () => goListening();
      audioRef.current.play().catch(() => goListening());

      // Start listening for mic input during AI speech (for interruption)
      if (autoStartRef.current) {
        startVADDuringPlayback();
      }
    } else {
      goListening();
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
    autoStartRef.current = true; // Enable hands-free mode

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
          messages: [{ role: "lead", content: "(chamada atendida, o lead disse alô)" }],
          system_prompt: buildSystemPrompt(training),
          voice_key: voiceKey || selectedVoice || "default",
          script: training.openingScript || "",
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
    autoStartRef.current = false; // Disable hands-free mode
    setPhase("ended");
    if (timerRef.current) clearInterval(timerRef.current);
    releaseMic();
    // Cleanup VAD
    if (vadStreamRef.current) {
      vadStreamRef.current.getTracks().forEach(t => t.stop());
      vadStreamRef.current = null;
    }
    if (vadFrameRef.current) cancelAnimationFrame(vadFrameRef.current);
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
              {phase === "processing" && (processingStage ? STAGE_LABELS[processingStage] : "Processando...")}
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
                  {recording ? `Gravando... ${formatTime(recDuration)} — clique para enviar` :
                   phase === "ai_speaking" ? "Aguarde a IA terminar ou clique para interromper" :
                   phase === "processing" ? "Processando seu áudio..." :
                   "Clique para falar"}
                </p>

                {/* Volume meter */}
                {recording && (
                  <div className="w-48 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-100 ${
                            volumeLevel > 50 ? "bg-green-500" :
                            volumeLevel > 20 ? "bg-yellow-500" : "bg-red-500"
                          }`}
                          style={{ width: `${volumeLevel}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-8 text-right font-mono">
                        {Math.round(volumeLevel)}%
                      </span>
                    </div>
                    {lowVolumeWarn && (
                      <p className="text-[10px] text-yellow-500 text-center animate-pulse">
                        ⚠ Fale mais perto do microfone
                      </p>
                    )}
                  </div>
                )}

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
