import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Library, Play, Pause, Volume2, Search, Building2, Mic } from "lucide-react";

type Script = {
  id: string;
  company_id: string;
  voice_profile_id: string;
  intent: string;
  category: string;
  text_raw: string;
  text_v3: string;
  audio_url: string | null;
  audio_duration_ms: number | null;
};

type Company = { id: string; name: string };
type Voice = { id: string; voice_name: string; gender: string; voice_key: string; description: string | null };

const CATEGORY_ORDER = ["opening", "pitch", "info", "benefit", "handoff", "close", "redirect", "objection", "compliance", "goodbye", "probe", "edge"];
const CATEGORY_LABEL: Record<string, string> = {
  opening: "Aberturas", pitch: "Pitch", info: "Informação", benefit: "Benefícios",
  handoff: "Handoff WhatsApp", close: "Fechamento", redirect: "Redirect WhatsApp",
  objection: "Objeções", compliance: "Compliance", goodbye: "Despedidas",
  probe: "Sondagem", edge: "Edge cases",
};

export default function VoiceLibrary() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<string | null>(null);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);

  // Filters
  const [selCompany, setSelCompany] = useState<string>("__all");
  const [selVoice, setSelVoice] = useState<string>("__all");
  const [selCategory, setSelCategory] = useState<string>("__all");
  const [search, setSearch] = useState("");

  // Load dimensions + all scripts
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: scriptRows } = await supabase
        .from("ivr_audio_scripts")
        .select("id, company_id, voice_profile_id, intent, category, text_raw, text_v3, audio_url, audio_duration_ms")
        .eq("is_active", true)
        .not("audio_url", "is", null);
      const rows = (scriptRows ?? []) as Script[];
      setScripts(rows);

      const companyIds = [...new Set(rows.map(s => s.company_id))];
      const voiceIds = [...new Set(rows.map(s => s.voice_profile_id))];

      const [{ data: cData }, { data: vData }] = await Promise.all([
        supabase.from("companies").select("id, name").in("id", companyIds),
        supabase.from("voice_profiles").select("id, voice_name, gender, voice_key, description").in("id", voiceIds),
      ]);
      setCompanies((cData ?? []) as Company[]);
      setVoices((vData ?? []) as Voice[]);
      setLoading(false);
    })();
  }, []);

  const companyMap = useMemo(() => Object.fromEntries(companies.map(c => [c.id, c.name])), [companies]);
  const voiceMap = useMemo(() => Object.fromEntries(voices.map(v => [v.id, v])), [voices]);

  const filtered = useMemo(() => {
    let out = scripts;
    if (selCompany !== "__all") out = out.filter(s => s.company_id === selCompany);
    if (selVoice !== "__all") out = out.filter(s => s.voice_profile_id === selVoice);
    if (selCategory !== "__all") out = out.filter(s => s.category === selCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(s => s.intent.toLowerCase().includes(q) || s.text_raw.toLowerCase().includes(q));
    }
    return out;
  }, [scripts, selCompany, selVoice, selCategory, search]);

  const grouped = useMemo(() => {
    const by: Record<string, Record<string, Script[]>> = {};
    for (const s of filtered) {
      const co = companyMap[s.company_id] ?? "?";
      const key = `${co}·${voiceMap[s.voice_profile_id]?.voice_name ?? "?"}`;
      by[key] ??= {};
      by[key][s.category] ??= [];
      by[key][s.category].push(s);
    }
    return by;
  }, [filtered, companyMap, voiceMap]);

  const play = (url: string, id: string) => {
    if (playing === id && audioEl) {
      audioEl.pause();
      setPlaying(null);
      return;
    }
    if (audioEl) audioEl.pause();
    const a = new Audio(url);
    a.onended = () => setPlaying(null);
    a.onerror = () => { setPlaying(null); toast.error("Erro ao tocar áudio"); };
    a.play().catch(() => setPlaying(null));
    setAudioEl(a);
    setPlaying(id);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Library className="h-5 w-5 text-primary" /> Biblioteca de Vozes
            </h1>
            <p className="text-sm text-muted-foreground">
              Todas as amostras v3 ElevenLabs — filtrar por empresa, persona e tema.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1.5">
              <Mic className="h-3 w-3" /> {voices.length} vozes
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <Building2 className="h-3 w-3" /> {companies.length} empresas
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <Volume2 className="h-3 w-3" /> {scripts.length} áudios
            </Badge>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-3 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Empresa</Label>
              <select
                className="w-full mt-1 px-2 py-1.5 rounded-md border border-border bg-background text-sm"
                value={selCompany}
                onChange={e => setSelCompany(e.target.value)}
              >
                <option value="__all">Todas</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Voz / Persona</Label>
              <select
                className="w-full mt-1 px-2 py-1.5 rounded-md border border-border bg-background text-sm"
                value={selVoice}
                onChange={e => setSelVoice(e.target.value)}
              >
                <option value="__all">Todas</option>
                {voices.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.gender === "female" ? "👩 " : "👨 "}{v.voice_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Tema / Categoria</Label>
              <select
                className="w-full mt-1 px-2 py-1.5 rounded-md border border-border bg-background text-sm"
                value={selCategory}
                onChange={e => setSelCategory(e.target.value)}
              >
                <option value="__all">Todos</option>
                {CATEGORY_ORDER.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Buscar</Label>
              <div className="relative mt-1">
                <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
                <Input
                  className="pl-7 h-8 text-sm"
                  placeholder="intent ou texto"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grouped samples */}
        {loading ? (
          <p className="text-center text-sm text-muted-foreground py-10">Carregando…</p>
        ) : Object.keys(grouped).length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">
            Nenhuma amostra com esses filtros.
          </p>
        ) : (
          Object.entries(grouped).map(([groupKey, cats]) => {
            const [coName, voiceName] = groupKey.split("·");
            return (
              <Card key={groupKey}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Badge className="bg-blue-500/15 text-blue-400 border-0 text-[10px]">{coName}</Badge>
                    <Badge variant="outline" className="text-[10px]">{voiceName}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {Object.values(cats).reduce((a, b) => a + b.length, 0)} áudios
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {CATEGORY_ORDER.filter(c => cats[c]?.length).map(cat => (
                    <div key={cat}>
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">
                        {CATEGORY_LABEL[cat] ?? cat} · {cats[cat].length}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {cats[cat].map(s => (
                          <div
                            key={s.id}
                            className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2 py-1.5"
                          >
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0"
                              onClick={() => s.audio_url && play(s.audio_url, s.id)}
                            >
                              {playing === s.id ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                            </Button>
                            <div className="flex-1 min-w-0">
                              <div className="font-mono text-xs text-foreground truncate">{s.intent}</div>
                              <div className="text-[11px] text-muted-foreground line-clamp-1">
                                {s.text_raw}
                              </div>
                            </div>
                            <audio
                              src={s.audio_url ?? undefined}
                              controls
                              className="h-6 w-40 flex-shrink-0"
                              preload="none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </DashboardLayout>
  );
}
