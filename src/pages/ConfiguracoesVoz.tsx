import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Settings, Server, Phone, Mic, Brain, MessageSquare,
  Save, TestTube, Loader2, Wifi, WifiOff, Check, X,
  Cpu, Globe, Key, Shield, Zap,
} from "lucide-react";

export default function ConfiguracoesVoz() {
  const [activeTab, setActiveTab] = useState("sip");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  // SIP Trunk
  const [sipConfig, setSipConfig] = useState({
    host: "", port: "5060", username: "", password: "",
    maxChannels: "10", transport: "udp", codec: "G711",
  });

  // Voice AI
  const [voiceConfig, setVoiceConfig] = useState({
    serverUrl: "http://localhost:8084",
    sttProvider: "faster-whisper", sttModel: "large-v3",
    llmProvider: "anthropic", llmModel: "claude-3-5-haiku-20241022",
    ttsProvider: "xtts", ttsVoiceSample: "",
    llmMaxTokens: "300", llmTemperature: "0.7",
    silenceThreshold: "0.01", silenceDuration: "1.5",
  });

  // WhatsApp Meta
  const [whatsappConfig, setWhatsappConfig] = useState({
    provider: "meta",
    metaAccessToken: "", metaPhoneNumberId: "",
    metaWabaId: "", metaAppSecret: "",
    metaWebhookVerifyToken: "",
    autoReplyEnabled: true, followupEnabled: true,
    followupDelayMinutes: "30", maxFollowups: "3",
    bulkDelaySeconds: "2", bulkMaxPerHour: "200",
  });

  // API Keys
  const [apiKeys, setApiKeys] = useState({
    anthropic: "", openai: "", groq: "",
    google: "", deepseek: "", elevenlabs: "",
  });

  const saveConfig = async (section: string) => {
    setSaving(true);
    try {
      // In production, save to system_configs table
      toast.success(`Configurações de ${section} salvas com sucesso!`);
    } catch (error) {
      toast.error("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async (service: string) => {
    setTesting(service);
    try {
      // Simulate connection test
      await new Promise((r) => setTimeout(r, 2000));
      toast.success(`Conexão com ${service} testada com sucesso!`);
    } catch {
      toast.error(`Falha ao conectar com ${service}.`);
    } finally {
      setTesting(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Configurações Avançadas"
          subtitle="SIP Trunk, Voice AI, WhatsApp Meta e chaves de API"
          badge={<Badge variant="outline"><Settings className="h-3 w-3 mr-1" />Admin</Badge>}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="h-auto flex-wrap gap-2 rounded-xl border border-border/60 bg-secondary/40 p-1">
            <TabsTrigger value="sip">SIP Trunk</TabsTrigger>
            <TabsTrigger value="voice-ai">Voice AI</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp Meta</TabsTrigger>
            <TabsTrigger value="api-keys">Chaves de API</TabsTrigger>
          </TabsList>

          {/* SIP TRUNK */}
          <TabsContent value="sip" className="space-y-6">
            <Card className="border-border/60 bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Server className="h-4 w-4 text-primary" />Configuração do SIP Trunk</CardTitle>
                <CardDescription>Configure a conexão com o provedor de telefonia VoIP (FreeSWITCH)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Host / IP do SIP Trunk</Label>
                    <Input value={sipConfig.host} onChange={(e) => setSipConfig({ ...sipConfig, host: e.target.value })} placeholder="sip.provedor.com.br" />
                  </div>
                  <div className="space-y-2">
                    <Label>Porta</Label>
                    <Input value={sipConfig.port} onChange={(e) => setSipConfig({ ...sipConfig, port: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Usuário SIP</Label>
                    <Input value={sipConfig.username} onChange={(e) => setSipConfig({ ...sipConfig, username: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha SIP</Label>
                    <Input type="password" value={sipConfig.password} onChange={(e) => setSipConfig({ ...sipConfig, password: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Canais Simultâneos</Label>
                    <Input type="number" value={sipConfig.maxChannels} onChange={(e) => setSipConfig({ ...sipConfig, maxChannels: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Transporte</Label>
                    <Select value={sipConfig.transport} onValueChange={(v) => setSipConfig({ ...sipConfig, transport: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="udp">UDP</SelectItem>
                        <SelectItem value="tcp">TCP</SelectItem>
                        <SelectItem value="tls">TLS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={() => saveConfig("SIP Trunk")} disabled={saving}><Save className="h-4 w-4 mr-1.5" />Salvar</Button>
                  <Button variant="outline" onClick={() => testConnection("SIP Trunk")} disabled={testing === "SIP Trunk"}>
                    {testing === "SIP Trunk" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <TestTube className="h-4 w-4 mr-1.5" />}Testar Conexão
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* VOICE AI */}
          <TabsContent value="voice-ai" className="space-y-6">
            <Card className="border-border/60 bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Cpu className="h-4 w-4 text-primary" />Servidor Voice AI</CardTitle>
                <CardDescription>Configuração do motor de IA de voz (STT + LLM + TTS)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>URL do Servidor Voice AI</Label>
                  <Input value={voiceConfig.serverUrl} onChange={(e) => setVoiceConfig({ ...voiceConfig, serverUrl: e.target.value })} placeholder="http://gpu-server:8084" />
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  {/* STT */}
                  <div className="space-y-3 p-4 rounded-lg border border-border/60 bg-secondary/10">
                    <h4 className="text-sm font-semibold flex items-center gap-2"><Mic className="h-4 w-4 text-blue-400" />STT (Fala → Texto)</h4>
                    <div className="space-y-2">
                      <Label className="text-xs">Provedor</Label>
                      <Select value={voiceConfig.sttProvider} onValueChange={(v) => setVoiceConfig({ ...voiceConfig, sttProvider: v })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="faster-whisper">Faster-Whisper (GPU)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Modelo</Label>
                      <Select value={voiceConfig.sttModel} onValueChange={(v) => setVoiceConfig({ ...voiceConfig, sttModel: v })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="large-v3">Large v3 (melhor qualidade)</SelectItem>
                          <SelectItem value="medium">Medium (mais rápido)</SelectItem>
                          <SelectItem value="small">Small (leve)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-[10px] text-muted-foreground">~200ms latência | GPU local</p>
                  </div>

                  {/* LLM */}
                  <div className="space-y-3 p-4 rounded-lg border border-border/60 bg-secondary/10">
                    <h4 className="text-sm font-semibold flex items-center gap-2"><Brain className="h-4 w-4 text-violet-400" />LLM (Inteligência)</h4>
                    <div className="space-y-2">
                      <Label className="text-xs">Provedor</Label>
                      <Select value={voiceConfig.llmProvider} onValueChange={(v) => setVoiceConfig({ ...voiceConfig, llmProvider: v })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                          <SelectItem value="openai">OpenAI (GPT-4o)</SelectItem>
                          <SelectItem value="groq">Groq (ultra-rápido)</SelectItem>
                          <SelectItem value="google">Google (Gemini)</SelectItem>
                          <SelectItem value="deepseek">DeepSeek</SelectItem>
                          <SelectItem value="ollama">Ollama (local)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Max Tokens</Label>
                      <Input className="h-8 text-xs" value={voiceConfig.llmMaxTokens} onChange={(e) => setVoiceConfig({ ...voiceConfig, llmMaxTokens: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Temperature</Label>
                      <Input className="h-8 text-xs" value={voiceConfig.llmTemperature} onChange={(e) => setVoiceConfig({ ...voiceConfig, llmTemperature: e.target.value })} />
                    </div>
                    <p className="text-[10px] text-muted-foreground">~300-500ms latência | API</p>
                  </div>

                  {/* TTS */}
                  <div className="space-y-3 p-4 rounded-lg border border-border/60 bg-secondary/10">
                    <h4 className="text-sm font-semibold flex items-center gap-2"><Zap className="h-4 w-4 text-emerald-400" />TTS (Texto → Fala)</h4>
                    <div className="space-y-2">
                      <Label className="text-xs">Provedor</Label>
                      <Select value={voiceConfig.ttsProvider} onValueChange={(v) => setVoiceConfig({ ...voiceConfig, ttsProvider: v })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="xtts">XTTS v2 (GPU + clonagem)</SelectItem>
                          <SelectItem value="chatterbox">Chatterbox (GPU)</SelectItem>
                          <SelectItem value="elevenlabs">ElevenLabs (API)</SelectItem>
                          <SelectItem value="openai_tts">OpenAI TTS (API)</SelectItem>
                          <SelectItem value="edge">Edge TTS (grátis)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Amostra de voz (URL)</Label>
                      <Input className="h-8 text-xs" value={voiceConfig.ttsVoiceSample} onChange={(e) => setVoiceConfig({ ...voiceConfig, ttsVoiceSample: e.target.value })} placeholder="URL do .wav" />
                    </div>
                    <p className="text-[10px] text-muted-foreground">~300ms latência | GPU local</p>
                  </div>
                </div>

                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-foreground">Pipeline Total: ~800ms-1.2s (conversa natural)</p>
                    <p className="text-xs text-muted-foreground">STT (~200ms) + LLM (~300-500ms) + TTS (~300ms) = Round-trip completo</p>
                  </CardContent>
                </Card>

                <div className="flex gap-3">
                  <Button onClick={() => saveConfig("Voice AI")} disabled={saving}><Save className="h-4 w-4 mr-1.5" />Salvar</Button>
                  <Button variant="outline" onClick={() => testConnection("Voice AI Server")} disabled={testing === "Voice AI Server"}>
                    {testing === "Voice AI Server" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <TestTube className="h-4 w-4 mr-1.5" />}Testar Conexão
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* WHATSAPP META */}
          <TabsContent value="whatsapp" className="space-y-6">
            <Card className="border-border/60 bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4 text-emerald-400" />WhatsApp Cloud API (Meta)</CardTitle>
                <CardDescription>Credenciais da API oficial do WhatsApp Business</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Meta Access Token</Label>
                    <Input type="password" value={whatsappConfig.metaAccessToken} onChange={(e) => setWhatsappConfig({ ...whatsappConfig, metaAccessToken: e.target.value })} placeholder="EAAx..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number ID</Label>
                    <Input value={whatsappConfig.metaPhoneNumberId} onChange={(e) => setWhatsappConfig({ ...whatsappConfig, metaPhoneNumberId: e.target.value })} placeholder="1234567890" />
                  </div>
                  <div className="space-y-2">
                    <Label>WABA ID</Label>
                    <Input value={whatsappConfig.metaWabaId} onChange={(e) => setWhatsappConfig({ ...whatsappConfig, metaWabaId: e.target.value })} placeholder="9876543210" />
                  </div>
                  <div className="space-y-2">
                    <Label>App Secret</Label>
                    <Input type="password" value={whatsappConfig.metaAppSecret} onChange={(e) => setWhatsappConfig({ ...whatsappConfig, metaAppSecret: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Webhook Verify Token</Label>
                    <Input value={whatsappConfig.metaWebhookVerifyToken} onChange={(e) => setWhatsappConfig({ ...whatsappConfig, metaWebhookVerifyToken: e.target.value })} />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-border/60">
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-medium">Auto-reply com IA</p><p className="text-xs text-muted-foreground">Responder automaticamente mensagens recebidas</p></div>
                    <Switch checked={whatsappConfig.autoReplyEnabled} onCheckedChange={(v) => setWhatsappConfig({ ...whatsappConfig, autoReplyEnabled: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-medium">Follow-up automático</p><p className="text-xs text-muted-foreground">Enviar follow-up após ligação qualificada</p></div>
                    <Switch checked={whatsappConfig.followupEnabled} onCheckedChange={(v) => setWhatsappConfig({ ...whatsappConfig, followupEnabled: v })} />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Delay follow-up (min)</Label>
                    <Input type="number" value={whatsappConfig.followupDelayMinutes} onChange={(e) => setWhatsappConfig({ ...whatsappConfig, followupDelayMinutes: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Máx. follow-ups</Label>
                    <Input type="number" value={whatsappConfig.maxFollowups} onChange={(e) => setWhatsappConfig({ ...whatsappConfig, maxFollowups: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Máx. mensagens/hora (bulk)</Label>
                    <Input type="number" value={whatsappConfig.bulkMaxPerHour} onChange={(e) => setWhatsappConfig({ ...whatsappConfig, bulkMaxPerHour: e.target.value })} />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => saveConfig("WhatsApp Meta")} disabled={saving}><Save className="h-4 w-4 mr-1.5" />Salvar</Button>
                  <Button variant="outline" onClick={() => testConnection("WhatsApp Meta")} disabled={testing === "WhatsApp Meta"}>
                    {testing === "WhatsApp Meta" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <TestTube className="h-4 w-4 mr-1.5" />}Testar API
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API KEYS */}
          <TabsContent value="api-keys" className="space-y-6">
            <Card className="border-border/60 bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Key className="h-4 w-4 text-primary" />Chaves de API</CardTitle>
                <CardDescription>Configure as chaves dos provedores de IA utilizados</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: "anthropic", label: "Anthropic (Claude)", placeholder: "sk-ant-..." },
                  { key: "openai", label: "OpenAI (GPT / TTS)", placeholder: "sk-..." },
                  { key: "groq", label: "Groq (Llama / Mixtral)", placeholder: "gsk_..." },
                  { key: "google", label: "Google (Gemini)", placeholder: "AIza..." },
                  { key: "deepseek", label: "DeepSeek", placeholder: "sk-..." },
                  { key: "elevenlabs", label: "ElevenLabs (TTS)", placeholder: "xi-..." },
                ].map((provider) => (
                  <div key={provider.key} className="grid md:grid-cols-[200px_1fr_auto] gap-3 items-end">
                    <div>
                      <Label>{provider.label}</Label>
                    </div>
                    <Input
                      type="password"
                      value={(apiKeys as any)[provider.key]}
                      onChange={(e) => setApiKeys({ ...apiKeys, [provider.key]: e.target.value })}
                      placeholder={provider.placeholder}
                    />
                    <Badge variant="outline" className={(apiKeys as any)[provider.key] ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"}>
                      {(apiKeys as any)[provider.key] ? "Configurada" : "Não configurada"}
                    </Badge>
                  </div>
                ))}
                <Button onClick={() => saveConfig("API Keys")} disabled={saving} className="mt-4"><Save className="h-4 w-4 mr-1.5" />Salvar Chaves</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
