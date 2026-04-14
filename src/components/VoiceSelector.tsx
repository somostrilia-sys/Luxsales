/**
 * VoiceSelector — dropdown de vozes ElevenLabs pro consultor escolher
 * Usa tabela voice_profiles (Supabase), filtrada por active+provider.
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mic, Play, Pause, Loader2 } from "lucide-react";

export interface VoiceProfile {
  id: string;
  voice_key: string;
  voice_name: string;
  voice_id: string;
  provider: string;
  gender: string | null;
  accent: string | null;
  description: string | null;
  is_default: boolean | null;
}

interface VoiceSelectorProps {
  value: string | null;
  onChange: (profile: VoiceProfile | null) => void;
  className?: string;
  label?: string;
  showLabel?: boolean;
  /** "cartesia" | "elevenlabs" | undefined (ambos) */
  provider?: string;
  /** companyId pra filtrar só vozes com amostra renderizada pra essa empresa (opcional) */
  companyId?: string | null;
}

const LOCAL_KEY = "luxsales_selected_voice_id";

/** Mantém só o nome da persona (Lucas/Cléo), descartando descrições entre parênteses. */
function shortName(full: string): string {
  if (!full) return "";
  return full.replace(/\s*\(.*?\)\s*/g, "").trim();
}

export function VoiceSelector({
  value,
  onChange,
  className,
  label = "Voz do Agente",
  showLabel = true,
  provider,
  companyId,
}: VoiceSelectorProps) {
  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [sampleUrls, setSampleUrls] = useState<Record<string, string>>({});
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      let q = supabase
        .from("voice_profiles")
        .select("id, voice_key, voice_name, voice_id, provider, gender, accent, description, is_default")
        .eq("active", true)
        .order("is_default", { ascending: false })
        .order("voice_name");
      if (provider) q = q.eq("provider", provider);
      const { data, error } = await q;

      if (!mounted) return;
      if (error) {
        console.error("Erro ao carregar vozes:", error);
      } else {
        let list = (data ?? []) as VoiceProfile[];

        // Quando companyId for passado, limita às vozes que têm áudio renderizado
        // (opening_*) pra aquela empresa — e coleta as URLs dos openings pra preview.
        if (companyId && list.length) {
          const ids = list.map(v => v.id);
          const { data: covered } = await supabase
            .from("ivr_audio_scripts")
            .select("voice_profile_id, intent, audio_url")
            .in("voice_profile_id", ids)
            .eq("company_id", companyId)
            .like("intent", "opening_%")
            .not("audio_url", "is", null);
          const samples: Record<string, string> = {};
          const coveredIds = new Set<string>();
          for (const row of covered ?? []) {
            coveredIds.add(row.voice_profile_id);
            // Prefere opening_qualificacao > opening_generico > qualquer opening
            const prev = samples[row.voice_profile_id];
            if (!prev || row.intent === "opening_qualificacao" || (row.intent === "opening_generico" && !prev.includes("opening_qualificacao"))) {
              samples[row.voice_profile_id] = row.audio_url as string;
            }
          }
          if (coveredIds.size) list = list.filter(v => coveredIds.has(v.id));
          setSampleUrls(samples);
        } else {
          setSampleUrls({});
        }

        setVoices(list);

        // Se não tem valor selecionado, usa localStorage ou default
        if (!value && list.length > 0) {
          const stored = localStorage.getItem(LOCAL_KEY);
          const fromStorage = stored ? list.find((v) => v.id === stored) : null;
          const defaultVoice = list.find((v) => v.is_default) || list[0];
          const pick = fromStorage || defaultVoice;
          onChange(pick as VoiceProfile);
        }
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [provider, companyId]);

  // Sincroniza quando outro componente (VoiceGallery) seleciona uma voz
  useEffect(() => {
    const handler = (e: Event) => {
      const voice = (e as CustomEvent).detail as VoiceProfile;
      if (voice && voice.id !== value) {
        onChange(voice);
      }
    };
    window.addEventListener("voice-selected", handler);
    return () => window.removeEventListener("voice-selected", handler);
  }, [value, onChange]);

  const handleChange = (voiceId: string) => {
    const profile = voices.find((v) => v.id === voiceId) || null;
    if (profile) {
      localStorage.setItem(LOCAL_KEY, profile.id);
    }
    onChange(profile);
  };

  const selected = voices.find((v) => v.id === value);

  const playSample = () => {
    if (!selected) return;
    const url = sampleUrls[selected.id];
    if (!url) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (playingId === selected.id) {
      setPlayingId(null);
      return;
    }

    const audio = new Audio(url);
    audio.onended = () => { setPlayingId(null); audioRef.current = null; };
    audio.onerror = () => { setPlayingId(null); audioRef.current = null; };
    audio.play().catch(() => setPlayingId(null));
    audioRef.current = audio;
    setPlayingId(selected.id);
  };

  // Limpa áudio ao desmontar
  useEffect(() => () => { if (audioRef.current) audioRef.current.pause(); }, []);

  return (
    <div className={className}>
      {showLabel && (
        <Label className="flex items-center gap-2 mb-2 text-sm text-slate-300">
          <Mic className="h-3.5 w-3.5" />
          {label}
        </Label>
      )}
      <div className="flex items-center gap-2 min-w-0">
        <Select value={value ?? ""} onValueChange={handleChange} disabled={loading}>
          <SelectTrigger className="bg-slate-900/60 border-slate-700 flex-1 min-w-0 max-w-full">
            <SelectValue placeholder={loading ? "Carregando vozes..." : "Selecione uma voz"}>
              {selected ? (
                <span className="flex items-center gap-1.5 min-w-0 truncate">
                  <span className="text-slate-400 shrink-0">
                    {selected.gender === "female" ? "♀" : selected.gender === "male" ? "♂" : "◈"}
                  </span>
                  <span className="font-medium truncate">{shortName(selected.voice_name)}</span>
                </span>
              ) : null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {voices.map((v) => {
              const genderIcon = v.gender === "female" ? "♀" : v.gender === "male" ? "♂" : "◈";
              return (
                <SelectItem key={v.id} value={v.id}>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">{genderIcon}</span>
                    <span className="font-medium">{v.voice_name}</span>
                    {v.accent && <span className="text-xs text-slate-500">· {v.accent}</span>}
                    {v.is_default && <span className="text-xs text-emerald-400">· default</span>}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {selected && sampleUrls[selected.id] && (
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-9 w-9 shrink-0"
            onClick={playSample}
            title="Ouvir amostra"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> :
             playingId === selected.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
        )}
      </div>
      {selected?.description && (
        <p className="mt-1 text-xs text-slate-500 line-clamp-2 break-words">{selected.description}</p>
      )}
    </div>
  );
}
