import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Smartphone, Wifi, WifiOff, RefreshCw, QrCode } from "lucide-react";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { EDGE_BASE, SUPABASE_ANON_KEY } from "@/lib/constants";
import { toast } from "sonner";

interface ChipItem {
  id: string;
  name: string;
  status: string;
  phone_number?: string | null;
  type: "fixed" | "disposable";
}

const statusConfig: Record<string, { label: string; icon: string; variant: "default" | "secondary" | "destructive" }> = {
  connected: { label: "Conectado", icon: "🟢", variant: "default" },
  connecting: { label: "Conectando", icon: "🟡", variant: "secondary" },
  disconnected: { label: "Desconectado", icon: "🔴", variant: "destructive" },
};

export default function MeusChips() {
  const { collaborator } = useCollaborator();
  const [chips, setChips] = useState<ChipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrChipName, setQrChipName] = useState("");
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const fetchChips = useCallback(async () => {
    if (!collaborator) return;
    setLoading(true);
    try {
      const [fixedRes, dispRes] = await Promise.all([
        supabase.from("bot_instances").select("id, name, whatsapp_status, whatsapp_number").eq("collaborator_id", collaborator.id),
        supabase.from("disposable_chips").select("id, label, status, phone_number").eq("collaborator_id", collaborator.id),
      ]);

      const fixed: ChipItem[] = (fixedRes.data || []).map((c: any) => ({
        id: c.id, name: c.name, status: c.whatsapp_status || "disconnected", phone_number: c.whatsapp_number, type: "fixed",
      }));
      const disposable: ChipItem[] = (dispRes.data || []).map((c: any) => ({
        id: c.id, name: c.label || `Chip ${c.id.slice(0, 6)}`, status: c.status || "disconnected", phone_number: c.phone_number, type: "disposable",
      }));
      setChips([...fixed, ...disposable]);
    } catch { toast.error("Erro ao buscar chips"); }
    setLoading(false);
  }, [collaborator]);

  useEffect(() => { fetchChips(); }, [fetchChips]);

  const callEdge = async (chipId: string, action: string) => {
    setActionLoading(p => ({ ...p, [chipId + action]: true }));
    try {
      const res = await fetch(`${EDGE_BASE}/manage-disposable-chip`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ action, chip_id: chipId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");

      if (action === "connect" && data.qr_code) {
        setQrCode(data.qr_code);
        setQrChipName(chips.find(c => c.id === chipId)?.name || "Chip");
      } else if (action === "status") {
        toast.success(`Status: ${data.status || "desconhecido"}`);
        fetchChips();
      }
    } catch (e: any) { toast.error(e.message); }
    setActionLoading(p => ({ ...p, [chipId + action]: false }));
  };

  const renderChipGroup = (title: string, type: "fixed" | "disposable") => {
    const group = chips.filter(c => c.type === type);
    if (group.length === 0) return (
      <Card variant="glass" className="border-dashed">
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          Nenhum {type === "fixed" ? "chip fixo" : "chip de disparo"} encontrado
        </CardContent>
      </Card>
    );

    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {group.map(chip => {
          const st = statusConfig[chip.status] || statusConfig.disconnected;
          return (
            <Card key={chip.id} variant="gradient" className="hover:shadow-[var(--shadow-card-hover)] transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium truncate max-w-[140px]">{chip.name}</span>
                  </div>
                  <Badge variant={st.variant} className="text-xs gap-1">
                    {st.icon} {st.label}
                  </Badge>
                </div>
                {chip.phone_number && <p className="text-xs text-muted-foreground">{chip.phone_number}</p>}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 text-xs" disabled={!!actionLoading[chip.id + "connect"]}
                    onClick={() => callEdge(chip.id, "connect")}>
                    {actionLoading[chip.id + "connect"] ? <Loader2 className="h-3 w-3 animate-spin" /> : <QrCode className="h-3 w-3" />}
                    Conectar
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs" disabled={!!actionLoading[chip.id + "status"]}
                    onClick={() => callEdge(chip.id, "status")}>
                    {actionLoading[chip.id + "status"] ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Status
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <PageHeader title="Meus Chips" subtitle="Gerencie seus chips de WhatsApp" />
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Wifi className="h-4 w-4" /> Chip Fixo
          </h3>
          {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : renderChipGroup("Chip Fixo", "fixed")}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <WifiOff className="h-4 w-4" /> Chips de Disparo
          </h3>
          {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : renderChipGroup("Chips de Disparo", "disposable")}
        </div>
      </div>

      <Dialog open={!!qrCode} onOpenChange={() => setQrCode(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Conectar {qrChipName}</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <p className="text-sm text-muted-foreground text-center">Escaneie o QR Code no WhatsApp</p>
            {qrCode && <img src={`data:image/png;base64,${qrCode}`} alt="QR Code" className="w-64 h-64 rounded-lg border" />}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
