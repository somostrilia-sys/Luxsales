export type Empresa = "Objetivo" | "Trilia" | "WALK";
export type AgentStatus = "ativo" | "pausado" | "erro";
export type ConsultorPerfil = "admin" | "gestor" | "consultor";

export interface Agente {
  id: string;
  nome: string;
  emoji: string;
  empresa: Empresa;
  status: AgentStatus;
  ultimoRelatorio: string;
  proximaExecucao: string;
  descricao: string;
}

export interface Consultor {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  empresa: Empresa;
  perfil: ConsultorPerfil;
  regiao: string;
  ativo: boolean;
}

export interface Relatorio {
  id: string;
  agenteId: string;
  agenteNome: string;
  agenteEmoji: string;
  empresa: Empresa;
  data: string;
  tipo: string;
  resumo: string;
  status: "completo" | "parcial" | "erro";
}

export const agentes: Agente[] = [
  { id: "1", nome: "Prospector Lead", emoji: "🎯", empresa: "Objetivo", status: "ativo", ultimoRelatorio: "09/03/2026 08:30", proximaExecucao: "09/03/2026 14:00", descricao: "Prospecção automática de leads B2B" },
  { id: "2", nome: "Report Builder", emoji: "📊", empresa: "Trilia", status: "ativo", ultimoRelatorio: "09/03/2026 07:00", proximaExecucao: "09/03/2026 13:00", descricao: "Geração de relatórios de vendas" },
  { id: "3", nome: "Email Nurture", emoji: "📧", empresa: "WALK", status: "pausado", ultimoRelatorio: "08/03/2026 18:00", proximaExecucao: "—", descricao: "Nutrição de leads por email" },
  { id: "4", nome: "Social Listener", emoji: "👂", empresa: "Objetivo", status: "ativo", ultimoRelatorio: "09/03/2026 09:15", proximaExecucao: "09/03/2026 15:15", descricao: "Monitoramento de menções em redes sociais" },
  { id: "5", nome: "Data Cleaner", emoji: "🧹", empresa: "Trilia", status: "erro", ultimoRelatorio: "08/03/2026 22:00", proximaExecucao: "09/03/2026 10:00", descricao: "Limpeza e enriquecimento de dados" },
  { id: "6", nome: "Chatbot Suporte", emoji: "🤖", empresa: "WALK", status: "ativo", ultimoRelatorio: "09/03/2026 09:45", proximaExecucao: "09/03/2026 10:45", descricao: "Atendimento automatizado ao cliente" },
  { id: "7", nome: "Scheduler Pro", emoji: "📅", empresa: "Objetivo", status: "ativo", ultimoRelatorio: "09/03/2026 08:00", proximaExecucao: "09/03/2026 12:00", descricao: "Agendamento inteligente de reuniões" },
  { id: "8", nome: "Analytics Hub", emoji: "📈", empresa: "Trilia", status: "pausado", ultimoRelatorio: "07/03/2026 20:00", proximaExecucao: "—", descricao: "Central de análise de métricas" },
];

export const consultores: Consultor[] = [
  { id: "1", nome: "Ana Oliveira", telefone: "(11) 99876-5432", email: "ana@objetivo.com.br", empresa: "Objetivo", perfil: "admin", regiao: "São Paulo", ativo: true },
  { id: "2", nome: "Carlos Silva", telefone: "(21) 98765-4321", email: "carlos@trilia.com.br", empresa: "Trilia", perfil: "gestor", regiao: "Rio de Janeiro", ativo: true },
  { id: "3", nome: "Beatriz Santos", telefone: "(31) 97654-3210", email: "beatriz@walk.com.br", empresa: "WALK", perfil: "consultor", regiao: "Belo Horizonte", ativo: true },
  { id: "4", nome: "Diego Ferreira", telefone: "(41) 96543-2109", email: "diego@objetivo.com.br", empresa: "Objetivo", perfil: "consultor", regiao: "Curitiba", ativo: false },
  { id: "5", nome: "Fernanda Lima", telefone: "(51) 95432-1098", email: "fernanda@trilia.com.br", empresa: "Trilia", perfil: "gestor", regiao: "Porto Alegre", ativo: true },
  { id: "6", nome: "Gabriel Costa", telefone: "(71) 94321-0987", email: "gabriel@walk.com.br", empresa: "WALK", perfil: "consultor", regiao: "Salvador", ativo: true },
  { id: "7", nome: "Helena Rocha", telefone: "(61) 93210-9876", email: "helena@objetivo.com.br", empresa: "Objetivo", perfil: "admin", regiao: "Brasília", ativo: true },
  { id: "8", nome: "Igor Mendes", telefone: "(85) 92109-8765", email: "igor@trilia.com.br", empresa: "Trilia", perfil: "consultor", regiao: "Fortaleza", ativo: false },
];

export const relatorios: Relatorio[] = [
  { id: "1", agenteId: "1", agenteNome: "Prospector Lead", agenteEmoji: "🎯", empresa: "Objetivo", data: "09/03/2026 08:30", tipo: "Prospecção", resumo: "42 novos leads qualificados identificados na região Sul", status: "completo" },
  { id: "2", agenteId: "2", agenteNome: "Report Builder", agenteEmoji: "📊", empresa: "Trilia", data: "09/03/2026 07:00", tipo: "Vendas", resumo: "Relatório semanal de vendas consolidado com aumento de 15%", status: "completo" },
  { id: "3", agenteId: "4", agenteNome: "Social Listener", agenteEmoji: "👂", empresa: "Objetivo", data: "09/03/2026 09:15", tipo: "Monitoramento", resumo: "23 menções positivas detectadas, 3 requerem atenção", status: "completo" },
  { id: "4", agenteId: "5", agenteNome: "Data Cleaner", agenteEmoji: "🧹", empresa: "Trilia", data: "08/03/2026 22:00", tipo: "Limpeza", resumo: "Erro ao processar lote 47 — timeout na API externa", status: "erro" },
  { id: "5", agenteId: "6", agenteNome: "Chatbot Suporte", agenteEmoji: "🤖", empresa: "WALK", data: "09/03/2026 09:45", tipo: "Atendimento", resumo: "187 atendimentos realizados, 94% de satisfação", status: "completo" },
  { id: "6", agenteId: "7", agenteNome: "Scheduler Pro", agenteEmoji: "📅", empresa: "Objetivo", data: "09/03/2026 08:00", tipo: "Agendamento", resumo: "12 reuniões agendadas automaticamente para hoje", status: "completo" },
  { id: "7", agenteId: "1", agenteNome: "Prospector Lead", agenteEmoji: "🎯", empresa: "Objetivo", data: "08/03/2026 08:30", tipo: "Prospecção", resumo: "38 leads qualificados, 5 convertidos em oportunidades", status: "completo" },
  { id: "8", agenteId: "3", agenteNome: "Email Nurture", agenteEmoji: "📧", empresa: "WALK", data: "08/03/2026 18:00", tipo: "Email", resumo: "Campanha pausada — taxa de bounce acima do limite", status: "parcial" },
  { id: "9", agenteId: "2", agenteNome: "Report Builder", agenteEmoji: "📊", empresa: "Trilia", data: "08/03/2026 07:00", tipo: "Vendas", resumo: "Relatório diário gerado com 234 transações processadas", status: "completo" },
  { id: "10", agenteId: "4", agenteNome: "Social Listener", agenteEmoji: "👂", empresa: "Objetivo", data: "08/03/2026 09:15", tipo: "Monitoramento", resumo: "18 menções detectadas, sentimento geral positivo", status: "completo" },
];

export const performanceData = [
  { dia: "Seg", leads: 34, relatorios: 12, atendimentos: 156 },
  { dia: "Ter", leads: 42, relatorios: 15, atendimentos: 187 },
  { dia: "Qua", leads: 38, relatorios: 11, atendimentos: 143 },
  { dia: "Qui", leads: 51, relatorios: 18, atendimentos: 201 },
  { dia: "Sex", leads: 46, relatorios: 14, atendimentos: 178 },
  { dia: "Sáb", leads: 22, relatorios: 6, atendimentos: 89 },
  { dia: "Dom", leads: 15, relatorios: 3, atendimentos: 45 },
];
