import { useEffect, useState, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { EDGE_BASE } from "@/lib/constants";
import { toast } from "sonner";
import {
  Loader2, Phone, PhoneOff, Mic, MicOff, Settings, Volume2,
  AlertTriangle, CheckCircle, XCircle, Save,
} from "lucide-react";

const FALLBACK_COMPANY_ID = "d33b6a84-8f72-4441-b2eb-dd151a31ac12";

interface TranscriptEntry {
  type: "lead" | "ai" | "system";
  text: string;
  ts: string;
}

declare const JsSIP: any;

// ── Web Speech API types ──
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: { [key: number]: { [key: number]: { transcript: string }; isFinal: boolean }; length: number };
}

export default function VoiceSimulate() {
  const { collaborator } = useCollaborator();
  const { selectedCompanyId } = useCompanyFilter();
  const companyId = (selectedCompanyId && selectedCompanyId !== "all") ? selectedCompanyId : (collaborator?.company_id || FALLBACK_COMPANY_ID);

  const [mode, setMode] = useState<"browser" | "voip">("browser");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [inCall, setInCall] = useState(false);
  const [callTimer, setCallTimer] = useState(0);
  const [phoneNumber, setPhoneNumber] = useState("5531997441277");
  const [listening, setListening] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);

  // VoIP config
  const [sipHost, setSipHost] = useState("");
  const [sipPort, setSipPort] = useState("5060");
  const [sipUser, setSipUser] = useState("");
  const [sipPass, setSipPass] = useState("");
  const [sipTransport, setSipTransport] = useState("WSS");
  const [sipConnected, setSipConnected] = useState(false);
  const [savingSip, setSavingSip] = useState(false);
  const [loadingSip, setLoadingSip] = useState(true);

  // Pipeline
  const [pipelineOnline, setPipelineOnline] = useState<boolean | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsPlayingRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const uaRef = useRef<any>(null);
  const sessionRef = useRef<any>(null);
  const conversationRef = useRef<{ role: string; content: string }[]>([]);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgAudioCtxRef = useRef<AudioContext | null>(null);

  // ── Load SIP config from DB ──
  useEffect(() => {
    const load = async () => {
      setLoadingSip(true);
      const { data } = await supabase
        .from("sip_trunks")
        .select("host, port, username, password, transport")
        .eq("company_id", companyId)
        .maybeSingle();
      if (data) {
        setSipHost(data.host || "");
        setSipPort(data.port?.toString() || "5060");
        setSipUser(data.username || "");
        setSipPass(data.password || "");
        setSipTransport(data.transport || "WSS");
      }
      setLoadingSip(false);
    };
    load();
  }, [companyId]);

  // ── Save SIP config ──
  const saveSipConfig = async () => {
    if (!sipHost || !sipUser) {
      toast.error("Preencha host e usuário");
      return;
    }
    setSavingSip(true);
    const { error } = await supabase.from("sip_trunks").upsert({
      company_id: companyId,
      host: sipHost,
      port: parseInt(sipPort) || 5060,
      username: sipUser,
      password: sipPass,
      transport: sipTransport,
      provider: "custom",
      max_channels: 10,
    }, { onConflict: "company_id" });
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Configuração VoIP salva");
    }
    setSavingSip(false);
  };

  // ── Health check for pipeline ──
  const checkHealth = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${EDGE_BASE}/orchestrator-proxy?path=${encodeURIComponent("/health")}`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "",
        },
      });
      setPipelineOnline(res.ok);
    } catch {
      setPipelineOnline(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const iv = setInterval(checkHealth, 15000);
    return () => clearInterval(iv);
  }, [checkHealth]);

  // ── Auto-scroll transcript ──
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript]);

  const addSystem = useCallback((text: string) => {
    setTranscript((prev) => [...prev, { type: "system", text, ts: new Date().toLocaleTimeString("pt-BR") }]);
  }, []);

  const addEntry = useCallback((type: "lead" | "ai", text: string) => {
    setTranscript((prev) => [...prev, { type, text, ts: new Date().toLocaleTimeString("pt-BR") }]);
  }, []);

  // ══════════════════════════════════════════════
  // ── MODO BROWSER: Web Speech + AI Simulator ──
  // ══════════════════════════════════════════════

  // Limpar markdown e artefatos para fala natural
  const cleanForTTS = (text: string): string => {
    return text
      .replace(/\*\*([^*]+)\*\*/g, "$1")     // **bold** → bold
      .replace(/\*([^*]+)\*/g, "$1")          // *italic* → italic
      .replace(/#{1,6}\s/g, "")               // # headers
      .replace(/[-•]\s/g, "")                 // bullets
      .replace(/\n{2,}/g, ". ")               // double newlines → period
      .replace(/\n/g, ", ")                   // single newline → comma
      .replace(/[`_~]/g, "")                 // backticks, underscores
      .replace(/\s{2,}/g, " ")               // multiple spaces
      .replace(/\bponto\b/gi, "")            // remove "ponto" solto
      .replace(/\bvírgula\b/gi, "")          // remove "vírgula" solto
      .replace(/\bdois pontos\b/gi, "")      // remove "dois pontos"
      .replace(/\bexclamação\b/gi, "")       // remove "exclamação"
      .replace(/\binterrogação\b/gi, "")     // remove "interrogação"
      .replace(/\s{2,}/g, " ")               // cleanup espaços novamente
      .trim();
  };

  // Pausar mic, tocar áudio XTTS, retomar mic
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  const playXTTS = useCallback(async (text: string) => {
    // Pausar Speech Recognition enquanto TTS toca
    ttsPlayingRef.current = true;
    try { recognitionRef.current?.stop(); } catch {}
    setListening(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${EDGE_BASE}/ai-simulator`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "",
        },
        body: JSON.stringify({ action: "tts", text, tts_url: "http://134.122.17.106/api/tts" }),
      });
      if (!res.ok) throw new Error(`TTS ${res.status}`);
      const data = await res.json();
      if (data.audio) {
        const byteChars = atob(data.audio);
        const byteArray = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArray], { type: "audio/wav" });
        const url = URL.createObjectURL(blob);

        // Criar novo Audio element dedicado para TTS (não reusar audioRef)
        await new Promise<void>((resolve) => {
          const audio = new Audio(url);
          audio.volume = 1.0;
          ttsAudioRef.current = audio;
          audio.onended = () => {
            URL.revokeObjectURL(url);
            resolve();
          };
          audio.onerror = () => resolve();
          audio.play().catch(() => resolve());
          // Safety timeout
          setTimeout(resolve, 20000);
        });
      }
    } catch (err) {
      console.error("XTTS error:", err);
    }

    // Retomar mic após TTS terminar
    ttsPlayingRef.current = false;
    if (sessionRef.current === "browser" && recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setListening(true);
      } catch {}
    }
  }, []);

  const VOICE_SYSTEM_PROMPT = `Você está em uma LIGAÇÃO TELEFÔNICA. Responda SEMPRE de forma curta e natural, como uma pessoa real falando ao telefone.

REGRAS OBRIGATÓRIAS:
- Máximo 2-3 frases curtas por resposta
- NUNCA use markdown, bullets, asteriscos ou formatação
- NUNCA faça listas ou tópicos
- Fale de forma coloquial e direta
- Seja conciso como num telefonema real`;

  const callAiSimulator = useCallback(async (userMessage: string) => {
    setAiThinking(true);
    conversationRef.current.push({ role: "user", content: userMessage });

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const messagesWithSystem = [
        { role: "system", content: VOICE_SYSTEM_PROMPT },
        ...conversationRef.current,
      ];

      const res = await fetch(`${EDGE_BASE}/ai-simulator`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "",
        },
        body: JSON.stringify({
          messages: messagesWithSystem,
          company_id: companyId,
          context: { phone_number: phoneNumber },
          system_prompt: VOICE_SYSTEM_PROMPT,
        }),
      });

      const data = await res.json();
      const rawText = data.text || data.response || data.message || "...";
      // Limpar e truncar para TTS rápido
      const aiText = cleanForTTS(rawText).slice(0, 200);
      conversationRef.current.push({ role: "assistant", content: aiText });
      addEntry("ai", aiText);

      // TTS via XTTS
      await playXTTS(aiText);
    } catch (err: any) {
      addSystem(`❌ Erro IA: ${err.message || "falha na conexão"}`);
    }
    setAiThinking(false);
  }, [companyId, phoneNumber, addEntry, addSystem, playXTTS]);

  const startBrowserCall = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Seu navegador não suporta reconhecimento de voz. Use Chrome.");
      return;
    }

    setInCall(true);
    setCallTimer(0);
    setTranscript([]);
    conversationRef.current = [];
    timerRef.current = setInterval(() => setCallTimer((p) => p + 1), 1000);

    // Iniciar background office
    try {
      const bgAudio = new Audio("/audio/office-bg.mp3");
      bgAudio.loop = true;
      bgAudio.volume = 0.15;
      bgAudio.play().catch(() => {});
      bgAudioRef.current = bgAudio;
    } catch {}

    addSystem("📞 Chamada simulada iniciada (modo browser)");
    addSystem("🎤 Fale algo para começar a conversa...");

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[0];
      if (result && result.isFinal) {
        const text = result[0].transcript.trim();
        if (text) {
          addEntry("lead", text);
          callAiSimulator(text);
        }
      }
    };

    recognition.onend = () => {
      setListening(false);
      // Restart automatically if still in call — mas NÃO durante TTS
      if (sessionRef.current === "browser" && !ttsPlayingRef.current) {
        setTimeout(() => {
          if (!ttsPlayingRef.current) {
            try {
              recognition.start();
              setListening(true);
            } catch {}
          }
        }, 300);
      }
    };

    recognition.onstart = () => {
      setListening(true);
      addSystem("🎤 Microfone ativo — fale agora");
    };
    recognition.onerror = (e: any) => {
      if (e.error === "not-allowed") {
        addSystem("❌ Microfone bloqueado. Permita o acesso nas configurações do navegador.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        addSystem(`⚠️ Erro microfone: ${e.error}`);
      }
    };

    try {
      recognition.start();
    } catch (err: any) {
      addSystem(`❌ Não foi possível iniciar o microfone: ${err.message}`);
    }
    recognitionRef.current = recognition;
    sessionRef.current = "browser";
  }, [addSystem, addEntry, callAiSimulator]);

  const endBrowserCall = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    sessionRef.current = null;
    window.speechSynthesis?.cancel();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    // Parar background office
    if (bgAudioRef.current) {
      bgAudioRef.current.pause();
      bgAudioRef.current = null;
    }
    setInCall(false);
    setListening(false);
    addSystem("📵 Chamada simulada encerrada");
  }, [addSystem]);

  // ══════════════════════════════════════════
  // ── MODO VOIP: SIP via JsSIP ──
  // ══════════════════════════════════════════

  const connectSip = useCallback(() => {
    if (typeof JsSIP === "undefined") {
      addSystem("❌ JsSIP não carregado. Recarregue a página.");
      return;
    }
    if (!sipHost || !sipUser) {
      toast.error("Configure host e usuário SIP primeiro");
      return;
    }

    try {
      // Disconnect previous
      if (uaRef.current) {
        uaRef.current.stop();
        uaRef.current = null;
      }

      const wsPort = sipTransport === "WSS" ? "7443" : "5066";
      const wsUri = `${sipTransport.toLowerCase()}://${sipHost}:${wsPort}`;
      const socket = new JsSIP.WebSocketInterface(wsUri);
      const config = {
        sockets: [socket],
        uri: `sip:${sipUser}@${sipHost}`,
        password: sipPass,
        display_name: "LuxSales",
        register: true,
      };

      const ua = new JsSIP.UA(config);

      ua.on("registered", () => {
        setSipConnected(true);
        addSystem("✅ Registrado no servidor SIP");
      });
      ua.on("unregistered", () => {
        setSipConnected(false);
        addSystem("⚠️ Desconectado do SIP");
      });
      ua.on("registrationFailed", (e: any) => {
        setSipConnected(false);
        addSystem(`❌ Falha no registro SIP: ${e?.cause || "desconhecido"}`);
      });
      ua.on("newRTCSession", (data: any) => {
        if (data.originator === "remote") {
          data.session.answer({ mediaConstraints: { audio: true, video: false } });
        }
      });

      ua.start();
      uaRef.current = ua;
      addSystem("🔄 Conectando ao servidor SIP...");
    } catch (err: any) {
      addSystem(`❌ Erro SIP: ${err.message}`);
    }
  }, [sipHost, sipUser, sipPass, sipTransport, addSystem]);

  const startSipCall = useCallback(() => {
    if (!uaRef.current || !sipConnected) return;

    const target = `sip:${phoneNumber}@${sipHost}`;
    const options = {
      mediaConstraints: { audio: true, video: false },
      rtcOfferConstraints: { offerToReceiveAudio: true },
    };

    const session = uaRef.current.call(target, options);

    session.on("connecting", () => addSystem("📞 Chamando..."));
    session.on("accepted", () => {
      setInCall(true);
      setCallTimer(0);
      timerRef.current = setInterval(() => setCallTimer((p) => p + 1), 1000);
      addSystem("✅ Chamada aceita");
    });
    session.on("confirmed", () => {
      const streams = session.connection?.getRemoteStreams?.();
      if (streams?.length && audioRef.current) {
        audioRef.current.srcObject = streams[0];
      }
    });
    session.on("ended", () => endSipCall("Chamada encerrada"));
    session.on("failed", (e: any) => endSipCall(`Chamada falhou: ${e?.cause || "código desconhecido"}`));

    if (session.connection) {
      session.connection.ontrack = (event: RTCTrackEvent) => {
        if (audioRef.current && event.streams?.[0]) {
          audioRef.current.srcObject = event.streams[0];
        }
      };
    }

    sessionRef.current = session;
  }, [sipConnected, sipHost, phoneNumber, addSystem]);

  const endSipCall = useCallback((reason: string) => {
    if (sessionRef.current && sessionRef.current !== "browser") {
      sessionRef.current.terminate?.();
    }
    setInCall(false);
    setSipConnected(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    sessionRef.current = null;
    addSystem(`📵 ${reason}`);
  }, [addSystem]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      uaRef.current?.stop();
      window.speechSynthesis?.cancel();
      bgAudioRef.current?.pause();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  // ── Render ──
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <Tabs value={mode} onValueChange={(v) => setMode(v as "browser" | "voip")}>
          <div className="flex items-center justify-between gap-4">
            <TabsList>
              <TabsTrigger value="browser" className="gap-1.5">
                <Mic className="h-3.5 w-3.5" /> Teste no Browser
              </TabsTrigger>
              <TabsTrigger value="voip" className="gap-1.5">
                <Phone className="h-3.5 w-3.5" /> VoIP / SIP
              </TabsTrigger>
            </TabsList>

            {/* Pipeline status inline */}
            <div>
              {pipelineOnline === null ? (
                <Badge variant="outline" className="gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Verificando pipeline...
                </Badge>
              ) : pipelineOnline ? (
                <Badge className="gap-1.5 bg-green-500/15 text-green-500 border-green-500/30">
                  <CheckCircle className="h-3 w-3" /> Pipeline Online
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1.5 text-muted-foreground">
                  <XCircle className="h-3 w-3" /> Pipeline Offline
                </Badge>
              )}
            </div>
          </div>

          {/* ── BROWSER MODE ── */}
          <TabsContent value="browser" className="mt-4">
            <div className="flex gap-4" style={{ minHeight: 550 }}>
              <div className="w-[380px] shrink-0 space-y-4">
                {/* Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Mic className="h-4 w-4" /> Simulação via Browser
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-2">
                    <p>Simule uma ligação usando o microfone do seu navegador. A IA responde em tempo real como se fosse uma chamada.</p>
                    <p className="text-xs">Requisitos: Chrome/Edge, microfone ativo.</p>
                  </CardContent>
                </Card>

                {/* Phone + Call */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Chamada Simulada</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Número do lead (para contexto)"
                      disabled={inCall}
                    />

                    {!inCall ? (
                      <Button
                        className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                        onClick={startBrowserCall}
                      >
                        <Mic className="h-4 w-4" /> Iniciar Simulação
                      </Button>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {listening ? (
                              <Badge className="gap-1 bg-green-500/15 text-green-500 border-green-500/30 animate-pulse">
                                <Mic className="h-3 w-3" /> Ouvindo...
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1 text-muted-foreground">
                                <MicOff className="h-3 w-3" /> Mic pausado
                              </Badge>
                            )}
                            {aiThinking && (
                              <Badge variant="outline" className="gap-1 text-blue-400 border-blue-400/30">
                                <Loader2 className="h-3 w-3 animate-spin" /> IA pensando...
                              </Badge>
                            )}
                          </div>
                          <span className="font-mono text-lg font-bold">{formatTimer(callTimer)}</span>
                        </div>
                        <Button
                          className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white"
                          onClick={endBrowserCall}
                        >
                          <PhoneOff className="h-4 w-4" /> Encerrar Simulação
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Transcript */}
              <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="pb-2 shrink-0">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Volume2 className="h-4 w-4" /> Transcrição em Tempo Real
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-0">
                  {renderTranscript()}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── VOIP MODE ── */}
          <TabsContent value="voip" className="mt-4">
            <div className="flex gap-4" style={{ minHeight: 550 }}>
              <div className="w-[400px] shrink-0 space-y-4">
                {/* SIP Config */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Settings className="h-4 w-4" /> Configuração VoIP / SIP Trunk
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {loadingSip ? (
                      <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Host / IP</Label>
                            <Input
                              value={sipHost}
                              onChange={(e) => setSipHost(e.target.value)}
                              placeholder="sip.allgar.com.br"
                              disabled={sipConnected}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Porta</Label>
                            <Input
                              value={sipPort}
                              onChange={(e) => setSipPort(e.target.value)}
                              placeholder="5060"
                              disabled={sipConnected}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Usuário</Label>
                            <Input
                              value={sipUser}
                              onChange={(e) => setSipUser(e.target.value)}
                              placeholder="usuario"
                              disabled={sipConnected}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Senha</Label>
                            <Input
                              type="password"
                              value={sipPass}
                              onChange={(e) => setSipPass(e.target.value)}
                              placeholder="••••••"
                              disabled={sipConnected}
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Transporte</Label>
                          <Select value={sipTransport} onValueChange={setSipTransport} disabled={sipConnected}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="WSS">WSS (WebSocket Seguro)</SelectItem>
                              <SelectItem value="WS">WS (WebSocket)</SelectItem>
                              <SelectItem value="UDP">UDP</SelectItem>
                              <SelectItem value="TCP">TCP</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={saveSipConfig} disabled={savingSip || sipConnected}>
                            {savingSip ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                            Salvar Config
                          </Button>
                          {!sipConnected ? (
                            <Button size="sm" onClick={connectSip} disabled={!sipHost || !sipUser}>
                              Conectar SIP
                            </Button>
                          ) : (
                            <Button size="sm" variant="destructive" onClick={() => {
                              uaRef.current?.stop();
                              uaRef.current = null;
                              setSipConnected(false);
                              addSystem("🔌 Desconectado do SIP");
                            }}>
                              Desconectar
                            </Button>
                          )}
                        </div>

                        {!sipHost && (
                          <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span>Aguardando dados do provedor VoIP (Allgar). Preencha quando receber as credenciais SIP.</span>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* SIP Status */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${sipConnected ? "bg-green-500" : "bg-gray-500"}`} />
                      Conexão SIP
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {sipConnected ? "Registrado e pronto para chamadas" : sipHost ? "Desconectado — clique 'Conectar SIP'" : "Configure as credenciais acima"}
                    </p>
                  </CardContent>
                </Card>

                {/* Call */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Chamada VoIP</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Número de telefone"
                      disabled={inCall || !sipConnected}
                    />
                    {!inCall ? (
                      <Button
                        className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                        disabled={!sipConnected}
                        onClick={startSipCall}
                      >
                        <Phone className="h-4 w-4" /> Iniciar Chamada
                      </Button>
                    ) : (
                      <>
                        <div className="text-center text-2xl font-mono font-bold">{formatTimer(callTimer)}</div>
                        <Button
                          className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white"
                          onClick={() => endSipCall("Chamada encerrada pelo operador")}
                        >
                          <PhoneOff className="h-4 w-4" /> Encerrar
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Transcript */}
              <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="pb-2 shrink-0">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Volume2 className="h-4 w-4" /> Transcrição em Tempo Real
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-0">
                  {renderTranscript()}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <audio ref={audioRef} autoPlay style={{ display: "none" }} />
      </div>
    </DashboardLayout>
  );

  function renderTranscript() {
    return (
      <div
        ref={scrollRef}
        className="overflow-y-auto px-4 py-3 space-y-2"
        style={{ height: 500, background: "#0d0d14", borderRadius: "0 0 8px 8px" }}
      >
        {transcript.length === 0 ? (
          <p className="text-center text-sm text-gray-500 pt-10">
            {mode === "browser" ? "Inicie a simulação para conversar com a IA" : "Aguardando chamada..."}
          </p>
        ) : (
          transcript.map((entry, i) => {
            if (entry.type === "system") {
              return (
                <div key={i} className="text-center">
                  <span className="text-xs text-gray-500">{entry.ts} — {entry.text}</span>
                </div>
              );
            }
            const isLead = entry.type === "lead";
            return (
              <div key={i} className={`flex ${isLead ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[75%] rounded-xl px-3 py-2 text-sm"
                  style={{
                    background: isLead ? "#1a7a4c" : "#3b2d7a",
                    color: "#e5e7eb",
                  }}
                >
                  <div className="text-[10px] opacity-60 mb-0.5">
                    {isLead ? "👤 Lead" : "🤖 Lucas"} · {entry.ts}
                  </div>
                  <p className="whitespace-pre-wrap">{entry.text}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  }
}
