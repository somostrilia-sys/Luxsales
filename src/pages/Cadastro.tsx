import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2, Copy, Download, Upload } from "lucide-react";

interface RegisterResult {
  email: string;
  name: string;
  password: string;
}

export default function Cadastro() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [sectors, setSectors] = useState<any[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<RegisterResult[]>([]);

  const [form, setForm] = useState({
    name: "", email: "", phone: "", password: "",
    company_id: "", role_id: "", sector_id: "", reports_to: "",
  });

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvSubmitting, setCsvSubmitting] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [compRes, roleRes, sectorRes, collabRes] = await Promise.all([
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("roles").select("id, name, level, company_id").eq("active", true).order("level"),
      supabase.from("sectors").select("id, name, company_id").order("name"),
      supabase.from("collaborators").select(`
        id, name, email, phone, active, company_id, company_ids,
        role:roles!collaborators_role_id_fkey(name, level),
        company:companies!collaborators_company_id_fkey(name),
        sector:sectors!collaborators_sector_id_fkey(name)
      `).eq("active", true).order("name"),
    ]);
    setCompanies(compRes.data || []);
    setRoles(roleRes.data || []);
    setSectors(sectorRes.data || []);
    setCollaborators(collabRes.data || []);
    setLoading(false);
  };

  const filteredRoles = roles.filter(r => !form.company_id || r.company_id === form.company_id);
  const filteredSectors = sectors.filter(s => !form.company_id || s.company_id === form.company_id);
  const filteredSupervisors = collaborators.filter(c => {
    if (!form.company_id) return false;
    if (c.company_id === form.company_id) return true;
    if (Array.isArray(c.company_ids) && c.company_ids.includes(form.company_id)) return true;
    return false;
  });

  const getDefaultPassword = (name: string) => {
    const firstName = name.trim().split(" ")[0];
    return firstName ? `${firstName}@2026` : "User@2026";
  };

  const handleCompanyChange = (id: string) => {
    setForm(prev => ({ ...prev, company_id: id, role_id: "", sector_id: "", reports_to: "" }));
  };

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.company_id || !form.role_id) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const password = form.password || getDefaultPassword(form.name);
      const res = await fetch(
        `https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/register-collaborator`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            phone: form.phone || null,
            password,
            company_id: form.company_id,
            role_id: form.role_id,
            sector_id: form.sector_id || null,
            reports_to: form.reports_to || null,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao cadastrar");

      if (data.results) {
        setResults(data.results);
        toast.success("Colaborador cadastrado com sucesso!");
      } else if (data.success) {
        setResults([{ email: form.email, name: form.name, password }]);
        toast.success("Colaborador cadastrado!");
      }
      setForm({ name: "", email: "", phone: "", password: "", company_id: "", role_id: "", sector_id: "", reports_to: "" });
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCsvUpload = async () => {
    if (!csvFile) return;
    setCsvSubmitting(true);
    try {
      const text = await csvFile.text();
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) { toast.error("CSV vazio"); return; }

      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const rows = lines.slice(1).map(line => {
        const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
        const obj: any = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
        return obj;
      });

      const { data: { session } } = await supabase.auth.getSession();
      const allResults: RegisterResult[] = [];
      const errors: string[] = [];

      for (const row of rows) {
        try {
          const password = row.password || getDefaultPassword(row.name || row.nome || "User");
          const res = await fetch(
            `https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/register-collaborator`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session?.access_token}`,
              },
              body: JSON.stringify({
                name: row.name || row.nome,
                email: row.email,
                phone: row.phone || row.telefone || null,
                password,
                company_id: row.company_id || row.empresa_id,
                role_id: row.role_id || row.cargo_id,
                sector_id: row.sector_id || row.setor_id || null,
                reports_to: row.reports_to || row.superior_id || null,
              }),
            }
          );
          const data = await res.json();
          if (data.results) allResults.push(...data.results);
          else if (data.success) allResults.push({ email: row.email, name: row.name || row.nome, password });
          else errors.push(`${row.email}: ${data.error || "erro"}`);
        } catch (e: any) {
          errors.push(`${row.email}: ${e.message}`);
        }
      }

      setResults(allResults);
      if (errors.length > 0) toast.error(`${errors.length} erros no cadastro em massa`);
      else toast.success(`${allResults.length} colaboradores cadastrados!`);
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCsvSubmitting(false);
    }
  };

  const copyResults = () => {
    const text = results.map(r => `${r.name} | ${r.email} | ${r.password}`).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const downloadResultsCsv = () => {
    const header = "Nome,Email,Senha\n";
    const rows = results.map(r => `"${r.name}","${r.email}","${r.password}"`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "credenciais.csv";
    a.click();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Cadastro de Colaboradores</h1>
          <p className="text-muted-foreground text-sm">Registre novos colaboradores no sistema</p>
        </div>

        <Tabs defaultValue="individual">
          <TabsList>
            <TabsTrigger value="individual">Individual</TabsTrigger>
            <TabsTrigger value="massa">Em Massa (CSV)</TabsTrigger>
          </TabsList>

          <TabsContent value="individual" className="space-y-4 mt-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><Label>Nome Completo *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome do colaborador" /></div>
                  <div><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@empresa.com" /></div>
                  <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" /></div>
                  <div>
                    <Label>Senha <span className="text-muted-foreground text-xs">(padrão: Nome@2026)</span></Label>
                    <Input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={form.name ? getDefaultPassword(form.name) : "PrimeiroNome@2026"} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Empresa *</Label>
                    <Select value={form.company_id} onValueChange={handleCompanyChange}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Cargo *</Label>
                    <Select value={form.role_id} onValueChange={v => setForm({ ...form, role_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{filteredRoles.map(r => <SelectItem key={r.id} value={r.id}>{r.name} (Lv.{r.level})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Setor</Label>
                    <Select value={form.sector_id} onValueChange={v => setForm({ ...form, sector_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{filteredSectors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Superior Direto</Label>
                    <Select value={form.reports_to} onValueChange={v => setForm({ ...form, reports_to: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{filteredSupervisors.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.email})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={handleSubmit} disabled={submitting} className="btn-modern">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Cadastrar Colaborador
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="massa" className="space-y-4 mt-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Envie um CSV com colunas: name, email, phone, password, company_id, role_id, sector_id, reports_to
                </p>
                <div className="flex gap-3 items-center">
                  <label className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-[10px] border bg-card hover:bg-muted transition-colors text-sm">
                      <Upload className="h-4 w-4" />
                      {csvFile ? csvFile.name : "Selecionar CSV"}
                    </div>
                    <input type="file" accept=".csv" className="hidden" onChange={e => setCsvFile(e.target.files?.[0] || null)} />
                  </label>
                  <Button onClick={handleCsvUpload} disabled={!csvFile || csvSubmitting} className="btn-modern">
                    {csvSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Processar CSV
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Results */}
        {results.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Credenciais Geradas</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyResults}><Copy className="h-4 w-4 mr-1" /> Copiar</Button>
                  <Button variant="outline" size="sm" onClick={downloadResultsCsv}><Download className="h-4 w-4 mr-1" /> CSV</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Senha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>{r.email}</TableCell>
                      <TableCell><code className="font-mono text-sm bg-muted px-2 py-1 rounded">{r.password}</code></TableCell>
                    </TableRow>
                  ))}</TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Existing collaborators table */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Colaboradores Cadastrados</CardTitle></CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collaborators.map(c => (
                    <TableRow key={c.id} className="table-row-hover">
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.email}</TableCell>
                      <TableCell>{c.company?.name || "—"}</TableCell>
                      <TableCell>{c.role?.name || "—"}</TableCell>
                      <TableCell>{c.sector?.name || "—"}</TableCell>
                      <TableCell>
                        <Badge className={c.active ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}>
                          {c.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}</TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
