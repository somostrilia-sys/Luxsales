import { useEffect, useState, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mic } from "lucide-react";

const PROXY = "https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/orchestrator-proxy";
const AUTH_HEADER = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjYWR1endhdXRscHpwdmpvZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMDQ1MTcsImV4cCI6MjA4ODU4MDUxN30.LinR7PIoK7n79hWjbSJ3EgDwA_y6uN-HfQnOk7GgYi4";

export default function VoiceSimulate() {
  const [online, setOnline] = useState<boolean | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${PROXY}?path=${encodeURIComponent("/health")}`, {
        headers: { Authorization: AUTH_HEADER },
      });
      setOnline(res.ok);
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Mic className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Teste de Voz ao Vivo</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Simule uma ligação completa com transcrição em tempo real
            </p>
          </div>
          <div>
            {online === null ? (
              <Badge variant="outline" className="gap-1.5 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Verificando...
              </Badge>
            ) : online ? (
              <Badge className="gap-1.5 bg-green-500/15 text-green-500 border-green-500/30 hover:bg-green-500/20">
                🟢 Pipeline Online
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1.5">
                🔴 Pipeline Offline
              </Badge>
            )}
          </div>
        </div>

        {/* Iframe */}
        <div className="rounded-xl border border-border overflow-hidden" style={{ background: "#0a0a0f" }}>
          <iframe
            src={`${PROXY}?path=${encodeURIComponent("/webrtc-test")}`}
            width="100%"
            height="700px"
            style={{ border: "none", borderRadius: "12px", background: "#0a0a0f" }}
            allow="microphone; camera; autoplay"
            title="WebRTC Voice Test"
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
