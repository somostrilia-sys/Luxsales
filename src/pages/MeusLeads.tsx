import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Target } from "lucide-react";

const statusOptions = ["novo", "contatado", "qualificado", "convertido", "perdido"];

export default function MeusLeads() {
  const { collaborator } = useCollaborator();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLeads(); }, [collaborator]);

  const loadLeads = async () => {
    if (!collaborator) return;
    const { data } = await supabase.from("contact_leads")
      .select("*")
      .eq("assigned_to", collaborator.id)
      .order("created_at", { ascending: false });
    setLeads(data || []);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("contact_leads").update({ status }).eq("id", id);
    if (error) toast.error("Erro ao atualizar");
    else { toast.success("Status atualizado!"); loadLeads(); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Target className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Meus Leads</h1>
            <p className="text-muted-foreground text-sm">{leads.length} leads atribuídos a você</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map(l => (
                    <TableRow key={l.id} className="table-row-hover">
                      <TableCell className="font-medium">{l.name || "—"}</TableCell>
                      <TableCell>{l.email || "—"}</TableCell>
                      <TableCell>{l.phone || "—"}</TableCell>
                      <TableCell>{[l.city, l.state].filter(Boolean).join("/") || "—"}</TableCell>
                      <TableCell>
                        <Select value={l.status} onValueChange={v => updateStatus(l.id, v)}>
                          <SelectTrigger className="w-[130px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                  {leads.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum lead atribuído</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
