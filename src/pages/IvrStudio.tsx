import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { EDGE_BASE } from "@/lib/constants";
import { toast } from "sonner";
import { Loader2, Play, MessageSquare, Volume2, Zap, GitBranch, Tag, CheckCircle2, AlertCircle, PhoneCall } from "lucide-react";

type IvrScript = {
  id: string;
  company_id: string;
  voice_profile_id: string;
  intent: string;
  variation_key: string;
  category: string;
  text_raw: string;
  text_v3: string;
  audio_url: string | null;
  audio_duration_ms: number | null;
  training_examples: string[];
  branch_hints: Record<string, string | boolean>;
  notes: string | null;
};

type Company = { id: string; name: string };
type Voice = { id: string; voice_name: string; gender: string; voice_key: string };

const CATEGORY_ORDER = ["opening", "pitch", "info", "benefit", "handoff", "close", "redirect", "objection", "compliance", "goodbye", "probe", "edge"];
const CATEGORY_LABEL: Record<string, string> = {
  opening: "Aberturas", pitch: "Pitch", info: "Informação", benefit: "Benefícios",
  handoff: "Handoff", close: "Fechamento", redirect: "Redirect WhatsApp",
  objection: "Objeções", compliance: "Compliance", goodbye: "Despedidas",
  probe: "Sondagem", edge: "Edge cases",
};

export default function IvrStudio() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [scripts, setScripts] = useState<IvrScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<IvrScript | null>(null);
  const [audioPlaying, setAudioPlaying] = useState<string | null>(null);

  // Classifier tester
  const [testTranscript, setTestTranscript] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // IVR dial tester
  const [dialPhone, setDialPhone] = useState("");
  const [dialing, setDialing] = useState(false);
  const [dialResult, setDialResult] = useState<{ room?: string; call_id?: string | null; error?: string } | null>(null);

  // Load dimensions
  useEffect(() => {
    (async () => {
      const { data: scriptRows } = await supabase
        .from("ivr_audio_scripts")
        .select("company_id, voice_profile_id")
        .eq("is_active", true);
      if (!scriptRows?.length) { setLoading(false); return; }

      const companyIds = [...new Set(scriptRows.map(s => s.company_id))];
      const voiceIds = [...new Set(scriptRows.map(s => s.voice_profile_id))];

      const [{ data: cData }, { data: vData }] = await Promise.all([
        supabase.from("companies").select("id, name").in("id", companyIds),
        supabase.from("voice_profiles").select("id, voice_name, gender, voice_key").in("id", voiceIds),
      ]);
      setCompanies((cData ?? []) as Company[]);
      setVoices((vData ?? []) as Voice[]);
      if (cData?.length && !selectedCompany) setSelectedCompany(cData[0].id);
      if (vData?.length && !selectedVoice) setSelectedVoice(vData[0].id);
    })();
  }, []);

  // Load scripts for selected filters
  useEffect(() => {
    if (!selectedCompany || !selectedVoice) return;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("ivr_audio_scripts")
        .select("*")
        .eq("company_id", selectedCompany)
        .eq("voice_profile_id", selectedVoice)
        .eq("is_active", true)
        .order("category")
        .order("intent");
      if (error) toast.error(error.message);
      setScripts((data ?? []) as IvrScript[]);
      setSelected(null);
      setLoading(false);
    })();
  }, [selectedCompany, selectedVoice]);

  const grouped = useMemo(() => {
    const out: Record<string, IvrScript[]> = {};
    for (const s of scripts) (out[s.category] ??= []).push(s);
    const keys = Object.keys(out).sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a); const ib = CATEGORY_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    return { out, keys };
  }, [scripts]);

  const stats = useMemo(() => {
    const total = scripts.length;
    const rendered = scripts.filter(s => !!s.audio_url).length;
    const withExamples = scripts.filter(s => (s.training_examples?.length ?? 0) > 0).length;
    return { total, rendered, withExamples };
  }, [scripts]);

  async function playAudio(url: string, id: string) {
    if (audioPlaying === id) { setAudioPlaying(null); return; }
    setAudioPlaying(id);
    const audio = new Audio(url);
    audio.onended = () => setAudioPlaying(null);
    audio.onerror = () => { setAudioPlaying(null); toast.error("Erro ao tocar áudio"); };
    audio.play().catch(() => setAudioPlaying(null));
  }

  async function testClassifier() {
    if (!testTranscript.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${EDGE_BASE}/ivr-classify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "",
        },
        body: JSON.stringify({
          company_id: selectedCompany,
          voice_profile_id: selectedVoice,
          transcript: testTranscript,
        }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.intent_id) {
        const match = scripts.find(s => s.intent === data.intent_id);
        if (match) setSelected(match);
      }
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
    setTesting(false);
  }

  async function dialIvr() {
    const digits = dialPhone.replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("Número inválido");
      return;
    }
    setDialing(true);
    setDialResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("make-call", {
        body: {
          action: "dial",
          route: "ivr",
          to: dialPhone,
          company_id: selectedCompany,
          voice_profile_id: selectedVoice,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.detail || data.error);
      setDialResult({ room: data.room, call_id: data.call_id });
      toast.success(`Ligação IVR iniciada — sala ${data.room}`);
    } catch (err: any) {
      const msg = err?.message || String(err);
      setDialResult({ error: msg });
      toast.error("Falha: " + msg);
    }
    setDialing(false);
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary" /> IVR Studio
            </h1>
            <p className="text-sm text-muted-foreground">
              Árvore de intents cacheáveis — áudios v3 ElevenLabs + classificador semântico
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1.5">
              <Tag className="h-3 w-3" /> {stats.total} intents
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <Volume2 className="h-3 w-3" />
              {stats.rendered}/{stats.total} renderizados
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <MessageSquare className="h-3 w-3" />
              {stats.withExamples} com exemplos
            </Badge>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Empresa:</Label>
            <div className="flex gap-1">
              {companies.map(c => (
                <Button
                  key={c.id}
                  size="sm"
                  variant={selectedCompany === c.id ? "default" : "outline"}
                  onClick={() => setSelectedCompany(c.id)}
                >
                  {c.name}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Voz:</Label>
            <div className="flex gap-1">
              {voices.map(v => (
                <Button
                  key={v.id}
                  size="sm"
                  variant={selectedVoice === v.id ? "default" : "outline"}
                  onClick={() => setSelectedVoice(v.id)}
                >
                  {v.gender === "female" ? "👩 " : "👨 "}
                  {v.voice_name.split(" ")[0]}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4 min-h-[600px]">
          {/* Left: IVR tree */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Árvore IVR</span>
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[700px] overflow-y-auto">
              {grouped.keys.length === 0 && !loading ? (
                <p className="text-center text-sm text-muted-foreground py-10">
                  Nenhum script pra esta empresa/voz.
                </p>
              ) : (
                <Accordion type="multiple" defaultValue={grouped.keys} className="px-2">
                  {grouped.keys.map(cat => (
                    <AccordionItem key={cat} value={cat} className="border-b-border/40">
                      <AccordionTrigger className="hover:no-underline py-2 text-sm">
                        <span className="flex items-center gap-2">
                          <span className="font-medium">{CATEGORY_LABEL[cat] ?? cat}</span>
                          <span className="text-xs text-muted-foreground">({grouped.out[cat].length})</span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pb-1">
                        <div className="space-y-1">
                          {grouped.out[cat].map(s => (
                            <button
                              key={s.id}
                              onClick={() => setSelected(s)}
                              className={`w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors ${
                                selected?.id === s.id ? "bg-accent border-l-2 border-primary" : ""
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-xs truncate">{s.intent}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                  {s.audio_url && (
                                    <Volume2 className="h-3 w-3 text-green-500" />
                                  )}
                                  {(s.training_examples?.length ?? 0) > 0 && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {s.training_examples.length}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                {s.text_raw}
                              </p>
                            </button>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>

          {/* Right: Details + classifier tester */}
          <div className="space-y-4">
            {/* IVR dial tester */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <PhoneCall className="h-4 w-4 text-primary" />
                  Testar ligação IVR
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="+5531987654321"
                    value={dialPhone}
                    onChange={e => setDialPhone(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && dialIvr()}
                    disabled={dialing || !selectedCompany || !selectedVoice}
                  />
                  <Button onClick={dialIvr} disabled={dialing || !dialPhone.trim() || !selectedCompany || !selectedVoice}>
                    {dialing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Discar"}
                  </Button>
                </div>
                {dialResult?.room && (
                  <div className="rounded-md px-3 py-2 text-xs border bg-green-500/10 border-green-500/30 text-green-200">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      sala <strong className="font-mono">{dialResult.room}</strong>
                      {dialResult.call_id && <> · call_id <span className="font-mono">{dialResult.call_id}</span></>}
                    </span>
                  </div>
                )}
                {dialResult?.error && (
                  <div className="rounded-md px-3 py-2 text-xs border bg-red-500/10 border-red-500/30 text-red-200">
                    <span className="flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {dialResult.error}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Classifier tester */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Testar classificador
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder='Digite uma fala do lead (ex: "tá caro demais")'
                    value={testTranscript}
                    onChange={e => setTestTranscript(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && testClassifier()}
                    disabled={testing}
                  />
                  <Button onClick={testClassifier} disabled={testing || !testTranscript.trim()}>
                    {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Classificar"}
                  </Button>
                </div>
                {testResult && (
                  <div className={`rounded-md px-3 py-2 text-xs border ${
                    testResult.fallback_to_llm
                      ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-200"
                      : "bg-green-500/10 border-green-500/30 text-green-200"
                  }`}>
                    {testResult.fallback_to_llm ? (
                      <span className="flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <strong>fallback_to_llm</strong> — confidence baixa ({testResult.confidence})
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <strong>{testResult.intent_id}</strong> · conf {testResult.confidence} · {testResult.reason}
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Intent detail */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {selected ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{selected.category}</Badge>
                        <span className="font-mono">{selected.intent}</span>
                      </span>
                      {selected.audio_url ? (
                        <Badge className="bg-green-500/15 text-green-400 border-0 gap-1">
                          <Volume2 className="h-3 w-3" /> renderizado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 border-orange-500/30 text-orange-400">
                          <AlertCircle className="h-3 w-3" /> sem áudio
                        </Badge>
                      )}
                    </div>
                  ) : "Selecione um intent"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selected ? (
                  <p className="text-center text-sm text-muted-foreground py-10">
                    Clique em qualquer nó na árvore ou classifique uma fala acima.
                  </p>
                ) : (
                  <Tabs defaultValue="content" className="space-y-3">
                    <TabsList>
                      <TabsTrigger value="content">Conteúdo</TabsTrigger>
                      <TabsTrigger value="examples">
                        Exemplos ({selected.training_examples?.length ?? 0})
                      </TabsTrigger>
                      <TabsTrigger value="branches">Transições</TabsTrigger>
                    </TabsList>

                    <TabsContent value="content" className="space-y-3">
                      {selected.audio_url && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => playAudio(selected.audio_url!, selected.id)}
                            className="gap-2"
                          >
                            <Play className="h-4 w-4" />
                            {audioPlaying === selected.id ? "Tocando..." : "Tocar áudio"}
                          </Button>
                          <audio controls src={selected.audio_url} className="h-8" />
                        </div>
                      )}

                      <div>
                        <Label className="text-xs text-muted-foreground">Texto base</Label>
                        <p className="text-sm bg-muted/40 rounded-md p-3 mt-1">{selected.text_raw}</p>
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground">Texto com audio tags (v3)</Label>
                        <p className="text-sm bg-primary/5 border border-primary/20 rounded-md p-3 mt-1 font-mono leading-relaxed">
                          {renderTaggedText(selected.text_v3)}
                        </p>
                      </div>

                      {selected.notes && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Notas</Label>
                          <p className="text-xs text-muted-foreground mt-1">{selected.notes}</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="examples">
                      {(selected.training_examples?.length ?? 0) === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">Sem exemplos cadastrados.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {selected.training_examples.map((ex, i) => (
                            <Badge key={i} variant="outline" className="text-xs font-mono">
                              {ex}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="branches">
                      {Object.keys(selected.branch_hints ?? {}).length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">Sem transições definidas.</p>
                      ) : (
                        <div className="space-y-2">
                          {Object.entries(selected.branch_hints).map(([key, val]) => (
                            <div key={key} className="flex items-center gap-2 text-sm">
                              <Badge variant="outline" className="text-[10px] font-mono">{key}</Badge>
                              <span className="text-muted-foreground">→</span>
                              {val === true ? (
                                <Badge className="bg-red-500/15 text-red-400 border-0">terminal</Badge>
                              ) : (
                                <button
                                  className="font-mono text-xs text-primary hover:underline"
                                  onClick={() => {
                                    const target = scripts.find(s => s.intent === val);
                                    if (target) setSelected(target);
                                  }}
                                >
                                  {String(val)}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

/** Realça tags v3 [warm][softly] etc no texto */
function renderTaggedText(text: string) {
  const parts = text.split(/(\[[a-z ]+\])/gi);
  return parts.map((p, i) =>
    /^\[.*\]$/.test(p) ? (
      <span key={i} className="inline-block px-1 py-0.5 mx-0.5 rounded bg-primary/20 text-primary text-[10px] font-bold uppercase">
        {p.slice(1, -1)}
      </span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}
