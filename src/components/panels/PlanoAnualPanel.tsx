import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useModal } from '../../context/ModalContext';
import {
  calcDerivados, getReceitaTotalMes, getContratos, getQtdRealizada,
  getReceitaRealizada, getMetaMensal, garantirBreakdownV2,
} from '../../lib/calculations';
import { fmtBRL, fmtBRLCompleto } from '../../lib/formatters';
import { pesosSazonalidade, PROD_PRINCIPAIS } from '../../lib/constants';
import type { Mes } from '../../types';
import ModalFinalizarMes from '../modals/ModalFinalizarMes';
import ModalDetalheMes from '../modals/ModalDetalheMes';

export default function PlanoAnualPanel() {
  const { state, dispatch } = useAppContext();
  const { meses, premissas, planoOriginal, produtosState, expandidos } = state;
  const { showConfirm, showChoice, showAlert } = useModal();

  const [finalizarIdx, setFinalizarIdx] = useState<number | null>(null);

  const totais = meses.reduce((acc, m) => {
    const d = calcDerivados(m.receita, premissas);
    return {
      receita: acc.receita + m.receita,
      contratos: acc.contratos + d.contratos,
      renov: acc.renov + m.renov,
      reun: acc.reun + d.reunioes,
      leads: acc.leads + d.leads,
    };
  }, { receita: 0, contratos: 0, renov: 0, reun: 0, leads: 0 });

  const handleMetaReceita = (i: number, raw: string) => {
    const val = parseFloat(raw.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
    dispatch({ type: 'SET_MES_META_RECEITA', idx: i, valor: val });
  };

  const handleStatusClick = async (i: number) => {
    const m = meses[i];
    const statusLabel = (s: string) =>
      s === 'realizado' ? 'Realizado' : s === 'andamento' ? 'Em andamento' : 'Planejado';

    const escolha = await showChoice({
      title: `Status de ${m.mes}`,
      subtitle: `Status atual: ${statusLabel(m.status)}`,
      options: [
        { key: 'planejado',  icon: '○', title: 'Planejado',     desc: 'Mês ainda no plano · valores são previsões.' },
        { key: 'andamento',  icon: '→', title: 'Em andamento',  desc: 'Mês corrente · acompanhamento em tempo real.' },
        { key: 'realizado',  icon: '✓', title: 'Realizado',     desc: 'Mês concluído · abre o modal de finalização.' },
      ],
    });
    if (!escolha || escolha === m.status) return;
    dispatch({ type: 'SET_MES_STATUS', idx: i, status: escolha as Mes['status'] });
    if (escolha === 'realizado') {
      setTimeout(() => setFinalizarIdx(i), 200);
    }
  };

  const handleRedistribuir = () => dispatch({ type: 'REDISTRIBUIR_GAP' });

  const handleResetar = async () => {
    const ok = await showConfirm({
      title: 'Resetar plano original?',
      message: 'Todos os meses voltam para o plano original previsto. <strong>Os breakdowns lançados também serão apagados.</strong>',
      kind: 'danger',
      okText: 'Sim, resetar plano',
      cancelText: 'Cancelar',
    });
    if (!ok) return;
    dispatch({ type: 'RESET_PLANO' });
  };

  const handleExportar = () => {
    const data = { premissas, meses, vendedores: state.appState.vendedores, timestamp: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plano_2026_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1 className="page-title">Plano Anual 2026</h1>
          <div className="page-subtitle">Mês a mês com cálculo dinâmico de contratos, reuniões e leads</div>
        </div>
      </div>

      {/* Premissas */}
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-title">Premissas de Cálculo</div>
        <div className="card-subtitle">Edite os parâmetros base. Toda a tabela e KPIs recalculam em tempo real.</div>
        <div className="form-grid">
          {([
            { id: 'prem-meta',   label: 'Meta Anual (R$)',       help: 'Total a atingir em 2026',        step: 10000, key: 'meta' as const },
            { id: 'prem-ticket', label: 'Ticket Médio (R$)',     help: 'Receita ÷ ticket = nº contratos', step: 500,   key: 'ticket' as const },
            { id: 'prem-reun',   label: 'Reuniões / Contrato',   help: 'Conversão reunião → contrato',    step: 0.1,   key: 'reun' as const },
            { id: 'prem-lead',   label: 'Leads / Reunião',       help: 'Conversão lead → reunião',        step: 0.1,   key: 'lead' as const },
          ] as const).map(f => (
            <div key={f.id} className="form-field">
              <label className="form-label" htmlFor={f.id}>{f.label}</label>
              <input
                type="number"
                id={f.id}
                className="form-input"
                value={premissas[f.key]}
                step={f.step}
                onChange={e => dispatch({ type: 'SET_PREMISSAS', payload: { [f.key]: parseFloat(e.target.value) || 0 } })}
              />
              <span className="form-help">{f.help}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="actions-bar">
        <button className="btn btn-primary" onClick={handleRedistribuir}>⚖ Redistribuir Gap (Mai–Dez)</button>
        <button className="btn" onClick={() => {}}>↻ Recalcular</button>
        <button className="btn" onClick={handleExportar}>↓ Exportar JSON</button>
        <button className="btn btn-danger" onClick={handleResetar}>↺ Resetar Plano Original</button>
      </div>

      {/* Tabela */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mês</th>
              <th>Receita (R$)</th>
              <th>Novos</th>
              <th>Renov.</th>
              <th>Total</th>
              <th>Reuniões</th>
              <th>Leads</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody id="tbody">
            {meses.map((m, i) => {
              const d = calcDerivados(m.receita, premissas);
              const total = d.contratos + m.renov;
              const isExpanded = expandidos.has(i);
              const metaReceita = planoOriginal[i]?.receita ?? m.receita;
              const realizadoVal = getReceitaTotalMes(m);
              const isRealizado = m.status === 'realizado';
              const trCls = isRealizado ? 'realizado' : m.status === 'andamento' ? 'andamento' : '';
              const statusLabel = isRealizado ? 'Realizado' : m.status === 'andamento' ? 'Em andamento' : 'Planejado';

              let realizadoCell: React.ReactNode;
              if (realizadoVal === 0 && !isRealizado) {
                realizadoCell = <div className="receita-realizado planejado">—</div>;
              } else if (isRealizado) {
                realizadoCell = <div className="receita-realizado realizado">{fmtBRLCompleto(realizadoVal)}</div>;
              } else {
                realizadoCell = (
                  <div className="receita-realizado andamento" title="Vendas lançadas, mas mês ainda não foi finalizado">
                    {fmtBRLCompleto(realizadoVal)}
                  </div>
                );
              }

              return [
                <tr key={`row-${i}`} className={trCls}>
                  <td className="month-cell">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        className={`expand-btn${isExpanded ? ' expanded' : ''}`}
                        title="Ver breakdown do mês"
                        onClick={() => dispatch({ type: 'TOGGLE_EXPANDIDO', idx: i })}
                      >
                        <span>›</span>
                      </button>
                      {m.mes}
                    </div>
                  </td>
                  <td className="receita-cell">
                    <div className="receita-stack">
                      <div className="receita-meta">
                        <span className="receita-label">META</span>
                        <MetaInput idx={i} metaReceita={metaReceita} onSave={handleMetaReceita} />
                      </div>
                      <div className="receita-divider" />
                      <div className="receita-real-row">
                        <span className="receita-label">REAL</span>
                        {realizadoCell}
                      </div>
                    </div>
                  </td>
                  <td><input type="number" className="input-cell calculated" value={d.contratos} readOnly /></td>
                  <td>
                    <input
                      type="number"
                      className="input-cell"
                      value={m.renov}
                      onChange={e => dispatch({ type: 'SET_MES_RENOV', idx: i, valor: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                  <td><input type="number" className="input-cell calculated" value={total} readOnly /></td>
                  <td><input type="number" className="input-cell calculated" value={d.reunioes} readOnly /></td>
                  <td><input type="number" className="input-cell calculated" value={d.leads} readOnly /></td>
                  <td>
                    <button className={`status-pill ${m.status}`} onClick={() => handleStatusClick(i)}>
                      {statusLabel}
                    </button>
                  </td>
                  <td>
                    <button className="btn btn-sm" onClick={() => setFinalizarIdx(i)}>Finalizar</button>
                  </td>
                </tr>,
                isExpanded && (
                  <tr key={`detail-${i}`} className="tr-detail">
                    <td colSpan={9}>
                      <ModalDetalheMes idx={i} />
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>TOTAL 2026</td>
              <td id="t-receita">{fmtBRLCompleto(totais.receita)}</td>
              <td id="t-contratos">{totais.contratos}</td>
              <td id="t-renovacoes">{totais.renov}</td>
              <td id="t-total">{totais.contratos + totais.renov}</td>
              <td id="t-reunioes">{totais.reun}</td>
              <td id="t-leads">{totais.leads}</td>
              <td colSpan={2}>—</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="note-box">
        <strong>Como usar:</strong> Edite a Receita de qualquer mês — contratos, reuniões e leads recalculam automaticamente.
        Clique em <strong>Finalizar Mês</strong> para registrar o detalhamento por produto. Use{' '}
        <strong>Redistribuir Gap</strong> para rebalancear Mai–Dez respeitando a sazonalidade.
      </div>

      {/* Modal Finalizar Mês */}
      {finalizarIdx !== null && (
        <ModalFinalizarMes idx={finalizarIdx} onClose={() => setFinalizarIdx(null)} />
      )}
    </>
  );
}

/* ── MetaInput (receita editável) ─────────────────────────── */
function MetaInput({ idx, metaReceita, onSave }: { idx: number; metaReceita: number; onSave: (i: number, v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');

  const onFocus = () => {
    setEditing(true);
    setVal(String(metaReceita));
  };
  const onBlur = () => {
    setEditing(false);
    onSave(idx, val);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      className="input-cell input-receita-meta"
      value={editing ? val : fmtBRLCompleto(metaReceita)}
      data-raw={metaReceita}
      onFocus={onFocus}
      onChange={e => setVal(e.target.value)}
      onBlur={onBlur}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    />
  );
}
