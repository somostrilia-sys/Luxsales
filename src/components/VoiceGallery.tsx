/**
 * VoiceGallery — Galeria de vozes com player pra consultor ouvir antes de escolher.
 * Usado em Ligacoes.tsx e VoiceSimulate.tsx via aba "Vozes".
 */
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Play, Pause, Check, Search, Volume2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VoiceProfile } from "./VoiceSelector";

interface VoiceGalleryProps {
  selectedId: string | null;
  onSelect: (voice: VoiceProfile) => void;
  /** "cartesia" | "elevenlabs" | undefined (ambos). Define qual provider filtrar. */
  provider?: string;
  /** Quando informado, substitui voice.sample_url pelo áudio de opening da empresa
   *  (Lucas falando "da Objetivo" vs "da Trilia"). Usa bucket ivr-audios. */
  companyId?: string | null;
}

const LOCAL_KEY = "luxsales_selected_voice_id";

export function VoiceGallery({ selectedId, onSelect, provider, companyId }: VoiceGalleryProps) {
  const [voices, setVoices] = useState<(VoiceProfile & { sample_url?: string | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">("all");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      let q = supabase
        .from("voice_profiles")
        .select("id, voice_key, voice_name, voice_id, provider, gender, accent, description, is_default, sample_url")
        .eq("active", true)
        .order("is_default", { ascending: false })
        .order("voice_name");
      if (provider) q = q.eq("provider", provider);
      const { data, error } = await q;
      if (!mounted) return;
      if (error || !data) { setLoading(false); return; }

      // Override sample_url com opening específico da empresa, quando companyId presente
      const profiles = data as (VoiceProfile & { sample_url?: string | null })[];
      if (companyId && profiles.length) {
        const ids = profiles.map(p => p.id);
        const { data: samples } = await supabase
          .from("ivr_audio_scripts")
          .select("voice_profile_id, intent, audio_url")
          .in("voice_profile_id", ids)
          .eq("company_id", companyId)
          .like("intent", "opening_%")
          .not("audio_url", "is", null);
        if (samples?.length) {
          for (const p of profiles) {
            const matches = samples.filter(s => s.voice_profile_id === p.id);
            if (!matches.length) continue;
            // Prioridade: opening_qualificacao (Objetivo) > opening_generico (Trilia) > qualquer opening
            const preferred =
              matches.find(s => s.intent === "opening_qualificacao") ??
              matches.find(s => s.intent === "opening_generico") ??
              matches[0];
            p.sample_url = preferred.audio_url as string;
          }
        }
      }
      setVoices(profiles);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [provider, companyId]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handlePlay = (voice: VoiceProfile & { sample_url?: string | null }) => {
    if (!voice.sample_url) return;

    // Parar áudio atual se estiver tocando
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Se clicou no mesmo, só pausa
    if (playingId === voice.id) {
      setPlayingId(null);
      return;
    }

    setLoadingId(voice.id);
    const audio = new Audio(voice.sample_url);
    audioRef.current = audio;

    audio.addEventListener("loadeddata", () => setLoadingId(null));
    audio.addEventListener("play", () => setPlayingId(voice.id));
    audio.addEventListener("ended", () => {
      setPlayingId(null);
      audioRef.current = null;
    });
    audio.addEventListener("error", () => {
      setLoadingId(null);
      setPlayingId(null);
    });

    audio.play().catch(() => {
      setLoadingId(null);
      setPlayingId(null);
    });
  };

  const handleSelect = (voice: VoiceProfile) => {
    localStorage.setItem(LOCAL_KEY, voice.id);
    onSelect(voice);
  };

  const filtered = voices.filter((v) => {
    if (genderFilter !== "all" && v.gender !== genderFilter) return false;
    if (search && !v.voice_name.toLowerCase().includes(search.toLowerCase()) && !(v.description || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Carregando vozes...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar voz..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-900/60 border-slate-700"
          />
        </div>
        <Button
          size="sm"
          variant={genderFilter === "all" ? "default" : "outline"}
          onClick={() => setGenderFilter("all")}
        >
          Todas ({voices.length})
        </Button>
        <Button
          size="sm"
          variant={genderFilter === "male" ? "default" : "outline"}
          onClick={() => setGenderFilter("male")}
        >
          ♂ Masc ({voices.filter((v) => v.gender === "male").length})
        </Button>
        <Button
          size="sm"
          variant={genderFilter === "female" ? "default" : "outline"}
          onClick={() => setGenderFilter("female")}
        >
          ♀ Fem ({voices.filter((v) => v.gender === "female").length})
        </Button>
      </div>

      {/* Grid de vozes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((voice) => {
          const isSelected = selectedId === voice.id;
          const isPlaying = playingId === voice.id;
          const isLoadingThis = loadingId === voice.id;
          return (
            <Card
              key={voice.id}
              className={cn(
                "relative overflow-hidden transition-all cursor-pointer border-2",
                isSelected
                  ? "border-emerald-500 bg-emerald-500/5"
                  : "border-slate-800 bg-slate-900/60 hover:border-slate-600"
              )}
              onClick={() => handleSelect(voice)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg">
                      {voice.gender === "female" ? "♀" : voice.gender === "male" ? "♂" : "◈"}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{voice.voice_name}</div>
                      {voice.accent && (
                        <div className="text-xs text-slate-500 truncate">{voice.accent}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {voice.is_default && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[10px]">
                        default
                      </Badge>
                    )}
                    {isSelected && (
                      <Badge className="bg-emerald-600 text-white border-0 text-[10px]">
                        <Check className="h-3 w-3 mr-0.5" /> escolhida
                      </Badge>
                    )}
                  </div>
                </div>

                {voice.description && (
                  <p className="text-xs text-slate-400 line-clamp-2 mb-2">
                    {voice.description}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8"
                    disabled={!voice.sample_url}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlay(voice);
                    }}
                  >
                    {isLoadingThis ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : isPlaying ? (
                      <Pause className="h-3.5 w-3.5 mr-1" />
                    ) : (
                      <Play className="h-3.5 w-3.5 mr-1" />
                    )}
                    {voice.sample_url ? "Ouvir" : "Sem amostra"}
                  </Button>
                  {!isSelected && (
                    <Button
                      size="sm"
                      className="h-8 bg-emerald-600 hover:bg-emerald-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(voice);
                      }}
                    >
                      Usar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          <Volume2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Nenhuma voz encontrada
        </div>
      )}
    </div>
  );
}
