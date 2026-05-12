import type {
  Mes, Contrato, ProdutoState, ProdutosState, Vendedor,
  Derivados, Premissas, Lancamento,
} from '../types';
import { PRODUTOS, META_MRR_DEZEMBRO } from './constants';

/* ── Contratos ──────────────────────────────────────────────── */

export function normContrato(
  c: number | Contrato,
  defaultTipo: 'tcv' | 'mrr' = 'tcv',
  defaultMeses = 6,
): Contrato {
  if (typeof c === 'number') {
    return {
      valor: c,
      tipo: defaultTipo,
      meses: defaultTipo === 'mrr' ? defaultMeses : null,
      comboItens: null,
    };
  }
  return {
    valor: parseFloat(String(c.valor)) || 0,
    tipo: c.tipo || defaultTipo,
    meses: c.meses != null ? c.meses : (c.tipo === 'mrr' ? defaultMeses : null),
    comboItens: c.comboItens || null,
  };
}

/* ── Breakdown ──────────────────────────────────────────────── */

export function garantirBreakdownV2(mes: Mes): import('../types').BreakdownDados {
  if (!mes.breakdown || mes.breakdown.versao !== 3) {
    mes.breakdown = { versao: 3, dados: { novos: {}, renov: [], mrrAtivo: 0 } };
  }
  if (!mes.breakdown.dados) {
    mes.breakdown.dados = { novos: {}, renov: [], mrrAtivo: 0 };
  }
  if (!mes.breakdown.dados.novos) mes.breakdown.dados.novos = {};
  if (!Array.isArray(mes.breakdown.dados.renov)) mes.breakdown.dados.renov = [];

  PRODUTOS.forEach(p => {
    if (!Array.isArray(mes.breakdown!.dados.novos[p.id])) {
      mes.breakdown!.dados.novos[p.id] = [];
    }
  });

  return mes.breakdown.dados;
}

export function getContratos(mes: Mes, pid: string): Contrato[] {
  const dados = garantirBreakdownV2(mes);
  return (dados.novos[pid] || []).map(c => normContrato(c));
}

export function getQtdRealizada(mes: Mes, pid: string, tipo?: 'tcv' | 'mrr'): number {
  const lista = getContratos(mes, pid);
  if (!tipo) return lista.length;
  return lista.filter(c => c.tipo === tipo).length;
}

export function getReceitaRealizada(mes: Mes, pid: string, tipo?: 'tcv' | 'mrr'): number {
  const lista = getContratos(mes, pid);
  const filtrada = tipo ? lista.filter(c => c.tipo === tipo) : lista;
  return filtrada.reduce((s, c) => s + c.valor, 0);
}

export function getReceitaAvulsos(mes: Mes): number {
  if (!mes.detalhe || !Array.isArray(mes.detalhe.outros)) return 0;
  return mes.detalhe.outros.reduce((s, o) => s + (parseFloat(String(o.receita)) || 0), 0);
}

export function getReceitaTotalMes(mes: Mes): number {
  const dados = garantirBreakdownV2(mes);
  let total = 0;
  Object.values(dados.novos || {}).forEach(lista => {
    (lista || []).forEach(c => {
      total += typeof c === 'number' ? c : (c.valor || 0);
    });
  });
  total += (dados.renov || []).reduce<number>(
    (s, v) => s + (parseFloat(String(typeof v === 'number' ? v : (v as Contrato).valor)) || 0), 0
  );
  total += parseFloat(String(dados.mrrAtivo)) || 0;
  total += getReceitaAvulsos(mes);
  return total;
}

/* ── Metas mensais ──────────────────────────────────────────── */

export function getMetaMensal(
  mes: Mes,
  pid: string,
  tipo: 'tcv' | 'mrr',
  produtosState: ProdutosState,
): number {
  if (!mes.metas) mes.metas = {};
  if (!mes.metas[pid]) mes.metas[pid] = {};
  const saved = mes.metas[pid][tipo];
  if (saved != null) return saved;
  const produto = produtosState.items.find(p => p.id === pid);
  if (!produto) return 0;
  const metaAnual = tipo === 'tcv' ? (produto.metaTCV || 0) : (produto.metaMRR || 0);
  return Math.round(metaAnual / 12);
}

/* ── Premissas & derivados ──────────────────────────────────── */

export function calcDerivados(receita: number, premissas: Premissas): Derivados {
  const contratos = Math.round(receita / premissas.ticket);
  const reunioes  = Math.round(contratos * premissas.reun);
  const leads     = Math.round(reunioes * premissas.lead);
  return { contratos, reunioes, leads };
}

/* ── Produtos ───────────────────────────────────────────────── */

export interface ReceitaProduto { tcv: number; mrr: number; total: number; }

export function calcReceitaProduto(p: ProdutoState): ReceitaProduto {
  const recTCV = (p.metaTCV || 0) * (p.ticketTCV || 0);
  const mesesEfetivos = p.isRenov ? 12 : (p.mesesMRR || 6);
  const recMRR = (p.metaMRR || 0) * (p.ticketMRR || 0) * mesesEfetivos;
  return { tcv: recTCV, mrr: recMRR, total: recTCV + recMRR };
}

export function calcProdutosTotais(produtosState: ProdutosState) {
  const items = produtosState.items;
  const totaisPorTipo = { mrr: 0, tcv: 0 };
  let totalReceita = 0;
  let totalContratosNovos = 0;
  items.forEach(p => {
    const rec = calcReceitaProduto(p);
    totalReceita += rec.total;
    totaisPorTipo.tcv += rec.tcv;
    totaisPorTipo.mrr += rec.mrr;
    if (!p.isRenov) totalContratosNovos += (p.metaTCV || 0) + (p.metaMRR || 0);
  });
  return { totalReceita, totaisPorTipo, totalContratosNovos };
}

/* ── Gráfico MRR ─────────────────────────────────────────────  */

export function calcularMRRMensal(meses: Mes[]): {
  realizados: (number | null)[];
  metas: number[];
  ultimoRealizadoIdx: number;
} {
  const realizados: (number | null)[] = [];
  for (let i = 0; i < 12; i++) {
    const m = meses[i];
    let mrr: number | null = null;
    if (m.status === 'realizado') {
      if (m.breakdown?.dados && typeof m.breakdown.dados.mrrAtivo === 'number') {
        mrr = m.breakdown.dados.mrrAtivo;
      }
    }
    realizados.push(mrr);
  }

  let ultimoRealizadoIdx = -1;
  let ultimoMRR = 0;
  for (let i = 11; i >= 0; i--) {
    if (realizados[i] != null && (realizados[i] as number) > 0) {
      ultimoRealizadoIdx = i;
      ultimoMRR = realizados[i] as number;
      break;
    }
  }

  const metas: number[] = [];
  for (let i = 0; i < 12; i++) {
    if (i <= ultimoRealizadoIdx) {
      metas.push(realizados[i] || 0);
    } else {
      const mesesRestantes = 11 - ultimoRealizadoIdx;
      if (mesesRestantes <= 0) {
        metas.push(META_MRR_DEZEMBRO);
      } else {
        const passo = (META_MRR_DEZEMBRO - ultimoMRR) / mesesRestantes;
        const passos = i - ultimoRealizadoIdx;
        metas.push(Math.round(ultimoMRR + passo * passos));
      }
    }
  }

  return { realizados, metas, ultimoRealizadoIdx };
}

/* ── Dashboard ───────────────────────────────────────────────── */

export function dashSomarMeses(indices: number[], meses: Mes[], premissas: Premissas) {
  let receitaTotal = 0, realizado = 0, contratos = 0, renov = 0, reun = 0, leads = 0, planejados = 0;
  indices.forEach(i => {
    const m = meses[i];
    const d = calcDerivados(m.receita, premissas);
    receitaTotal += m.receita;
    if (m.status === 'realizado' || m.status === 'andamento') realizado += m.receita;
    if (m.status === 'planejado') planejados++;
    contratos += d.contratos;
    renov += m.renov;
    reun += d.reunioes;
    leads += d.leads;
  });
  return { receitaTotal, realizado, contratos, renov, reun, leads, planejados, faltam: receitaTotal - realizado };
}

/* ── Vendedores ──────────────────────────────────────────────── */

export function lancamentosNoRange(vendedor: Vendedor, de: string, ate: string): Lancamento[] {
  return vendedor.lancamentos.filter(l => l.data && l.data >= de && l.data <= ate);
}

export function somarLanc(lancs: Lancamento[]) {
  return lancs.reduce((s, l) => ({
    ligacoes:              s.ligacoes              + (l.ligacoes              || 0),
    reuniones_agendadas:   s.reuniones_agendadas   + (l.reuniones_agendadas   || 0),
    reunioes_realizadas:   s.reunioes_realizadas   + (l.reunioes_realizadas   || 0),
    propostas:             s.propostas             + (l.propostas             || 0),
    contratos:             s.contratos             + (l.contratos             || 0),
    receita:               s.receita               + (l.receita               || 0),
  }), { ligacoes: 0, reuniones_agendadas: 0, reunioes_realizadas: 0, propostas: 0, contratos: 0, receita: 0 });
}

export function getMeta(
  vendedor: Vendedor,
  metricaMes: string,
  periodo: string,
  diasNoCustom?: number,
): number {
  const overrideKey = `${metricaMes}:${periodo}`;
  if (vendedor.metasOverride?.[overrideKey] != null) {
    return vendedor.metasOverride[overrideKey];
  }
  const base = (vendedor.metas as unknown as Record<string, number>)[metricaMes] || 0;
  if (periodo === 'custom' && diasNoCustom != null) {
    return base * (diasNoCustom / 20);
  }
  const mult: Record<string, number> = {
    diario: 1 / 20, semanal: 1 / 4.33, mensal: 1,
    trimestral: 3, anual: 12,
  };
  return base * (mult[periodo] || 1);
}

/* ── Funis ───────────────────────────────────────────────────── */

export function cdCalcFunilDados(f: import('../types').Funil) {
  const leads    = f.etapas[0]?.valor || 0;
  const contratos = f.etapas[f.etapas.length - 1]?.valor || 0;
  const receita  = f.receita || 0;
  const ticket   = contratos > 0 ? receita / contratos : 0;
  const taxaTotal = leads > 0 ? (contratos / leads) * 100 : 0;
  return { leads, contratos, receita, ticket, taxaTotal };
}

export function cdCalcMacro(
  cdMesData: import('../types').CdMesData,
  config: import('../types').CdConfig,
) {
  let receitaCalc = 0, contratos = 0, totalLeads = 0;
  cdMesData.funis.forEach(f => {
    const d = cdCalcFunilDados(f);
    receitaCalc += d.receita;
    contratos += d.contratos;
    totalLeads += d.leads;
  });
  const receita = cdMesData.receitaManual != null ? cdMesData.receitaManual : receitaCalc;
  const meta = config.metaMensal;
  const pctMeta = meta > 0 ? (receita / meta) * 100 : 0;
  const ticket = contratos > 0 ? receita / contratos : 0;
  return { receita, receitaCalc, meta, pctMeta, contratos, ticket, totalLeads };
}

/* ── Fórmula customizada ─────────────────────────────────────── */

export function cdEvalFormula(formula: string, ctx: Record<string, number>): number {
  if (!formula) return 0;
  let expr = formula.toLowerCase();
  if (/[^a-z_0-9+\-*/().\s,]/i.test(expr)) return 0;
  expr = expr.replace(/[a-z_][a-z_0-9]*/g, (m) => {
    if (ctx[m] != null) return `(${ctx[m]})`;
    return '0';
  });
  try {
    const result = Function('"use strict"; return (' + expr + ')')() as unknown;
    if (typeof result !== 'number' || !isFinite(result)) return 0;
    return result;
  } catch {
    return 0;
  }
}

/* ── Redistribuição ──────────────────────────────────────────── */

export function redistribuirGap(
  meses: Mes[],
  meta: number,
  pesosSazonalidade: Record<string, number>,
) {
  const realiz = meses
    .filter(m => ['realizado', 'andamento'].includes(m.status))
    .reduce((s, m) => s + m.receita, 0);
  const restante = meta - realiz;
  const planej = meses.filter(m => m.status === 'planejado');
  const somaP = planej.reduce((s, m) => s + (pesosSazonalidade[m.mes] || 1), 0);
  planej.forEach(m => {
    m.receita = Math.round((restante * (pesosSazonalidade[m.mes] || 1)) / somaP);
  });
  const ajuste = meta - meses.reduce((s, m) => s + m.receita, 0);
  if (Math.abs(ajuste) > 0) {
    const set = meses.find(m => m.mes === 'Setembro' && m.status === 'planejado');
    if (set) set.receita += ajuste;
  }
}

/* ── Helpers de data ─────────────────────────────────────────── */

export function isoHoje(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isoSomar(iso: string, dias: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function inicioSemana(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const dow = d.getDay();
  const diff = (dow + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

export function getRangeDoPeriodo(periodo: import('../types').Periodo): {
  de: string; ate: string; label: string; diasUteis: number;
} {
  const hoje = isoHoje();
  let de = hoje, ate = hoje, label = '', diasUteis = 1;

  switch (periodo.tipo) {
    case 'diario': {
      de = ate = hoje;
      const d = new Date(hoje + 'T00:00:00');
      label = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' });
      diasUteis = 1;
      break;
    }
    case 'semanal': {
      de = inicioSemana(hoje);
      ate = isoSomar(de, 6);
      label = `Semana de ${de} a ${ate}`;
      diasUteis = 5;
      break;
    }
    case 'mensal': {
      const d = new Date(hoje + 'T00:00:00');
      de = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      ate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
      label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      diasUteis = 20;
      break;
    }
    case 'trimestral': {
      const d = new Date(hoje + 'T00:00:00');
      const q = Math.floor(d.getMonth() / 3);
      const mesIni = q * 3;
      de = `${d.getFullYear()}-${String(mesIni + 1).padStart(2, '0')}-01`;
      const ultimo = new Date(d.getFullYear(), mesIni + 3, 0).getDate();
      ate = `${d.getFullYear()}-${String(mesIni + 3).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
      label = `Q${q + 1} ${d.getFullYear()}`;
      diasUteis = 60;
      break;
    }
    case 'anual': {
      const ano = new Date(hoje + 'T00:00:00').getFullYear();
      de = `${ano}-01-01`;
      ate = `${ano}-12-31`;
      label = `Ano ${ano}`;
      diasUteis = 240;
      break;
    }
    case 'custom': {
      de = periodo.de || hoje;
      ate = periodo.ate || hoje;
      label = `${de} → ${ate}`;
      const dDe = new Date(de + 'T00:00:00');
      const dAte = new Date(ate + 'T00:00:00');
      const totalDias = Math.max(1, Math.round((dAte.getTime() - dDe.getTime()) / 86400000) + 1);
      diasUteis = Math.round(totalDias * 5 / 7);
      break;
    }
  }
  return { de, ate, label, diasUteis };
}
