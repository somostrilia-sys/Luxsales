export type Empresa = "Objetivo" | "Trilia" | "Trackit" | "Trilho" | "Essência" | "Alex Pessoal";
export type AgentStatus = "ativo" | "pausado" | "erro";
export type ConsultorPerfil = "admin" | "gestor" | "consultor";

export interface EmpresaInfo {
  id: Empresa;
  nome: string;
  descricao: string;
  emoji: string;
}

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

export const empresas: EmpresaInfo[] = [
  { id: "Objetivo", nome: "Objetivo", descricao: "Proteção veicular + Administrativo", emoji: "🛡️" },
  { id: "Trilia", nome: "Trilia", descricao: "Consultoria", emoji: "📐" },
  { id: "Trackit", nome: "Trackit", descricao: "Rastreamento", emoji: "📍" },
  { id: "Trilho", nome: "Trilho", descricao: "Assistência 24h", emoji: "🚗" },
  { id: "Essência", nome: "Essência", descricao: "Marketing", emoji: "✨" },
  { id: "Alex Pessoal", nome: "Alex Pessoal", descricao: "Pessoal", emoji: "👤" },
];

// ── AGENTES ──

const agentesObjetivo: Agente[] = [
  { id: "obj-1", nome: "Espião", emoji: "🕵️", empresa: "Objetivo", status: "ativo", ultimoRelatorio: "09/03/2026 08:30", proximaExecucao: "09/03/2026 14:00", descricao: "Monitoramento de concorrentes e mercado de proteção veicular" },
  { id: "obj-2", nome: "Prospector", emoji: "🎯", empresa: "Objetivo", status: "ativo", ultimoRelatorio: "09/03/2026 09:00", proximaExecucao: "09/03/2026 15:00", descricao: "Prospecção automática de leads B2B qualificados" },
  { id: "obj-3", nome: "Social Seller", emoji: "📱", empresa: "Objetivo", status: "ativo", ultimoRelatorio: "09/03/2026 07:45", proximaExecucao: "09/03/2026 13:45", descricao: "Vendas sociais e engajamento em redes" },
  { id: "obj-4", nome: "Coach", emoji: "🏋️", empresa: "Objetivo", status: "ativo", ultimoRelatorio: "09/03/2026 08:15", proximaExecucao: "09/03/2026 14:15", descricao: "Treinamento e coaching de equipe de vendas" },
  { id: "obj-5", nome: "Cotador", emoji: "💰", empresa: "Objetivo", status: "ativo", ultimoRelatorio: "09/03/2026 09:30", proximaExecucao: "09/03/2026 15:30", descricao: "Cotação automática de proteção veicular" },
  { id: "obj-6", nome: "SDR", emoji: "📞", empresa: "Objetivo", status: "ativo", ultimoRelatorio: "09/03/2026 08:00", proximaExecucao: "09/03/2026 14:00", descricao: "Qualificação e agendamento de reuniões" },
  { id: "obj-7", nome: "Anti-Churn", emoji: "🔄", empresa: "Objetivo", status: "pausado", ultimoRelatorio: "08/03/2026 18:00", proximaExecucao: "—", descricao: "Retenção de associados e prevenção de cancelamento" },
  { id: "obj-8", nome: "Criador de Conteúdo", emoji: "✍️", empresa: "Objetivo", status: "ativo", ultimoRelatorio: "09/03/2026 07:00", proximaExecucao: "09/03/2026 13:00", descricao: "Geração de conteúdo para blogs e redes sociais" },
  { id: "obj-9", nome: "Analista", emoji: "📊", empresa: "Objetivo", status: "ativo", ultimoRelatorio: "09/03/2026 09:15", proximaExecucao: "09/03/2026 15:15", descricao: "Análise de métricas e geração de insights" },
];

const agentesTrilia: Agente[] = [
  { id: "tri-1", nome: "Pesquisador", emoji: "🔍", empresa: "Trilia", status: "ativo", ultimoRelatorio: "09/03/2026 08:00", proximaExecucao: "09/03/2026 14:00", descricao: "Pesquisa de mercado e análise de tendências" },
  { id: "tri-2", nome: "Social Seller", emoji: "📱", empresa: "Trilia", status: "ativo", ultimoRelatorio: "09/03/2026 07:30", proximaExecucao: "09/03/2026 13:30", descricao: "Engajamento e vendas via redes sociais" },
  { id: "tri-3", nome: "SDR", emoji: "📞", empresa: "Trilia", status: "ativo", ultimoRelatorio: "09/03/2026 09:00", proximaExecucao: "09/03/2026 15:00", descricao: "Prospecção ativa e qualificação de leads" },
  { id: "tri-4", nome: "Diagnosticador", emoji: "🩺", empresa: "Trilia", status: "ativo", ultimoRelatorio: "09/03/2026 08:45", proximaExecucao: "09/03/2026 14:45", descricao: "Diagnóstico de maturidade empresarial" },
  { id: "tri-5", nome: "Preparador", emoji: "📋", empresa: "Trilia", status: "pausado", ultimoRelatorio: "08/03/2026 20:00", proximaExecucao: "—", descricao: "Preparação de propostas e apresentações" },
  { id: "tri-6", nome: "Criador de Conteúdo", emoji: "✍️", empresa: "Trilia", status: "ativo", ultimoRelatorio: "09/03/2026 07:00", proximaExecucao: "09/03/2026 13:00", descricao: "Conteúdo técnico para consultoria" },
  { id: "tri-7", nome: "Analista", emoji: "📊", empresa: "Trilia", status: "erro", ultimoRelatorio: "08/03/2026 22:00", proximaExecucao: "09/03/2026 10:00", descricao: "Análise de KPIs e relatórios de consultoria" },
];

const agentesTrackit: Agente[] = [
  { id: "trk-1", nome: "Monitor GPS", emoji: "📡", empresa: "Trackit", status: "ativo", ultimoRelatorio: "09/03/2026 09:00", proximaExecucao: "09/03/2026 10:00", descricao: "Monitoramento em tempo real de veículos rastreados" },
  { id: "trk-2", nome: "Alertador", emoji: "🚨", empresa: "Trackit", status: "ativo", ultimoRelatorio: "09/03/2026 09:30", proximaExecucao: "09/03/2026 10:30", descricao: "Alertas de cercas virtuais e desvios de rota" },
  { id: "trk-3", nome: "Relatórios Fleet", emoji: "🚛", empresa: "Trackit", status: "pausado", ultimoRelatorio: "08/03/2026 18:00", proximaExecucao: "—", descricao: "Geração de relatórios de frota e consumo" },
];

const agentesTrilho: Agente[] = [
  { id: "tlh-1", nome: "Dispatcher", emoji: "🚑", empresa: "Trilho", status: "ativo", ultimoRelatorio: "09/03/2026 09:45", proximaExecucao: "09/03/2026 10:45", descricao: "Despacho automático de assistência 24h" },
  { id: "tlh-2", nome: "Atendente Virtual", emoji: "🤖", empresa: "Trilho", status: "ativo", ultimoRelatorio: "09/03/2026 09:50", proximaExecucao: "09/03/2026 10:50", descricao: "Atendimento automatizado para chamados de emergência" },
];

const agentesEssencia: Agente[] = [
  { id: "ess-1", nome: "Social Manager", emoji: "📣", empresa: "Essência", status: "ativo", ultimoRelatorio: "09/03/2026 08:00", proximaExecucao: "09/03/2026 14:00", descricao: "Gestão de redes sociais e calendário editorial" },
  { id: "ess-2", nome: "Designer AI", emoji: "🎨", empresa: "Essência", status: "ativo", ultimoRelatorio: "09/03/2026 07:30", proximaExecucao: "09/03/2026 13:30", descricao: "Geração de criativos e peças visuais" },
  { id: "ess-3", nome: "Copywriter", emoji: "✏️", empresa: "Essência", status: "pausado", ultimoRelatorio: "08/03/2026 20:00", proximaExecucao: "—", descricao: "Redação publicitária e copies para anúncios" },
];

const agentesAlex: Agente[] = [
  { id: "alex-1", nome: "Criador de Conteúdo", emoji: "✍️", empresa: "Alex Pessoal", status: "ativo", ultimoRelatorio: "09/03/2026 08:00", proximaExecucao: "09/03/2026 14:00", descricao: "Criação de conteúdo pessoal e branding" },
  { id: "alex-2", nome: "Analista", emoji: "📊", empresa: "Alex Pessoal", status: "ativo", ultimoRelatorio: "09/03/2026 09:00", proximaExecucao: "09/03/2026 15:00", descricao: "Análise de performance e métricas pessoais" },
  { id: "alex-3", nome: "Assistente", emoji: "🤝", empresa: "Alex Pessoal", status: "ativo", ultimoRelatorio: "09/03/2026 09:30", proximaExecucao: "09/03/2026 15:30", descricao: "Assistente pessoal para tarefas e agenda" },
];

export const agentes: Agente[] = [
  ...agentesObjetivo, ...agentesTrilia, ...agentesTrackit, ...agentesTrilho, ...agentesEssencia, ...agentesAlex,
];

// ── CONSULTORES ──

const regioes = ["São Paulo", "Rio de Janeiro", "Belo Horizonte", "Curitiba", "Porto Alegre", "Salvador", "Brasília", "Fortaleza", "Recife", "Goiânia", "Campinas", "Manaus"];
const nomes = ["Ana Oliveira","Carlos Silva","Beatriz Santos","Diego Ferreira","Fernanda Lima","Gabriel Costa","Helena Rocha","Igor Mendes","Juliana Alves","Rafael Souza","Mariana Pereira","Lucas Barbosa","Camila Ribeiro","Thiago Martins","Larissa Gomes","Pedro Araújo","Natália Cardoso","Bruno Nascimento","Patrícia Duarte","Vinícius Moreira","Amanda Teixeira","Felipe Correia","Isabela Dias","Rodrigo Pinto","Letícia Castro","Eduardo Ramos","Daniela Nunes","Gustavo Campos","Aline Vieira","Renato Freitas","Priscila Monteiro","André Carvalho","Vanessa Azevedo","Marcelo Lopes","Cristiane Melo","João Paulo Cunha","Tatiane Fernandes","Fábio Rezende","Sandra Borges","Alexandre Fonseca","Elaine Machado","Roberto Medeiros","Simone Cavalcanti","Leandro Bastos","Claudia Batista","Otávio Pires","Michele Guimarães","Sérgio Nogueira","Adriana Sampaio","Marcela Xavier","Caio Mendonça","Bianca Tavares","Paulo Henrique Reis","Viviane Brito","Renan Andrade","Débora Moura","William Garcia","Raquel Figueiredo","Henrique Cruz","Estela Miranda","Matheus Pacheco","Carolina Assis","Danilo Rangel","Paloma Siqueira","Ricardo Leal","Jéssica Prado","Fabiano Costa","Luana Barros","Wagner Telles","Renata Lacerda","Thales Coutinho","Sabrina Amorim","Evandro Valente","Lorena Diniz","Murilo Esteves","Elisa Vargas","Alex Neves","Monique Serra","Hugo Braga","Talita Rocha","Augusto Maia","Débora Queiroz","Emanuel Ávila","Rose Bueno","Nelson Coelho","Lívia Passos","Oswaldo Galvão","Karen Marques","Jonas Silvestre","Teresa Fontes","Cláudio Bittencourt","Ingrid Espíndola","Marcos Viana","Gisele Jardim","Davi Luz","Luiza Motta","Artur Seabra","Raissa Aguiar","Flávio Teixeira"];

function gerarConsultores(empresa: Empresa, quantidade: number, startId: number): Consultor[] {
  const perfis: ConsultorPerfil[] = ["admin", "gestor", "consultor"];
  const dominio = empresa.toLowerCase().replace(/ /g, "") + ".com.br";
  return Array.from({ length: quantidade }, (_, i) => {
    const nome = nomes[i % nomes.length];
    const ddd = ["11","21","31","41","51","71","61","85","81","62"][i % 10];
    return {
      id: `${empresa.substring(0,3).toLowerCase()}-c${startId + i}`,
      nome,
      telefone: `(${ddd}) 9${String(Math.floor(1000 + Math.random() * 9000))}-${String(Math.floor(1000 + Math.random() * 9000))}`,
      email: `${nome.split(" ")[0].toLowerCase()}${startId + i}@${dominio}`,
      empresa,
      perfil: i < 2 ? "admin" : i < 5 ? "gestor" : "consultor",
      regiao: regioes[i % regioes.length],
      ativo: Math.random() > 0.15,
    };
  });
}

const consultoresObjetivo = gerarConsultores("Objetivo", 100, 1);
const consultoresTrilia = gerarConsultores("Trilia", 10, 1);
const consultoresTrackit = gerarConsultores("Trackit", 8, 1);
const consultoresTrilho = gerarConsultores("Trilho", 7, 1);
const consultoresEssencia = gerarConsultores("Essência", 6, 1);
const consultoresAlex = gerarConsultores("Alex Pessoal", 5, 1);

export const consultores: Consultor[] = [
  ...consultoresObjetivo, ...consultoresTrilia, ...consultoresTrackit, ...consultoresTrilho, ...consultoresEssencia, ...consultoresAlex,
];

// ── RELATÓRIOS ──

function gerarRelatorios(agentesEmpresa: Agente[]): Relatorio[] {
  const results: Relatorio[] = [];
  const statusOpts: Array<"completo" | "parcial" | "erro"> = ["completo", "completo", "completo", "parcial", "erro"];
  const resumos: Record<string, string[]> = {
    "Espião": ["12 movimentações de concorrentes detectadas", "Novo player identificado na região Sudeste"],
    "Prospector": ["42 novos leads qualificados identificados", "28 leads B2B com alto score de conversão"],
    "Social Seller": ["156 interações em redes sociais", "32 conexões estratégicas realizadas"],
    "Coach": ["8 sessões de coaching concluídas", "Equipe de vendas atingiu 92% da meta"],
    "Cotador": ["87 cotações geradas automaticamente", "Ticket médio de R$189,90"],
    "SDR": ["34 reuniões agendadas esta semana", "18 leads qualificados encaminhados"],
    "Anti-Churn": ["15 associados retidos com sucesso", "Taxa de retenção subiu para 94%"],
    "Criador de Conteúdo": ["12 posts publicados", "Engajamento médio de 4.2%"],
    "Analista": ["Dashboard atualizado com 23 métricas", "ROI de campanhas: 340%"],
    "Pesquisador": ["5 tendências de mercado mapeadas", "Relatório de benchmark concluído"],
    "Diagnosticador": ["3 diagnósticos empresariais finalizados", "Maturidade média: nível 3.8/5"],
    "Preparador": ["7 propostas elaboradas", "Taxa de aprovação: 78%"],
    "Monitor GPS": ["2.340 veículos monitorados em tempo real", "3 alertas de desvio de rota"],
    "Alertador": ["18 alertas de cerca virtual", "Zero incidentes críticos"],
    "Relatórios Fleet": ["Relatório semanal de frota gerado", "Consumo médio: 12.3 km/l"],
    "Dispatcher": ["47 chamados atendidos nas últimas 24h", "Tempo médio de resposta: 8 min"],
    "Atendente Virtual": ["312 atendimentos automatizados", "Satisfação: 96%"],
    "Social Manager": ["Calendário editorial atualizado", "45 posts agendados para a semana"],
    "Designer AI": ["28 peças visuais geradas", "3 campanhas em produção"],
    "Copywriter": ["15 copies de anúncios criados", "CTR médio: 3.8%"],
    "Assistente": ["23 tarefas organizadas", "5 reuniões agendadas"],
  };

  agentesEmpresa.forEach((ag) => {
    const resumoList = resumos[ag.nome] || ["Execução concluída com sucesso", "Processamento realizado"];
    for (let d = 0; d < 3; d++) {
      results.push({
        id: `rel-${ag.id}-${d}`,
        agenteId: ag.id,
        agenteNome: ag.nome,
        agenteEmoji: ag.emoji,
        empresa: ag.empresa,
        data: `${9 - d}/03/2026 ${String(7 + Math.floor(Math.random() * 3)).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}`,
        tipo: ag.descricao.split(" ")[0],
        resumo: resumoList[d % resumoList.length],
        status: d === 0 ? (ag.status === "erro" ? "erro" : "completo") : statusOpts[Math.floor(Math.random() * statusOpts.length)],
      });
    }
  });
  return results;
}

export const relatorios: Relatorio[] = gerarRelatorios(agentes);

// ── PERFORMANCE ──

export const performanceData = [
  { dia: "Seg", leads: 34, relatorios: 12, atendimentos: 156 },
  { dia: "Ter", leads: 42, relatorios: 15, atendimentos: 187 },
  { dia: "Qua", leads: 38, relatorios: 11, atendimentos: 143 },
  { dia: "Qui", leads: 51, relatorios: 18, atendimentos: 201 },
  { dia: "Sex", leads: 46, relatorios: 14, atendimentos: 178 },
  { dia: "Sáb", leads: 22, relatorios: 6, atendimentos: 89 },
  { dia: "Dom", leads: 15, relatorios: 3, atendimentos: 45 },
];

// Helper: gerar performanceData por empresa (variação aleatória seed-based)
export function getPerformanceData(empresa: Empresa) {
  const multipliers: Record<Empresa, number> = {
    "Objetivo": 1,
    "Trilia": 0.6,
    "Trackit": 0.4,
    "Trilho": 0.35,
    "Essência": 0.3,
    "Alex Pessoal": 0.15,
  };
  const m = multipliers[empresa];
  return performanceData.map(d => ({
    dia: d.dia,
    leads: Math.round(d.leads * m),
    relatorios: Math.round(d.relatorios * m),
    atendimentos: Math.round(d.atendimentos * m),
  }));
}
