import { useAppContext } from '../../context/AppContext';
import { dashSomarMeses, calcDerivados, calcularMRRMensal } from '../../lib/calculations';
import { fmtBRL, fmtBRLCompleto } from '../../lib/formatters';
import { META_MRR_DEZEMBRO } from '../../lib/constants';
import type { DashPeriodo } from '../../types';

const MESES_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function dashGetMesesRange(dashState: { periodo: DashPeriodo; trimestre: number | null; mes: number | null }): number[] {
  if (dashState.periodo === 'anual') return [0,1,2,3,4,5,6,7,8,9,10,11];
  if (dashState.periodo === 'trimestre') {
    const q = dashState.trimestre ?? 0;
    return [q*3, q*3+1, q*3+2];
  }
  return [dashState.mes ?? 0];
}

export default function DashboardPanel() {
  const { state, dispatch } = useAppContext();
  const { meses, dashState, premissas, planoOriginal } = state;

  const indices = dashGetMesesRange(dashState);
  const dados = dashSomarMeses(indices, meses, premissas);
  const fracao = indices.length / 12;
  const metaPeriodo = premissas.meta * fracao;
  const diff = dados.receitaTotal - metaPeriodo;

  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const trimAtual = Math.floor(mesAtual / 3);

  // MRR chart
  const { realizados, metas, ultimoRealizadoIdx } = calcularMRRMensal(meses);
  const maxMrr = Math.max(...realizados.filter((x): x is number => x != null), ...metas, META_MRR_DEZEMBRO, 1);

  // Labels dinâmicos
  const labMonth = MESES_LABELS;
  let metaLabel = 'Meta Anual';
  let projetadoLabel = 'Projetado · Ano';
  let realizadoLabel = `Realizado · Jan-${labMonth[mesAtual]}`;
  let faltaLabel = mesAtual < 11 ? `Falta · ${labMonth[mesAtual+1]}-Dez` : 'Falta · Ano';

  if (dashState.periodo === 'trimestre') {
    const qLbl = ['Q1','Q2','Q3','Q4'][dashState.trimestre ?? 0];
    const tri = [['Jan','Fev','Mar'],['Abr','Mai','Jun'],['Jul','Ago','Set'],['Out','Nov','Dez']][dashState.trimestre ?? 0];
    metaLabel = `Meta · ${qLbl} ${tri[0]}-${tri[2]}`;
    projetadoLabel = `Projetado · ${qLbl}`;
    realizadoLabel = `Realizado · ${qLbl}`;
    faltaLabel = `Falta · ${qLbl}`;
  } else if (dashState.periodo === 'mes') {
    const nome = MESES_FULL[dashState.mes ?? 0];
    metaLabel = `Meta · ${nome}`;
    projetadoLabel = `Projetado · ${nome}`;
    realizadoLabel = `Realizado · ${nome}`;
    faltaLabel = `Falta · ${nome}`;
  }

  const pctReal = (dados.realizado / Math.max(1, metaPeriodo) * 100).toFixed(1);
  const falta = Math.max(0, metaPeriodo - dados.realizado);

  // Alert
  let alertCls = 'alert show alert-success';
  let alertMsg = '';
  if (Math.abs(diff) < 1000) {
    alertMsg = `<strong>✓ Plano alinhado com a meta.</strong> Total de ${fmtBRL(dados.receitaTotal)} bate com a meta de ${fmtBRL(metaPeriodo)}.`;
  } else if (diff < 0) {
    alertCls = 'alert show alert-warning';
    const sugMensal = dashState.periodo !== 'mes' && dados.planejados > 0
      ? ` Para fechar: ${fmtBRL((metaPeriodo - dados.realizado) / dados.planejados)}/mês nos ${dados.planejados} meses planejados.`
      : '';
    alertMsg = `<strong>⚠ Gap de ${fmtBRL(Math.abs(diff))}</strong> para fechar a meta.${sugMensal}`;
  } else {
    alertMsg = `<strong>✓ Acima da meta:</strong> ${fmtBRL(diff)} de folga sobre ${fmtBRL(metaPeriodo)}.`;
  }

  const setDashPeriodo = (periodo: DashPeriodo) =>
    dispatch({ type: 'SET_DASH_STATE', payload: { periodo } });

  const setTrimestre = (t: number) =>
    dispatch({ type: 'SET_DASH_STATE', payload: { trimestre: t } });

  const setMes = (m: number) =>
    dispatch({ type: 'SET_DASH_STATE', payload: { mes: m } });

  // Subtitle
  let subtitle = `Visão executiva do plano de ${fmtBRL(premissas.meta)} em 2026`;
  if (dashState.periodo === 'trimestre') {
    subtitle = `Q${(dashState.trimestre??0)+1} 2026 · meta ${fmtBRL(metaPeriodo)} · ${dados.planejados} mês(es) planejado(s)`;
  } else if (dashState.periodo === 'mes') {
    subtitle = `${MESES_FULL[dashState.mes??0]} 2026 · meta ${fmtBRL(metaPeriodo)}`;
  }

  // MRR desc
  const primeiroMRR = realizados.find((x): x is number => x != null && x > 0) || 40000;
  const ultimoMostrado = ultimoRealizadoIdx >= 0 ? (realizados[ultimoRealizadoIdx] ?? primeiroMRR) : primeiroMRR;
  const crescAteAgora = primeiroMRR > 0 ? ((ultimoMostrado / primeiroMRR - 1) * 100).toFixed(0) : '0';
  const crescAnual = primeiroMRR > 0 ? ((META_MRR_DEZEMBRO / primeiroMRR - 1) * 100).toFixed(0) : '0';
  const mrrDescEl = `Realizado: <strong style="color: var(--silver-0);">${fmtBRLCompleto(primeiroMRR)}</strong> → <strong style="color: var(--silver-0);">${fmtBRLCompleto(ultimoMostrado)}</strong> (${parseInt(crescAteAgora) >= 0 ? '+' : ''}${crescAteAgora}% até ${MESES_FULL[Math.max(ultimoRealizadoIdx, 0)]}) · Meta de Dezembro: <strong style="color: var(--silver-0);">${fmtBRLCompleto(META_MRR_DEZEMBRO)}</strong> (+${crescAnual}% no ano)`;

  return (
    <>
      <div className="topbar">
        <div>
          <h1 className="page-title">Dashboard Comercial</h1>
          <div className="page-subtitle" id="dashboard-subtitle">{subtitle}</div>
        </div>
        {/* Period tabs */}
        <div className="period-tabs">
          {(['anual','trimestre','mes'] as const).map(p => (
            <button
              key={p}
              data-dash-period={p}
              className={`period-tab${dashState.periodo === p ? ' active' : ''}`}
              onClick={() => setDashPeriodo(p)}
            >
              {p === 'anual' ? 'Anual' : p === 'trimestre' ? 'Trimestre' : 'Mês'}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-period bar */}
      <div className="sub-period-bar" id="dashboard-subperiod" style={dashState.periodo === 'anual' ? { display: 'none' } : {}}>
        <span className="sub-period-label" id="dashboard-subperiod-label">
          {dashState.periodo === 'trimestre' ? 'Trimestre' : 'Mês'}
        </span>
        <div className="sub-period-tabs" id="dashboard-subperiod-tabs">
          {dashState.periodo === 'trimestre'
            ? ['Q1','Q2','Q3','Q4'].map((q, i) => (
                <button
                  key={i}
                  className={`sub-period-tab${dashState.trimestre === i ? ' active' : ''}`}
                  onClick={() => setTrimestre(i)}
                >
                  {q} · {[['Jan','Fev','Mar'],['Abr','Mai','Jun'],['Jul','Ago','Set'],['Out','Nov','Dez']][i].join('/')}
                </button>
              ))
            : MESES_LABELS.map((m, i) => (
                <button
                  key={i}
                  className={`sub-period-tab${dashState.mes === i ? ' active' : ''}`}
                  onClick={() => setMes(i)}
                >
                  {m}
                </button>
              ))
          }
        </div>
        <div className="sub-period-summary" id="dashboard-subperiod-summary">
          {dashState.periodo === 'trimestre'
            ? <>Período: <strong>{MESES_FULL.slice((dashState.trimestre??0)*3, (dashState.trimestre??0)*3+3).join(' · ')}</strong> · Meta: <strong>{fmtBRL(metaPeriodo)}</strong></>
            : <>Período: <strong>{MESES_FULL[dashState.mes??0]}</strong> · Meta do mês: <strong>{fmtBRL(metaPeriodo)}</strong></>
          }
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-head">
            <span className="kpi-label" id="kpi-meta-label">{metaLabel}</span>
            <span className="kpi-icon">◎</span>
          </div>
          <div className="kpi-value" id="kpi-meta">{fmtBRL(metaPeriodo)}</div>
          <div className="kpi-foot" id="kpi-meta-foot">
            {dashState.periodo === 'anual' ? '100% do objetivo' : `${(fracao*100).toFixed(0)}% do plano anual`}
          </div>
          <div className="kpi-bar"><div className="kpi-bar-fill" style={{ width: '100%' }} /></div>
        </div>

        <div className="kpi-card">
          <div className="kpi-head">
            <span className="kpi-label" id="kpi-projetado-label">{projetadoLabel}</span>
            <span className="kpi-icon">↗</span>
          </div>
          <div className="kpi-value" id="kpi-projetado">{fmtBRL(dados.receitaTotal)}</div>
          <div className="kpi-bar">
            <div
              className="kpi-bar-fill"
              id="kpi-projetado-bar"
              style={{ width: `${Math.min(100, (dados.receitaTotal / Math.max(1, metaPeriodo)) * 100)}%` }}
            />
          </div>
          <div
            className={`kpi-foot ${Math.abs(diff) < 1000 ? 'green' : diff > 0 ? 'green' : 'red'}`}
            id="kpi-diff"
          >
            {Math.abs(diff) < 1000
              ? '✓ Bate exatamente com a meta'
              : diff > 0
                ? `+${fmtBRL(diff)} acima da meta`
                : `−${fmtBRL(Math.abs(diff))} abaixo da meta`}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-head">
            <span className="kpi-label" id="kpi-realizado-label">{realizadoLabel}</span>
            <span className="kpi-icon">✓</span>
          </div>
          <div className="kpi-value" id="kpi-realizado">{fmtBRL(dados.realizado)}</div>
          <div className="kpi-bar">
            <div
              className="kpi-bar-fill green"
              id="kpi-realizado-bar"
              style={{ width: `${Math.min(100, (dados.realizado / Math.max(1, metaPeriodo)) * 100)}%` }}
            />
          </div>
          <div className="kpi-foot" id="kpi-realizado-foot">{pctReal}% do período</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-head">
            <span className="kpi-label" id="kpi-falta-label">{faltaLabel}</span>
            <span className="kpi-icon">⏳</span>
          </div>
          <div className="kpi-value" id="kpi-falta">{fmtBRL(falta)}</div>
          <div className="kpi-bar"><div className="kpi-bar-fill" style={{ width: `${Math.min(100, (falta / Math.max(1, metaPeriodo)) * 100)}%`, background: 'linear-gradient(90deg, #d97706, #f59e0b)' }} /></div>
          <div className="kpi-foot amber" id="kpi-falta-foot">
            {dados.planejados > 0
              ? `Média: ${fmtBRL(falta / dados.planejados)}/mês × ${dados.planejados} mês${dados.planejados===1?'':'es'}`
              : falta > 0
                ? 'Período totalmente realizado/em andamento'
                : `Meta ${dashState.periodo === 'anual' ? 'anual' : 'do período'} batida`}
          </div>
        </div>
      </div>

      <div id="alert" className={alertCls} dangerouslySetInnerHTML={{ __html: alertMsg }} />

      {/* Funil de conversão */}
      <div className="section">
        <div className="section-eyebrow">Conversão</div>
        <div className="section-title">Funil de Conversão Previsto</div>
        <div className="section-desc">Taxas de conversão baseadas nas premissas do plano</div>
      </div>
      <div className="grid-4">
        {[
          { label: 'Lead → Reunião', value: `${(1/premissas.lead * 100).toFixed(0)}%`, detail: `${Math.round(dados.leads)} leads → ${Math.round(dados.reun)} reun.` },
          { label: 'Reunião → Contrato', value: `${(1/premissas.reun * 100).toFixed(0)}%`, detail: `${Math.round(dados.reun)} reun. → ${dados.contratos} contratos` },
          { label: 'Reunião → Proposta', value: '60%', detail: `${Math.round(dados.reun)} reun. → ${Math.round(dados.reun * 0.6)} prop.` },
          { label: 'Lead → Contrato', value: `${(1/(premissas.lead * premissas.reun) * 100).toFixed(0)}%`, detail: `${Math.round(dados.leads)} leads → ${dados.contratos} contratos` },
        ].map(item => (
          <div key={item.label} className="funnel-card">
            <div className="funnel-card-label">{item.label}</div>
            <div className="funnel-card-value">{item.value}</div>
            <div className="funnel-card-detail">{item.detail}</div>
          </div>
        ))}
      </div>
      <div className="note-box">
        📌 <strong>Fórmula rápida:</strong> Para fechar X contratos → {premissas.reun}X reuniões → {(premissas.reun * premissas.lead).toFixed(1)}X leads.
      </div>

      {/* MRR Chart */}
      <div className="section">
        <div className="section-eyebrow">Crescimento</div>
        <div className="section-title">Evolução do MRR Mensal</div>
        <div
          className="section-desc"
          dangerouslySetInnerHTML={{ __html: mrrDescEl }}
        />
      </div>
      <div className="chart-wrap">
        <div className="chart-legend">
          <span className="chart-legend-item"><span className="chart-legend-dot realizado"></span>MRR realizado</span>
          <span className="chart-legend-item"><span className="chart-legend-dot meta"></span>Meta projetada</span>
        </div>
        <div className="chart-bars" id="chart-mrr">
          {meses.map((_, i) => {
            const isRealizado = realizados[i] != null;
            const valor = isRealizado ? (realizados[i] as number) : metas[i];
            const altura = (valor / maxMrr) * 100;
            const label = `${(valor / 1000).toFixed(0)}k`;
            return (
              <div key={i} className="chart-bar-col">
                <div className="chart-bar-value">
                  <span className={`chart-bar-tag ${isRealizado ? 'realizado' : 'meta'}`}>{label}</span>
                </div>
                <div
                  className={`chart-bar ${isRealizado ? 'realizado' : 'meta'}`}
                  style={{ height: `${altura}%` }}
                  title={`${meses[i].mes}: ${fmtBRLCompleto(valor)} ${isRealizado ? 'realizado' : '(projeção)'}`}
                />
              </div>
            );
          })}
        </div>
        <div className="chart-labels">
          {MESES_LABELS.map(m => <div key={m} className="chart-label">{m}</div>)}
        </div>
      </div>

      {/* Ritmo Semanal */}
      <div className="section">
        <div className="section-eyebrow">Operação</div>
        <div className="section-title">Ritmo Semanal Necessário</div>
        <div className="section-desc">Cadência semanal para entregar {Math.round(dados.contratos/12)} contratos por mês</div>
      </div>
      <div className="grid-4">
        {[
          { icon: '📞', value: Math.round(dados.leads/12/4.33), label: 'Leads / semana', detail: `≈ ${Math.round(dados.leads/12)} / mês` },
          { icon: '🤝', value: Math.round(dados.reun/12/4.33),  label: 'Reuniões / semana', detail: `≈ ${Math.round(dados.reun/12)} / mês` },
          { icon: '📋', value: Math.round(dados.reun/12*0.6/4.33), label: 'Propostas / semana', detail: `≈ ${Math.round(dados.reun/12*0.6)} / mês` },
          { icon: '✍', value: `${Math.round(dados.contratos/12/4.33)}-${Math.round(dados.contratos/12/4.33)+1}`, label: 'Contratos / semana', detail: `≈ ${Math.round(dados.contratos/12)} / mês` },
        ].map(item => (
          <div key={item.label} className="weekly-card">
            <div className="weekly-icon">{item.icon}</div>
            <div className="weekly-value">{item.value}</div>
            <div className="weekly-label">{item.label}</div>
            <div className="weekly-detail">{item.detail}</div>
          </div>
        ))}
      </div>
    </>
  );
}
