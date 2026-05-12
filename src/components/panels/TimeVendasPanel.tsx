import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useModal } from '../../context/ModalContext';
import { lancamentosNoRange, somarLanc, getMeta, isoHoje, getRangeDoPeriodo } from '../../lib/calculations';
import { fmtBRL, fmtBRLCompleto, formatDate } from '../../lib/formatters';
import type { Periodo, Lancamento } from '../../types';

export default function TimeVendasPanel() {
  const { state, dispatch, addVendedor: addVendedorAsync, removeVendedor: removeVendedorAsync } = useAppContext();
  const { showPrompt, showConfirm, showAlert, showChoice } = useModal();
  const { appState } = state;
  const { vendedores, activeVendedor, periodo } = appState;

  const handleAddVendedor = async () => {
    const nome = await showPrompt({
      title: 'Novo vendedor',
      subtitle: 'Adicionar à equipe',
      message: 'Informe o nome ou apelido do vendedor que será adicionado à equipe.',
      placeholder: 'Ex: Ana Souza',
      help: 'Você pode editar ou remover depois clicando no × da aba.',
      okText: 'Adicionar',
    });
    if (!nome || !nome.trim()) return;
    await addVendedorAsync(nome.trim());
  };

  const handleRemoveVendedor = async (id: string) => {
    if (vendedores.length <= 1) return;
    const v = vendedores.find(x => x.id === id);
    const nLanc = v?.lancamentos?.length || 0;
    const ok = await showConfirm({
      title: `Remover ${v?.nome || 'vendedor'}?`,
      message: `Esta ação remove o vendedor e <strong>${nLanc} lançamento${nLanc === 1 ? '' : 's'}</strong> registrado${nLanc === 1 ? '' : 's'}. Não pode ser desfeita.`,
      kind: 'danger',
      okText: 'Sim, remover',
      cancelText: 'Cancelar',
    });
    if (!ok) return;
    await removeVendedorAsync(id);
  };

  const activeV = vendedores.find(x => x.id === activeVendedor) ?? vendedores[0];

  return (
    <>
      <div className="topbar">
        <div>
          <h1 className="page-title">Time de Vendas</h1>
          <div className="page-subtitle">Metas individuais e lançamento diário de cada vendedor</div>
        </div>
      </div>

      <div className="seller-tabs">
        {vendedores.map(v => {
          const initials = v.nome.split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase() || '?';
          return (
            <button
              key={v.id}
              className={`seller-tab${v.id === (activeVendedor ?? vendedores[0]?.id) ? ' active' : ''}`}
              onClick={() => dispatch({ type: 'SET_ACTIVE_VENDEDOR', id: v.id })}
            >
              <span className="seller-mini-avatar">{initials}</span>
              <span>{v.nome}</span>
              {vendedores.length > 1 && (
                <span
                  className="remove-x"
                  title="Remover"
                  onClick={e => { e.stopPropagation(); handleRemoveVendedor(v.id); }}
                >×</span>
              )}
            </button>
          );
        })}
        <button className="seller-tab add-btn" onClick={handleAddVendedor}>
          <span style={{ fontSize: 14 }}>＋</span> Adicionar vendedor
        </button>
      </div>

      {activeV && (
        <SellerContent
          v={activeV}
          periodo={periodo}
          allVendedores={vendedores}
          onPeriodoChange={(p) => dispatch({ type: 'SET_PERIODO', periodo: p })}
        />
      )}
    </>
  );
}

type SellerContentProps = {
  v: import('../../types').Vendedor;
  periodo: Periodo;
  allVendedores: import('../../types').Vendedor[];
  onPeriodoChange: (p: Periodo) => void;
};

function SellerContent({ v, periodo, allVendedores, onPeriodoChange }: SellerContentProps) {
  const { dispatch } = useAppContext();
  const { showPrompt, showAlert, showChoice } = useModal();

  const hoje = isoHoje();
  const range = getRangeDoPeriodo(periodo);
  const lancsPeriodo = lancamentosNoRange(v, range.de, range.ate);
  const totPeriodo = somarLanc(lancsPeriodo);

  const dHoje = new Date(hoje + 'T00:00:00');
  const mesDe = `${dHoje.getFullYear()}-${String(dHoje.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(dHoje.getFullYear(), dHoje.getMonth() + 1, 0).getDate();
  const mesAte = `${dHoje.getFullYear()}-${String(dHoje.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const lancsMes = lancamentosNoRange(v, mesDe, mesAte);
  const totMes = somarLanc(lancsMes);

  const tipo = periodo.tipo;
  const tipoLabel: Record<string, string> = { diario: 'Diário', semanal: 'Semanal', mensal: 'Mensal', trimestral: 'Trimestral', anual: 'Anual', custom: 'Personalizado' };

  const [dailyDate, setDailyDate] = useState(hoje);
  const [dailyForm, setDailyForm] = useState({
    ligacoes: 0, reuniones_agendadas: 0, reunioes_realizadas: 0,
    propostas: 0, contratos: 0, receita: 0,
  });

  const handleSalvarDia = async () => {
    if (!dailyDate) {
      await showAlert({ title: 'Data obrigatória', message: 'Selecione a data do lançamento antes de salvar.', kind: 'warning' });
      return;
    }
    const lanc: Lancamento = { data: dailyDate, ...dailyForm };
    dispatch({ type: 'ADD_LANCAMENTO', vendedorId: v.id, lancamento: lanc });
    setDailyForm({ ligacoes: 0, reuniones_agendadas: 0, reunioes_realizadas: 0, propostas: 0, contratos: 0, receita: 0 });
  };

  const handleRemoveLanc = async (idx: number) => {
    dispatch({ type: 'REMOVE_LANCAMENTO', vendedorId: v.id, idx });
  };

  const handleEditarMeta = async (key: string) => {
    const tipoLbl: Record<string, string> = { diario: 'diária', semanal: 'semanal', mensal: 'mensal', trimestral: 'trimestral', anual: 'anual', custom: 'do período' };
    const labels: Record<string, string> = {
      ligacoesMes: 'Ligações', reunioesAgendadasMes: 'Reuniões agendadas',
      reunioesRealizadasMes: 'Reuniões realizadas', propostasMes: 'Propostas',
      contratosMes: 'Contratos', receitaMes: 'Receita (R$)',
    };
    const isReceita = key === 'receitaMes';
    const fmtVal = (n: number) => isReceita ? fmtBRLCompleto(n) : Math.round(n).toLocaleString('pt-BR');

    if (tipo === 'mensal') {
      const novo = await showPrompt({
        title: `Meta mensal · ${labels[key]}`,
        subtitle: v.nome,
        message: `Valor atual: <strong>${fmtVal((v.metas as unknown as Record<string, number>)[key])}</strong>`,
        defaultValue: (v.metas as unknown as Record<string, number>)[key],
        type: 'number',
        help: 'A meta mensal é a base — todos os outros períodos recalculam proporcionalmente a partir dela.',
        okText: 'Salvar meta',
      });
      if (novo === null || novo.trim() === '') return;
      const n = parseFloat(novo);
      if (isNaN(n) || n < 0) { await showAlert({ title: 'Valor inválido', message: 'Informe um número válido.', kind: 'warning' }); return; }
      dispatch({ type: 'EDIT_META', vendedorId: v.id, key, valor: n, isOverride: false, periodoKey: `${key}:mensal` });
      return;
    }

    const overrideKey = `${key}:${tipo}`;
    const valorAtual = v.metasOverride[overrideKey] != null
      ? v.metasOverride[overrideKey]
      : Math.round(getMeta(v, key, tipo, range.diasUteis));

    const escolha = await showChoice({
      title: `Editar meta · ${labels[key]}`,
      subtitle: `${v.nome} · período: ${tipoLbl[tipo]}`,
      options: [
        { key: 'periodo', icon: '◐', title: `Ajustar só o período (${tipoLbl[tipo]})`, desc: `Define meta específica para este período. Atual: ${fmtVal(valorAtual)} · Mensal continua: ${fmtVal((v.metas as unknown as Record<string, number>)[key])}` },
        { key: 'mensal', icon: '◉', title: 'Ajustar meta MENSAL base', desc: 'Todos os períodos recalculam proporcionalmente. Mais consistente.' },
      ],
    });
    if (!escolha) return;

    const novo = await showPrompt({
      title: `Meta ${escolha === 'mensal' ? 'mensal' : tipoLbl[tipo]} · ${labels[key]}`,
      subtitle: v.nome,
      message: `Valor atual: <strong>${fmtVal(valorAtual)}</strong>`,
      defaultValue: valorAtual,
      type: 'number',
      okText: 'Salvar meta',
    });
    if (novo === null || novo.trim() === '') return;
    const n = parseFloat(novo);
    if (isNaN(n) || n < 0) return;

    if (escolha === 'mensal') {
      dispatch({ type: 'EDIT_META', vendedorId: v.id, key, valor: n, isOverride: false });
    } else {
      dispatch({ type: 'EDIT_META', vendedorId: v.id, key: overrideKey, valor: n, isOverride: true });
    }
  };

  const tipoLbl: Record<string, string> = { diario: 'Hoje', semanal: 'Semana', mensal: 'Mês', trimestral: 'Trimestre', anual: 'Ano', custom: 'Período' };

  const metaCards = [
    { emoji: '📞', label: 'Ligações',            atualP: totPeriodo.ligacoes,             atualM: totMes.ligacoes,             key: 'ligacoesMes',            isReceita: false },
    { emoji: '📅', label: 'Reuniões agendadas',  atualP: totPeriodo.reuniones_agendadas,  atualM: totMes.reuniones_agendadas,  key: 'reunioesAgendadasMes',   isReceita: false },
    { emoji: '🤝', label: 'Reuniões realizadas', atualP: totPeriodo.reunioes_realizadas,  atualM: totMes.reunioes_realizadas,  key: 'reunioesRealizadasMes',  isReceita: false },
    { emoji: '📋', label: 'Propostas geradas',   atualP: totPeriodo.propostas,            atualM: totMes.propostas,            key: 'propostasMes',           isReceita: false },
    { emoji: '✍',  label: 'Contratos fechados',  atualP: totPeriodo.contratos,            atualM: totMes.contratos,            key: 'contratosMes',           isReceita: false },
    { emoji: '💰', label: 'Receita gerada',       atualP: totPeriodo.receita,              atualM: totMes.receita,              key: 'receitaMes',             isReceita: true  },
  ];

  return (
    <div id="seller-content">
      {/* Período picker */}
      <div className="period-picker-wrap">
        <div className="period-picker-left">
          <span className="period-picker-label">Período</span>
          <div className="period-picker-buttons">
            {(['diario', 'semanal', 'mensal', 'trimestral', 'anual'] as const).map(t => (
              <button
                key={t}
                className={`period-picker-btn${tipo === t ? ' active' : ''}`}
                onClick={() => onPeriodoChange({ tipo: t, de: null, ate: null })}
              >
                {tipoLabel[t]}
              </button>
            ))}
          </div>
          <div className="period-range">
            <span className="period-range-label">Range</span>
            <input type="date" className="period-range-input" value={periodo.de || hoje}
              onChange={e => onPeriodoChange({ tipo: 'custom', de: e.target.value, ate: periodo.ate || hoje })} />
            <span className="period-range-sep">→</span>
            <input type="date" className="period-range-input" value={periodo.ate || hoje}
              onChange={e => onPeriodoChange({ tipo: 'custom', de: periodo.de || hoje, ate: e.target.value })} />
          </div>
        </div>
        <div className="period-summary">
          <span className="period-pill">
            {range.de === range.ate ? formatDate(range.de) : `${formatDate(range.de)} → ${formatDate(range.ate)}`}
          </span>
          <span style={{ color: 'var(--txt-2)' }}>{range.label}</span>
        </div>
      </div>

      <div className="section" style={{ marginTop: 0 }}>
        <div className="section-eyebrow">Performance · {tipoLabel[tipo]}</div>
        <div className="section-title">Metas de {v.nome}</div>
        <div className="section-desc">
          No período <strong style={{ color: 'var(--silver-1)' }}>{range.label}</strong> · cards mostram{' '}
          <strong style={{ color: 'var(--silver-1)' }}>No período</strong> e{' '}
          <strong style={{ color: 'var(--silver-1)' }}>Acumulado mês</strong> lado a lado
        </div>
      </div>

      <div className="seller-meta-grid">
        {metaCards.map(mc => {
          const metaP = getMeta(v, mc.key, tipo, range.diasUteis);
          const pct = metaP > 0 ? Math.min(999, (mc.atualP / metaP) * 100) : 0;
          const cls = pct >= 100 ? 'green' : pct >= 70 ? 'amber' : pct >= 30 ? 'silver' : 'red';
          const isOverride = v.metasOverride[`${mc.key}:${tipo}`] != null;
          return (
            <div key={mc.key} className="seller-meta-card">
              <div className="seller-meta-head">
                <span className="seller-meta-label">
                  <span className="seller-meta-emoji">{mc.emoji}</span>{mc.label}
                </span>
                <span className={`seller-meta-pct ${cls}`}>{pct.toFixed(0)}%</span>
              </div>
              <div className="seller-meta-stats">
                <div className="seller-meta-stat-block">
                  <span className="seller-meta-stat-label">{tipoLbl[tipo]}</span>
                  <span className="seller-meta-stat-value">
                    {mc.isReceita ? fmtBRL(mc.atualP) : mc.atualP}
                  </span>
                </div>
                <div className="seller-meta-stat-block">
                  <span className="seller-meta-stat-label">Acumulado mês</span>
                  <span className="seller-meta-stat-value muted">
                    {mc.isReceita ? fmtBRL(mc.atualM) : mc.atualM}
                  </span>
                </div>
              </div>
              <div className="seller-meta-target">
                <span className="seller-meta-target-text">
                  Meta {tipoLbl[tipo].toLowerCase()}: <strong style={{ color: 'var(--silver-1)' }}>
                    {mc.isReceita ? fmtBRL(metaP) : Math.round(metaP).toLocaleString('pt-BR')}
                  </strong>
                  {isOverride && <span className="pill pill-blue" style={{ fontSize: 9, padding: '1px 6px' }}>custom</span>}
                </span>
                <button className="btn btn-sm btn-ghost" style={{ padding: '2px 8px', fontSize: 10 }}
                  onClick={() => handleEditarMeta(mc.key)}>editar</button>
              </div>
              <div className="seller-meta-bar">
                <div className={`seller-meta-bar-fill ${cls}`} style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Form diário */}
      <div className="daily-form">
        <div className="daily-form-head">
          <div>
            <div className="card-title" style={{ marginBottom: 2 }}>Lançamento Diário</div>
            <div style={{ color: 'var(--txt-2)', fontSize: 12.5 }}>
              Preencha as métricas do dia. Os números somam automaticamente nas metas acima.
            </div>
          </div>
          <input type="date" className="daily-date-input" value={dailyDate}
            onChange={e => setDailyDate(e.target.value)} />
        </div>
        <div className="daily-grid">
          <div className="daily-field">
            <span className="daily-field-label">📞 Ligações</span>
            <input type="number" className="daily-field-input" min={0} value={dailyForm.ligacoes}
              onChange={e => setDailyForm(f => ({ ...f, ligacoes: parseInt(e.target.value) || 0 }))} />
          </div>
          <div className="daily-field">
            <span className="daily-field-label">📅 Reun. Agendadas</span>
            <input type="number" className="daily-field-input" min={0} value={dailyForm.reuniones_agendadas}
              onChange={e => setDailyForm(f => ({ ...f, reuniones_agendadas: parseInt(e.target.value) || 0 }))} />
          </div>
          <div className="daily-field">
            <span className="daily-field-label">🤝 Reun. Realizadas</span>
            <input type="number" className="daily-field-input" min={0} value={dailyForm.reunioes_realizadas}
              onChange={e => setDailyForm(f => ({ ...f, reunioes_realizadas: parseInt(e.target.value) || 0 }))} />
          </div>
          <div className="daily-field">
            <span className="daily-field-label">📋 Propostas</span>
            <input type="number" className="daily-field-input" min={0} value={dailyForm.propostas}
              onChange={e => setDailyForm(f => ({ ...f, propostas: parseInt(e.target.value) || 0 }))} />
          </div>
          <div className="daily-field">
            <span className="daily-field-label">✍ Contratos</span>
            <input type="number" className="daily-field-input" min={0} value={dailyForm.contratos}
              onChange={e => setDailyForm(f => ({ ...f, contratos: parseInt(e.target.value) || 0 }))} />
          </div>
          <div className="daily-field">
            <span className="daily-field-label">💰 Receita (R$)</span>
            <input type="number" className="daily-field-input" min={0} step={100} value={dailyForm.receita}
              onChange={e => setDailyForm(f => ({ ...f, receita: parseFloat(e.target.value) || 0 }))} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={handleSalvarDia}>Salvar lançamento do dia</button>
        </div>
      </div>

      {/* Histórico */}
      <div className="card">
        <div className="card-title">Histórico de Lançamentos</div>
        <div className="card-subtitle">Últimos 30 lançamentos · ordenado do mais recente para o mais antigo</div>
        {v.lancamentos.length === 0 ? (
          <div className="history-empty">Nenhum lançamento ainda. Use o formulário acima para começar a registrar o dia.</div>
        ) : (
          <div className="table-wrap" style={{ margin: 0 }}>
            <table className="history-table">
              <thead>
                <tr>
                  <th>Data</th><th>Ligações</th><th>R. Agend.</th><th>R. Realiz.</th>
                  <th>Propostas</th><th>Contratos</th><th>Receita</th><th></th>
                </tr>
              </thead>
              <tbody>
                {[...v.lancamentos].reverse().slice(0, 30).map((l, idx) => {
                  const realIdx = v.lancamentos.length - 1 - idx;
                  return (
                    <tr key={idx}>
                      <td>{formatDate(l.data)}</td>
                      <td>{l.ligacoes || 0}</td>
                      <td>{l.reuniones_agendadas || 0}</td>
                      <td>{l.reunioes_realizadas || 0}</td>
                      <td>{l.propostas || 0}</td>
                      <td>{l.contratos || 0}</td>
                      <td>{fmtBRLCompleto(l.receita || 0)}</td>
                      <td>
                        <button className="btn btn-sm btn-danger" onClick={() => handleRemoveLanc(realIdx)}>×</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ranking */}
      {allVendedores.length > 1 && (
        <RankingCard vendedores={allVendedores} />
      )}
    </div>
  );
}

function RankingCard({ vendedores }: { vendedores: import('../../types').Vendedor[] }) {
  const mesCorr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const ranking = vendedores.map(v => {
    const lm = v.lancamentos.filter((l: Lancamento) => l.data && l.data.startsWith(mesCorr));
    const r = lm.reduce((s: number, l: Lancamento) => s + (l.receita || 0), 0);
    const c = lm.reduce((s: number, l: Lancamento) => s + (l.contratos || 0), 0);
    return { nome: v.nome, contratos: c, receita: r };
  }).sort((a, b) => b.receita - a.receita);

  return (
    <>
      <div className="section">
        <div className="section-eyebrow">Comparativo do Time</div>
        <div className="section-title">Ranking — Mês Atual</div>
        <div className="section-desc">Top vendedores por receita gerada</div>
      </div>
      <div className="ranking-card">
        <div className="ranking-list">
          {ranking.map((r, i) => (
            <div key={i} className={`ranking-row${i === 0 ? ' gold' : ''}`}>
              <div className="ranking-pos">{i + 1}</div>
              <div className="ranking-avatar">
                {r.nome.split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div>
                <div className="ranking-name">{r.nome}</div>
                <div className="ranking-meta">{r.contratos} contratos no mês</div>
              </div>
              <div className="ranking-value">{fmtBRL(r.receita)}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
