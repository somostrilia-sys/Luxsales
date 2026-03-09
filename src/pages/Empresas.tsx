import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

interface Company {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  description: string;
}

export default function Empresas() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("");
  const [sectors, setSectors] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("companies").select("*").order("name").then(({ data }) => {
      setCompanies(data || []);
      if (data && data.length > 0) setActiveTab(data[0].id);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!activeTab) return;
    Promise.all([
      supabase.from("sectors").select("*").eq("company_id", activeTab).order("name"),
      supabase.from("units").select("*").eq("company_id", activeTab).order("name"),
      supabase.from("roles").select("*").eq("company_id", activeTab).order("level"),
    ]).then(([s, u, r]) => {
      setSectors(s.data || []);
      setUnits(u.data || []);
      setRoles(r.data || []);
    });
  }, [activeTab]);

  if (loading) return <DashboardLayout><div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Empresas</h1>
          <p className="text-muted-foreground text-sm">Gerencie todas as empresas do grupo</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto">
            {companies.map(c => (
              <TabsTrigger key={c.id} value={c.id} className="gap-2">
                <span>{c.emoji}</span>{c.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {companies.map(c => (
            <TabsContent key={c.id} value={c.id} className="space-y-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-4xl">{c.emoji}</span>
                    <div>
                      <h2 className="text-xl font-bold">{c.name}</h2>
                      <p className="text-muted-foreground">{c.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Setores */}
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-3">Setores ({sectors.length})</h3>
                    <Table>
                      <TableHeader><TableRow><TableHead>Nome</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {sectors.map(s => <TableRow key={s.id}><TableCell>{s.name}</TableCell></TableRow>)}
                        {sectors.length === 0 && <TableRow><TableCell className="text-muted-foreground">Nenhum setor</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Cargos */}
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-3">Cargos ({roles.length})</h3>
                    <Table>
                      <TableHeader><TableRow><TableHead>Cargo</TableHead><TableHead>Nível</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {roles.map(r => (
                          <TableRow key={r.id}>
                            <TableCell>{r.name}</TableCell>
                            <TableCell>{r.level}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Unidades */}
                <Card className="md:col-span-2">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-3">Unidades ({units.length})</h3>
                    <Table>
                      <TableHeader><TableRow><TableHead>Nome</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {units.map(u => <TableRow key={u.id}><TableCell>{u.name}</TableCell></TableRow>)}
                        {units.length === 0 && <TableRow><TableCell className="text-muted-foreground">Nenhuma unidade</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
