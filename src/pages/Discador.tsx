import { useState, useEffect, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { supabase } from "@/lib/supabase";
import { EDGE_BASE } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Phone, User, Loader2, Clock, Bot, CheckCircle, PhoneOff } from "lucide-react";

type CallStatus = "idle" | "dialing" | "answered" | "in_call" | "ended";

const CALL_LABEL: Record<CallStatus, string> = {
  idle:    "Aguardando",
  dialing: "Discando...",
  answered:"Atendeu",
  in_call: "Em conversa",
  ended:   "Encerrou",
};

const CALL_COLOR: Record<CallStatus, string> = {
  idle:    "bg-muted text-muted-foreground",
  dialing: "bg-yellow-500/20 text-yellow-400 animate-pulse",
  answered:"bg-blue-500/20 text-blue-400 animate-pulse",
  in_call: "bg-emerald-500/20 text-emerald-400",
  ended:   "bg-purple-500/20 text-purple-400",
};

const TEMP_MAP: Record<string, string> = { hot: "🔥 Hot", warm: "☀️ Warm", cold: "❄️ Cold" };

const POOL_STATUS_BADGE: Record<string, string> = {
  assigned:    "bg-blue-500/15 text-blue-400",
  in_progress: "bg-yellow-500/15 text-yellow-400",
  follow_up:   "bg-orange-500/15 text-orange-400",
};
const POOL_STATUS_LABEL: Record<string, string> = {
  assigned:    "Atribuído",
  in_progress: "Em contato",
  follow_up:   "Follow-up",
};

const formatDuration = (s: number) =>
  `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

export default function Discador() {
  const { collaborator, isCEO } = useCollaborator();
  const { selectedCompanyId } = useCompanyFilter();

  const companyId = (selectedCompanyId && selectedCompanyId !== "all")
    ? selectedCompanyId
    : collaborator?.company_id;

  const [leads, setLeads] = useState<any[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);

  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [postCallNotes, setPostCallNotes] = useState("");
  const [postCallResult, setPostCallResult] = useState("interest");
  const [savingCall, setSavingCall] = useState(false);

  const fetchLeads = useCallback(async () => {
    if (!collaborator) return;
    setLoadingLeads(true);
    try {
      let q = supabase
        .from("consultant_lead_pool")
        .select("id, status, priority, notes, next_contact_at, last_contact_at, lead:leads_master(id, lead_name, phone_number, lead_score, lead_temperature, city, state, source)")
        .in("status", ["assigned", "in_progress", "follow_up"]);

      if (!isCEO) {
        q = q.eq("collaborator_id", collaborator.id);
      }

      const { data, error } = await q
        .order("priority", { ascending: false })
        .limit(100);

      if (error) throw error;
      setLeads(data ?? []);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao buscar leads");
    } finally {
      setLoadingLeads(false);
    }
  }, [collaborator, isCEO]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Call timer
  useEffect(() => {
    if (callStatus === "in_call") {
      timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (callStatus !== "ended") setCallDuration(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callStatus]);

  const initiateCall = async () => {
    if (!selectedLead) { toast.error("Selecione um lead primeiro"); return; }
    const phone = selectedLead.lead?.phone_number;
    if (!phone) { toast.error("Lead sem telefone cadastrado"); return; }

    setCallStatus("dialing");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const normalizedPhone = phone.startsWith("+") ? phone : `+55${phone.replace(/\D/g, "")}`;

      const res = await fetch(`${EDGE_BASE}/orchestrator-proxy?path=/api/calls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          phone: normalizedPhone,
          company_id: companyId,
          lead_name: selectedLead.lead?.lead_name ?? null,
          pool_id: selectedLead.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? `HTTP ${res.status}`);
      }

      toast.success("Ligação iniciada pela IA");
      setCallStatus("answered");

      // Transition to in_call after brief delay
      setTimeout(() => setCallStatus("in_call"), 4000);

      // Mark pool as in_progress
      await supabase
        .from("consultant_lead_pool")
        .update({ status: "in_progress", last_contact_at: new Date().toISOString() })
        .eq("id", selectedLead.id);
    } catch (e: any) {
      toast.error("Erro ao iniciar ligação: " + e.message);
      setCallStatus("idle");
    }
  };

  const endCall = () => {
    setCallStatus("ended");
  };

  const saveCallResult = async () => {
    if (!selectedLead || !collaborator) return;
    setSavingCall(true);

    const resultToPoolStatus: Record<string, string> = {
      interest:    "in_progress",
      no_interest: "lost",
      return:      "follow_up",
      converted:   "converted",
    };

    const callStartedAt = new Date(Date.now() - callDuration * 1000).toISOString();

    try {
      await supabase.from("call_logs").insert({
        company_id: companyId,
        lead_phone: selectedLead.lead?.phone_number ?? null,
        lead_name: selectedLead.lead?.lead_name ?? null,
        lead_temperature: selectedLead.lead?.lead_temperature ?? null,
        status: "completed",
        duration_sec: callDuration,
        started_at: callStartedAt,
        ended_at: new Date().toISOString(),
        ai_qualification: postCallResult,
        goal_details: postCallNotes || null,
      } as any);

      const newStatus = resultToPoolStatus[postCallResult] ?? "contacted";
      const appendedNotes = postCallNotes
        ? `${selectedLead.notes ? selectedLead.notes + "\n---\n" : ""}${new Date().toLocaleDateString("pt-BR")}: ${postCallNotes}`
        : selectedLead.notes;

      await supabase
        .from("consultant_lead_pool")
        .update({
          status: newStatus,
          notes: appendedNotes,
          last_contact_at: new Date().toISOString(),
        })
        .eq("id", selectedLead.id);

      toast.success("Resultado salvo com sucesso");
      setCallStatus("idle");
      setPostCallNotes("");
      setPostCallResult("interest");
      setSelectedLead(null);
      fetchLeads();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSavingCall(false);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Discador IA"
        subtitle="Selecione um lead e deixe a IA ligar"
      />

      <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
        {/* LEFT: Lead list */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Leads para Ligar
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingLeads ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : leads.length === 0 ? (
              <div className="py-12 text-center px-4">
                <User className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Nenhum lead atribuído. Peça ao gestor.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/40 max-h-[560px] overflow-y-auto">
                {leads.map(item => {
                  const lead = item.lead;
                  const isSelected = selectedLead?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      className={`w-full text-left px-4 py-3 transition-colors hover:bg-secondary/40 ${isSelected ? "bg-primary/10 border-l-2 border-primary" : ""}`}
                      onClick={() => {
                        setSelectedLead(item);
                        setCallStatus("idle");
                        setPostCallNotes("");
                        setPostCallResult("interest");
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{lead?.lead_name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground font-mono">{lead?.phone_number ?? "—"}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 border-0 ${POOL_STATUS_BADGE[item.status] ?? "bg-muted text-muted-foreground"}`}
                          >
                            {POOL_STATUS_LABEL[item.status] ?? item.status}
                          </Badge>
                          {lead?.lead_score != null && (
                            <span className={`text-[10px] font-bold ${lead.lead_score >= 70 ? "text-green-400" : lead.lead_score >= 40 ? "text-yellow-400" : "text-red-400"}`}>
                              {lead.lead_score}pts
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* RIGHT: Details + Dialer */}
        <div className="space-y-4">
          {!selectedLead ? (
            <Card className="border-border/60">
              <CardContent className="flex flex-col items-center justify-center py-24">
                <Phone className="h-12 w-12 text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground text-sm">
                  Selecione um lead na lista para começar
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Lead Details */}
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    {selectedLead.lead?.lead_name ?? "Lead"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Telefone</p>
                      <p className="font-mono text-sm">{selectedLead.lead?.phone_number ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Score</p>
                      <p className={`font-bold ${
                        (selectedLead.lead?.lead_score ?? 0) >= 70 ? "text-green-400"
                        : (selectedLead.lead?.lead_score ?? 0) >= 40 ? "text-yellow-400"
                        : "text-red-400"
                      }`}>
                        {selectedLead.lead?.lead_score ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Temperatura</p>
                      <p className="text-sm">
                        {selectedLead.lead?.lead_temperature
                          ? (TEMP_MAP[selectedLead.lead.lead_temperature] ?? selectedLead.lead.lead_temperature)
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Localização</p>
                      <p className="text-xs">
                        {[selectedLead.lead?.city, selectedLead.lead?.state].filter(Boolean).join(", ") || "—"}
                      </p>
                    </div>
                  </div>
                  {selectedLead.notes && (
                    <div className="mt-3 rounded-lg bg-secondary/30 p-3">
                      <p className="text-xs text-muted-foreground mb-1">Notas anteriores</p>
                      <p className="text-xs whitespace-pre-wrap">{selectedLead.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Dialer Panel */}
              <Card className="border-border/60">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge className={`px-4 py-1.5 text-sm font-medium ${CALL_COLOR[callStatus]}`}>
                      {CALL_LABEL[callStatus]}
                    </Badge>
                    {(callStatus === "in_call" || callStatus === "ended") && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span className="font-mono text-sm">{formatDuration(callDuration)}</span>
                      </div>
                    )}
                  </div>

                  {callStatus === "idle" && (
                    <Button
                      size="lg"
                      className="w-full h-14 text-base bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={initiateCall}
                    >
                      <Bot className="h-5 w-5 mr-2" />
                      Ligar com IA
                    </Button>
                  )}

                  {(callStatus === "dialing" || callStatus === "answered" || callStatus === "in_call") && (
                    <div className="space-y-3">
                      <div className="rounded-lg bg-secondary/20 p-4 text-center space-y-1">
                        <p className="text-sm text-muted-foreground">{CALL_LABEL[callStatus]}</p>
                        {callStatus === "in_call" && (
                          <p className="text-2xl font-mono font-bold text-emerald-400">
                            {formatDuration(callDuration)}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="destructive"
                        size="lg"
                        className="w-full h-12"
                        onClick={endCall}
                      >
                        <PhoneOff className="h-4 w-4 mr-2" />
                        Encerrar Ligação
                      </Button>
                    </div>
                  )}

                  {callStatus === "ended" && (
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1.5">Resultado da ligação</p>
                        <Select value={postCallResult} onValueChange={setPostCallResult}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="interest">Interesse</SelectItem>
                            <SelectItem value="no_interest">Sem interesse</SelectItem>
                            <SelectItem value="return">Retornar</SelectItem>
                            <SelectItem value="converted">Convertido</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1.5">Notas</p>
                        <Textarea
                          placeholder="Observações sobre a ligação..."
                          value={postCallNotes}
                          onChange={e => setPostCallNotes(e.target.value)}
                          className="min-h-[80px]"
                        />
                      </div>
                      <Button
                        className="w-full"
                        onClick={saveCallResult}
                        disabled={savingCall}
                      >
                        {savingCall
                          ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          : <CheckCircle className="h-4 w-4 mr-2" />}
                        Salvar e Concluir
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
