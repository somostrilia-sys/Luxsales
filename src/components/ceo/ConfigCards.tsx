import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save, Crown, Users, ShieldCheck } from "lucide-react";
import { ApiKeyInput } from "./ApiKeyInput";

interface ConfigValues {
  anthropic_api_key_ceo: string;
  ceo_model: string;
  api_key_agent_1: string;
  api_key_agent_2: string;
  api_key_agent_3: string;
  api_key_agent_4: string;
  anthropic_api_key_staff: string;
}

const DEFAULT_VALUES: ConfigValues = {
  anthropic_api_key_ceo: "",
  ceo_model: "claude-opus-4-5",
  api_key_agent_1: "",
  api_key_agent_2: "",
  api_key_agent_3: "",
  api_key_agent_4: "",
  anthropic_api_key_staff: "",
};

export function ConfigCards() {
  const { toast } = useToast();
  const [values, setValues] = useState<ConfigValues>({ ...DEFAULT_VALUES });
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  async function loadConfigs() {
    const { data } = await supabase.from("system_configs").select("*");
    if (data) {
      const next = { ...DEFAULT_VALUES };
      data.forEach((c) => {
        if (c.key in next) {
          (next as any)[c.key] = c.value;
        }
      });
      setValues(next);
    }
  }

  function set(key: keyof ConfigValues, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function upsertKeys(keys: (keyof ConfigValues)[], cardId: string) {
    setSaving(cardId);
    try {
      for (const key of keys) {
        await supabase
          .from("system_configs")
          .update({ value: values[key], updated_at: new Date().toISOString() })
          .eq("key", key);
      }
      toast({ title: "Configurações salvas!" });
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
    setSaving(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* CEO Card - Gold border */}
      <Card className="border-2 border-yellow-500/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            API Key do CEO (Bolt)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Usada exclusivamente pelo Bolt para orquestração e análise
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <ApiKeyInput
            label="API Key Anthropic"
            value={values.anthropic_api_key_ceo}
            onChange={(v) => set("anthropic_api_key_ceo", v)}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Modelo</label>
            <Select value={values.ceo_model} onValueChange={(v) => set("ceo_model", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude-opus-4-5">claude-opus-4-5</SelectItem>
                <SelectItem value="claude-sonnet-4-6">claude-sonnet-4-6</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => upsertKeys(["anthropic_api_key_ceo", "ceo_model"], "ceo")}
            disabled={saving === "ceo"}
            className="w-full gap-2"
          >
            <Save className="h-4 w-4" />
            {saving === "ceo" ? "Salvando..." : "Salvar"}
          </Button>
        </CardContent>
      </Card>

      {/* Agents Pool Card - Blue border */}
      <Card className="border-2 border-blue-500/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            Pool de API Keys dos Agentes
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Distribuída entre os 80 bots (rotação anti-rate-limit)
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {([1, 2, 3, 4] as const).map((n) => (
            <ApiKeyInput
              key={n}
              label={`Chave ${n}`}
              value={values[`api_key_agent_${n}` as keyof ConfigValues]}
              onChange={(v) => set(`api_key_agent_${n}` as keyof ConfigValues, v)}
            />
          ))}
          <p className="text-xs text-muted-foreground italic">
            Modelo fixo: claude-sonnet-4-6
          </p>
          <Button
            onClick={() =>
              upsertKeys(
                ["api_key_agent_1", "api_key_agent_2", "api_key_agent_3", "api_key_agent_4"],
                "agents"
              )
            }
            disabled={saving === "agents"}
            className="w-full gap-2"
          >
            <Save className="h-4 w-4" />
            {saving === "agents" ? "Salvando..." : "Salvar"}
          </Button>
        </CardContent>
      </Card>

      {/* Staff Card - Green border */}
      <Card className="border-2 border-green-500/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-500" />
            API Key dos Colaboradores
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Usada pelos consultores e gestores no painel
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <ApiKeyInput
            label="API Key Anthropic"
            value={values.anthropic_api_key_staff}
            onChange={(v) => set("anthropic_api_key_staff", v)}
          />
          <Button
            onClick={() => upsertKeys(["anthropic_api_key_staff"], "staff")}
            disabled={saving === "staff"}
            className="w-full gap-2"
          >
            <Save className="h-4 w-4" />
            {saving === "staff" ? "Salvando..." : "Salvar"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
