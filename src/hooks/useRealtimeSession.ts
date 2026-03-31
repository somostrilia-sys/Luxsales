import { useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { EDGE_BASE, SUPABASE_ANON_KEY } from "@/lib/constants";

interface UseRealtimeSessionOptions {
  onUserSpeech: (text: string) => void;
  onAISpeech: (text: string) => void;
  onSystem: (text: string) => void;
}

export function useRealtimeSession({
  onUserSpeech,
  onAISpeech,
  onSystem,
}: UseRealtimeSessionOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Use refs for callbacks to avoid stale closures in event handlers
  const onUserSpeechRef = useRef(onUserSpeech);
  const onAISpeechRef = useRef(onAISpeech);
  const onSystemRef = useRef(onSystem);
  onUserSpeechRef.current = onUserSpeech;
  onAISpeechRef.current = onAISpeech;
  onSystemRef.current = onSystem;

  const handleRealtimeEvent = useCallback((event: any) => {
    if (event.type === "conversation.item.created") {
      const item = event.item;
      if (item?.role === "user" && item?.content) {
        for (const c of item.content) {
          if (c.type === "input_audio" && c.transcript) {
            onUserSpeechRef.current(c.transcript);
          }
        }
      }
      if (item?.role === "assistant" && item?.content) {
        for (const c of item.content) {
          if (c.type === "audio" && c.transcript) {
            onAISpeechRef.current(c.transcript);
          } else if (c.type === "text" && c.text) {
            onAISpeechRef.current(c.text);
          }
        }
      }
    }
    // Transcription events
    if (event.type === "response.audio_transcript.done" && event.transcript) {
      onAISpeechRef.current(event.transcript);
    }
    if (
      event.type === "conversation.item.input_audio_transcription.completed" &&
      event.transcript
    ) {
      onUserSpeechRef.current(event.transcript);
    }
  }, []);

  const disconnect = useCallback(() => {
    dcRef.current?.close();
    dcRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
      audioElRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const connect = useCallback(
    async (systemPrompt: string) => {
      setIsConnecting(true);
      try {
        // 1. Get ephemeral token from edge function
        let authToken = SUPABASE_ANON_KEY;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) authToken = session.access_token;
        } catch {}

        const res = await fetch(`${EDGE_BASE}/realtime-session`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ system_prompt: systemPrompt, voice: "shimmer" }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error("[Realtime] token fetch failed:", res.status, errText);
          throw new Error(`Token error ${res.status}: ${errText}`);
        }
        const tokenData = await res.json();
        if (!tokenData.token) {
          throw new Error(tokenData.error || "Token vazio na resposta");
        }
        const ephemeralToken = tokenData.token;

        // 2. Get microphone
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        // 3. Create RTCPeerConnection
        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        // 4. Remote audio output
        pc.ontrack = (event) => {
          if (!audioElRef.current) {
            audioElRef.current = new Audio();
            audioElRef.current.autoplay = true;
          }
          audioElRef.current.srcObject = event.streams[0];
        };

        // 5. Add mic tracks
        for (const track of stream.getTracks()) {
          pc.addTrack(track, stream);
        }

        // 6. Data channel for transcript events
        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;

        dc.onopen = () => {
          setIsConnected(true);
          setIsConnecting(false);
          onSystemRef.current("⚡ Modo Rápido conectado — latência ~300ms");
        };

        dc.onmessage = (e) => {
          try {
            handleRealtimeEvent(JSON.parse(e.data));
          } catch {}
        };

        dc.onerror = () => {
          onSystemRef.current("⚠️ Erro no canal de dados Realtime");
        };

        dc.onclose = () => {
          setIsConnected(false);
        };

        // 7. Create SDP offer and exchange with OpenAI
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const sdpRes = await fetch(
          "https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2025-06-03",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ephemeralToken}`,
              "Content-Type": "application/sdp",
            },
            body: offer.sdp,
          }
        );

        if (!sdpRes.ok) {
          throw new Error(`WebRTC SDP error: ${sdpRes.status} ${await sdpRes.text()}`);
        }

        const answerSdp = await sdpRes.text();
        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      } catch (err: any) {
        setIsConnecting(false);
        onSystemRef.current(`❌ Erro ao conectar Realtime: ${err.message}`);
        disconnect();
      }
    },
    [disconnect, handleRealtimeEvent]
  );

  return { connect, disconnect, isConnected, isConnecting };
}
