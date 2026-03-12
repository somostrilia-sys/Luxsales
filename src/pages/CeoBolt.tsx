import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Save, Send, Crown, Bot } from "lucide-react";

interface SystemConfig {
  id: string;
  key: string;
  value: string;
  description: string | null;
}

interface AgentDef {
  id: string;
  name: string;
  emoji: string | null;
  active: boolean;
  company_id: string | null;
  company_name?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function CeoBolt() {
  const { toast } = useToast();

  // Config state
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("claude-opus-4-5");
  const [showKey, setShowKey] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Agents state
  const [agents, setAgents] = useState<AgentDef[]>([]);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Olá! Sou o Bolt, seu assistente CEO. Como posso ajudar?" },
  ]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConfigs();
    loadAgents();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadConfigs() {
    const { data } = await supabase
      .from("system_configs" as any)
      .select("*");
    if (data) {
      const configs = data as unknown as SystemConfig[];
      configs.forEach((c) => {
        if (c.key === "anthropic_api_key") setApiKey(c.value);
        if (c.key === "ceo_model") setModel(c.value);
      });
    }
  }

  async function loadAgents() {
    const { data } = await supabase
      .from("agent_definitions" as any)
      .select("id, name, emoji, active, company_id");
    if (!data) return;
    const agentList = data as unknown as AgentDef[];

    // fetch company names
    const companyIds = [...new Set(agentList.filter((a) => a.company_id).map((a) => a.company_id!))];
    let companyMap: Record<string, string> = {};
    if (companyIds.length > 0) {
      const { data: companies } = await supabase
        .from("companies" as any)
        .select("id, name")
        .in("id", companyIds);
      if (companies) {
        (companies as unknown as { id: string; name: string }[]).forEach(
          (c) => (companyMap[c.id] = c.name)
        );
      }
    }
    setAgents(
      agentList.map((a) => ({
        ...a,
        company_name: a.company_id ? companyMap[a.company_id] || "—" : "—",
      }))
    );
  }

  async function saveConfigs() {
    setSavingConfig(true);
    try {
      await supabase
        .from("system_configs" as any)
        .update({ value: apiKey, updated_at: new Date().toISOString() } as any)
        .eq("key", "anthropic_api_key");
      await supabase
        .from("system_configs" as any)
        .update({ value: model, updated_at: new Date().toISOString() } as any)
        .eq("key", "ceo_model");
      toast({ title: "Configurações salvas!" });
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
    setSavingConfig(false);
  }

  async function toggleAgent(agent: AgentDef) {
    const newActive = !agent.active;
    await supabase
      .from("agent_definitions" as any)
      .update({ active: newActive } as any)
      .eq("id", agent.id);
    setAgents((prev) =>
      prev.map((a) => (a.id === agent.id ? { ...a, active: newActive } : a))
    );
  }

  function sendMessage() {
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setChatInput("");

    // Simulated response (TODO: integrate with Anthropic API)
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Recebi sua mensagem: "${userMsg.content}". A integração com a API está em desenvolvimento. 🚀`,
        },
      ]);
    }, 800);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Crown className="h-7 w-7 text-yellow-500" />
          <h1 className="text-2xl font-bold text-foreground">CEO / Bolt</h1>
        </div>

        {/* A) CONFIGURAÇÕES */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5 text-muted-foreground" />
              Configurações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  API Key Anthropic
                </label>
                <div className="relative">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-ant-..."
                    autoComplete="off"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Modelo</label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude-opus-4-5">claude-opus-4-5</SelectItem>
                    <SelectItem value="claude-sonnet-4-6">claude-sonnet-4-6</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={saveConfigs} disabled={savingConfig} className="gap-2">
              <Save className="h-4 w-4" />
              {savingConfig ? "Salvando..." : "Salvar"}
            </Button>
          </CardContent>
        </Card>

        {/* B) STATUS DOS AGENTES */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bot className="h-5 w-5 text-muted-foreground" />
              Status dos Agentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum agente encontrado.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{agent.emoji || "🤖"}</span>
                        <span className="font-medium text-foreground truncate">
                          {agent.name}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {agent.company_name}
                      </p>
                      <Badge
                        variant={agent.active ? "default" : "secondary"}
                        className="mt-1 text-[10px]"
                      >
                        {agent.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <Switch
                      checked={agent.active}
                      onCheckedChange={() => toggleAgent(agent)}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* C) CHAT COM BOLT */}
        <Card className="flex flex-col" style={{ minHeight: 400 }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              Chat com Bolt
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 p-0">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ maxHeight: 350 }}>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border p-3 flex gap-2">
              <Input
                type="search"
                autoComplete="off"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />
              <Button onClick={sendMessage} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

// Need to import Settings
import { Settings } from "lucide-react";
