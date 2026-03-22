import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  PhoneCall,
  Bot,
  BarChart3,
  Check,
  Zap,
  Shield,
  ArrowRight,
} from "lucide-react";

const features = [
  {
    icon: MessageSquare,
    title: "WhatsApp Business API Oficial",
    description:
      "Templates homologados, inbox unificado e automacoes de mensagens com integracao direta ao Meta Business.",
  },
  {
    icon: PhoneCall,
    title: "Ligacoes IA com Voz Clonada",
    description:
      "Simulador de voz, campanhas automatizadas e scripts inteligentes que convertem com naturalidade.",
  },
  {
    icon: Bot,
    title: "Agentes IA Multi-Canal",
    description:
      "Bots treinados com seus dados, atendimento 24/7 em WhatsApp, telefone e chat simultaneamente.",
  },
  {
    icon: BarChart3,
    title: "Dashboard de Metricas em Tempo Real",
    description:
      "Acompanhe conversoes, tempo de resposta, volume de atendimentos e ROI de cada canal ao vivo.",
  },
];

const plans = [
  {
    name: "Starter",
    price: "297",
    slug: "starter",
    highlight: false,
    features: [
      "1 usuario",
      "1.000 mensagens WhatsApp/mes",
      "100 ligacoes IA/mes",
      "Dashboard basico",
      "Suporte por e-mail",
    ],
  },
  {
    name: "Business",
    price: "697",
    slug: "business",
    highlight: true,
    features: [
      "5 usuarios",
      "5.000 mensagens WhatsApp/mes",
      "500 ligacoes IA/mes",
      "Voz clonada personalizada",
      "Dashboard avancado",
      "Suporte prioritario",
    ],
  },
  {
    name: "Enterprise",
    price: "1.497",
    slug: "enterprise",
    highlight: false,
    features: [
      "Usuarios ilimitados",
      "Mensagens ilimitadas",
      "Ligacoes ilimitadas",
      "API dedicada",
      "Suporte prioritario 24/7",
      "Gerente de conta exclusivo",
    ],
  },
];

export default function Venda() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
        <div className="relative mx-auto max-w-5xl px-6 py-28 text-center">
          <Badge variant="secondary" className="mb-4 text-sm">
            <Zap className="mr-1 h-3.5 w-3.5" /> Digital Lux
          </Badge>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            LuxSales
          </h1>
          <p className="mt-2 text-xl font-semibold text-primary sm:text-2xl">
            Plataforma Comercial Inteligente
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Automatize vendas com IA, WhatsApp oficial e ligacoes inteligentes.
            Tudo em uma unica plataforma para escalar seu comercial.
          </p>
          <Button
            size="lg"
            className="mt-8 text-base"
            onClick={() => navigate("/criar-conta?plano=starter")}
          >
            Comecar Agora <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="mb-2 text-center text-3xl font-bold">
          Tudo que voce precisa para vender mais
        </h2>
        <p className="mb-12 text-center text-muted-foreground">
          Funcionalidades pensadas para equipes comerciais de alta performance.
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <Card
              key={f.title}
              className="border-border bg-card transition-colors hover:border-primary/40"
            >
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-border bg-muted/30 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-2 text-center text-3xl font-bold">Planos e Precos</h2>
          <p className="mb-12 text-center text-muted-foreground">
            Escolha o plano ideal para o tamanho da sua operacao.
          </p>
          <div className="grid gap-8 md:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.slug}
                className={
                  "flex flex-col " +
                  (plan.highlight
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border")
                }
              >
                <CardHeader className="text-center">
                  {plan.highlight && (
                    <Badge className="mx-auto mb-2 w-fit">Mais Popular</Badge>
                  )}
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="mt-2">
                    <span className="text-4xl font-extrabold">
                      R$ {plan.price}
                    </span>
                    <span className="text-muted-foreground">/mes</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {plan.features.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={plan.highlight ? "default" : "outline"}
                    onClick={() =>
                      navigate("/criar-conta?plano=" + plan.slug)
                    }
                  >
                    Assinar <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>Digital Lux &copy; 2026. Todos os direitos reservados.</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="/termos" className="hover:text-foreground transition-colors">
              Termos de Uso
            </a>
            <a href="/privacidade" className="hover:text-foreground transition-colors">
              Politica de Privacidade
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
