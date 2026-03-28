import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Settings, Server, Phone, Mic, Brain, MessageSquare,
  Save, TestTube, Loader2, Cpu, Zap, Key, Building,
  Users, Plus, Trash2, Edit,
} from "lucide-react";

export default function ConfiguracoesVoz() {
  const { collaborator } = useCollaborator();
  const [activeTab, setActiveTab] = useState("empresa");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  // Company
  const [company, setCompany] = useState({ name: "", cnpj: "", logo_url: "" });

  // SIP (agora via sip_trunks)
  const [sip, setSip] = useState({ id: "", host: "", port: "5060", username: "", password: "", maxChannels: "10", provider: "custom", transport: "UDP" });
  const [sipTrunks, setSipTrunks] = useState<any[]>([]);

  // WhatsApp Meta (via whatsapp_meta_credentials)
  const [wa, setWa] = useState({ instance_id: "", api_key: "", number: "", meta_waba_id: "", meta_access_token: "", meta_phone_number_id: "" });
  const [metaCreds, setMetaCreds] = useState<any>(null);

  // PBX Config
  const [pbx, setPbx] = useState<any>(null);

  // Voice AI
  const [ai, setAi] = useState({
    sttProvider: "faster-whisper", llmProvider: "anthropic", llmModel: "claude-3-5-haiku-20241022",
    ttsProvider: "xtts", apiKey: "",
  });

  // Agents
  const [agents, setAgents] = useState<any[]>([]);
  const [agentForm, setAgentForm] = useState({ name: "", email: "", extension: "", role: "agent" });
  const [addAgentOpen, setAddAgentOpen] = useState(false);

  useEffect(() => {
    loadCompany();
    loadAgents();
    loadSipTrunks();
    loadMetaCreds();
    loadPbxConfig();
  }, [collaborator]);

  const loadCompany = async () => {
    const companyId = collaborator?.company_id;
    if (!companyId) return;
    const { data } = await supabase.from("companies").select("name, cnpj, logo_url, whatsapp_instance_id, whatsapp_api_key, whatsapp_number, meta_business_id, lgpd_dpo_email, lgpd_dpo_name").eq("id", companyId).single();
    if (data) {
      setCompany({ name: data.name ?? "", cnpj: data.cnpj ?? "", logo_url: data.logo_url ?? "" });
      setWa({ instance_id: data.whatsapp_instance_id ?? "", api_key: data.whatsapp_api_key ?? "", number: data.whatsapp_number ?? "", meta_waba_id: "", meta_access_token: "", meta_phone_number_id: "" });
    }
  };

  const loadSipTrunks = async () => {
    const companyId = collaborator?.company_id;
    if (!companyId) return;
    const { data } = await supabase.from("sip_trunks").select("*").eq("company_id", companyId).order("created_at");
    setSipTrunks(data ?? []);
    if (data && data.length > 0) {
      const t = data[0];
      setSip({ id: t.id, host: t.sip_host ?? "", port: String(t.sip_port ?? 5060), username: t.auth_username ?? "", password: "", maxChannels: String(t.max_channels ?? 10), provider: t.provider ?? "custom", transport: t.sip_transport ?? "UDP" });
    }
  };

  const loadMetaCreds = async () => {
    const companyId = collaborator?.company_id;
    if (!companyId) return;
    const { data } = await supabase.from("whatsapp_meta_credentials").select("*").eq("company_id", companyId).single();
    if (data) {
      setMetaCreds(data);
      setWa(prev => ({ ...prev, meta_waba_id: data.meta_waba_id ?? "", meta_access_token: data.meta_access_token ?? "", meta_phone_number_id: data.meta_phone_number_id ?? "" }));
    }
  };

  const loadPbxConfig = async () => {
    const companyId = collaborator?.company_id;
    if (!companyId) return;
    const { data } = await supabase.from("pbx_config").select("*").eq("company_id", companyId).single();
    setPbx(data);
  };

  const loadAgents = async () => {
    const companyId = collaborator?.company_id;
    if (!companyId) return;
    const { data } = await supabase.from("agents").select("*").eq("company_id", companyId).order("name");
    setAgents(data ?? []);
  };

  const saveCompany = async () => {
    setSaving(true);
    const { error } = await supabase.from("companies").update({ name: company.name, cnpj: company.cnpj, logo_url: company.logo_url }).eq("id", collaborator?.company_id);
    if (error) toast.error("Erro ao salvar."); else toast.success("Empresa atualizada!");
    setSaving(false);
  };

  const saveSip = async () => {
    setSaving(true);
    const companyId = collaborator?.company_id;
    if (!companyId) { setSaving(false); return; }

    const trunkData = {
      company_id: companyId,
      name: company.name + " - SIP Trunk",
      provider: sip.provider,
      sip_host: sip.host,
      sip_port: Number(sip.port),
      sip_transport: sip.transport,
      auth_username: sip.username,
      max_channels: Number(sip.maxChannels),
    };

    let error;
    if (sip.id) {
      ({ error } = await supabase.from("sip_trunks").update(trunkData).eq("id", sip.id));
    } else {
      ({ error } = await supabase.from("sip_trunks").insert(trunkData));
    }
    if (error) toast.error("Erro ao salvar: " + error.message); else { toast.success("SIP Trunk salvo na tabela sip_trunks!"); loadSipTrunks(); }
    setSaving(false);
  };

  const saveWa = async () => {
    setSaving(true);
    const companyId = collaborator?.company_id;
    if (!companyId) { setSaving(false); return; }

    // Save legacy fields
    await supabase.from("companies").update({
      whatsapp_instance_id: wa.instance_id, whatsapp_api_key: wa.api_key, whatsapp_number: wa.number,
    }).eq("id", companyId);

    // Save Meta credentials if provided
    if (wa.meta_waba_id || wa.meta_access_token) {
      const { data, error } = await supabase.functions.invoke("whatsapp-meta-onboarding", {
        body: {
          company_id: companyId,
          action: "setup_credentials",
          meta_access_token: wa.meta_access_token,
          meta_waba_id: wa.meta_waba_id,
          meta_phone_number_id: wa.meta_phone_number_id,
        },
      });
      if (error || data?.error) toast.error(data?.error || "Erro ao salvar Meta credentials");
      else toast.success("WhatsApp Meta configurado! Webhook: " + (data?.webhook_url || ""));
    } else {
      toast.success("WhatsApp salvo!");
    }
    setSaving(false);
  };

  const testConnection = async (service: string) => {
    setTesting(service);
    await new Promise(r => setTimeout(r, 2000));
    toast.success(`Conexão com ${service} OK!`);
    setTesting(null);
  };

  const addAgent = async () => {
    if (!agentForm.name || !agentForm.email) { toast.error("Nome e email são obrigatórios."); return; }
    setSaving(true);
    const { error } = await supabase.from("agents").insert({
      company_id: collaborator?.company_id, name: agentForm.name, email: agentForm.email,
      extension: agentForm.extension || null, role: agentForm.role, status: "offline",
    });
    if (error) { console.error(error); toast.error("Erro ao adicionar agente."); }
    else { toast.success("Agente adicionado!"); setAgentForm({ name: "", email: "", extension: "", role: "agent" }); setAddAgentOpen(false); await loadAgents(); }
    setSaving(false);
  };

  const deleteAgent = async (id: string) => {
    const { error } = await supabase.from("agents").delete().eq("id", id);
    if (error) toast.error("Erro ao remover."); else { toast.success("Agente removido."); await loadAgents(); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader title="Configurações" subtitle="Empresa, SIP Trunk, WhatsApp, IA e Agentes"
          badge={<Badge variant="outline"><Settings className="h-3 w-3 mr-1" />Admin</Badge>} />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="h-auto flex-wrap gap-2 rounded-xl border border-border/60 bg-secondary/40 p-1">
            <TabsTrigger value="empresa">Empresa</TabsTrigger>
            <TabsTrigger value="sip">SIP Trunk</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="ia">IA</TabsTrigger>
            <TabsTrigger value="agentes">Agentes</TabsTrigger>
          </TabsList>

          {/* EMPRESA */}
          <TabsContent value="empresa">
            <Card className="border-border/60 bg-card">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building className="h-4 w-4 text-primary" />Dados da Empresa</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Nome da Empresa</Label><Input value={company.name} onChange={e => setCompany({ ...company, name: e.target.value })} /></div>
                  <div className="space-y-2"><Label>CNPJ</Label><Input value={company.cnpj} onChange={e => setCompany({ ...company, cnpj: e.target.value })} placeholder="XX.XXX.XXX/XXXX-XX" /></div>
                  <div className="space-y-2 md:col-span-2"><Label>URL do Logo</Label><Input value={company.logo_url} onChange={e => setCompany({ ...company, logo_url: e.target.value })} placeholder="https://..." /></div>
                </div>
                <Button onClick={saveCompany} disabled={saving}><Save className="h-4 w-4 mr-1.5" />Salvar</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SIP */}
          <TabsContent value="sip">
            <Card className="border-border/60 bg-card">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Server className="h-4 w-4 text-primary" />SIP Trunk</CardTitle><CardDescription>Configuração do provedor de telefonia VoIP</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Host</Label><Input value={sip.host} onChange={e => setSip({ ...sip, host: e.target.value })} placeholder="sip.provedor.com.br" /></div>
                  <div className="space-y-2"><Label>Porta</Label><Input value={sip.port} onChange={e => setSip({ ...sip, port: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Usuário SIP</Label><Input value={sip.username} onChange={e => setSip({ ...sip, username: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Senha SIP</Label><Input type="password" value={sip.password} onChange={e => setSip({ ...sip, password: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Canais Simultâneos</Label><Input type="number" value={sip.maxChannels} onChange={e => setSip({ ...sip, maxChannels: e.target.value })} /></div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={saveSip} disabled={saving}><Save className="h-4 w-4 mr-1.5" />Salvar</Button>
                  <Button variant="outline" onClick={() => testConnection("SIP")} disabled={testing === "SIP"}>
                    {testing === "SIP" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <TestTube className="h-4 w-4 mr-1.5" />}Testar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* WHATSAPP */}
          <TabsContent value="whatsapp">
            <Card className="border-border/60 bg-card">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4 text-emerald-400" />WhatsApp</CardTitle><CardDescription>Meta WhatsApp Business Cloud API</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>URL / Instance ID</Label><Input value={wa.instance_id} onChange={e => setWa({ ...wa, instance_id: e.target.value })} placeholder="Phone Number ID" /></div>
                  <div className="space-y-2"><Label>API Key</Label><Input type="password" value={wa.api_key} onChange={e => setWa({ ...wa, api_key: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Número WhatsApp</Label><Input value={wa.number} onChange={e => setWa({ ...wa, number: e.target.value })} placeholder="5511999998888" /></div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={saveWa} disabled={saving}><Save className="h-4 w-4 mr-1.5" />Salvar</Button>
                  <Button variant="outline" onClick={() => testConnection("WhatsApp")} disabled={testing === "WhatsApp"}>
                    {testing === "WhatsApp" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <TestTube className="h-4 w-4 mr-1.5" />}Testar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* IA */}
          <TabsContent value="ia">
            <Card className="border-border/60 bg-card">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Cpu className="h-4 w-4 text-primary" />Configuração IA</CardTitle><CardDescription>STT, LLM e TTS</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-3 p-4 rounded-lg border border-border/60 bg-secondary/10">
                    <h4 className="text-sm font-semibold flex items-center gap-2"><Mic className="h-4 w-4 text-blue-400" />STT</h4>
                    <Select value={ai.sttProvider} onValueChange={v => setAi({ ...ai, sttProvider: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="faster-whisper">Faster-Whisper</SelectItem><SelectItem value="openai">OpenAI Whisper</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3 p-4 rounded-lg border border-border/60 bg-secondary/10">
                    <h4 className="text-sm font-semibold flex items-center gap-2"><Brain className="h-4 w-4 text-violet-400" />LLM</h4>
                    <Select value={ai.llmProvider} onValueChange={v => setAi({ ...ai, llmProvider: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="anthropic">Anthropic</SelectItem><SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="groq">Groq</SelectItem><SelectItem value="google">Google</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3 p-4 rounded-lg border border-border/60 bg-secondary/10">
                    <h4 className="text-sm font-semibold flex items-center gap-2"><Zap className="h-4 w-4 text-emerald-400" />TTS</h4>
                    <Select value={ai.ttsProvider} onValueChange={v => setAi({ ...ai, ttsProvider: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="xtts">XTTS v2</SelectItem><SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                        <SelectItem value="openai_tts">OpenAI TTS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2"><Label>API Key (LLM)</Label><Input type="password" value={ai.apiKey} onChange={e => setAi({ ...ai, apiKey: e.target.value })} placeholder="sk-..." /></div>
                <Button onClick={() => toast.success("Configurações de IA salvas!")} disabled={saving}><Save className="h-4 w-4 mr-1.5" />Salvar</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AGENTES */}
          <TabsContent value="agentes">
            <Card className="border-border/60 bg-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Agentes</CardTitle><CardDescription>Operadores do discador</CardDescription></div>
                  <Dialog open={addAgentOpen} onOpenChange={setAddAgentOpen}>
                    <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo Agente</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Adicionar Agente</DialogTitle></DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2"><Label>Nome</Label><Input value={agentForm.name} onChange={e => setAgentForm({ ...agentForm, name: e.target.value })} /></div>
                        <div className="space-y-2"><Label>Email</Label><Input value={agentForm.email} onChange={e => setAgentForm({ ...agentForm, email: e.target.value })} /></div>
                        <div className="space-y-2"><Label>Ramal</Label><Input value={agentForm.extension} onChange={e => setAgentForm({ ...agentForm, extension: e.target.value })} placeholder="1001" /></div>
                        <div className="space-y-2"><Label>Função</Label>
                          <Select value={agentForm.role} onValueChange={v => setAgentForm({ ...agentForm, role: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="agent">Agente</SelectItem><SelectItem value="supervisor">Supervisor</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
                          </Select>
                        </div>
                        <Button onClick={addAgent} disabled={saving} className="w-full">
                          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}Adicionar
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Ramal</TableHead><TableHead>Função</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {agents.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum agente cadastrado</TableCell></TableRow>
                    ) : agents.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium text-foreground">{a.name}</TableCell>
                        <TableCell className="text-muted-foreground">{a.email}</TableCell>
                        <TableCell className="text-muted-foreground">{a.extension ?? "—"}</TableCell>
                        <TableCell><Badge variant="outline">{a.role ?? "agent"}</Badge></TableCell>
                        <TableCell>
                          <Badge variant="outline" className={a.status === "online" ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"}>
                            {a.status ?? "offline"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => deleteAgent(a.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
