import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Bot } from "lucide-react";

export default function MeuBot() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Meu Bot</h1>
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Bot className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">Nenhum canal conectado — contate o administrador.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
