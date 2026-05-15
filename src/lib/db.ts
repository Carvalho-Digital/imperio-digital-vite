import { supabase } from './supabase';
import type { Mes, Premissas, ProdutoState, AppState, CdState, Vendedor, Lancamento, Funil } from '../types';
import { MESES_INICIAIS, PRODUTOS_STATE_INICIAL, VENDEDOR_DEFAULT_METAS } from './constants';

const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

export interface DbRefs {
  workspaceId: string;
  productCodeToId: Record<string, string>;
  monthlyPlanIdByMonth: Record<number, string>;
  funnelStageIds: Record<string, string[]>;
}

export interface LoadResult {
  meses: Mes[];
  premissas: Premissas;
  produtosState: { items: ProdutoState[] };
  appState: AppState;
  cdState: CdState;
  refs: DbRefs;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeQuery(fn: () => PromiseLike<any>): Promise<any> {
  try {
    return (await fn()).data ?? null;
  } catch (e) {
    console.error('[DB] query falhou:', e);
    return null;
  }
}

export async function loadAllData(workspaceId: string): Promise<LoadResult> {
  const [rawProducts, rawWs, rawPlans, rawSellers, rawFunnels] = await Promise.all([
    safeQuery(() =>
      supabase
        .from('products')
        .select('id,code,name,tag,meta_tcv,meta_mrr,ticket_tcv,ticket_mrr,months_mrr,is_renov,is_combo,sort_order')
        .eq('workspace_id', workspaceId)
        .order('sort_order')),
    safeQuery(() =>
      supabase
        .from('workspaces')
        .select('annual_goal,avg_ticket,meetings_per_contract,leads_per_meeting')
        .eq('id', workspaceId)
        .single()),
    safeQuery(() =>
      supabase
        .from('monthly_plans')
        .select(`id,year,month,revenue_goal,renov_count,mrr_active,status,
          contracts(id,product_id,contract_type,value,months,combo_components),
          monthly_metas(product_id,contract_type,target),
          miscellaneous_revenue(id,name,quantity,revenue)`)
        .eq('workspace_id', workspaceId)
        .order('year').order('month')),
    safeQuery(() =>
      supabase
        .from('sellers')
        .select(`id,name,
          seller_metrics(metric_key,monthly_target),
          daily_entries(entry_date,metric_key,value)`)
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .order('sort_order')),
    safeQuery(() =>
      supabase
        .from('funnels')
        .select(`id,name,color,sort_order,
          funnel_stages(id,label,sort_order),
          funnel_metrics(stage_id,year,month,value,revenue)`)
        .eq('workspace_id', workspaceId)
        .order('sort_order')),
  ]);

  // ── Products ─────────────────────────────────────────────────
  const productCodeToId: Record<string, string> = {};
  const productIdToCode: Record<string, string> = {};
  const products: any[] = rawProducts || [];

  const produtosItems: ProdutoState[] = PRODUTOS_STATE_INICIAL.items.map(def => {
    const db = products.find((p: any) => p.code === def.id);
    if (db) {
      productCodeToId[db.code] = db.id;
      productIdToCode[db.id] = db.code;
      return {
        id: def.id,
        icon: def.icon,
        nome: db.name,
        tag: db.tag || def.tag,
        metaTCV: db.meta_tcv,
        metaMRR: db.meta_mrr,
        ticketTCV: Number(db.ticket_tcv),
        ticketMRR: Number(db.ticket_mrr),
        mesesMRR: db.months_mrr,
        isRenov: db.is_renov,
        isCombo: db.is_combo,
      };
    }
    return def;
  });

  // ── Premissas ─────────────────────────────────────────────────
  const ws = rawWs;
  const premissas: Premissas = ws ? {
    meta: Number(ws.annual_goal),
    ticket: Number(ws.avg_ticket),
    reun: Number(ws.meetings_per_contract),
    lead: Number(ws.leads_per_meeting),
  } : { meta: 3000000, ticket: 19000, reun: 3, lead: 2.5 };

  // ── Monthly plans ─────────────────────────────────────────────
  const monthlyPlanIdByMonth: Record<number, string> = {};
  const plans: any[] = rawPlans || [];

  const meses: Mes[] = MESES_INICIAIS.map((def, i) => {
    const plan = plans.find((p: any) => p.month === i + 1);
    if (!plan) return { ...def };

    monthlyPlanIdByMonth[i + 1] = plan.id;

    const novos: Record<string, Mes['breakdown'] extends null | undefined ? never : any> = {
      funil: [], posic: [], estr: [], renov: [], combo: [],
    };
    ((plan as any).contracts || []).forEach((c: any) => {
      const code = productIdToCode[c.product_id];
      if (code && novos[code] !== undefined) {
        novos[code].push({ valor: Number(c.value), tipo: c.contract_type, meses: c.months, comboItens: c.combo_components });
      }
    });

    const mrrAtivo = Number(plan.mrr_active) || 0;
    const hasData = Object.values(novos).some((a: any[]) => a.length > 0) || mrrAtivo > 0;

    const metas: Record<string, { tcv?: number; mrr?: number }> = {};
    ((plan as any).monthly_metas || []).forEach((m: any) => {
      const code = productIdToCode[m.product_id];
      if (code) {
        if (!metas[code]) metas[code] = {};
        metas[code][m.contract_type as 'tcv' | 'mrr'] = m.target;
      }
    });

    const outros = ((plan as any).miscellaneous_revenue || []).map((r: any) => ({
      nome: r.name, qtd: r.quantity, receita: Number(r.revenue),
    }));

    return {
      mes: MONTH_NAMES[i],
      receita: Number(plan.revenue_goal),
      renov: plan.renov_count,
      status: plan.status as Mes['status'],
      breakdown: hasData ? { versao: 3, dados: { novos, renov: [], mrrAtivo } } : null,
      detalhe: outros.length > 0 ? { previsto: {}, outros } : undefined,
      metas: Object.keys(metas).length > 0 ? metas : undefined,
    };
  });

  // ── Sellers ───────────────────────────────────────────────────
  const sellers: any[] = rawSellers || [];
  const vendedores: Vendedor[] = sellers.map((s: any) => {
    const metas = { ...VENDEDOR_DEFAULT_METAS };
    ((s as any).seller_metrics || []).forEach((m: any) => {
      (metas as any)[m.metric_key] = Number(m.monthly_target);
    });

    const byDate: Record<string, Record<string, number>> = {};
    ((s as any).daily_entries || []).forEach((e: any) => {
      if (!byDate[e.entry_date]) byDate[e.entry_date] = {};
      byDate[e.entry_date][e.metric_key] = Number(e.value);
    });

    const lancamentos: Lancamento[] = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, m]) => ({
        data: date,
        ligacoes: m.ligacoesMes || 0,
        reuniones_agendadas: m.reunioesAgendadasMes || 0,
        reunioes_realizadas: m.reunioesRealizadasMes || 0,
        propostas: m.propostasMes || 0,
        contratos: m.contratosMes || 0,
        receita: m.receitaMes || 0,
      }));

    return { id: s.id, nome: s.name, metas, metasOverride: {}, lancamentos };
  });

  const appState: AppState = {
    vendedores: vendedores.length > 0 ? vendedores : [],
    activeVendedor: vendedores[0]?.id ?? null,
    periodo: { tipo: 'mensal', de: null, ate: null },
  };

  // ── Funnels ───────────────────────────────────────────────────
  const funnels: any[] = rawFunnels || [];
  const funnelStageIds: Record<string, string[]> = {};

  funnels.forEach((f: any) => {
    const stages = (f.funnel_stages || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
    funnelStageIds[f.id] = stages.map((s: any) => s.id);
  });

  const cdMeses: Record<string, any> = {};

  funnels.forEach((f: any) => {
    const stages = ((f as any).funnel_stages || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
    const stageUUIDs = funnelStageIds[f.id] || [];

    ((f as any).funnel_metrics || []).forEach((fm: any) => {
      const mesKey = `${fm.year}-${String(fm.month).padStart(2, '0')}`;
      if (!cdMeses[mesKey]) cdMeses[mesKey] = { receitaManual: null, funis: [], metasCustom: [] };

      let funil = cdMeses[mesKey].funis.find((x: any) => x.id === f.id);
      if (!funil) {
        funil = {
          id: f.id, nome: f.name, cor: f.color,
          etapas: stages.map((s: any) => ({ label: s.label, valor: 0 })),
          receita: 0,
        };
        cdMeses[mesKey].funis.push(funil);
      }

      if (fm.stage_id) {
        const idx = stageUUIDs.indexOf(fm.stage_id);
        if (idx >= 0) funil.etapas[idx].valor = Number(fm.value);
      } else if (fm.revenue != null) {
        funil.receita = Number(fm.revenue);
      }
    });
  });

  const today = new Date();
  const currentMesKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  if (!cdMeses[currentMesKey]) {
    cdMeses[currentMesKey] = {
      receitaManual: null,
      funis: funnels.map((f: any) => ({
        id: f.id, nome: f.name, cor: f.color,
        etapas: (f.funnel_stages || [])
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((s: any) => ({ label: s.label, valor: 0 })),
        receita: 0,
      })),
      metasCustom: [],
    };
  }

  const cdState: CdState = {
    config: { metaAnual: premissas.meta, metaMensal: Math.round(premissas.meta / 12) },
    mesAtivo: currentMesKey,
    meses: cdMeses,
  };

  return {
    meses, premissas, produtosState: { items: produtosItems }, appState, cdState,
    refs: { workspaceId, productCodeToId, monthlyPlanIdByMonth, funnelStageIds },
  };
}

// ── Save functions ────────────────────────────────────────────

export async function saveWorkspace(workspaceId: string, premissas: Premissas) {
  await supabase.from('workspaces').update({
    annual_goal: premissas.meta,
    avg_ticket: premissas.ticket,
    meetings_per_contract: premissas.reun,
    leads_per_meeting: premissas.lead,
  }).eq('id', workspaceId);
}

export async function saveProducts(productCodeToId: Record<string, string>, items: ProdutoState[]) {
  await Promise.all(items.map(item => {
    const id = productCodeToId[item.id];
    if (!id) return Promise.resolve();
    return supabase.from('products').update({
      name: item.nome, tag: item.tag,
      meta_tcv: item.metaTCV, meta_mrr: item.metaMRR,
      ticket_tcv: item.ticketTCV, ticket_mrr: item.ticketMRR,
      months_mrr: item.mesesMRR,
    }).eq('id', id);
  }));
}

export async function saveMonthlyPlan(
  planId: string,
  mes: Mes,
  productCodeToId: Record<string, string>,
) {
  await supabase.from('monthly_plans').update({
    revenue_goal: mes.receita,
    renov_count: mes.renov,
    mrr_active: mes.breakdown?.dados?.mrrAtivo ?? 0,
    status: mes.status,
  }).eq('id', planId);

  await supabase.from('contracts').delete().eq('monthly_plan_id', planId);

  const newContracts: any[] = [];
  Object.entries(mes.breakdown?.dados?.novos || {}).forEach(([code, contracts]) => {
    const productId = productCodeToId[code];
    if (!productId) return;
    contracts.forEach(c => newContracts.push({
      monthly_plan_id: planId, product_id: productId,
      contract_type: c.tipo, value: c.valor, months: c.meses, combo_components: c.comboItens,
    }));
  });
  if (newContracts.length > 0) await supabase.from('contracts').insert(newContracts);

  await supabase.from('monthly_metas').delete().eq('monthly_plan_id', planId);
  const newMetas: any[] = [];
  Object.entries(mes.metas || {}).forEach(([code, metaObj]) => {
    const productId = productCodeToId[code];
    if (!productId) return;
    if (metaObj.tcv != null) newMetas.push({ monthly_plan_id: planId, product_id: productId, contract_type: 'tcv', target: metaObj.tcv });
    if (metaObj.mrr != null) newMetas.push({ monthly_plan_id: planId, product_id: productId, contract_type: 'mrr', target: metaObj.mrr });
  });
  if (newMetas.length > 0) await supabase.from('monthly_metas').insert(newMetas);

  await supabase.from('miscellaneous_revenue').delete().eq('monthly_plan_id', planId);
  const outros = mes.detalhe?.outros || [];
  if (outros.length > 0) {
    await supabase.from('miscellaneous_revenue').insert(
      outros.map(o => ({ monthly_plan_id: planId, name: o.nome, quantity: o.qtd, revenue: o.receita }))
    );
  }
}

export async function saveSeller(workspaceId: string, vendedor: Vendedor) {
  await supabase.from('sellers').upsert(
    { id: vendedor.id, workspace_id: workspaceId, name: vendedor.nome },
    { onConflict: 'id' }
  );

  await supabase.from('seller_metrics').delete().eq('seller_id', vendedor.id);
  const metrics = Object.entries(vendedor.metas).map(([key, val]) => ({
    seller_id: vendedor.id, metric_key: key, monthly_target: val,
  }));
  if (metrics.length > 0) await supabase.from('seller_metrics').insert(metrics);

  await supabase.from('daily_entries').delete().eq('seller_id', vendedor.id);
  const entries: any[] = [];
  vendedor.lancamentos.forEach(lanc => {
    const map: Record<string, number> = {
      ligacoesMes: lanc.ligacoes, reunioesAgendadasMes: lanc.reuniones_agendadas,
      reunioesRealizadasMes: lanc.reunioes_realizadas, propostasMes: lanc.propostas,
      contratosMes: lanc.contratos, receitaMes: lanc.receita,
    };
    Object.entries(map).forEach(([key, value]) => {
      if (value > 0) entries.push({ seller_id: vendedor.id, entry_date: lanc.data, metric_key: key, value });
    });
  });
  if (entries.length > 0) await supabase.from('daily_entries').insert(entries);
}

export async function createSeller(workspaceId: string, nome: string): Promise<string> {
  const { data, error } = await supabase.from('sellers')
    .insert({ workspace_id: workspaceId, name: nome, is_active: true })
    .select('id').single();
  if (error || !data) throw new Error('Erro ao criar vendedor');
  return data.id;
}

export async function deactivateSeller(sellerId: string) {
  await supabase.from('sellers').update({ is_active: false }).eq('id', sellerId);
}

export async function saveFunnelMetrics(
  funnelStageIds: Record<string, string[]>,
  funis: Funil[],
  year: number,
  month: number,
) {
  await Promise.all(funis.map(async funil => {
    const stageUUIDs = funnelStageIds[funil.id];
    if (!stageUUIDs) return;

    await supabase.from('funnel_metrics')
      .delete().eq('funnel_id', funil.id).eq('year', year).eq('month', month);

    const rows: any[] = [];
    funil.etapas.forEach((etapa, idx) => {
      const stageId = stageUUIDs[idx];
      if (stageId) rows.push({ funnel_id: funil.id, stage_id: stageId, year, month, value: etapa.valor });
    });
    if (funil.receita > 0) {
      rows.push({ funnel_id: funil.id, stage_id: null, year, month, value: 0, revenue: funil.receita });
    }
    if (rows.length > 0) await supabase.from('funnel_metrics').insert(rows);
  }));
}

export async function createFunil(
  workspaceId: string,
  funil: { nome: string; cor: string; etapas: { label: string }[] },
): Promise<{ funnelId: string; stageIds: string[] }> {
  const { data: f, error } = await supabase.from('funnels')
    .insert({ workspace_id: workspaceId, name: funil.nome, color: funil.cor })
    .select('id').single();
  if (error || !f) throw new Error('Erro ao criar funil');

  const stageResults = await Promise.all(
    funil.etapas.map((e, idx) =>
      supabase.from('funnel_stages')
        .insert({ funnel_id: f.id, label: e.label, sort_order: idx + 1 })
        .select('id').single()
    )
  );
  const stageIds = stageResults.map(r => r.data!.id);
  return { funnelId: f.id, stageIds };
}

export async function deleteFunilDb(funnelId: string) {
  await supabase.from('funnels').delete().eq('id', funnelId);
}

export async function addFunilStageDb(funnelId: string, label: string, sortOrder: number): Promise<string> {
  const { data, error } = await supabase.from('funnel_stages')
    .insert({ funnel_id: funnelId, label, sort_order: sortOrder })
    .select('id').single();
  if (error || !data) throw new Error('Erro ao criar etapa');
  return data.id;
}

export async function deleteFunilStageDb(stageId: string) {
  await supabase.from('funnel_stages').delete().eq('id', stageId);
}

// ── Bootstrap new workspace ───────────────────────────────────

export async function createDefaultWorkspace(userId: string): Promise<string> {
  const { data: ws, error } = await supabase.from('workspaces')
    .insert({ name: 'Meu Workspace', annual_goal: 3000000, avg_ticket: 19000, meetings_per_contract: 3, leads_per_meeting: 2.5 })
    .select('id').single();
  if (error || !ws) throw new Error('Erro ao criar workspace');

  await supabase.from('workspace_members').insert({ workspace_id: ws.id, user_id: userId, role: 'owner' });

  const productRows = PRODUTOS_STATE_INICIAL.items.map((p, idx) => ({
    workspace_id: ws.id, code: p.id, name: p.nome, icon: p.icon, tag: p.tag,
    meta_tcv: p.metaTCV, meta_mrr: p.metaMRR, ticket_tcv: p.ticketTCV,
    ticket_mrr: p.ticketMRR, months_mrr: p.mesesMRR,
    is_renov: p.isRenov ?? false, is_combo: p.isCombo ?? false, sort_order: idx + 1,
  }));
  await supabase.from('products').insert(productRows);

  const today = new Date();
  const year = today.getFullYear();
  const planRows = MESES_INICIAIS.map((m, idx) => ({
    workspace_id: ws.id, year, month: idx + 1,
    revenue_goal: m.receita, renov_count: m.renov, mrr_active: 0, status: m.status,
  }));
  await supabase.from('monthly_plans').insert(planRows);

  const funnelDefs = [
    { name: 'Tráfego Pago', color: '#60a5fa', stages: ['Leads','Reunião Agendada','Reunião Realizada','Proposta Enviada','Contrato Fechado'] },
    { name: 'Social Selling', color: '#22c55e', stages: ['Leads','Reunião Agendada','Reunião Realizada','Contrato Fechado'] },
    { name: 'Indicação', color: '#f59e0b', stages: ['Indicações Recebidas','Reunião Realizada','Proposta Enviada','Contrato Fechado'] },
  ];

  for (let i = 0; i < funnelDefs.length; i++) {
    const fd = funnelDefs[i];
    const { data: f } = await supabase.from('funnels')
      .insert({ workspace_id: ws.id, name: fd.name, color: fd.color, sort_order: i + 1 })
      .select('id').single();
    if (f) {
      await supabase.from('funnel_stages').insert(
        fd.stages.map((label, si) => ({ funnel_id: f.id, label, sort_order: si + 1 }))
      );
    }
  }

  return ws.id;
}
