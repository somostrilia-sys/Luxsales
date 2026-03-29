import { useEffect, useState, useRef, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  MessageSquare, Send, Search, Phone, Clock, Shield, FileText,
  CheckCheck, Check, X, Loader2, RefreshCw, AlertTriangle,
  BarChart3, Zap, CircleCheck, CircleDot,
  Plus, Eye, Pencil, Trash2, Copy, TestTube2, Image, Video, File,
  Link, PhoneCall, Reply,
} from "lucide-react";

const formatTime = (d: string) => {
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60000) return "Agora";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min`;
  if (diff < 86400000) return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

const statusIcon = (s: string) => {
  if (s === "read") return <CheckCheck className="h-3.5 w-3.5 text-blue-400" />;
  if (s === "delivered") return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />;
  if (s === "sent") return <Check className="h-3.5 w-3.5 text-muted-foreground" />;
  if (s === "failed") return <X className="h-3.5 w-3.5 text-red-400" />;
  return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
};

const qualityBadge = (q: string | null) => {
  if (q === "GREEN") return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Verde</Badge>;
  if (q === "YELLOW") return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Amarelo</Badge>;
  if (q === "RED") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Vermelho</Badge>;
  return <Badge variant="secondary">—</Badge>;
};

const templateStatusBadge = (s: string) => {
  const map: Record<string, string> = {
    APPROVED: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    PENDING: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    REJECTED: "bg-red-500/20 text-red-400 border-red-500/30",
    PAUSED: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    DISABLED: "bg-muted text-muted-foreground",
  };
  return <Badge variant="outline" className={map[s] ?? "bg-muted text-muted-foreground"}>{s}</Badge>;
};

type Conversation = { id: string; phone: string; name: string | null; lastMessage: string; lastTime: string; unread: number };
type Message = { id: string; direction: string; content: string; status: string; ai_generated: boolean; created_at: string; pricing_category?: string };

type HeaderType = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
type ButtonType = "URL" | "PHONE_NUMBER" | "QUICK_REPLY";
interface TemplateButton {
  type: ButtonType;
  text: string;
  value: string;
}

interface TemplateFormData {
  name: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: string;
  headerType: HeaderType;
  headerContent: string;
  body: string;
  footer: string;
  buttons: TemplateButton[];
  exampleValues: string[];
}

const DEFAULT_FORM: TemplateFormData = {
  name: "",
  category: "MARKETING",
  language: "pt_BR",
  headerType: "NONE",
  headerContent: "",
  body: "",
  footer: "",
  buttons: [],
  exampleValues: [],
};

const LANGUAGES = [
  { value: "pt_BR", label: "Portugues (BR)" },
  { value: "en_US", label: "English (US)" },
  { value: "es", label: "Espanol" },
  { value: "fr", label: "Francais" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
];

function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(\d+)\}\}/g);
  if (!matches) return [];
  const unique = [...new Set(matches)].sort((a, b) => {
    const na = parseInt(a.replace(/\D/g, ""));
    const nb = parseInt(b.replace(/\D/g, ""));
    return na - nb;
  });
  return unique;
}

function replaceVariablesWithExamples(text: string, exampleValues: string[]): string {
  let result = text;
  const vars = extractVariables(text);
  vars.forEach((v, i) => {
    const val = exampleValues[i] || v;
    result = result.replace(new RegExp(v.replace(/[{}]/g, "\\$&"), "g"), val);
  });
  return result;
}

function isValidSnakeCase(name: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(name);
}

function buildComponents(form: TemplateFormData): unknown[] {
  const components: unknown[] = [];

  if (form.headerType !== "NONE") {
    if (form.headerType === "TEXT") {
      components.push({ type: "HEADER", format: "TEXT", text: form.headerContent });
    } else {
      components.push({
        type: "HEADER",
        format: form.headerType,
        example: { header_handle: [form.headerContent] },
      });
    }
  }

  const bodyVars = extractVariables(form.body);
  const bodyComponent: any = { type: "BODY", text: form.body };
  if (bodyVars.length > 0 && form.exampleValues.length > 0) {
    bodyComponent.example = { body_text: [form.exampleValues] };
  }
  components.push(bodyComponent);

  if (form.footer.trim()) {
    components.push({ type: "FOOTER", text: form.footer });
  }

  if (form.buttons.length > 0) {
    const buttons = form.buttons.map((btn) => {
      if (btn.type === "URL") return { type: "URL", text: btn.text, url: btn.value };
      if (btn.type === "PHONE_NUMBER") return { type: "PHONE_NUMBER", text: btn.text, phone_number: btn.value };
      return { type: "QUICK_REPLY", text: btn.text };
    });
    components.push({ type: "BUTTONS", buttons });
  }

  return components;
}

function parseComponentsToForm(template: any): TemplateFormData {
  const form: TemplateFormData = { ...DEFAULT_FORM };
  form.name = template.name || "";
  form.category = template.category || "MARKETING";
  form.language = template.language || "pt_BR";

  const components = template.components || [];
  for (const comp of components) {
    if (comp.type === "HEADER") {
      if (comp.format === "TEXT") {
        form.headerType = "TEXT";
        form.headerContent = comp.text || "";
      } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(comp.format)) {
        form.headerType = comp.format as HeaderType;
        form.headerContent = comp.example?.header_handle?.[0] || "";
      }
    } else if (comp.type === "BODY") {
      form.body = comp.text || "";
    } else if (comp.type === "FOOTER") {
      form.footer = comp.text || "";
    } else if (comp.type === "BUTTONS") {
      form.buttons = (comp.buttons || []).map((btn: any) => ({
        type: btn.type as ButtonType,
        text: btn.text || "",
        value: btn.url || btn.phone_number || "",
      }));
    }
  }

  const vars = extractVariables(form.body);
  form.exampleValues = vars.map(() => "");

  return form;
}

// ── WhatsApp Preview Bubble ──
function TemplatePreview({ form }: { form: TemplateFormData }) {
  const bodyWithExamples = replaceVariablesWithExamples(form.body, form.exampleValues);

  return (
    <div className="flex flex-col items-start gap-2 p-4">
      <p className="text-xs text-muted-foreground font-medium mb-1">Preview</p>
      <div className="w-full max-w-[320px]">
        {/* Bubble */}
        <div className="bg-emerald-700 rounded-xl rounded-tl-sm p-3 shadow-md text-white text-sm space-y-1.5">
          {/* Header */}
          {form.headerType !== "NONE" && (
            <div className="pb-1">
              {form.headerType === "TEXT" ? (
                <p className="font-bold text-[13px]">{form.headerContent || "Header"}</p>
              ) : (
                <div className="bg-emerald-800/50 rounded-lg h-32 flex items-center justify-center">
                  {form.headerType === "IMAGE" && <Image className="h-8 w-8 text-emerald-300/60" />}
                  {form.headerType === "VIDEO" && <Video className="h-8 w-8 text-emerald-300/60" />}
                  {form.headerType === "DOCUMENT" && <File className="h-8 w-8 text-emerald-300/60" />}
                </div>
              )}
            </div>
          )}
          {/* Body */}
          <p className="text-[13px] whitespace-pre-wrap leading-relaxed">
            {bodyWithExamples || "Corpo da mensagem..."}
          </p>
          {/* Footer */}
          {form.footer && (
            <p className="text-[11px] text-emerald-200/70 italic pt-0.5">{form.footer}</p>
          )}
          {/* Time */}
          <div className="flex justify-end">
            <span className="text-[10px] text-emerald-200/50">12:00</span>
          </div>
        </div>
        {/* Buttons below bubble */}
        {form.buttons.length > 0 && (
          <div className="space-y-1 mt-1">
            {form.buttons.map((btn, i) => (
              <button
                key={i}
                className="w-full bg-card border border-border/60 rounded-lg py-2 text-sm text-blue-400 font-medium flex items-center justify-center gap-1.5 hover:bg-secondary/30 transition-colors"
              >
                {btn.type === "URL" && <Link className="h-3.5 w-3.5" />}
                {btn.type === "PHONE_NUMBER" && <PhoneCall className="h-3.5 w-3.5" />}
                {btn.type === "QUICK_REPLY" && <Reply className="h-3.5 w-3.5" />}
                {btn.text || "Botao"}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function WhatsAppMeta() {
  const { collaborator } = useCollaborator();
  const [activeTab, setActiveTab] = useState("inbox");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Meta API data
  const [credentials, setCredentials] = useState<any>(null);
  const [phoneNumbers, setPhoneNumbers] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [syncingTemplates, setSyncingTemplates] = useState(false);

  // Template Builder state
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderMode, setBuilderMode] = useState<"create" | "edit">("create");
  const [builderSaving, setBuilderSaving] = useState(false);
  const [templateForm, setTemplateForm] = useState<TemplateFormData>({ ...DEFAULT_FORM });

  // AI Generate state
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  // Preview Dialog state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);

  // Delete Confirmation state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Nova Conversa state
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [newConvPhone, setNewConvPhone] = useState("");
  const [newConvTemplate, setNewConvTemplate] = useState("");
  const [newConvSending, setNewConvSending] = useState(false);

  // Send Test Dialog state
  const [testOpen, setTestOpen] = useState(false);
  const [testTemplate, setTestTemplate] = useState<any>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testVars, setTestVars] = useState<string[]>([]);
  const [testSending, setTestSending] = useState(false);

  const { selectedCompanyId } = useCompanyFilter();
  const companyId = (selectedCompanyId && selectedCompanyId !== "all") ? selectedCompanyId : collaborator?.company_id;

  // Body variables detection for builder
  const bodyVariables = useMemo(() => extractVariables(templateForm.body), [templateForm.body]);

  // Keep exampleValues in sync with detected variables
  useEffect(() => {
    setTemplateForm((prev) => {
      const newLen = bodyVariables.length;
      const oldVals = prev.exampleValues;
      if (oldVals.length === newLen) return prev;
      const updated = bodyVariables.map((_, i) => oldVals[i] || "");
      return { ...prev, exampleValues: updated };
    });
  }, [bodyVariables]);

  useEffect(() => {
    if (companyId) {
      loadConversations();
      loadMetaData();
    }
  }, [companyId]);

  // Realtime on whatsapp_meta_messages
  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-meta-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "whatsapp_meta_messages" }, (payload) => {
        const msg = payload.new as any;
        if (selectedConv && (msg.phone_from === selectedConv || msg.phone_to === selectedConv)) {
          setMessages(prev => [...prev, {
            id: msg.id, direction: msg.direction, content: msg.body ?? "",
            status: msg.status ?? "sent", ai_generated: false,
            created_at: msg.created_at ?? new Date().toISOString(),
            pricing_category: msg.pricing_category,
          }]);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
        loadConversations();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "whatsapp_meta_messages" }, () => {
        if (selectedConv) loadMessages(selectedConv);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedConv]);

  const loadMetaData = async () => {
    if (!companyId) return;

    const [creds, phones, tmpls] = await Promise.all([
      supabase.from("whatsapp_meta_credentials").select("*").eq("company_id", companyId).single(),
      supabase.from("whatsapp_meta_phone_numbers").select("*").eq("company_id", companyId),
      supabase.from("whatsapp_meta_templates").select("*").eq("company_id", companyId).neq("status", "DELETED").order("category").order("name"),
    ]);

    setCredentials(creds.data);
    setPhoneNumbers(phones.data ?? []);
    setTemplates(tmpls.data ?? []);
  };

  const loadConversations = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("whatsapp_meta_messages")
      .select("id, message_id, phone_from, phone_to, direction, body, status, created_at, pricing_category")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(300);

    if (data && data.length > 0) {
      const convMap = new Map<string, Conversation>();
      data.forEach((m: any) => {
        const phone = m.direction === "inbound" ? m.phone_from : m.phone_to;
        if (!phone) return;
        if (!convMap.has(phone)) {
          convMap.set(phone, { id: phone, phone, name: null, lastMessage: m.body ?? "", lastTime: m.created_at, unread: 0 });
        }
        if (m.direction === "inbound" && m.status !== "read") {
          convMap.get(phone)!.unread++;
        }
      });
      setConversations(Array.from(convMap.values()));
    }
    setLoading(false);
  };

  const loadMessages = async (phone: string) => {
    setLoadingMsgs(true);
    setSelectedConv(phone);
    const { data } = await supabase
      .from("whatsapp_meta_messages")
      .select("id, direction, body, status, created_at, pricing_category, sent_at, delivered_at, read_at")
      .or(`phone_from.eq.${phone},phone_to.eq.${phone}`)
      .eq("company_id", companyId)
      .order("created_at", { ascending: true })
      .limit(200);
    setMessages((data ?? []).map((m: any) => ({
      id: m.id, direction: m.direction, content: m.body ?? "",
      status: m.status ?? "sent", ai_generated: false,
      created_at: m.created_at, pricing_category: m.pricing_category,
    })));
    setLoadingMsgs(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedConv || !companyId) return;
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-meta-send", {
        body: { company_id: companyId, to: selectedConv, type: "text", text: { body: messageInput } },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Erro ao enviar");
      } else {
        toast.success("Mensagem enviada via Meta API!");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar");
    }
    setMessageInput("");
  };

  const syncTemplates = async () => {
    if (!companyId) return;
    setSyncingTemplates(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-meta-templates", {
        body: { company_id: companyId, action: "sync" },
      });
      if (error || data?.error) {
        toast.error(data?.error || "Erro ao sincronizar templates");
      } else {
        toast.success(`Templates sincronizados: ${data.synced || 0} de ${data.total || 0}`);
        if (data.errors && data.errors.length > 0) toast.error(`Erros: ${data.errors.join(", ")}`);
        loadMetaData();
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    setSyncingTemplates(false);
  };

  // ── Template Builder Actions ──

  const openCreateBuilder = () => {
    setTemplateForm({ ...DEFAULT_FORM });
    setBuilderMode("create");
    setBuilderOpen(true);
  };

  const openEditBuilder = (template: any) => {
    const form = parseComponentsToForm(template);
    setTemplateForm(form);
    setBuilderMode("edit");
    setBuilderOpen(true);
  };

  const saveTemplate = async () => {
    if (!companyId) return;
    if (!templateForm.name.trim()) {
      toast.error("Nome do template e obrigatorio");
      return;
    }
    if (!isValidSnakeCase(templateForm.name)) {
      toast.error("Nome deve ser snake_case (ex: meu_template_1)");
      return;
    }
    if (!templateForm.body.trim()) {
      toast.error("Corpo da mensagem e obrigatorio");
      return;
    }
    if (templateForm.body.length > 1024) {
      toast.error("Corpo excede 1024 caracteres");
      return;
    }
    if (templateForm.footer.length > 60) {
      toast.error("Footer excede 60 caracteres");
      return;
    }

    setBuilderSaving(true);
    try {
      const components = buildComponents(templateForm);
      const { data, error } = await supabase.functions.invoke("whatsapp-meta-templates", {
        body: {
          company_id: companyId,
          action: builderMode === "edit" ? "update" : "create",
          name: templateForm.name,
          language: templateForm.language,
          category: templateForm.category,
          components,
        },
      });
      if (error || data?.error) {
        toast.error(data?.error || data?.details?.error?.message || error?.message || "Erro ao criar template");
      } else {
        toast.success(`Template "${templateForm.name}" enviado para aprovacao!`);
        setBuilderOpen(false);
        loadMetaData();
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar template");
    }
    setBuilderSaving(false);
  };

  const deleteTemplate = async () => {
    if (!companyId || !deleteTarget) return;
    setDeleteLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-meta-templates", {
        body: { company_id: companyId, action: "delete", template_name: deleteTarget.name },
      });
      if (error || data?.error) {
        toast.error(data?.error || "Erro ao deletar template");
      } else {
        toast.success(`Template "${deleteTarget.name}" deletado`);
        setDeleteOpen(false);
        setDeleteTarget(null);
        loadMetaData();
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao deletar");
    }
    setDeleteLoading(false);
  };

  const duplicateTemplate = (template: any) => {
    const form = parseComponentsToForm(template);
    form.name = template.name + "_copy";
    setTemplateForm(form);
    setBuilderMode("create");
    setBuilderOpen(true);
    toast.info(`Duplicando "${template.name}" como "${form.name}"`);
  };

  const generateWithAI = async () => {
    if (!companyId || !aiPrompt.trim()) {
      toast.error("Descreva o produto/objetivo para gerar o template");
      return;
    }
    setAiGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-template", {
        body: {
          company_id: companyId,
          action: "generate",
          prompt: aiPrompt.trim(),
          category: templateForm.category,
          language: templateForm.language,
        },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Erro ao gerar template com IA");
      } else {
        // Apply generated content to form
        if (data.name) updateForm("name", data.name);
        if (data.body) updateForm("body", data.body);
        if (data.header) {
          updateForm("headerType", "TEXT");
          updateForm("headerContent", data.header);
        }
        if (data.footer) updateForm("footer", data.footer);
        if (data.buttons && Array.isArray(data.buttons)) {
          updateForm("buttons", data.buttons.map((btn: any) => ({
            type: btn.type || "QUICK_REPLY",
            text: btn.text || "",
            value: btn.url || btn.phone_number || "",
          })));
        }
        toast.success("Template gerado com IA! Revise e ajuste antes de criar.");
        setAiDialogOpen(false);
        setAiPrompt("");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar template");
    }
    setAiGenerating(false);
  };

  const openPreview = (template: any) => {
    setPreviewTemplate(template);
    setPreviewOpen(true);
  };

  const openTestDialog = (template: any) => {
    setTestTemplate(template);
    setTestPhone("");
    const bodyComp = (template.components || []).find((c: any) => c.type === "BODY");
    const vars = bodyComp ? extractVariables(bodyComp.text || "") : [];
    setTestVars(vars.map(() => ""));
    setTestOpen(true);
  };

  const sendTestTemplate = async () => {
    if (!companyId || !testTemplate || !testPhone.trim()) return;
    if (!/^\d{10,15}$/.test(testPhone.replace(/\D/g, ""))) {
      toast.error("Telefone invalido. Use apenas numeros com DDI (ex: 5511999999999)");
      return;
    }
    setTestSending(true);
    try {
      const bodyComp = (testTemplate.components || []).find((c: any) => c.type === "BODY");
      const vars = bodyComp ? extractVariables(bodyComp.text || "") : [];

      const templateComponents: any[] = [];
      if (vars.length > 0) {
        templateComponents.push({
          type: "body",
          parameters: testVars.map((v) => ({ type: "text", text: v || "-" })),
        });
      }

      const { data, error } = await supabase.functions.invoke("whatsapp-meta-send", {
        body: {
          company_id: companyId,
          to: testPhone.replace(/\D/g, ""),
          type: "template",
          template: {
            name: testTemplate.name,
            language: { code: testTemplate.language || "pt_BR" },
            components: templateComponents,
          },
        },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Erro ao enviar teste");
      } else {
        toast.success("Template de teste enviado!");
        setTestOpen(false);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar teste");
    }
    setTestSending(false);
  };

  // ── Nova Conversa ──
  const startNewConversation = async () => {
    if (!newConvPhone.trim() || !newConvTemplate) return;
    setNewConvSending(true);
    try {
      const tpl = templates.find((t: any) => t.name === newConvTemplate);
      const { data, error } = await supabase.functions.invoke("whatsapp-meta-send", {
        body: {
          company_id: companyId,
          to: newConvPhone.replace(/\D/g, ""),
          type: "template",
          template: {
            name: newConvTemplate,
            language: { code: tpl?.language || "pt_BR" },
          },
        },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Erro ao enviar template");
      } else {
        toast.success(`Template "${newConvTemplate}" enviado para ${newConvPhone}!`);
        setNewConvOpen(false);
        setNewConvPhone("");
        setNewConvTemplate("");
        // Reload conversations
        loadConversations();
        loadMetaData();
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao iniciar conversa");
    }
    setNewConvSending(false);
  };

  // ── Form helpers ──
  const updateForm = <K extends keyof TemplateFormData>(key: K, value: TemplateFormData[K]) => {
    setTemplateForm((prev) => ({ ...prev, [key]: value }));
  };

  const addButton = () => {
    if (templateForm.buttons.length >= 3) {
      toast.error("Maximo de 3 botoes");
      return;
    }
    updateForm("buttons", [...templateForm.buttons, { type: "QUICK_REPLY", text: "", value: "" }]);
  };

  const updateButton = (index: number, field: keyof TemplateButton, value: string) => {
    const updated = [...templateForm.buttons];
    updated[index] = { ...updated[index], [field]: value };
    updateForm("buttons", updated);
  };

  const removeButton = (index: number) => {
    updateForm("buttons", templateForm.buttons.filter((_, i) => i !== index));
  };

  const filteredConvs = conversations.filter(c =>
    !searchTerm || (c.name ?? "").toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm)
  );
  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  // Stats
  const approvedTemplates = templates.filter(t => t.status === "APPROVED").length;
  const connectedPhones = phoneNumbers.filter(p => p.status === "connected").length;

  // ── Preview form for test dialog ──
  const testPreviewBody = useMemo(() => {
    if (!testTemplate) return "";
    const bodyComp = (testTemplate.components || []).find((c: any) => c.type === "BODY");
    if (!bodyComp) return "";
    return replaceVariablesWithExamples(bodyComp.text || "", testVars);
  }, [testTemplate, testVars]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="WhatsApp Business"
          subtitle="API oficial Meta — Inbox, Templates e Configurações"
          badge={credentials?.is_verified
            ? <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30"><Shield className="h-3 w-3 mr-1" />Verificado</Badge>
            : <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">Pendente Verificacao</Badge>
          }
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Quality Rating", value: credentials?.quality_rating ?? "—", icon: BarChart3, color: credentials?.quality_rating === "GREEN" ? "text-emerald-400" : credentials?.quality_rating === "RED" ? "text-red-400" : "text-yellow-400" },
            { label: "Msg Limit", value: credentials?.messaging_limit_tier?.replace("TIER_", "") ?? "250", icon: Zap, color: "text-blue-400" },
            { label: "Telefones", value: `${connectedPhones}/${phoneNumbers.length}`, icon: Phone, color: "text-emerald-400" },
            { label: "Templates", value: `${approvedTemplates}/${templates.length}`, icon: FileText, color: "text-violet-400" },
          ].map(k => (
            <Card key={k.label} className="bg-card border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center"><k.icon className={`h-4 w-4 ${k.color}`} /></div>
                  <div>
                    <p className="text-lg font-bold text-foreground">{typeof k.value === "number" ? k.value.toLocaleString("pt-BR") : k.value}</p>
                    <p className="text-[10px] text-muted-foreground">{k.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="h-auto flex-wrap gap-2 rounded-xl border border-border/60 bg-secondary/40 p-1">
            <TabsTrigger value="inbox">Inbox {totalUnread > 0 && <Badge className="ml-1 h-5 bg-emerald-500 text-white text-[10px]">{totalUnread}</Badge>}</TabsTrigger>
            <TabsTrigger value="templates">Templates ({approvedTemplates})</TabsTrigger>
            <TabsTrigger value="config">Configurações</TabsTrigger>
          </TabsList>

          {/* INBOX TAB */}
          <TabsContent value="inbox">
            <div className="grid grid-cols-[320px_1fr] h-[550px] rounded-xl border border-border/60 overflow-hidden">
              <div className="border-r border-border/60 bg-card flex flex-col">
                <div className="p-3 border-b border-border/60 space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9" />
                    </div>
                    <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" title="Nova Conversa" onClick={() => setNewConvOpen(true)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  {loading ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                  ) : filteredConvs.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-8">Nenhuma conversa</div>
                  ) : filteredConvs.map(conv => (
                    <button key={conv.id} onClick={() => loadMessages(conv.phone)}
                      className={`w-full text-left px-4 py-3 border-b border-border/30 hover:bg-secondary/30 transition-colors ${selectedConv === conv.phone ? "bg-secondary/50" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{conv.name ?? conv.phone}</p>
                          <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[10px] text-muted-foreground">{formatTime(conv.lastTime)}</span>
                          {conv.unread > 0 && <span className="h-5 w-5 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center font-bold">{conv.unread}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </ScrollArea>
              </div>
              <div className="bg-background flex flex-col">
                {selectedConv ? (
                  <>
                    <div className="h-14 px-4 flex items-center border-b border-border/60 bg-card">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center"><Phone className="h-4 w-4 text-emerald-400" /></div>
                        <div>
                          <p className="text-sm font-medium">{conversations.find(c => c.phone === selectedConv)?.name ?? selectedConv}</p>
                          <p className="text-[10px] text-muted-foreground">{selectedConv} - Meta Cloud API</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto bg-secondary/10">
                      {loadingMsgs ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                      ) : messages.length === 0 ? (
                        <div className="text-center text-muted-foreground text-sm py-8">Nenhuma mensagem ainda</div>
                      ) : (
                        <div className="space-y-3">
                          {messages.map(m => (
                            <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[75%] rounded-xl px-4 py-2 text-sm ${m.direction === "outbound" ? "bg-emerald-600 text-white rounded-br-sm" : "bg-card text-foreground rounded-bl-sm"}`}>
                                <p>{m.content}</p>
                                <div className="flex items-center justify-end gap-1 mt-1">
                                  <span className="text-[10px] opacity-70">{formatTime(m.created_at)}</span>
                                  {m.direction === "outbound" && statusIcon(m.status)}
                                  {m.pricing_category && <Badge className="text-[8px] h-4 bg-blue-500/30 text-blue-300 px-1">{m.pricing_category}</Badge>}
                                </div>
                              </div>
                            </div>
                          ))}
                          <div ref={messagesEndRef} />
                        </div>
                      )}
                    </div>
                    <div className="p-3 border-t border-border/60 bg-card flex gap-2">
                      <Input placeholder="Mensagem via Meta API..." value={messageInput} onChange={e => setMessageInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} className="flex-1" />
                      <Button size="icon" onClick={sendMessage} className="bg-emerald-600 hover:bg-emerald-700"><Send className="h-4 w-4" /></Button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <div className="text-center space-y-2">
                      <MessageSquare className="h-12 w-12 mx-auto opacity-30" />
                      <p className="text-sm">Selecione uma conversa</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* TEMPLATES TAB */}
          <TabsContent value="templates" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{templates.length} templates cadastrados</p>
              <div className="flex gap-2">
                <Button variant="default" size="sm" onClick={openCreateBuilder}>
                  <Plus className="h-4 w-4 mr-1" />
                  Novo Template
                </Button>
                <Button variant="outline" size="sm" onClick={syncTemplates} disabled={syncingTemplates}>
                  {syncingTemplates ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  Sincronizar com Meta
                </Button>
              </div>
            </div>
            <Card className="border-border/60 bg-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Idioma</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Qualidade</TableHead>
                      <TableHead>Enviados</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum template. Clique em "Novo Template" ou "Sincronizar com Meta".</TableCell></TableRow>
                    ) : templates.map(t => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium text-foreground">{t.name}</span>
                            {t.status === "REJECTED" && t.rejection_reason && (
                              <div className="mt-1">
                                <Alert variant="destructive" className="py-1.5 px-2.5 text-xs">
                                  <AlertTriangle className="h-3 w-3" />
                                  <AlertDescription className="text-xs">{t.rejection_reason}</AlertDescription>
                                </Alert>
                              </div>
                            )}
                            {t.status === "APPROVED" && t.approved_at && (
                              <p className="text-[10px] text-emerald-400 mt-0.5">
                                Aprovado em {new Date(t.approved_at).toLocaleDateString("pt-BR")}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="secondary">{t.category}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{t.language}</TableCell>
                        <TableCell>{templateStatusBadge(t.status)}</TableCell>
                        <TableCell>{qualityBadge(t.quality_score)}</TableCell>
                        <TableCell className="text-muted-foreground">{t.total_sent ?? 0}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Preview" onClick={() => openPreview(t)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {(t.status === "REJECTED" || t.status === "PAUSED") && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => openEditBuilder(t)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Duplicar" onClick={() => duplicateTemplate(t)}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            {t.status === "APPROVED" && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Testar envio" onClick={() => openTestDialog(t)}>
                                <TestTube2 className="h-3.5 w-3.5 text-blue-400" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300" title="Deletar" onClick={() => { setDeleteTarget(t); setDeleteOpen(true); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CONFIGURAÇÕES TAB */}
          <TabsContent value="config" className="space-y-4">
            {/* Credenciais WABA */}
            <Card className="border-border/60 bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4 text-emerald-400" />Credenciais Meta WABA</CardTitle>
                <CardDescription>Dados da sua conta WhatsApp Business API</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {credentials ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">WABA ID</p>
                      <p className="text-sm font-mono text-foreground bg-muted/30 px-3 py-2 rounded-lg">{credentials.waba_id ?? "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Business ID</p>
                      <p className="text-sm font-mono text-foreground bg-muted/30 px-3 py-2 rounded-lg">{credentials.meta_business_id ?? "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">App ID</p>
                      <p className="text-sm font-mono text-foreground bg-muted/30 px-3 py-2 rounded-lg">{credentials.meta_app_id ?? "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">API Version</p>
                      <p className="text-sm font-mono text-foreground bg-muted/30 px-3 py-2 rounded-lg">{credentials.api_version ?? "v21.0"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Quality Rating</p>
                      <div>{qualityBadge(credentials.quality_rating)}</div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Messaging Limit</p>
                      <p className="text-sm text-foreground">{credentials.messaging_limit_tier ?? "TIER_250"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Verificação</p>
                      <div>
                        {credentials.is_verified
                          ? <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CircleCheck className="h-3 w-3 mr-1" />Verificado</Badge>
                          : <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><CircleDot className="h-3 w-3 mr-1" />Pendente</Badge>
                        }
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Access Token</p>
                      <p className="text-sm font-mono text-foreground bg-muted/30 px-3 py-2 rounded-lg truncate">
                        {credentials.meta_access_token ? `${credentials.meta_access_token.substring(0, 20)}...` : "Não configurado"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Nenhuma credencial configurada</AlertTitle>
                    <AlertDescription>Configure suas credenciais Meta WABA para começar a usar o WhatsApp Business API.</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Telefones */}
            <Card className="border-border/60 bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Phone className="h-4 w-4 text-emerald-400" />Números de Telefone</CardTitle>
                <CardDescription>{connectedPhones} de {phoneNumbers.length} números conectados</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Nome Verificado</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Quality</TableHead>
                      <TableHead>Limite Msgs</TableHead>
                      <TableHead>Throughput</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {phoneNumbers.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum número registrado. Configure via Meta Business Manager.</TableCell></TableRow>
                    ) : phoneNumbers.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium text-foreground font-mono">{p.display_phone}</TableCell>
                        <TableCell className="text-foreground">{p.verified_name ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={p.status === "connected" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"}>
                            {p.status === "connected" ? <CircleCheck className="h-3 w-3 mr-1" /> : <CircleDot className="h-3 w-3 mr-1" />}
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{qualityBadge(p.quality_rating)}</TableCell>
                        <TableCell className="text-muted-foreground">{p.messaging_limit ?? 250}/dia</TableCell>
                        <TableCell className="text-muted-foreground">{p.max_msgs_per_second ?? 80}/s</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TEMPLATE BUILDER DIALOG                                   */}
      {/* ══════════════════════════════════════════════════════════ */}
      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{builderMode === "create" ? "Criar Novo Template" : "Editar Template"}</DialogTitle>
            <DialogDescription>
              {builderMode === "create"
                ? "Preencha os campos para criar um template na Meta. Ele sera enviado para aprovacao."
                : "Altere os campos e reenvie para aprovacao na Meta."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 mt-4">
            {/* ── Form Column ── */}
            <div className="space-y-5">
              {/* Name + Category + Language */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-name">Nome (snake_case)</Label>
                  <Input
                    id="tpl-name"
                    placeholder="meu_template"
                    value={templateForm.name}
                    onChange={(e) => updateForm("name", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    disabled={builderMode === "edit"}
                  />
                  {templateForm.name && !isValidSnakeCase(templateForm.name) && (
                    <p className="text-xs text-red-400">Deve iniciar com letra, apenas a-z, 0-9 e _</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Select value={templateForm.category} onValueChange={(v) => updateForm("category", v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MARKETING">MARKETING</SelectItem>
                      <SelectItem value="UTILITY">UTILITY</SelectItem>
                      <SelectItem value="AUTHENTICATION">AUTHENTICATION</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Idioma</Label>
                  <Select value={templateForm.language} onValueChange={(v) => updateForm("language", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* AI Generate Button */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setAiDialogOpen(true)} className="text-violet-400 border-violet-500/30 hover:bg-violet-500/10">
                  <Zap className="h-3.5 w-3.5 mr-1" />
                  Gerar com IA
                </Button>
                <span className="text-xs text-muted-foreground">Descreva seu produto/objetivo e a IA gera o template</span>
              </div>

              {/* Header */}
              <div className="space-y-2">
                <Label>Header (opcional)</Label>
                <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
                  <Select value={templateForm.headerType} onValueChange={(v) => updateForm("headerType", v as HeaderType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Nenhum</SelectItem>
                      <SelectItem value="TEXT">Texto</SelectItem>
                      <SelectItem value="IMAGE">Imagem</SelectItem>
                      <SelectItem value="VIDEO">Video</SelectItem>
                      <SelectItem value="DOCUMENT">Documento</SelectItem>
                    </SelectContent>
                  </Select>
                  {templateForm.headerType !== "NONE" && (
                    <Input
                      placeholder={templateForm.headerType === "TEXT" ? "Texto do header..." : "URL da midia (handle)..."}
                      value={templateForm.headerContent}
                      onChange={(e) => updateForm("headerContent", e.target.value)}
                    />
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Corpo da mensagem</Label>
                  <span className={`text-xs ${templateForm.body.length > 1024 ? "text-red-400" : "text-muted-foreground"}`}>
                    {templateForm.body.length}/1024
                  </span>
                </div>
                <Textarea
                  placeholder={"Ola {{1}}, seu pedido {{2}} foi confirmado!\n\nUse {{1}}, {{2}}, etc. para variaveis."}
                  value={templateForm.body}
                  onChange={(e) => updateForm("body", e.target.value)}
                  rows={5}
                  className="font-mono text-sm"
                />
                {bodyVariables.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Variaveis detectadas: {bodyVariables.join(", ")}
                  </p>
                )}
              </div>

              {/* Example values */}
              {bodyVariables.length > 0 && (
                <div className="space-y-2">
                  <Label>Valores de exemplo (obrigatorio pela Meta)</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {bodyVariables.map((v, i) => (
                      <div key={v} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-10 shrink-0">{v}</span>
                        <Input
                          placeholder={`Exemplo para ${v}`}
                          value={templateForm.exampleValues[i] || ""}
                          onChange={(e) => {
                            const updated = [...templateForm.exampleValues];
                            updated[i] = e.target.value;
                            updateForm("exampleValues", updated);
                          }}
                          className="h-8 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Footer (opcional)</Label>
                  <span className={`text-xs ${templateForm.footer.length > 60 ? "text-red-400" : "text-muted-foreground"}`}>
                    {templateForm.footer.length}/60
                  </span>
                </div>
                <Input
                  placeholder="Ex: Responda SAIR para cancelar"
                  value={templateForm.footer}
                  onChange={(e) => updateForm("footer", e.target.value)}
                />
              </div>

              <Separator />

              {/* Buttons */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Botoes (opcional, max 3)</Label>
                  <Button variant="outline" size="sm" onClick={addButton} disabled={templateForm.buttons.length >= 3}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
                  </Button>
                </div>
                {templateForm.buttons.map((btn, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded-lg border border-border/60 bg-secondary/20">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Select value={btn.type} onValueChange={(v) => updateButton(i, "type", v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="URL">URL</SelectItem>
                          <SelectItem value="PHONE_NUMBER">Telefone</SelectItem>
                          <SelectItem value="QUICK_REPLY">Resposta Rapida</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Texto do botao"
                        value={btn.text}
                        onChange={(e) => updateButton(i, "text", e.target.value)}
                        className="h-8 text-sm"
                      />
                      {btn.type !== "QUICK_REPLY" && (
                        <Input
                          placeholder={btn.type === "URL" ? "https://..." : "+5511999999999"}
                          value={btn.value}
                          onChange={(e) => updateButton(i, "value", e.target.value)}
                          className="h-8 text-sm"
                        />
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 shrink-0" onClick={() => removeButton(i)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Preview Column ── */}
            <div className="border border-border/60 rounded-xl bg-secondary/10 flex flex-col">
              <div className="px-4 py-2.5 border-b border-border/60 bg-emerald-900/20 rounded-t-xl">
                <p className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" /> Preview WhatsApp
                </p>
              </div>
              <div className="flex-1 bg-[#0b141a] rounded-b-xl p-3 flex items-start justify-center min-h-[300px]">
                <TemplatePreview form={templateForm} />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setBuilderOpen(false)}>Cancelar</Button>
            <Button onClick={saveTemplate} disabled={builderSaving} className="bg-emerald-600 hover:bg-emerald-700">
              {builderSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              {builderMode === "create" ? "Criar Template" : "Reenviar para Aprovacao"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TEMPLATE PREVIEW DIALOG                                   */}
      {/* ══════════════════════════════════════════════════════════ */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Preview: {previewTemplate?.name}</DialogTitle>
            <DialogDescription>
              {previewTemplate?.category} - {previewTemplate?.language} - {templateStatusBadge(previewTemplate?.status ?? "PENDING")}
            </DialogDescription>
          </DialogHeader>
          {previewTemplate && (
            <div className="bg-[#0b141a] rounded-xl p-4">
              <TemplatePreview form={parseComponentsToForm(previewTemplate)} />
            </div>
          )}
          {previewTemplate?.status === "REJECTED" && previewTemplate?.rejection_reason && (
            <Alert variant="destructive" className="mt-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Rejeitado</AlertTitle>
              <AlertDescription>{previewTemplate.rejection_reason}</AlertDescription>
            </Alert>
          )}
          {previewTemplate?.status === "APPROVED" && previewTemplate?.approved_at && (
            <p className="text-xs text-emerald-400 mt-2">
              Aprovado em {new Date(previewTemplate.approved_at).toLocaleDateString("pt-BR")}
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* DELETE CONFIRMATION DIALOG                                */}
      {/* ══════════════════════════════════════════════════════════ */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Deletar Template</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja deletar o template <strong>"{deleteTarget?.name}"</strong>? Esta acao sera refletida na Meta e nao pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={deleteTemplate} disabled={deleteLoading}>
              {deleteLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Deletar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* SEND TEST DIALOG                                          */}
      {/* ══════════════════════════════════════════════════════════ */}
      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar Teste: {testTemplate?.name}</DialogTitle>
            <DialogDescription>
              Envie este template para um numero de telefone para testar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Telefone (com DDI)</Label>
              <Input
                placeholder="5511999999999"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value.replace(/[^0-9]/g, ""))}
                className="font-mono"
              />
            </div>

            {testTemplate && (() => {
              const bodyComp = (testTemplate.components || []).find((c: any) => c.type === "BODY");
              const vars = bodyComp ? extractVariables(bodyComp.text || "") : [];
              if (vars.length === 0) return null;
              return (
                <div className="space-y-2">
                  <Label>Valores das variaveis</Label>
                  {vars.map((v, i) => (
                    <div key={v} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-10 shrink-0">{v}</span>
                      <Input
                        placeholder={`Valor para ${v}`}
                        value={testVars[i] || ""}
                        onChange={(e) => {
                          const updated = [...testVars];
                          updated[i] = e.target.value;
                          setTestVars(updated);
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Preview of final message */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Preview da mensagem</Label>
              <div className="bg-[#0b141a] rounded-lg p-3">
                <div className="bg-emerald-700 rounded-xl rounded-tl-sm p-3 text-white text-sm max-w-[280px]">
                  <p className="whitespace-pre-wrap text-[13px]">{testPreviewBody || "..."}</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(false)}>Cancelar</Button>
            <Button onClick={sendTestTemplate} disabled={testSending || !testPhone.trim()} className="bg-emerald-600 hover:bg-emerald-700">
              {testSending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Enviar Teste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nova Conversa Dialog */}
      <Dialog open={newConvOpen} onOpenChange={setNewConvOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Conversa</DialogTitle>
            <DialogDescription>Envie um template aprovado para iniciar uma nova conversa via Meta API.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Número do WhatsApp</Label>
              <Input
                placeholder="+55 11 99999-9999"
                value={newConvPhone}
                onChange={e => setNewConvPhone(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Formato: código do país + DDD + número</p>
            </div>
            <div>
              <Label>Template Aprovado</Label>
              <Select value={newConvTemplate} onValueChange={setNewConvTemplate}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione um template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.filter((t: any) => t.status === "APPROVED").map((t: any) => (
                    <SelectItem key={t.name} value={t.name}>
                      {t.name} ({t.language})
                    </SelectItem>
                  ))}
                  {templates.filter((t: any) => t.status === "APPROVED").length === 0 && (
                    <SelectItem value="__none" disabled>Nenhum template aprovado</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewConvOpen(false)}>Cancelar</Button>
            <Button
              onClick={startNewConversation}
              disabled={!newConvPhone.trim() || !newConvTemplate || newConvSending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {newConvSending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Enviar Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* AI GENERATE TEMPLATE DIALOG                               */}
      {/* ══════════════════════════════════════════════════════════ */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Zap className="h-4 w-4 text-violet-400" />Gerar Template com IA</DialogTitle>
            <DialogDescription>
              Descreva seu produto ou objetivo e a IA vai gerar um template otimizado para WhatsApp Business.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Produto / Objetivo</Label>
              <Textarea
                placeholder="Ex: Promoção de 20% em tênis esportivos para clientes que compraram nos últimos 30 dias"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={4}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Quanto mais detalhes, melhor o resultado.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiDialogOpen(false)}>Cancelar</Button>
            <Button onClick={generateWithAI} disabled={aiGenerating || !aiPrompt.trim()} className="bg-violet-600 hover:bg-violet-700">
              {aiGenerating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
              Gerar Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
