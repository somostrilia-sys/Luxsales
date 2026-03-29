import { useEffect, useState, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Phone, PhoneOff, AlertTriangle } from "lucide-react";

const PROXY = "https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/orchestrator-proxy";
const AUTH_HEADER =
  "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjYWR1endhdXRscHpwdmpvZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMDQ1MTcsImV4cCI6MjA4ODU4MDUxN30.LinR7PIoK7n79hWjbSJ3EgDwA_y6uN-HfQnOk7GgYi4";

const WS_URI = "wss://192.168.0.206:7443";
const SIP_USER = "1001";
const SIP_PASS = "WalkFS2026Secure";
const SIP_DOMAIN = "192.168.0.206";
const TRANSCRIPT_WS = "ws://192.168.0.206:8500";

interface TranscriptEntry {
  type: "lead" | "ai" | "system";
  text: string;
  ts: string;
}

declare const JsSIP: any;

export default function VoiceSimulate() {
  const [pipelineOnline, setPipelineOnline] = useState<boolean | null>(null);
  const [sipConnected, setSipConnected] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("5531997441277");
  const [callTimer, setCallTimer] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  const uaRef = useRef<any>(null);
  const sessionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptWsRef = useRef<WebSocket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Health check
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${PROXY}?path=${encodeURIComponent("/health")}`, {
        headers: { Authorization: AUTH_HEADER },
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

  // SIP connection
  useEffect(() => {
    if (typeof JsSIP === "undefined") {
      addSystem("JsSIP não carregado. Recarregue a página.");
      return;
    }

    try {
      const socket = new JsSIP.WebSocketInterface(WS_URI);
      const config = {
        sockets: [socket],
        uri: `sip:${SIP_USER}@${SIP_DOMAIN}`,
        password: SIP_PASS,
        display_name: "Walk Test",
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
          // Auto-answer incoming
          data.session.answer({
            mediaConstraints: { audio: true, video: false },
          });
        }
      });

      ua.start();
      uaRef.current = ua;

      return () => {
        ua.stop();
        uaRef.current = null;
      };
    } catch (err: any) {
      addSystem(`Erro ao iniciar SIP: ${err.message}`);
    }
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript]);

  const addSystem = (text: string) => {
    setTranscript((prev) => [...prev, { type: "system", text, ts: new Date().toLocaleTimeString("pt-BR") }]);
  };

  const connectTranscriptWs = () => {
    try {
      const ws = new WebSocket(TRANSCRIPT_WS);
      ws.onopen = () => addSystem("📡 Transcrição conectada");
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          const ts = new Date().toLocaleTimeString("pt-BR");
          if (data.type === "transcript") {
            setTranscript((p) => [...p, { type: "lead", text: data.text, ts }]);
          } else if (data.type === "ai_response") {
            setTranscript((p) => [...p, { type: "ai", text: data.text, ts }]);
          }
        } catch {}
      };
      ws.onclose = () => addSystem("📡 Transcrição desconectada");
      ws.onerror = () => addSystem("❌ Erro na conexão de transcrição");
      transcriptWsRef.current = ws;
    } catch {
      addSystem("❌ Não foi possível conectar transcrição");
    }
  };

  const startCall = () => {
    if (!uaRef.current || !sipConnected) return;

    const target = `sip:${phoneNumber}@${SIP_DOMAIN}`;
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
      connectTranscriptWs();
    });
    session.on("confirmed", () => {
      // Attach remote audio
      const streams = session.connection?.getRemoteStreams?.();
      if (streams?.length && audioRef.current) {
        audioRef.current.srcObject = streams[0];
      }
    });
    session.on("ended", () => endCallCleanup("Chamada encerrada"));
    session.on("failed", (e: any) => endCallCleanup(`Chamada falhou: ${e?.cause || ""}`));

    // Attach remote stream via ontrack
    if (session.connection) {
      session.connection.ontrack = (event: RTCTrackEvent) => {
        if (audioRef.current && event.streams?.[0]) {
          audioRef.current.srcObject = event.streams[0];
        }
      };
    }

    sessionRef.current = session;
  };

  const endCall = () => {
    sessionRef.current?.terminate();
    endCallCleanup("Chamada encerrada pelo operador");
  };

  const endCallCleanup = (reason: string) => {
    setInCall(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    transcriptWsRef.current?.close();
    transcriptWsRef.current = null;
    sessionRef.current = null;
    addSystem(`📵 ${reason}`);
  };

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Warning banner */}
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5 text-sm text-yellow-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>⚠️ Esta página funciona apenas na rede local (192.168.0.x)</span>
        </div>

        {/* Two column layout */}
        <div className="flex gap-4" style={{ minHeight: 600 }}>
          {/* Left column — controls */}
          <div className="w-[400px] shrink-0 space-y-4">
            {/* SIP Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${sipConnected ? "bg-green-500" : "bg-red-500"}`} />
                  Conexão SIP
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {sipConnected ? "Registrado e pronto" : "Aguardando conexão..."}
                </p>
              </CardContent>
            </Card>

            {/* Phone input + call buttons */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Chamada</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Número de telefone"
                  disabled={inCall}
                />

                {!inCall ? (
                  <Button
                    className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                    disabled={!sipConnected}
                    onClick={startCall}
                  >
                    <Phone className="h-4 w-4" />
                    📞 Iniciar Chamada
                  </Button>
                ) : (
                  <>
                    <div className="text-center text-2xl font-mono font-bold text-foreground">
                      {formatTimer(callTimer)}
                    </div>
                    <Button
                      className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white"
                      onClick={endCall}
                    >
                      <PhoneOff className="h-4 w-4" />
                      📵 Encerrar
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Pipeline status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Status Pipeline</CardTitle>
              </CardHeader>
              <CardContent>
                {pipelineOnline === null ? (
                  <Badge variant="outline" className="gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" /> Verificando...
                  </Badge>
                ) : pipelineOnline ? (
                  <Badge className="gap-1.5 bg-green-500/15 text-green-500 border-green-500/30">
                    🟢 Pipeline Online
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1.5">
                    🔴 Pipeline Offline
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column — transcript */}
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="pb-2 shrink-0">
              <CardTitle className="text-base">Transcrição em Tempo Real</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <div
                ref={scrollRef}
                className="overflow-y-auto px-4 py-3 space-y-2"
                style={{ height: 500, background: "#0d0d14", borderRadius: "0 0 8px 8px" }}
              >
                {transcript.length === 0 ? (
                  <p className="text-center text-sm text-gray-500 pt-10">Aguardando chamada...</p>
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
            </CardContent>
          </Card>
        </div>

        {/* Hidden audio element */}
        <audio ref={audioRef} autoPlay style={{ display: "none" }} />
      </div>
    </DashboardLayout>
  );
}
