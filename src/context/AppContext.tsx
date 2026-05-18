import React, {
  createContext, useContext, useReducer, useEffect, useCallback, useRef, useState,
} from 'react';
import type { ReactNode } from 'react';
import type {
  Mes, ProdutosState, AppState, DashState,
  Premissas, Contrato, Vendedor, Periodo, Funil,
} from '../types';
import {
  MESES_INICIAIS, PRODUTOS_STATE_INICIAL, DATA_VERSION,
  VENDEDOR_DEFAULT_METAS, CD_DEFAULT_FUNNELS,
} from '../lib/constants';
import { garantirBreakdownV2, getReceitaTotalMes, redistribuirGap } from '../lib/calculations';
import { pesosSazonalidade } from '../lib/constants';
import { supabase } from '../lib/supabase';
import {
  loadAllData, saveWorkspace, saveProducts, saveMonthlyPlan,
  saveSeller, createSeller, deactivateSeller,
  saveFunnelMetrics, createFunil, deleteFunilDb,
  addFunilStageDb, deleteFunilStageDb,
  createDefaultWorkspace,
} from '../lib/db';

const deepClone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/* ── State ──────────────────────────────────────────────────── */
export interface FullState {
  meses: Mes[];
  planoOriginal: Mes[];
  produtosState: ProdutosState;
  appState: AppState;
  dashState: DashState;
  cdState: CdState;
  premissas: Premissas;
  expandidos: Set<number>;
}

const hoje = new Date();

function buildInitialState(): FullState {
  return {
    meses: deepClone(MESES_INICIAIS),
    planoOriginal: deepClone(MESES_INICIAIS),
    produtosState: deepClone(PRODUTOS_STATE_INICIAL),
    appState: {
      vendedores: [],
      activeVendedor: null,
      periodo: { tipo: 'mensal', de: null, ate: null },
    },
    dashState: {
      periodo: 'anual',
      trimestre: Math.floor(hoje.getMonth() / 3),
      mes: hoje.getMonth(),
    },
    cdState: {
      config: { metaAnual: 3000000, metaMensal: 250000 },
      mesAtivo: null,
      meses: {},
    },
    premissas: { meta: 3000000, ticket: 19000, reun: 3, lead: 2.5 },
    expandidos: new Set(),
  };
}

/* ── Actions ────────────────────────────────────────────────── */
export type Action =
  | { type: 'LOAD_ALL'; payload: Partial<FullState> }
  | { type: 'SET_PREMISSAS'; payload: Partial<Premissas> }
  | { type: 'SET_MES_META_RECEITA'; idx: number; valor: number }
  | { type: 'SET_MES_RENOV'; idx: number; valor: number }
  | { type: 'SET_MES_STATUS'; idx: number; status: Mes['status'] }
  | { type: 'TOGGLE_EXPANDIDO'; idx: number }
  | { type: 'SET_EXPANDIDO'; idx: number; aberto: boolean }
  | { type: 'FINALIZAR_MES'; idx: number; mrrAtivo: number }
  | { type: 'ADD_CONTRATO'; idx: number; pid: string; contrato: Contrato }
  | { type: 'REMOVE_CONTRATO'; idx: number; pid: string; ci: number }
  | { type: 'SET_META_MENSAL'; idx: number; pid: string; tipo: 'tcv' | 'mrr'; valor: number }
  | { type: 'RESET_META_MENSAL'; idx: number; pid: string; tipo: 'tcv' | 'mrr' }
  | { type: 'ADD_AVULSO'; idx: number }
  | { type: 'UPDATE_AVULSO'; idx: number; oi: number; field: 'nome' | 'qtd' | 'receita'; valor: string | number }
  | { type: 'REMOVE_AVULSO'; idx: number; oi: number }
  | { type: 'REDISTRIBUIR_GAP' }
  | { type: 'RESET_PLANO' }
  | { type: 'SAVE_PRODUTO'; pid: string; campos: Partial<import('../types').ProdutoState> }
  | { type: 'SET_DASH_STATE'; payload: Partial<DashState> }
  | { type: 'ADD_VENDEDOR'; nome: string; id?: string }
  | { type: 'REMOVE_VENDEDOR'; id: string }
  | { type: 'SET_ACTIVE_VENDEDOR'; id: string }
  | { type: 'SET_PERIODO'; periodo: Partial<Periodo> }
  | { type: 'ADD_LANCAMENTO'; vendedorId: string; lancamento: import('../types').Lancamento }
  | { type: 'REMOVE_LANCAMENTO'; vendedorId: string; idx: number }
  | { type: 'EDIT_META'; vendedorId: string; key: string; valor: number; isOverride: boolean; periodoKey?: string }
  | { type: 'CD_SET_MES_ATIVO'; mesKey: string }
  | { type: 'CD_UPDATE_FUNIL'; mesKey: string; funilId: string; campos: Partial<import('../types').Funil> }
  | { type: 'CD_UPDATE_ETAPA'; mesKey: string; funilId: string; etapaIdx: number; valor: number }
  | { type: 'CD_UPDATE_RECEITA'; mesKey: string; funilId: string; receita: number }
  | { type: 'CD_ADD_FUNIL'; mesKey: string; funil: import('../types').Funil }
  | { type: 'CD_REMOVE_FUNIL'; mesKey: string; funilId: string }
  | { type: 'CD_ADD_ETAPA'; mesKey: string; funilId: string; label: string }
  | { type: 'CD_REMOVE_ETAPA'; mesKey: string; funilId: string; etapaIdx: number }
  | { type: 'CD_ADD_METRIC'; mesKey: string; metric: import('../types').MetricaCustom }
  | { type: 'CD_REMOVE_METRIC'; mesKey: string; metricId: string }
  | { type: 'CD_SET_RECEITA_MANUAL'; mesKey: string; valor: number | null }
  | { type: 'CD_SET_CONFIG'; config: Partial<import('../types').CdConfig> }
  | { type: 'CD_RESET_MES'; mesKey: string }

type CdState = import('../types').CdState;

function cdGarantirMes(state: FullState, mesKey: string) {
  if (!state.cdState.meses[mesKey]) {
    state.cdState.meses[mesKey] = {
      receitaManual: null,
      funis: CD_DEFAULT_FUNNELS(),
      metasCustom: [],
    };
  } else {
    const m = state.cdState.meses[mesKey];
    if (!m.funis) m.funis = CD_DEFAULT_FUNNELS();
    if (!m.metasCustom) m.metasCustom = [];
  }
}

function criarVendedor(nome: string, id?: string): Vendedor {
  return {
    id: id ?? ('v_' + Math.random().toString(36).slice(2, 9)),
    nome,
    metas: { ...VENDEDOR_DEFAULT_METAS },
    metasOverride: {},
    lancamentos: [],
  };
}

/* ── Reducer ────────────────────────────────────────────────── */
function reducer(state: FullState, action: Action): FullState {
  const s = { ...state, meses: [...state.meses] };

  switch (action.type) {
    case 'LOAD_ALL':
      return { ...state, ...action.payload };

    case 'SET_PREMISSAS':
      return { ...s, premissas: { ...s.premissas, ...action.payload } };

    case 'SET_MES_META_RECEITA': {
      const m = { ...s.meses[action.idx], receita: action.valor };
      if (s.planoOriginal[action.idx]) {
        s.planoOriginal = [...s.planoOriginal];
        s.planoOriginal[action.idx] = { ...s.planoOriginal[action.idx], receita: action.valor };
      }
      s.meses[action.idx] = m;
      return s;
    }

    case 'SET_MES_RENOV': {
      s.meses[action.idx] = { ...s.meses[action.idx], renov: action.valor };
      return s;
    }

    case 'SET_MES_STATUS': {
      s.meses[action.idx] = { ...s.meses[action.idx], status: action.status };
      return s;
    }

    case 'TOGGLE_EXPANDIDO': {
      const exp = new Set(s.expandidos);
      if (exp.has(action.idx)) exp.delete(action.idx);
      else exp.add(action.idx);
      return { ...s, expandidos: exp };
    }

    case 'SET_EXPANDIDO': {
      const exp = new Set(s.expandidos);
      if (action.aberto) exp.add(action.idx);
      else exp.delete(action.idx);
      return { ...s, expandidos: exp };
    }

    case 'ADD_CONTRATO': {
      const mes = deepClone(s.meses[action.idx]);
      const dados = garantirBreakdownV2(mes);
      if (!Array.isArray(dados.novos[action.pid])) dados.novos[action.pid] = [];
      dados.novos[action.pid].push(action.contrato);
      mes.receitaRealizada = getReceitaTotalMes(mes);
      s.meses[action.idx] = mes;
      return s;
    }

    case 'REMOVE_CONTRATO': {
      const mes = deepClone(s.meses[action.idx]);
      const dados = garantirBreakdownV2(mes);
      dados.novos[action.pid]?.splice(action.ci, 1);
      mes.receitaRealizada = getReceitaTotalMes(mes);
      s.meses[action.idx] = mes;
      return s;
    }

    case 'SET_META_MENSAL': {
      const mes = deepClone(s.meses[action.idx]);
      if (!mes.metas) mes.metas = {};
      if (!mes.metas[action.pid]) mes.metas[action.pid] = {};
      mes.metas[action.pid][action.tipo] = Math.max(0, action.valor);
      s.meses[action.idx] = mes;
      return s;
    }

    case 'RESET_META_MENSAL': {
      const mes = deepClone(s.meses[action.idx]);
      if (mes.metas?.[action.pid]) {
        delete mes.metas[action.pid][action.tipo];
      }
      s.meses[action.idx] = mes;
      return s;
    }

    case 'ADD_AVULSO': {
      const mes = deepClone(s.meses[action.idx]);
      if (!mes.detalhe) mes.detalhe = { previsto: {}, outros: [] };
      mes.detalhe.outros.push({ nome: '', qtd: 1, receita: 0 });
      mes.receitaRealizada = getReceitaTotalMes(mes);
      s.meses[action.idx] = mes;
      return s;
    }

    case 'UPDATE_AVULSO': {
      const mes = deepClone(s.meses[action.idx]);
      if (!mes.detalhe) mes.detalhe = { previsto: {}, outros: [] };
      const outro = mes.detalhe.outros[action.oi];
      if (outro) {
        if (action.field === 'nome') outro.nome = String(action.valor);
        else if (action.field === 'qtd') outro.qtd = Number(action.valor) || 0;
        else if (action.field === 'receita') outro.receita = Number(action.valor) || 0;
      }
      mes.receitaRealizada = getReceitaTotalMes(mes);
      s.meses[action.idx] = mes;
      return s;
    }

    case 'REMOVE_AVULSO': {
      const mes = deepClone(s.meses[action.idx]);
      if (mes.detalhe?.outros) mes.detalhe.outros.splice(action.oi, 1);
      mes.receitaRealizada = getReceitaTotalMes(mes);
      s.meses[action.idx] = mes;
      return s;
    }

    case 'FINALIZAR_MES': {
      const mes = deepClone(s.meses[action.idx]);
      garantirBreakdownV2(mes);
      mes.breakdown!.dados.mrrAtivo = action.mrrAtivo;
      const qtdRenov = (mes.breakdown!.dados.novos['renov'] || []).length
        + (mes.breakdown!.dados.renov || []).length;
      mes.renov = qtdRenov;
      mes.receita = getReceitaTotalMes(mes);
      mes.receitaRealizada = mes.receita;
      mes.status = 'realizado';
      s.meses[action.idx] = mes;
      return s;
    }

    case 'REDISTRIBUIR_GAP': {
      const meses = deepClone(s.meses);
      redistribuirGap(meses, s.premissas.meta, pesosSazonalidade);
      return { ...s, meses };
    }

    case 'RESET_PLANO': {
      const meses = deepClone(s.planoOriginal);
      return { ...s, meses };
    }

    case 'SAVE_PRODUTO': {
      const items = s.produtosState.items.map(p =>
        p.id === action.pid ? { ...p, ...action.campos } : p
      );
      return { ...s, produtosState: { items } };
    }

    case 'SET_DASH_STATE':
      return { ...s, dashState: { ...s.dashState, ...action.payload } };

    case 'ADD_VENDEDOR': {
      const v = criarVendedor(action.nome, action.id);
      const appState = {
        ...s.appState,
        vendedores: [...s.appState.vendedores, v],
        activeVendedor: v.id,
      };
      return { ...s, appState };
    }

    case 'REMOVE_VENDEDOR': {
      const vendedores = s.appState.vendedores.filter(v => v.id !== action.id);
      const activeVendedor = s.appState.activeVendedor === action.id
        ? (vendedores[0]?.id ?? null)
        : s.appState.activeVendedor;
      return { ...s, appState: { ...s.appState, vendedores, activeVendedor } };
    }

    case 'SET_ACTIVE_VENDEDOR':
      return { ...s, appState: { ...s.appState, activeVendedor: action.id } };

    case 'SET_PERIODO':
      return { ...s, appState: { ...s.appState, periodo: { ...s.appState.periodo, ...action.periodo } } };

    case 'ADD_LANCAMENTO': {
      const vendedores = s.appState.vendedores.map(v =>
        v.id === action.vendedorId
          ? { ...v, lancamentos: [...v.lancamentos, action.lancamento] }
          : v
      );
      return { ...s, appState: { ...s.appState, vendedores } };
    }

    case 'REMOVE_LANCAMENTO': {
      const vendedores = s.appState.vendedores.map(v => {
        if (v.id !== action.vendedorId) return v;
        const lancamentos = [...v.lancamentos];
        lancamentos.splice(action.idx, 1);
        return { ...v, lancamentos };
      });
      return { ...s, appState: { ...s.appState, vendedores } };
    }

    case 'EDIT_META': {
      const vendedores = s.appState.vendedores.map(v => {
        if (v.id !== action.vendedorId) return v;
        if (!action.isOverride) {
          const metas = { ...v.metas, [action.key]: action.valor } as typeof v.metas;
          const metasOverride = { ...v.metasOverride };
          if (action.periodoKey) delete metasOverride[action.periodoKey];
          return { ...v, metas, metasOverride };
        } else {
          const metasOverride = { ...v.metasOverride, [action.key]: action.valor };
          return { ...v, metasOverride };
        }
      });
      return { ...s, appState: { ...s.appState, vendedores } };
    }

    case 'CD_SET_MES_ATIVO': {
      const cdState = deepClone(s.cdState);
      cdState.mesAtivo = action.mesKey;
      cdGarantirMes(cdState as unknown as FullState, action.mesKey);
      return { ...s, cdState };
    }

    case 'CD_UPDATE_FUNIL': {
      const cdState = deepClone(s.cdState);
      cdGarantirMes(cdState as unknown as FullState, cdState.mesAtivo!);
      const funis = cdState.meses[cdState.mesAtivo!].funis.map(f =>
        f.id === action.funilId ? { ...f, ...action.campos } : f
      );
      cdState.meses[cdState.mesAtivo!].funis = funis;
      return { ...s, cdState };
    }

    case 'CD_UPDATE_ETAPA': {
      const cdState = deepClone(s.cdState);
      const m = cdState.meses[action.mesKey];
      if (m) {
        const f = m.funis.find(x => x.id === action.funilId);
        if (f?.etapas[action.etapaIdx]) f.etapas[action.etapaIdx].valor = action.valor;
      }
      return { ...s, cdState };
    }

    case 'CD_UPDATE_RECEITA': {
      const cdState = deepClone(s.cdState);
      const m = cdState.meses[action.mesKey];
      if (m) {
        const f = m.funis.find(x => x.id === action.funilId);
        if (f) f.receita = action.receita;
      }
      return { ...s, cdState };
    }

    case 'CD_ADD_FUNIL': {
      const cdState = deepClone(s.cdState);
      cdGarantirMes(cdState as unknown as FullState, cdState.mesAtivo!);
      cdState.meses[cdState.mesAtivo!].funis.push(action.funil);
      return { ...s, cdState };
    }

    case 'CD_REMOVE_FUNIL': {
      const cdState = deepClone(s.cdState);
      const m = cdState.meses[action.mesKey];
      if (m) m.funis = m.funis.filter(f => f.id !== action.funilId);
      return { ...s, cdState };
    }

    case 'CD_ADD_ETAPA': {
      const cdState = deepClone(s.cdState);
      const m = cdState.meses[action.mesKey];
      if (m) {
        const f = m.funis.find(x => x.id === action.funilId);
        if (f) f.etapas.splice(f.etapas.length - 1, 0, { label: action.label, valor: 0 });
      }
      return { ...s, cdState };
    }

    case 'CD_REMOVE_ETAPA': {
      const cdState = deepClone(s.cdState);
      const m = cdState.meses[action.mesKey];
      if (m) {
        const f = m.funis.find(x => x.id === action.funilId);
        if (f) f.etapas.splice(action.etapaIdx, 1);
      }
      return { ...s, cdState };
    }

    case 'CD_ADD_METRIC': {
      const cdState = deepClone(s.cdState);
      cdGarantirMes(cdState as unknown as FullState, cdState.mesAtivo!);
      cdState.meses[cdState.mesAtivo!].metasCustom.push(action.metric);
      return { ...s, cdState };
    }

    case 'CD_REMOVE_METRIC': {
      const cdState = deepClone(s.cdState);
      const m = cdState.meses[action.mesKey];
      if (m) m.metasCustom = m.metasCustom.filter(x => x.id !== action.metricId);
      return { ...s, cdState };
    }

    case 'CD_SET_RECEITA_MANUAL': {
      const cdState = deepClone(s.cdState);
      const m = cdState.meses[action.mesKey];
      if (m) m.receitaManual = action.valor;
      return { ...s, cdState };
    }

    case 'CD_SET_CONFIG': {
      const cdState = { ...s.cdState, config: { ...s.cdState.config, ...action.config } };
      return { ...s, cdState };
    }

    case 'CD_RESET_MES': {
      const cdState = deepClone(s.cdState);
      const m = cdState.meses[action.mesKey];
      if (m) {
        m.receitaManual = null;
        m.funis.forEach(f => {
          f.etapas.forEach(e => { e.valor = 0; });
          f.receita = 0;
        });
      }
      return { ...s, cdState };
    }

    default:
      return state;
  }
}

/* ── localStorage helpers (UI-only state) ───────────────────── */

function loadUiState(): { dashState?: DashState; expandidos?: Set<number> } {
  const result: { dashState?: DashState; expandidos?: Set<number> } = {};
  try {
    const raw = localStorage.getItem('imperio_dash_periodo');
    if (raw) {
      const s = JSON.parse(raw);
      if (s) result.dashState = { ...buildInitialState().dashState, ...s };
    }
  } catch { /* ignore */ }
  return result;
}

function saveDashState(dashState: DashState) {
  try { localStorage.setItem('imperio_dash_periodo', JSON.stringify(dashState)); } catch { /* ignore */ }
}

/* ── Context ────────────────────────────────────────────────── */

interface AppContextValue {
  state: FullState;
  dispatch: React.Dispatch<Action>;
  isLoading: boolean;
  workspaceId: string | null;
  // Async operations (create/delete require Supabase first)
  addVendedor: (nome: string) => Promise<void>;
  removeVendedor: (id: string) => Promise<void>;
  addFunil: (mesKey: string, funil: Funil) => Promise<void>;
  removeFunil: (mesKey: string, funilId: string) => Promise<void>;
  addFunilEtapa: (mesKey: string, funilId: string, label: string) => Promise<void>;
  removeFunilEtapa: (mesKey: string, funilId: string, etapaIdx: number) => Promise<void>;
  // Legacy save helpers (kept for compatibility)
  saveMeses: () => void;
  saveApp: () => void;
  saveProdutos: () => void;
  saveDash: () => void;
  saveCd: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, null, () => {
    const base = buildInitialState();
    const ui = loadUiState();
    return { ...base, ...ui };
  });

  const [isLoading, setIsLoading] = useState(true);

  // Refs for Supabase ID mappings
  const workspaceIdRef = useRef<string | null>(null);
  const productCodeToIdRef = useRef<Record<string, string>>({});
  const monthlyPlanIdByMonthRef = useRef<Record<number, string>>({});
  const funnelStageIdsRef = useRef<Record<string, string[]>>({});

  // Debounce refs
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const isFirstLoadRef = useRef(true);
  const isInitializingRef = useRef(false);

  // ── Load data from Supabase ────────────────────────────────

  const applyDbResult = useCallback((result: import('../lib/db').LoadResult) => {
    workspaceIdRef.current = result.refs.workspaceId;
    productCodeToIdRef.current = result.refs.productCodeToId;
    monthlyPlanIdByMonthRef.current = result.refs.monthlyPlanIdByMonth;
    funnelStageIdsRef.current = result.refs.funnelStageIds;

    const ui = loadUiState();
    dispatch({
      type: 'LOAD_ALL',
      payload: {
        meses: result.meses,
        planoOriginal: deepClone(result.meses),
        premissas: result.premissas,
        produtosState: result.produtosState,
        appState: result.appState,
        cdState: result.cdState,
        ...(ui.dashState ? { dashState: ui.dashState } : {}),
      },
    });
  }, []);

  const loadFromDb = useCallback(async (workspaceId: string) => {
    try {
      const result = await loadAllData(workspaceId);
      applyDbResult(result);
    } catch (e) {
      console.error('[AppContext] Erro ao carregar dados:', e);
    }
  }, [applyDbResult]);

  const initUserData = useCallback(async (userId: string) => {
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;
    try {
      const { data: member } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userId)
        .single();

      if (member?.workspace_id) {
        await loadFromDb(member.workspace_id);
      } else {
        const wsId = await createDefaultWorkspace(userId);
        await loadFromDb(wsId);
      }
    } finally {
      // Defer para depois dos useEffects de auto-save rodarem neste ciclo de render
      setTimeout(() => { isFirstLoadRef.current = false; }, 0);
      isInitializingRef.current = false;
    }
  }, [loadFromDb]);

  useEffect(() => {
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        try {
          if (session?.user) await initUserData(session.user.id);
        } catch (e) {
          console.error('[AppContext] Erro ao inicializar:', e);
        } finally {
          setIsLoading(false);
        }
      })
      .catch((e) => {
        console.error('[AppContext] getSession falhou:', e);
        setIsLoading(false);
        isFirstLoadRef.current = false;
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // INITIAL_SESSION is already handled by getSession() above — skip to avoid duplicate init
      if (event === 'INITIAL_SESSION') return;

      if (session?.user) {
        setIsLoading(true);
        isFirstLoadRef.current = true;
        try {
          await initUserData(session.user.id);
        } catch (e) {
          console.error('[AppContext] Erro ao inicializar:', e);
        } finally {
          setIsLoading(false);
        }
      } else {
        // User signed out — reset to initial state
        workspaceIdRef.current = null;
        isFirstLoadRef.current = true;
        dispatch({ type: 'LOAD_ALL', payload: buildInitialState() });
      }
    });

    return () => subscription.unsubscribe();
  }, [initUserData]);

  // ── Auto-save to Supabase (debounced) ─────────────────────

  const scheduleDebounce = (key: string, fn: () => void, ms = 1500) => {
    clearTimeout(debounceRef.current[key]);
    debounceRef.current[key] = setTimeout(fn, ms);
  };

  useEffect(() => {
    if (isFirstLoadRef.current || !workspaceIdRef.current) return;
    scheduleDebounce('premissas', () => {
      saveWorkspace(workspaceIdRef.current!, state.premissas);
    });
  }, [state.premissas]);

  useEffect(() => {
    if (isFirstLoadRef.current || !workspaceIdRef.current) return;
    scheduleDebounce('produtos', () => {
      saveProducts(productCodeToIdRef.current, state.produtosState.items);
    });
  }, [state.produtosState]);

  useEffect(() => {
    if (isFirstLoadRef.current || !workspaceIdRef.current) return;
    scheduleDebounce('meses', async () => {
      for (const [monthStr, planId] of Object.entries(monthlyPlanIdByMonthRef.current)) {
        const mes = state.meses[Number(monthStr) - 1];
        if (mes) await saveMonthlyPlan(planId, mes, productCodeToIdRef.current);
      }
    });
  }, [state.meses]);

  useEffect(() => {
    if (isFirstLoadRef.current || !workspaceIdRef.current) return;
    scheduleDebounce('sellers', async () => {
      for (const vendedor of state.appState.vendedores) {
        if (workspaceIdRef.current) await saveSeller(workspaceIdRef.current, vendedor);
      }
    });
  }, [state.appState.vendedores]);

  useEffect(() => {
    if (isFirstLoadRef.current || !workspaceIdRef.current) return;
    scheduleDebounce('cd', async () => {
      for (const [mesKey, mesData] of Object.entries(state.cdState.meses)) {
        const [yearStr, monthStr] = mesKey.split('-');
        await saveFunnelMetrics(
          funnelStageIdsRef.current,
          mesData.funis,
          Number(yearStr),
          Number(monthStr),
        );
      }
    });
  }, [state.cdState.meses]);

  useEffect(() => {
    saveDashState(state.dashState);
  }, [state.dashState]);

  // ── Async operations ───────────────────────────────────────

  const addVendedor = useCallback(async (nome: string) => {
    if (!workspaceIdRef.current) {
      dispatch({ type: 'ADD_VENDEDOR', nome });
      return;
    }
    try {
      const id = await createSeller(workspaceIdRef.current, nome);
      dispatch({ type: 'ADD_VENDEDOR', nome, id });
    } catch {
      dispatch({ type: 'ADD_VENDEDOR', nome });
    }
  }, []);

  const removeVendedor = useCallback(async (id: string) => {
    if (workspaceIdRef.current) {
      await deactivateSeller(id).catch(console.error);
    }
    dispatch({ type: 'REMOVE_VENDEDOR', id });
  }, []);

  const addFunil = useCallback(async (mesKey: string, funil: Funil) => {
    if (!workspaceIdRef.current) {
      dispatch({ type: 'CD_ADD_FUNIL', mesKey, funil });
      return;
    }
    try {
      const { funnelId, stageIds } = await createFunil(workspaceIdRef.current, {
        nome: funil.nome,
        cor: funil.cor,
        etapas: funil.etapas.map(e => ({ label: e.label })),
      });
      funnelStageIdsRef.current[funnelId] = stageIds;
      dispatch({ type: 'CD_ADD_FUNIL', mesKey, funil: { ...funil, id: funnelId } });
    } catch {
      dispatch({ type: 'CD_ADD_FUNIL', mesKey, funil });
    }
  }, []);

  const removeFunil = useCallback(async (mesKey: string, funilId: string) => {
    if (workspaceIdRef.current) {
      await deleteFunilDb(funilId).catch(console.error);
      delete funnelStageIdsRef.current[funilId];
    }
    dispatch({ type: 'CD_REMOVE_FUNIL', mesKey, funilId });
  }, []);

  const addFunilEtapa = useCallback(async (mesKey: string, funilId: string, label: string) => {
    if (workspaceIdRef.current) {
      const currentStages = funnelStageIdsRef.current[funilId] || [];
      const sortOrder = currentStages.length;
      try {
        const stageId = await addFunilStageDb(funilId, label, sortOrder);
        const newStages = [...currentStages];
        newStages.splice(Math.max(0, newStages.length - 1), 0, stageId);
        funnelStageIdsRef.current[funilId] = newStages;
      } catch (e) {
        console.error(e);
      }
    }
    dispatch({ type: 'CD_ADD_ETAPA', mesKey, funilId, label });
  }, []);

  const removeFunilEtapa = useCallback(async (mesKey: string, funilId: string, etapaIdx: number) => {
    if (workspaceIdRef.current) {
      const stageId = (funnelStageIdsRef.current[funilId] || [])[etapaIdx];
      if (stageId) {
        await deleteFunilStageDb(stageId).catch(console.error);
        const newStages = [...(funnelStageIdsRef.current[funilId] || [])];
        newStages.splice(etapaIdx, 1);
        funnelStageIdsRef.current[funilId] = newStages;
      }
    }
    dispatch({ type: 'CD_REMOVE_ETAPA', mesKey, funilId, etapaIdx });
  }, []);

  // Legacy no-ops (kept for API compatibility, Supabase saves are automatic)
  const saveMeses = useCallback(() => {}, []);
  const saveApp = useCallback(() => {}, []);
  const saveProdutos = useCallback(() => {}, []);
  const saveDash = useCallback(() => saveDashState(state.dashState), [state.dashState]);
  const saveCd = useCallback(() => {}, []);

  return (
    <AppContext.Provider value={{
      state, dispatch, isLoading,
      workspaceId: workspaceIdRef.current,
      addVendedor, removeVendedor,
      addFunil, removeFunil, addFunilEtapa, removeFunilEtapa,
      saveMeses, saveApp, saveProdutos, saveDash, saveCd,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider');
  return ctx;
}
