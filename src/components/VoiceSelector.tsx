/**
 * VoiceSelector — dropdown de vozes ElevenLabs pro consultor escolher
 * Usa tabela voice_profiles (Supabase), filtrada por active+provider.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Mic } from "lucide-react";

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
        // (opening_*) pra aquela empresa — evita oferecer voz sem amostra.
        if (companyId && list.length) {
          const ids = list.map(v => v.id);
          const { data: covered } = await supabase
            .from("ivr_audio_scripts")
            .select("voice_profile_id")
            .in("voice_profile_id", ids)
            .eq("company_id", companyId)
            .like("intent", "opening_%")
            .not("audio_url", "is", null);
          const coveredIds = new Set((covered ?? []).map(r => r.voice_profile_id));
          if (coveredIds.size) list = list.filter(v => coveredIds.has(v.id));
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

  return (
    <div className={className}>
      {showLabel && (
        <Label className="flex items-center gap-2 mb-2 text-sm text-slate-300">
          <Mic className="h-3.5 w-3.5" />
          {label}
        </Label>
      )}
      <Select value={value ?? ""} onValueChange={handleChange} disabled={loading}>
        <SelectTrigger className="bg-slate-900/60 border-slate-700">
          <SelectValue placeholder={loading ? "Carregando vozes..." : "Selecione uma voz"} />
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
      {selected?.description && (
        <p className="mt-1 text-xs text-slate-500 line-clamp-2">{selected.description}</p>
      )}
    </div>
  );
}
