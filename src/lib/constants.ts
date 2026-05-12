import type { ProdutoCatalogo, ProdutosState, Mes } from '../types';

export const PRODUTOS: ProdutoCatalogo[] = [
  { id: 'funil', icon: '🎯', nome: 'Funil de Vendas',        ticketDefaultTCV: 10800, ticketDefaultMRR: 1800,  defaultMeses: 6 },
  { id: 'posic', icon: '💎', nome: 'Posicionamento',          ticketDefaultTCV: 12000, ticketDefaultMRR: 2500,  defaultMeses: 6 },
  { id: 'estr',  icon: '🛠', nome: 'Estruturação Comercial',  ticketDefaultTCV: 15000, ticketDefaultMRR: 1500,  defaultMeses: 6 },
  { id: 'renov', icon: '🔁', nome: 'Renovação',               ticketDefaultTCV: 10800, ticketDefaultMRR: 2000,  defaultMeses: 6, isRenov: true },
  { id: 'combo', icon: '🚀', nome: 'Combo (multi-produto)',   ticketDefaultTCV: 25800, ticketDefaultMRR: 4300,  defaultMeses: 6, isCombo: true },
];

export const COMBO_COMPONENTES = [
  { id: 'funil', nome: 'Funil de Vendas',       icon: '🎯' },
  { id: 'posic', nome: 'Posicionamento',         icon: '💎' },
  { id: 'estr',  nome: 'Estruturação Comercial', icon: '🛠' },
];

export const PROD_PRINCIPAIS = ['funil', 'posic', 'estr', 'renov', 'combo'];

export const META_MRR_DEZEMBRO = 265000;
export const DATA_VERSION = 16;

export const CLOUD_KEYS_TO_SYNC = [
  'imperio_meses',
  'imperio_meses_backup_v13',
  'imperio_state',
  'imperio_dash_periodo',
  'imperio_produtos',
  'carvalho_dashboard_v1',
];
export const CLOUD_GIST_FILENAME = 'imperio_digital_dados.json';

export const CD_MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

export const CD_CORES = [
  '#9ea0a8', '#60a5fa', '#22c55e', '#f59e0b',
  '#ef4444', '#a855f7', '#ec4899', '#14b8a6',
];

export const pesosSazonalidade: Record<string, number> = {
  Maio: 8, Junho: 11, Julho: 16, Agosto: 17,
  Setembro: 18, Outubro: 16.5, Novembro: 10.5, Dezembro: 8,
};

export const VENDEDOR_DEFAULT_METAS = {
  ligacoesMes:            660,
  reunioesAgendadasMes:    80,
  reunioesRealizadasMes:   60,
  propostasMes:            36,
  contratosMes:            24,
  receitaMes:          250000,
};

export const PERIODO_MULT: Record<string, number | null> = {
  diario:    1 / 20,
  semanal:   1 / 4.33,
  mensal:    1,
  trimestral: 3,
  anual:     12,
  custom:    null,
};

export const DEFAULT_PREMISSAS = {
  meta:   3000000,
  ticket:   19000,
  reun:         3,
  lead:       2.5,
};

// ── Dados iniciais dos meses ──────────────────────────────────
export const MESES_INICIAIS: Mes[] = [
  { mes: 'Janeiro',   receita:  77000, renov: 1, status: 'realizado', breakdown: null },
  { mes: 'Fevereiro', receita:  69000, renov: 0, status: 'realizado', breakdown: null },
  {
    mes: 'Março', receita: 94300, renov: 0, status: 'realizado',
    breakdown: {
      versao: 3,
      dados: {
        novos: {
          funil: [
            { valor: 8000,  tipo: 'tcv', meses: null, comboItens: null },
            { valor: 5600,  tipo: 'tcv', meses: null, comboItens: null },
            { valor: 5600,  tipo: 'tcv', meses: null, comboItens: null },
            { valor: 10800, tipo: 'tcv', meses: null, comboItens: null },
            { valor: 4800,  tipo: 'tcv', meses: null, comboItens: null },
          ],
          posic: [{ valor: 2500, tipo: 'mrr', meses: 6, comboItens: null }],
          estr:  [], renov: [], combo: [],
        },
        renov: [], mrrAtivo: 57000,
      },
    },
  },
  {
    mes: 'Abril', receita: 86020, renov: 1, status: 'realizado',
    breakdown: {
      versao: 3,
      dados: {
        novos: {
          funil: [
            { valor: 5000, tipo: 'tcv', meses: null, comboItens: null },
            { valor: 1200, tipo: 'mrr', meses: 6,    comboItens: null },
          ],
          posic: [
            { valor: 2000, tipo: 'mrr', meses: 6, comboItens: null },
            { valor: 2000, tipo: 'mrr', meses: 6, comboItens: null },
          ],
          estr: [],
          renov: [{ valor: 19000, tipo: 'tcv', meses: null, comboItens: null }],
          combo: [],
        },
        renov: [], mrrAtivo: 56820,
      },
    },
  },
  { mes: 'Maio',      receita: 200000, renov: 4, status: 'planejado', breakdown: null },
  { mes: 'Junho',     receita: 280000, renov: 5, status: 'planejado', breakdown: null },
  { mes: 'Julho',     receita: 390000, renov: 6, status: 'planejado', breakdown: null },
  { mes: 'Agosto',    receita: 425000, renov: 6, status: 'planejado', breakdown: null },
  { mes: 'Setembro',  receita: 445000, renov: 7, status: 'planejado', breakdown: null },
  { mes: 'Outubro',   receita: 410000, renov: 6, status: 'planejado', breakdown: null },
  { mes: 'Novembro',  receita: 270000, renov: 5, status: 'planejado', breakdown: null },
  { mes: 'Dezembro',  receita: 199000, renov: 3, status: 'planejado', breakdown: null },
];

// ── Produtos state inicial ────────────────────────────────────
export const PRODUTOS_STATE_INICIAL: ProdutosState = {
  items: [
    { id: 'funil', icon: '🎯', nome: 'Funil de Vendas',        tag: 'TCV ou MRR · gera caixa ou recorrência',
      metaTCV: 57, metaMRR: 19, ticketTCV: 10800, ticketMRR: 1800, mesesMRR: 6 },
    { id: 'posic', icon: '💎', nome: 'Posicionamento',          tag: 'TCV ou MRR · 6 meses',
      metaTCV: 0,  metaMRR: 24, ticketTCV: 12000, ticketMRR: 2500, mesesMRR: 6 },
    { id: 'estr',  icon: '🛠', nome: 'Estruturação Comercial',  tag: 'À vista ou recorrente · projeto',
      metaTCV: 0,  metaMRR: 0,  ticketTCV: 15000, ticketMRR: 1500, mesesMRR: 6 },
    { id: 'renov', icon: '🔁', nome: 'Renovação',               tag: 'Renovação · base instalada',
      metaTCV: 12, metaMRR: 26, ticketTCV: 10800, ticketMRR: 2000, mesesMRR: 6, isRenov: true },
    { id: 'combo', icon: '🚀', nome: 'Combo (multi-produto)',   tag: 'Combinação de 2+ produtos',
      metaTCV: 9,  metaMRR: 0,  ticketTCV: 25800, ticketMRR: 4300, mesesMRR: 6, isCombo: true },
  ],
};

// ── Funis padrão ──────────────────────────────────────────────
export const CD_DEFAULT_FUNNELS = () => ([
  {
    id: 'trafego', nome: 'Tráfego Pago', cor: '#60a5fa',
    etapas: [
      { label: 'Leads', valor: 0 },
      { label: 'Reunião Agendada', valor: 0 },
      { label: 'Reunião Realizada', valor: 0 },
      { label: 'Proposta Enviada', valor: 0 },
      { label: 'Contrato Fechado', valor: 0 },
    ],
    receita: 0,
  },
  {
    id: 'social', nome: 'Social Selling', cor: '#22c55e',
    etapas: [
      { label: 'Leads', valor: 0 },
      { label: 'Reunião Agendada', valor: 0 },
      { label: 'Reunião Realizada', valor: 0 },
      { label: 'Contrato Fechado', valor: 0 },
    ],
    receita: 0,
  },
  {
    id: 'indicacao', nome: 'Indicação', cor: '#f59e0b',
    etapas: [
      { label: 'Indicações Recebidas', valor: 0 },
      { label: 'Reunião Realizada', valor: 0 },
      { label: 'Proposta Enviada', valor: 0 },
      { label: 'Contrato Fechado', valor: 0 },
    ],
    receita: 0,
  },
]);
