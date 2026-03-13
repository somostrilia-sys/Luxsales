import { useState, useRef, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Bot, Send, Loader2, User, Briefcase, Building2 } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface CollabProfile {
  id: string;
  name: string;
  email?: string;
  roleName?: string;
  companyName?: string;
  sectorName?: string;
  bot_training?: string;
}

export default function MeuBot() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profile, setProfile] = useState<CollabProfile | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { init(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const init = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Carregar perfil completo do colaborador
      const { data: collab } = await supabase
        .from("collaborators")
        .select("id, name, email, bot_training, company_id, role_id, sector_id")
        .eq("auth_user_id", user.id)
        .single();

      if (!collab) return;

      // Buscar nome do cargo, empresa, setor em paralelo
      const [roleRes, companyRes, sectorRes] = await Promise.all([
        collab.role_id
          ? supabase.from("roles").select("name").eq("id", collab.role_id).single()
          : Promise.resolve({ data: null }),
        collab.company_id
          ? supabase.from("companies").select("name").eq("id", collab.company_id).single()
          : Promise.resolve({ data: null }),
        collab.sector_id
          ? supabase.from("sectors").select("name").eq("id", collab.sector_id).single()
          : Promise.resolve({ data: null }),
      ]);

      const p: CollabProfile = {
        id: collab.id,
        name: collab.name,
        email: collab.email,
        roleName: (roleRes.data as any)?.name,
        companyName: (companyRes.data as any)?.name,
        sectorName: (sectorRes.data as any)?.name,
        bot_training: collab.bot_training,
      };
      setProfile(p);

      // Buscar ou criar conversa meu-bot para este colaborador
      const { data: conv } = await supabase
        .from("agent_conversations")
        .select("id")
        .eq("collaborator_id", collab.id)
        .eq("conversation_type", "meu-bot")
        .order("started_at", { ascending: false })
        .limit(1)
        .single();

      let convId: string;
      if (conv) {
        convId = conv.id;
      } else {
        const { data: newConv } = await supabase
          .from("agent_conversations")
          .insert({ collaborator_id: collab.id, conversation_type: "meu-bot" })
          .select("id")
          .single();
        convId = newConv!.id;
      }
      setConversationId(convId);

      // Carregar histórico
      const { data: msgs } = await supabase
        .from("agent_messages")
        .select("role, content")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (msgs && msgs.length > 0) {
        setMessages(msgs.map(m => ({ role: m.role as "user" | "assistant", content: m.content })));
      } else {
        const welcome = { role: "assistant" as const, content: `Olá, ${collab.name}! Sou seu assistente pessoal. Como posso ajudar?` };
        setMessages([welcome]);
        await supabase.from("agent_messages").insert({ conversation_id: convId, role: "assistant", content: welcome.content });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const saveMsg = async (role: string, content: string) => {
    if (!conversationId) return;
    await supabase.from("agent_messages").insert({ conversation_id: conversationId, role, content });
    // Atualizar last_message_at
    await supabase.from("agent_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    await saveMsg("user", userMsg.content);

    try {
      const history = newMessages.slice(-20).map(({ role, content }) => ({ role, content }));
      const { data, error } = await supabase.functions.invoke("meu-bot", {
        body: {
          message: userMsg.content,
          history,
          collaborator_id: profile?.id,
          consultant_name: profile?.name,
          role_name: profile?.roleName,
          company_name: profile?.companyName,
          sector_name: profile?.sectorName,
          bot_training: profile?.bot_training,
        },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Erro ao enviar");
      } else if (data?.reply) {
        setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
        await saveMsg("assistant", data.reply);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro de conexão");
    }
    setSending(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-bold">Meu Bot</h1>
          {profile && (
            <div className="flex items-center gap-3 text-sm bg-muted/50 rounded-lg px-4 py-2">
              <User className="h-4 w-4 text-primary" />
              <span className="font-medium">{profile.name}</span>
              {profile.roleName && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{profile.roleName}</span>
                </>
              )}
              {profile.companyName && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{profile.companyName}</span>
                </>
              )}
            </div>
          )}
        </div>

        <Card className="flex flex-col" style={{ minHeight: 500 }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bot className="h-5 w-5 text-muted-foreground" />
              Chat Pessoal
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 p-0">
            {loading ? (
              <div className="flex-1 flex items-center justify-center p-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ maxHeight: 420 }}>
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted text-foreground rounded-bl-md"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  <div ref={endRef} />
                </div>
                <div className="border-t border-border p-3 flex gap-2">
                  <Input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="flex-1"
                    onKeyDown={e => e.key === "Enter" && sendMessage()}
                    autoComplete="off"
                  />
                  <Button onClick={sendMessage} size="icon" disabled={sending || !input.trim()}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
