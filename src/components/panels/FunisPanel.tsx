import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useModal } from '../../context/ModalContext';
import { cdCalcFunilDados, cdCalcMacro, cdEvalFormula } from '../../lib/calculations';
import { fmtBRL } from '../../lib/formatters';
import { CD_DEFAULT_FUNNELS } from '../../lib/constants';
import type { Funil, FunilEtapa, CdMesData } from '../../types';

const CD_MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function cdMesCorrente() {
  const d = new Date();
  return `2026-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function garantirMesData(cdState: import('../../types').CdState, mesKey: string): CdMesData {
  if (!cdState.meses[mesKey]) {
    return { receitaManual: null, funis: CD_DEFAULT_FUNNELS(), metasCustom: [] };
  }
  const m = cdState.meses[mesKey];
  return {
    receitaManual: m.receitaManual ?? null,
    funis: m.funis ?? CD_DEFAULT_FUNNELS(),
    metasCustom: m.metasCustom ?? [],
  };
}

export default function FunisPanel() {
  const { state, dispatch, addFunil, removeFunil, addFunilEtapa, removeFunilEtapa } = useAppContext();
  const { showPrompt, showConfirm, showAlert } = useModal();
  const { cdState } = state;

  const mesAtivo = cdState.mesAtivo ?? cdMesCorrente();
  const mesData = garantirMesData(cdState, mesAtivo);
  const funis = mesData.funis;
  const macro = cdCalcMacro(mesData, cdState.config);

  const [editingFunil, setEditingFunil] = useState<{ funil: Funil | null; fIdx: number | null } | null>(null);

  const pctMeta = macro.pctMeta;
  const cls = pctMeta >= 100 ? 'green' : pctMeta >= 70 ? 'amber' : pctMeta >= 30 ? 'silver' : 'red';
  const corPct = pctMeta >= 100 ? 'green' : pctMeta >= 70 ? 'amber' : 'red';

  const handleMesChange = (mesKey: string) => {
    dispatch({ type: 'CD_SET_MES_ATIVO', mesKey });
  };

  const handleReceitaClick = async () => {
    const novo = await showPrompt({
      title: 'Receita do mês',
      subtitle: 'Sobrescrever soma automática',
      message: mesData.receitaManual != null
        ? `Atualmente em modo <strong>manual</strong>: ${fmtBRL(mesData.receitaManual)}.`
        : `Atualmente em modo <strong>automático</strong> (soma das receitas dos funis).`,
      defaultValue: mesData.receitaManual != null ? mesData.receitaManual : undefined,
      placeholder: 'Ex: 350000',
      type: 'number',
      help: 'Deixe em branco para voltar à soma automática dos funis.',
      okText: 'Salvar',
    });
    if (novo === null) return;
    if (novo.trim() === '') {
      dispatch({ type: 'CD_SET_RECEITA_MANUAL', mesKey: mesAtivo, valor: null });
    } else {
      const n = parseFloat(novo.replace(/[^\d,.-]/g, '').replace(',', '.'));
      if (isNaN(n) || n < 0) return;
      dispatch({ type: 'CD_SET_RECEITA_MANUAL', mesKey: mesAtivo, valor: n });
    }
  };

  const handleUpdateEtapa = (fid: string, sIdx: number, valor: number) => {
    dispatch({ type: 'CD_UPDATE_ETAPA', mesKey: mesAtivo, funilId: fid, etapaIdx: sIdx, valor });
  };

  const handleUpdateReceita = (fid: string, valor: number) => {
    dispatch({ type: 'CD_UPDATE_RECEITA', mesKey: mesAtivo, funilId: fid, receita: valor });
  };

  const handleAddStage = (fid: string) => {
    addFunilEtapa(mesAtivo, fid, 'Nova etapa');
  };

  const handleRemoveStage = async (fid: string, sIdx: number) => {
    const f = funis.find(x => x.id === fid);
    if (!f || f.etapas.length <= 3) return;
    removeFunilEtapa(mesAtivo, fid, sIdx);
  };

  const handleRemoveFunil = async (fid: string) => {
    const f = funis.find(x => x.id === fid);
    const ok = await showConfirm({
      title: `Remover funil?`,
      message: `O funil <strong>${f?.nome || ''}</strong> será removido deste mês.`,
      kind: 'danger',
      okText: 'Sim, remover',
      cancelText: 'Cancelar',
    });
    if (!ok) return;
    removeFunil(mesAtivo, fid);
  };

  const handleAddFunil = (funil: Funil) => {
    addFunil(mesAtivo, funil);
  };

  const handleEditFunil = (funil: Funil) => {
    dispatch({ type: 'CD_UPDATE_FUNIL', mesKey: mesAtivo, funilId: funil.id, campos: funil });
  };

  const handleResetMes = async () => {
    const ok = await showConfirm({
      title: 'Resetar mês?',
      message: 'Todos os dados dos funis deste mês serão zerados e redefinidos para os funis padrão.',
      kind: 'danger',
      okText: 'Sim, resetar',
      cancelText: 'Cancelar',
    });
    if (!ok) return;
    dispatch({ type: 'CD_RESET_MES', mesKey: mesAtivo });
  };

  const handleAddMetricaCustom = async () => {
    const nome = await showPrompt({
      title: 'Nova métrica customizada',
      subtitle: 'Fórmula baseada nos dados dos funis',
      message: 'Digite o nome da métrica.',
      placeholder: 'Ex: ROI estimado',
      okText: 'Próximo',
    });
    if (!nome?.trim()) return;
    const formula = await showPrompt({
      title: 'Fórmula da métrica',
      subtitle: nome.trim(),
      message: 'Use variáveis: receita, contratos, leads, ticket, meta. Ex: receita / meta * 100',
      placeholder: 'Ex: receita / leads',
      okText: 'Salvar',
    });
    if (!formula?.trim()) return;
    const id = `m_${Date.now()}`;
    dispatch({ type: 'CD_ADD_METRIC', mesKey: mesAtivo, metric: { id, nome: nome.trim(), formula: formula.trim(), format: 'number', where: 'base' } });
  };

  const handleRemoveMetrica = async (mid: string) => {
    const m = mesData.metasCustom.find(x => x.id === mid);
    const ok = await showConfirm({
      title: 'Remover métrica?',
      message: `A métrica <strong>${m?.nome || ''}</strong> será removida.`,
      kind: 'danger',
      okText: 'Sim, remover',
      cancelText: 'Cancelar',
    });
    if (!ok) return;
    dispatch({ type: 'CD_REMOVE_METRIC', mesKey: mesAtivo, metricId: mid });
  };

  // Build context for custom metrics
  const ctx: Record<string, number> = {
    receita: macro.receita, contratos: macro.contratos,
    leads: macro.totalLeads, ticket: macro.ticket,
    meta: macro.meta, meta_anual: cdState.config.metaAnual,
  };
  funis.forEach(f => {
    const idClean = f.id.toLowerCase().replace(/[^a-z_0-9]/g, '');
    f.etapas.forEach((e, i) => { ctx[`funil_${idClean}_etapa_${i}`] = e.valor || 0; });
    ctx[`funil_${idClean}_receita`] = f.receita || 0;
    ctx[`funil_${idClean}_contratos`] = f.etapas[f.etapas.length - 1]?.valor || 0;
  });

  const topMetrics = mesData.metasCustom.filter(x => x.where === 'top');
  const baseMetrics = mesData.metasCustom.filter(x => x.where === 'base');

  const fmtCustom = (v: number, fmt: string) => {
    if (fmt === 'brl') return fmtBRL(v);
    if (fmt === 'pct') return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
    return Math.round(v).toLocaleString('pt-BR');
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1 className="page-title">Funis de Aquisição</h1>
          <div className="page-subtitle">Tráfego Pago, Social Selling e Indicação · acompanhamento mensal por canal</div>
        </div>
      </div>

      <div className="cd-toolbar">
        <div className="cd-toolbar-left">
          <span className="period-picker-label">Mês de referência</span>
          <select className="cd-month-select" value={mesAtivo} onChange={e => handleMesChange(e.target.value)}>
            {CD_MESES.map((nome, i) => {
              const key = `2026-${String(i + 1).padStart(2, '0')}`;
              return <option key={key} value={key}>{nome} 2026</option>;
            })}
          </select>
        </div>
        <div className="cd-toolbar-right">
          <button className="btn btn-sm" onClick={() => setEditingFunil({ funil: null, fIdx: null })}>+ Novo funil</button>
          <button className="btn btn-sm" onClick={handleAddMetricaCustom}>＋ Métrica custom</button>
          <button className="btn btn-sm btn-danger" onClick={handleResetMes}>↺ Resetar mês</button>
        </div>
      </div>

      {/* Macro KPIs */}
      <div className="cd-macro-grid">
        <div className="kpi-card">
          <div className="kpi-head"><span className="kpi-label">Receita do mês</span><span className="kpi-icon">$</span></div>
          <div className="kpi-value" style={{ cursor: 'pointer' }} title="Clique para editar manualmente" onClick={handleReceitaClick}>
            {fmtBRL(macro.receita)}
          </div>
          <div className={`kpi-foot${mesData.receitaManual != null ? ' amber' : ''}`}>
            {mesData.receitaManual != null ? 'Valor manual sobrescreve funis' : 'Soma dos contratos dos funis'}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-head"><span className="kpi-label">% da meta mensal</span><span className="kpi-icon">◎</span></div>
          <div className="kpi-value">{pctMeta.toFixed(1)}%</div>
          <div className={`kpi-foot ${corPct}`}>Meta: {fmtBRL(macro.meta)}</div>
          <div className="kpi-bar"><div className={`kpi-bar-fill ${cls}`} style={{ width: `${Math.min(100, pctMeta)}%` }} /></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-head"><span className="kpi-label">Contratos fechados</span><span className="kpi-icon">✍</span></div>
          <div className="kpi-value">{macro.contratos}</div>
          <div className="kpi-foot">soma dos funis</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-head"><span className="kpi-label">Ticket médio</span><span className="kpi-icon">≡</span></div>
          <div className="kpi-value">{fmtBRL(macro.ticket)}</div>
          <div className="kpi-foot">receita ÷ contratos</div>
        </div>
      </div>

      {/* Custom metrics top */}
      {topMetrics.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <div className="section-eyebrow" style={{ marginBottom: 10 }}>Métricas customizadas</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {topMetrics.map(metric => (
              <div key={metric.id} className="cd-custom-metric">
                <div className="cd-custom-metric-info">
                  <div className="cd-custom-metric-name">{metric.nome}</div>
                  <div className="cd-custom-metric-formula">= {metric.formula}</div>
                </div>
                <div className="cd-custom-metric-value">{fmtCustom(cdEvalFormula(metric.formula, ctx), metric.format)}</div>
                <div className="cd-custom-metric-actions">
                  <button className="cd-icon-btn danger" onClick={() => handleRemoveMetrica(metric.id)} title="Remover">×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="section" style={{ marginTop: 0 }}>
        <div className="section-eyebrow">Aquisição</div>
        <div className="section-title">Funis Ativos</div>
        <div className="section-desc">Clique em qualquer número para editar · taxas recalculam automaticamente</div>
      </div>

      <div className="cd-funnels-wrap">
        {funis.map((f, fIdx) => (
          <FunilCard
            key={f.id}
            f={f}
            onEditEtapa={(sIdx, val) => handleUpdateEtapa(f.id, sIdx, val)}
            onEditReceita={val => handleUpdateReceita(f.id, val)}
            onAddStage={() => handleAddStage(f.id)}
            onRemoveStage={sIdx => handleRemoveStage(f.id, sIdx)}
            onEdit={() => setEditingFunil({ funil: f, fIdx })}
            onRemove={() => handleRemoveFunil(f.id)}
          />
        ))}
        <button className="cd-add-funnel" onClick={() => setEditingFunil({ funil: null, fIdx: null })}>
          <div className="cd-add-funnel-plus">+</div>
          <div>Adicionar novo funil</div>
          <div style={{ fontSize: 11, color: 'var(--txt-3)' }}>Defina nome, cor e etapas</div>
        </button>
      </div>

      {/* Compare table */}
      <div className="section">
        <div className="section-eyebrow">Comparativo</div>
        <div className="section-title">Qual funil vale mais a pena no momento?</div>
        <div className="section-desc">Visão consolidada para decidir onde investir energia este mês</div>
      </div>
      <div className="table-wrap">
        <table className="cd-compare-table">
          <thead>
            {funis.length > 0 && (
              <tr>
                <th>Métrica</th>
                {funis.map(f => (
                  <th key={f.id}>
                    <span className="cd-funnel-color-dot" style={{ '--cd-color': f.cor } as React.CSSProperties} />
                    {f.nome}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {funis.length === 0 ? (
              <tr><td colSpan={2} style={{ padding: 30, color: 'var(--txt-3)', textAlign: 'center' }}>Nenhum funil cadastrado</td></tr>
            ) : (
              [
                { label: 'Total Leads / Indicações', fn: (f: Funil) => cdCalcFunilDados(f).leads.toLocaleString('pt-BR') },
                { label: 'Contratos fechados', fn: (f: Funil) => cdCalcFunilDados(f).contratos.toLocaleString('pt-BR') },
                { label: 'Receita gerada', fn: (f: Funil) => fmtBRL(cdCalcFunilDados(f).receita) },
                { label: 'Ticket médio', fn: (f: Funil) => fmtBRL(cdCalcFunilDados(f).ticket) },
                { label: 'Taxa Lead → Contrato', fn: (f: Funil) => cdCalcFunilDados(f).taxaTotal.toFixed(1) + '%' },
                { label: '% da receita total', fn: (f: Funil) => {
                  const r = cdCalcFunilDados(f).receita;
                  return macro.receitaCalc > 0 ? ((r / macro.receitaCalc) * 100).toFixed(1) + '%' : '0,0%';
                }},
              ].map(linha => (
                <tr key={linha.label}>
                  <td className="metric-row-label">{linha.label}</td>
                  {funis.map(f => <td key={f.id}>{linha.fn(f)}</td>)}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Custom metrics base */}
      {baseMetrics.length > 0 && (
        <div>
          <div className="section-eyebrow" style={{ marginBottom: 10, marginTop: 24 }}>Métricas customizadas</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {baseMetrics.map(metric => (
              <div key={metric.id} className="cd-custom-metric">
                <div className="cd-custom-metric-info">
                  <div className="cd-custom-metric-name">{metric.nome}</div>
                  <div className="cd-custom-metric-formula">= {metric.formula}</div>
                </div>
                <div className="cd-custom-metric-value">{fmtCustom(cdEvalFormula(metric.formula, ctx), metric.format)}</div>
                <div className="cd-custom-metric-actions">
                  <button className="cd-icon-btn danger" onClick={() => handleRemoveMetrica(metric.id)} title="Remover">×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal editar/criar funil */}
      {editingFunil !== null && (
        <ModalEditFunil
          funil={editingFunil.funil}
          onSave={f => {
            if (editingFunil.funil) handleEditFunil(f);
            else handleAddFunil(f);
            setEditingFunil(null);
          }}
          onClose={() => setEditingFunil(null)}
        />
      )}
    </>
  );
}

/* ── FunilCard ──────────────────────────────────────────── */
function FunilCard({ f, onEditEtapa, onEditReceita, onAddStage, onRemoveStage, onEdit, onRemove }: {
  f: Funil;
  onEditEtapa: (sIdx: number, val: number) => void;
  onEditReceita: (val: number) => void;
  onAddStage: () => void;
  onRemoveStage: (sIdx: number) => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const dados = cdCalcFunilDados(f);

  return (
    <div className="cd-funnel" style={{ '--cd-color': f.cor } as React.CSSProperties}>
      <div className="cd-funnel-head">
        <div>
          <div className="cd-funnel-title">
            <span className="cd-funnel-color-dot" />
            {f.nome}
          </div>
          <div className="cd-funnel-tag">{f.etapas.length} etapas · funil {f.id}</div>
        </div>
        <div className="cd-funnel-actions">
          <button className="cd-icon-btn" onClick={onEdit} title="Editar funil">✎</button>
          <button className="cd-icon-btn danger" onClick={onRemove} title="Remover funil">×</button>
        </div>
      </div>

      <div className="cd-stages">
        {f.etapas.map((etapa, i) => {
          const proximo = f.etapas[i + 1];
          const conv = (etapa.valor > 0 && proximo) ? (proximo.valor / etapa.valor) * 100 : null;
          const convCls = conv == null ? '' : conv >= 50 ? 'good' : conv >= 25 ? 'ok' : 'bad';
          const isLast = i === f.etapas.length - 1;
          return (
            <div key={i} className={`cd-stage${isLast ? ' last' : ''}`}>
              <div className="cd-stage-info">
                <span className="cd-stage-label">{etapa.label}</span>
                <div className="cd-stage-value-wrap">
                  <input
                    type="number"
                    min={0}
                    className="cd-stage-value"
                    value={etapa.valor}
                    onChange={e => onEditEtapa(i, Math.max(0, parseInt(e.target.value) || 0))}
                  />
                  {conv != null && (
                    <span className={`cd-stage-conv ${convCls}`}>↓ {conv.toFixed(0)}%</span>
                  )}
                </div>
              </div>
              {f.etapas.length > 3 && (
                <button className="cd-stage-rm" onClick={() => onRemoveStage(i)} title="Remover etapa">×</button>
              )}
            </div>
          );
        })}
      </div>

      {f.etapas.length < 6 && (
        <button className="cd-funnel-add-stage" onClick={onAddStage}>+ Adicionar etapa</button>
      )}

      <div className="cd-funnel-foot">
        <div className="cd-funnel-foot-row">
          <span className="cd-funnel-foot-label">Receita gerada</span>
          <input
            type="number"
            min={0}
            step={100}
            className="cd-receita-input"
            value={f.receita}
            onChange={e => onEditReceita(Math.max(0, parseFloat(e.target.value) || 0))}
          />
        </div>
        <div className="cd-funnel-foot-row">
          <span className="cd-funnel-foot-label">Taxa Lead → Contrato</span>
          <span className="cd-funnel-foot-value">{dados.taxaTotal.toFixed(1)}%</span>
        </div>
        <div className="cd-funnel-foot-row">
          <span className="cd-funnel-foot-label">Ticket médio</span>
          <span className="cd-funnel-foot-value receita">{fmtBRL(dados.ticket)}</span>
        </div>
      </div>
    </div>
  );
}

/* ── ModalEditFunil ─────────────────────────────────────── */
const COR_OPTIONS = ['#60a5fa', '#34d399', '#f59e0b', '#f87171', '#a78bfa', '#fb923c'];

function ModalEditFunil({ funil, onSave, onClose }: {
  funil: Funil | null;
  onSave: (f: Funil) => void;
  onClose: () => void;
}) {
  const isNew = funil === null;
  const [nome, setNome] = useState(funil?.nome ?? '');
  const [cor, setCor] = useState(funil?.cor ?? COR_OPTIONS[0]);
  const [etapas, setEtapas] = useState<FunilEtapa[]>(
    funil?.etapas ?? [{ label: 'Leads', valor: 0 }, { label: 'Qualificados', valor: 0 }, { label: 'Contratos', valor: 0 }]
  );
  const [receita, setReceita] = useState(funil?.receita ?? 0);

  const handleSalvar = () => {
    if (!nome.trim()) return;
    const f: Funil = {
      id: funil?.id ?? `f_${Date.now()}`,
      nome: nome.trim(),
      cor,
      etapas,
      receita,
    };
    onSave(f);
  };

  return (
    <div className="modal-backdrop show" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-sm" style={{ maxWidth: 520 }}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{isNew ? 'Novo Funil' : `Editar: ${funil?.nome}`}</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-field">
          <label className="form-label">Nome do funil</label>
          <input type="text" className="form-input" value={nome}
            onChange={e => setNome(e.target.value)} placeholder="Ex: LinkedIn Outbound" autoFocus />
        </div>

        <div className="form-field" style={{ marginTop: 12 }}>
          <label className="form-label">Cor</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {COR_OPTIONS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setCor(c)}
                style={{
                  width: 28, height: 28, borderRadius: '50%', background: c, border: `2px solid ${cor === c ? 'white' : 'transparent'}`,
                  cursor: 'pointer', boxShadow: cor === c ? `0 0 0 2px ${c}` : 'none',
                }}
              />
            ))}
          </div>
        </div>

        <div className="form-field" style={{ marginTop: 12 }}>
          <label className="form-label">Etapas</label>
          {etapas.map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
              <input type="text" className="form-input" style={{ flex: 2 }} value={e.label}
                onChange={ev => setEtapas(prev => prev.map((x, j) => j === i ? { ...x, label: ev.target.value } : x))}
                placeholder="Nome da etapa" />
              <input type="number" className="form-input" style={{ flex: 1 }} value={e.valor} min={0}
                onChange={ev => setEtapas(prev => prev.map((x, j) => j === i ? { ...x, valor: parseInt(ev.target.value) || 0 } : x))} />
              {etapas.length > 3 && (
                <button className="btn btn-sm btn-danger" onClick={() => setEtapas(prev => prev.filter((_, j) => j !== i))}>×</button>
              )}
            </div>
          ))}
          {etapas.length < 6 && (
            <button className="btn btn-sm" style={{ marginTop: 4 }}
              onClick={() => setEtapas(prev => [...prev, { label: 'Nova etapa', valor: 0 }])}>
              + Etapa
            </button>
          )}
        </div>

        <div className="form-field" style={{ marginTop: 12 }}>
          <label className="form-label">Receita gerada (R$)</label>
          <input type="number" className="form-input" value={receita} min={0} step={100}
            onChange={e => setReceita(parseFloat(e.target.value) || 0)} />
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSalvar} disabled={!nome.trim()}>Salvar funil</button>
        </div>
      </div>
    </div>
  );
}
