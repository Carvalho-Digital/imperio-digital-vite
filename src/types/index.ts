/* ============================================================
   TIPOS PRINCIPAIS
   ============================================================ */

export type ContratoTipo = 'tcv' | 'mrr';
export type MesStatus = 'planejado' | 'andamento' | 'realizado';
export type FormaPagamento = 'cartao' | 'avista' | 'mensalidade' | 'parcelado';

export interface ContratoFicha {
  vigenciaInicio?: string | null;        // ISO date YYYY-MM-DD
  vigenciaMeses?: number | null;
  entregaveis?: string | null;
  notasJuridico?: string | null;
  notasOperacional?: string | null;
  notasLivres?: string | null;
  customFields?: Record<string, unknown>;
  atualizadaEm?: string | null;
  atualizadaPor?: string | null;
}

export interface Contrato {
  id?: string;                            // populado quando vem do DB
  valor: number;
  tipo: ContratoTipo;
  meses: number | null;
  comboItens: string[] | null;
  cliente?: string | null;
  formaPagamento?: FormaPagamento | null;
  parcelas?: number | null;
  ficha?: ContratoFicha;
}

/* Form Builder lite — definições dos campos custom da Ficha */
export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'boolean' | 'select';

export interface FieldDefinition {
  id: string;
  formKey: string;                        // 'ficha_contrato' por enquanto
  fieldKey: string;
  label: string;
  description?: string | null;
  fieldType: FieldType;
  options?: { values: string[] } | null;
  required: boolean;
  sortOrder: number;
  isBuiltin: boolean;
}

export interface OutroServico {
  nome: string;
  qtd: number;
  receita: number;
}

export interface MesDetalhe {
  previsto: Record<string, unknown>;
  outros: OutroServico[];
}

export interface BreakdownNovos {
  [produtoId: string]: Contrato[];
}

export interface BreakdownDados {
  novos: BreakdownNovos;
  renov: (number | Contrato)[];
  mrrAtivo: number;
}

export interface Breakdown {
  versao: number;
  dados: BreakdownDados;
}

export interface MetasMensais {
  [produtoId: string]: {
    tcv?: number;
    mrr?: number;
  };
}

export interface Mes {
  mes: string;
  receita: number;
  renov: number;
  status: MesStatus;
  breakdown: Breakdown | null;
  detalhe?: MesDetalhe;
  receitaRealizada?: number;
  metas?: MetasMensais;
}

/* ============================================================
   PRODUTOS
   ============================================================ */

export interface ProdutoCatalogo {
  id: string;
  icon: string;
  nome: string;
  ticketDefaultTCV: number;
  ticketDefaultMRR: number;
  defaultMeses: number;
  isRenov?: boolean;
  isCombo?: boolean;
}

export interface ProdutoState {
  id: string;
  icon: string;
  nome: string;
  tag: string;
  metaTCV: number;
  metaMRR: number;
  ticketTCV: number;
  ticketMRR: number;
  mesesMRR: number;
  isRenov?: boolean;
  isCombo?: boolean;
}

export interface ProdutosState {
  items: ProdutoState[];
}

/* ============================================================
   VENDEDORES
   ============================================================ */

export interface Lancamento {
  data: string;
  ligacoes: number;
  reuniones_agendadas: number;
  reunioes_realizadas: number;
  propostas: number;
  contratos: number;
  receita: number;
  // campos novos (operação)
  qualificados?: number;
  leads_desqualificados?: number;
  followups_enviados?: number;
  retornos_followup?: number;
}

export interface VendedorMetas {
  ligacoesMes: number;
  reunioesAgendadasMes: number;
  reunioesRealizadasMes: number;
  propostasMes: number;
  contratosMes: number;
  receitaMes: number;
}

export interface Vendedor {
  id: string;
  nome: string;
  metas: VendedorMetas;
  metasOverride: Record<string, number>;
  lancamentos: Lancamento[];
}

/* ============================================================
   PERFIS DE COLABORADORES (localStorage)
   ============================================================ */

export type ColaboradorNivel = 'junior' | 'pleno' | 'senior';
export type ColaboradorTipo = 'sdr' | 'closer';

export interface ColaboradorProfile {
  nivel?: ColaboradorNivel;
  tipo?: ColaboradorTipo;
  clientes?: string[];
}

/* ============================================================
   SCRIPTS (localStorage)
   ============================================================ */

export interface Script {
  id: string;
  titulo: string;
  conteudo: string;
  criadoEm: string;
}

export interface ScriptModule {
  id: string;
  nome: string;
  scripts: Script[];
}

/* ============================================================
   TAREFAS + COMPROMISSOS (Meu Painel — localStorage)
   ============================================================ */

export interface Tarefa {
  id: string;
  texto: string;
  prazo?: string;
  concluida: boolean;
  vendedorId: string;
}

export interface Compromisso {
  id: string;
  titulo: string;
  data: string;
  hora: string;
  vendedorId: string;
}

export interface EstudoDia {
  vendedorId: string;
  texto: string;
  data: string; // YYYY-MM-DD
}

/* ============================================================
   MAPA MENTAL (localStorage)
   ============================================================ */

export interface MindMapNode {
  id: string;
  x: number;
  y: number;
  texto: string;
  cor?: string;
}

export interface MindMapEdge {
  id: string;
  from: string;
  to: string;
}

/* ============================================================
   TRACKING WIDGETS — Dashboard (localStorage)
   ============================================================ */

export interface TrackingWidget {
  id: string;
  label: string;
  meta: number;
  atual: number;
  formato: 'brl' | 'number' | 'pct';
  unidade?: string;
}

export type PeriodoTipo = 'diario' | 'semanal' | 'mensal' | 'trimestral' | 'anual' | 'custom';

export interface Periodo {
  tipo: PeriodoTipo;
  de: string | null;
  ate: string | null;
}

export interface AppState {
  vendedores: Vendedor[];
  activeVendedor: string | null;
  periodo: Periodo;
}

/* ============================================================
   DASHBOARD
   ============================================================ */

export type DashPeriodo = 'anual' | 'trimestre' | 'mes';

export interface DashState {
  periodo: DashPeriodo;
  trimestre: number | null;
  mes: number | null;
}

export interface DashDados {
  receitaTotal: number;
  realizado: number;
  contratos: number;
  renov: number;
  reun: number;
  leads: number;
  planejados: number;
  faltam: number;
}

/* ============================================================
   FUNIS (Carvalho Digital)
   ============================================================ */

export interface FunilEtapa {
  label: string;
  valor: number;
}

export interface Funil {
  id: string;
  nome: string;
  cor: string;
  etapas: FunilEtapa[];
  receita: number;
}

export interface MetricaCustom {
  id: string;
  nome: string;
  formula: string;
  format: 'number' | 'brl' | 'pct';
  where: 'top' | 'base';
}

export interface CdMesData {
  receitaManual: number | null;
  funis: Funil[];
  metasCustom: MetricaCustom[];
}

export interface CdConfig {
  metaAnual: number;
  metaMensal: number;
}

export interface CdState {
  config: CdConfig;
  mesAtivo: string | null;
  meses: Record<string, CdMesData>;
}

/* ============================================================
   PREMISSAS
   ============================================================ */

export interface Premissas {
  meta: number;
  ticket: number;
  reun: number;
  lead: number;
}

export interface Derivados {
  contratos: number;
  reunioes: number;
  leads: number;
}

/* ============================================================
   MODAIS GENÉRICOS
   ============================================================ */

export interface PromptOpts {
  title?: string;
  subtitle?: string;
  message?: string;
  defaultValue?: string | number;
  placeholder?: string;
  help?: string;
  type?: string;
  okText?: string;
}

export interface ConfirmOpts {
  title?: string;
  message?: string;
  kind?: 'warning' | 'danger' | 'info' | 'success';
  okText?: string;
  cancelText?: string;
}

export interface AlertOpts {
  title?: string;
  message?: string;
  kind?: 'warning' | 'danger' | 'info' | 'success';
}

export interface ChoiceOption {
  key: string;
  icon?: string;
  title: string;
  desc?: string;
}

export interface ChoiceOpts {
  title?: string;
  subtitle?: string;
  options?: ChoiceOption[];
}

export interface AddContratoOpts {
  produto: ProdutoState | ProdutoCatalogo;
  mes?: string;
  sugTipo?: ContratoTipo;
  sugValor?: number;
}

export interface DetalharContratoOpts {
  contrato: Contrato;
  produto: ProdutoState | ProdutoCatalogo;
  mes?: string;
  fichaAtual?: ContratoFicha;
}

export interface ModalContextValue {
  showPrompt: (opts: PromptOpts) => Promise<string | null>;
  showConfirm: (opts: ConfirmOpts) => Promise<boolean>;
  showAlert: (opts: AlertOpts) => Promise<void>;
  showChoice: (opts: ChoiceOpts) => Promise<string | null>;
  showAddContrato: (opts: AddContratoOpts) => Promise<Contrato | null>;
  showDetalharContrato: (opts: DetalharContratoOpts) => Promise<ContratoFicha | null>;
}

/* ============================================================
   CLOUD SYNC
   ============================================================ */

export type CloudSyncStatus = 'idle' | 'saving' | 'ok' | 'error' | 'not-configured';

export interface CloudSyncState {
  token: string | null;
  gistId: string | null;
  status: CloudSyncStatus;
  lastSync: number | null;
}
