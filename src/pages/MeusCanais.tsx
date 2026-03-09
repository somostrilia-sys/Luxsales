import { useState } from "react";
import { Smartphone, Instagram, Wifi, WifiOff, QrCode, RefreshCw, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface WhatsAppChip {
  nome: string;
  numero: string;
  status: "conectado" | "desconectado";
  ultimaAtividade: string;
}

const initialChips: WhatsAppChip[] = [
  { nome: "Chip Principal", numero: "+55 31 99876-5432", status: "conectado", ultimaAtividade: "Agora" },
  { nome: "Chip Prospecção", numero: "+55 31 98765-4321", status: "conectado", ultimaAtividade: "5 min atrás" },
  { nome: "Chip Suporte", numero: "+55 31 97654-3210", status: "desconectado", ultimaAtividade: "2h atrás" },
];

export default function MeusCanais() {
  const [whatsappConnected, setWhatsappConnected] = useState(true);
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showInstaLogin, setShowInstaLogin] = useState(false);
  const [chips, setChips] = useState<WhatsAppChip[]>(initialChips);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold">Meus Canais</h1>
          <p className="text-muted-foreground text-sm">Conecte e gerencie seus canais de comunicação</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-stagger">
          {/* WhatsApp Card */}
          <Card className="border bg-card/80 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-green-500/10">
                  <Smartphone className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">WhatsApp</CardTitle>
                  <p className="text-xs text-muted-foreground">Gerencie seus chips conectados</p>
                </div>
              </div>
              <Badge className={whatsappConnected ? "bg-green-500/15 text-green-600 border-green-500/30 status-glow-ativo" : "bg-destructive/15 text-destructive border-destructive/30"}>
                {whatsappConnected ? <><Wifi className="h-3 w-3 mr-1" /> Conectado</> : <><WifiOff className="h-3 w-3 mr-1" /> Desconectado</>}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Chips list */}
              <div className="space-y-2">
                {chips.map((chip, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50 table-row-hover">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${chip.status === "conectado" ? "bg-green-500" : "bg-destructive"}`} />
                      <div>
                        <p className="text-sm font-medium">{chip.nome}</p>
                        <p className="text-xs text-muted-foreground">{chip.numero}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{chip.ultimaAtividade}</p>
                      <Badge variant="outline" className="text-[10px] mt-0.5">
                        {chip.status === "conectado" ? "Online" : "Offline"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button className="btn-shimmer flex-1" onClick={() => setShowQR(true)}>
                  <QrCode className="h-4 w-4 mr-2" /> Conectar WhatsApp
                </Button>
                {whatsappConnected && (
                  <Button variant="outline" onClick={() => { setWhatsappConnected(false); setChips(c => c.map(ch => ({ ...ch, status: "desconectado" as const }))); }}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="outline" size="icon" onClick={() => { setWhatsappConnected(true); setChips(c => c.map((ch, i) => i < 2 ? { ...ch, status: "conectado" as const, ultimaAtividade: "Agora" } : ch)); }}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Instagram Card */}
          <Card className="border bg-card/80 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-pink-500/10">
                  <Instagram className="h-6 w-6 text-pink-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">Instagram</CardTitle>
                  <p className="text-xs text-muted-foreground">Conecte sua conta profissional</p>
                </div>
              </div>
              <Badge className={instagramConnected ? "bg-green-500/15 text-green-600 border-green-500/30" : "bg-destructive/15 text-destructive border-destructive/30"}>
                {instagramConnected ? <><Wifi className="h-3 w-3 mr-1" /> Conectado</> : <><WifiOff className="h-3 w-3 mr-1" /> Desconectado</>}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {instagramConnected ? (
                <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white font-bold">A</div>
                    <div>
                      <p className="font-medium text-sm">@alex.consultor</p>
                      <p className="text-xs text-muted-foreground">Conta profissional • 1.2k seguidores</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-lg border-2 border-dashed border-border flex flex-col items-center gap-2 text-center">
                  <Instagram className="h-10 w-10 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Nenhuma conta conectada</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button className="btn-shimmer flex-1" variant={instagramConnected ? "outline" : "default"} onClick={() => instagramConnected ? setInstagramConnected(false) : setShowInstaLogin(true)}>
                  {instagramConnected ? "Desconectar" : "Conectar Instagram"}
                </Button>
                {instagramConnected && (
                  <Button variant="outline" size="icon"><RefreshCw className="h-4 w-4" /></Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* QR Code Dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Escanear QR Code</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-border">
              <QrCode className="h-24 w-24 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground text-center">Abra o WhatsApp no celular → Dispositivos conectados → Conectar dispositivo</p>
            <Button className="btn-shimmer w-full" onClick={() => { setShowQR(false); setWhatsappConnected(true); }}>Simular Conexão</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Instagram Login Dialog */}
      <Dialog open={showInstaLogin} onOpenChange={setShowInstaLogin}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Login Instagram</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Usuário ou email" />
            <Input placeholder="Senha" type="password" />
            <Button className="btn-shimmer w-full" onClick={() => { setShowInstaLogin(false); setInstagramConnected(true); }}>Entrar e Conectar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
