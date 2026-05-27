import { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import type { Vendedor, Tarefa, Compromisso, EstudoDia } from '../../types';

/* ── localStorage helpers ─────────────────────────────────── */
const LS_TAREFAS = 'tarefas_v1';
const LS_COMPROMISSOS = 'compromissos_v1';
const LS_ESTUDO = 'estudo_v1';

function loadJson<T>(key: string, def: T): T {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? def; } catch { return def; }
}
function saveJson(key: string, val: unknown) { localStorage.setItem(key, JSON.stringify(val)); }
function uid() { return Math.random().toString(36).slice(2, 10); }

/* ── Date helpers ─────────────────────────────────────────── */
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MESES_CURTOS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function toYYYYMM(year: number, month: number) { return `${year}-${String(month + 1).padStart(2, '0')}`; }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function hojeMMDD() { const d = new Date(); return `${String(d.getMonth() + 1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`; }
function greeting() { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; }

/* ── Metrics calc ─────────────────────────────────────────── */
function calcSDRMetrics(v: Vendedor, mesKey: string | null) {
  const lncs = mesKey
    ? v.lancamentos.filter(l => l.data.startsWith(mesKey))
    : v.lancamentos;

  return {
    leadsCaptados: lncs.reduce((a, l) => a + l.ligacoes, 0),
    qualificados: lncs.reduce((a, l) => a + (l.qualificados ?? l.propostas ?? 0), 0),
    desqualificados: lncs.reduce((a, l) => a + (l.leads_desqualificados ?? 0), 0),
    agendados: lncs.reduce((a, l) => a + l.reuniones_agendadas, 0),
    realizados: lncs.reduce((a, l) => a + l.reunioes_realizadas, 0),
    contratos: lncs.reduce((a, l) => a + l.contratos, 0),
    followups: lncs.reduce((a, l) => a + (l.followups_enviados ?? 0), 0),
    retornos: lncs.reduce((a, l) => a + (l.retornos_followup ?? 0), 0),
    receita: lncs.reduce((a, l) => a + l.receita, 0),
  };
}

function pct(num: number, den: number) {
  if (!den) return '—';
  return (num / den * 100).toFixed(1) + '%';
}

type ViewTab = 'geral' | 'meu-painel';
type RankingTipo = 'sdr' | 'closer';

/* ── LOAD COLAB PROFILES ──────────────────────────────────── */
function getColabTipo(id: string): 'sdr' | 'closer' {
  try {
    const profiles = JSON.parse(localStorage.getItem('colab_profiles_v1') || '{}');
    return profiles[id]?.tipo ?? 'sdr';
  } catch { return 'sdr'; }
}

/* ════════════════════════════════════════════════════════════ */
export default function OperacaoDashPanel() {
  const { state } = useAppContext();
  const { vendedores } = state.appState;

  const today = new Date();
  const [activeTab, setActiveTab] = useState<ViewTab>('geral');
  const [selectedSDRId, setSelectedSDRId] = useState<string>('');
  const [selectedMes, setSelectedMes] = useState(() => toYYYYMM(today.getFullYear(), today.getMonth()));
  const [rankTipo, setRankTipo] = useState<RankingTipo>('sdr');
  const [rankDropOpen, setRankDropOpen] = useState(false);

  // Meu Painel state
  const [meuPainelId, setMeuPainelId] = useState<string>(() => vendedores[0]?.id ?? '');
  const [tarefas, setTarefas] = useState<Tarefa[]>(() => loadJson(LS_TAREFAS, []));
  const [compromissos, setCompromissos] = useState<Compromisso[]>(() => loadJson(LS_COMPROMISSOS, []));
  const [estudo, setEstudo] = useState<EstudoDia | null>(() => loadJson(LS_ESTUDO, null));
  const [novaTarefa, setNovaTarefa] = useState('');
  const [novaTarefaPrazo, setNovaTarefaPrazo] = useState('');
  const [showNovoComp, setShowNovoComp] = useState(false);
  const [compForm, setCompForm] = useState({ titulo: '', data: todayStr(), hora: '09:00' });
  const [showEstudoForm, setShowEstudoForm] = useState(false);
  const [estudoTexto, setEstudoTexto] = useState('');

  /* ── GERAL: aggregate metrics ───────────────────────────── */
  const aggMetrics = useMemo(() => {
    const sdrs = selectedSDRId
      ? vendedores.filter(v => v.id === selectedSDRId)
      : vendedores;
    const all = sdrs.map(v => calcSDRMetrics(v, selectedMes));
    return all.reduce((acc, m) => ({
      leadsCaptados: acc.leadsCaptados + m.leadsCaptados,
      qualificados: acc.qualificados + m.qualificados,
      desqualificados: acc.desqualificados + m.desqualificados,
      agendados: acc.agendados + m.agendados,
      realizados: acc.realizados + m.realizados,
      contratos: acc.contratos + m.contratos,
      followups: acc.followups + m.followups,
      retornos: acc.retornos + m.retornos,
      receita: acc.receita + m.receita,
    }), { leadsCaptados: 0, qualificados: 0, desqualificados: 0, agendados: 0, realizados: 0, contratos: 0, followups: 0, retornos: 0, receita: 0 });
  }, [vendedores, selectedSDRId, selectedMes]);

  /* ── Ranking ────────────────────────────────────────────── */
  const rankVendedores = useMemo(() => {
    const filtered = vendedores.filter(v => getColabTipo(v.id) === rankTipo);
    return [...filtered]
      .map(v => ({ v, m: calcSDRMetrics(v, selectedMes) }))
      .sort((a, b) => b.m.realizados - a.m.realizados);
  }, [vendedores, selectedMes, rankTipo]);

  /* ── Meu Painel SDR metrics ─────────────────────────────── */
  const meuVendedor = vendedores.find(v => v.id === meuPainelId);
  const meuMetrics = meuVendedor ? calcSDRMetrics(meuVendedor, selectedMes) : null;

  /* ── Tasks for current user ─────────────────────────────── */
  const minhasTarefas = tarefas.filter(t => t.vendedorId === meuPainelId);
  const atrasadas = minhasTarefas.filter(t => !t.concluida && t.prazo && t.prazo < todayStr());
  const pendentes = minhasTarefas.filter(t => !t.concluida);
  const meusComps = compromissos
    .filter(c => c.vendedorId === meuPainelId && c.data >= todayStr())
    .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  const estudoHoje = estudo?.vendedorId === meuPainelId && estudo.data === todayStr() ? estudo : null;

  function addTarefa() {
    if (!novaTarefa.trim()) return;
    const t: Tarefa = { id: uid(), texto: novaTarefa.trim(), prazo: novaTarefaPrazo || undefined, concluida: false, vendedorId: meuPainelId };
    const next = [...tarefas, t];
    setTarefas(next); saveJson(LS_TAREFAS, next);
    setNovaTarefa(''); setNovaTarefaPrazo('');
  }

  function toggleTarefa(id: string) {
    const next = tarefas.map(t => t.id === id ? { ...t, concluida: !t.concluida } : t);
    setTarefas(next); saveJson(LS_TAREFAS, next);
  }

  function addCompromisso() {
    if (!compForm.titulo.trim()) return;
    const c: Compromisso = { id: uid(), ...compForm, titulo: compForm.titulo.trim(), vendedorId: meuPainelId };
    const next = [...compromissos, c];
    setCompromissos(next); saveJson(LS_COMPROMISSOS, next);
    setShowNovoComp(false); setCompForm({ titulo: '', data: todayStr(), hora: '09:00' });
  }

  function saveEstudo() {
    const e: EstudoDia = { vendedorId: meuPainelId, texto: estudoTexto.trim(), data: todayStr() };
    setEstudo(e); saveJson(LS_ESTUDO, e);
    setShowEstudoForm(false);
  }

  /* ── Funil steps ────────────────────────────────────────── */
  const funil = [
    { roman: 'I', label: 'LEADS CAPTADOS', valor: aggMetrics.leadsCaptados, pctStr: null },
    { roman: 'II', label: 'QUALIFICADOS', valor: aggMetrics.qualificados, pctStr: pct(aggMetrics.qualificados, aggMetrics.leadsCaptados) },
    { roman: 'III', label: 'AGENDAMENTOS', valor: aggMetrics.agendados, pctStr: pct(aggMetrics.agendados, aggMetrics.qualificados) },
    { roman: 'IV', label: 'REUNIÕES REALIZADAS', valor: aggMetrics.realizados, pctStr: pct(aggMetrics.realizados, aggMetrics.agendados) },
    { roman: 'V', label: 'CONTRATOS FECHADOS', valor: aggMetrics.contratos, pctStr: pct(aggMetrics.contratos, aggMetrics.realizados) },
  ];

  const mesDisplay = (() => {
    const [y, m] = selectedMes.split('-').map(Number);
    return `${MESES[m - 1]} ${y}`;
  })();

  return (
    <div className="panel-root">
      <div className="panel-header">
        <div className="panel-header-meta">OPERAÇÃO</div>
        <h1 className="panel-title">Dashboard Comercial</h1>
        <div className="panel-header-actions" style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Notificações placeholder */}
        </div>
      </div>

      {/* Tabs */}
      <div className="op-tabs">
        <button className={`op-tab${activeTab === 'geral' ? ' active' : ''}`} onClick={() => setActiveTab('geral')}>
          📊 Visão Geral
        </button>
        <button className={`op-tab${activeTab === 'meu-painel' ? ' active' : ''}`} onClick={() => setActiveTab('meu-painel')}>
          🎯 Meu Painel (SDR)
        </button>
      </div>

      {/* ═══════════════════ VISÃO GERAL ═══════════════════ */}
      {activeTab === 'geral' && (
        <div className="op-geral">
          {/* Filtros */}
          <div className="op-filters">
            <div className="op-filter-label">FILTROS</div>
            <select className="op-select" value={selectedSDRId} onChange={e => setSelectedSDRId(e.target.value)}>
              <option value="">Todos os SDRs</option>
              {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
            <select className="op-select" value={selectedMes} onChange={e => setSelectedMes(e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => {
                const key = toYYYYMM(today.getFullYear(), i);
                return <option key={key} value={key}>{MESES_CURTOS[i]} {today.getFullYear()}</option>;
              })}
            </select>
            <div className="op-mes-display">{mesDisplay}</div>
          </div>

          {/* KPI cards */}
          <div className="op-kpi-grid">
            {[
              { label: 'LEADS QUALIFICADOS', val: aggMetrics.qualificados, sub: `de ${aggMetrics.leadsCaptados} captados`, pct: pct(aggMetrics.qualificados, aggMetrics.leadsCaptados), color: 'var(--green)' },
              { label: 'LEADS DESQUALIFICADOS', val: aggMetrics.desqualificados, sub: 'do total captado', pct: pct(aggMetrics.desqualificados, aggMetrics.leadsCaptados), color: 'var(--red)' },
              { label: 'REUNIÕES AGENDADAS', val: aggMetrics.agendados, sub: 'dos qualificados', pct: pct(aggMetrics.agendados, aggMetrics.qualificados), color: 'var(--blue)' },
              { label: 'FOLLOW-UPS ENVIADOS', val: aggMetrics.followups, sub: 'cadência média', pct: aggMetrics.agendados ? (aggMetrics.followups / aggMetrics.agendados).toFixed(1) + 'x' : '—', color: 'var(--amber)' },
              { label: 'RETORNOS DE FOLLOW-UP', val: aggMetrics.retornos, sub: 'taxa de resposta', pct: pct(aggMetrics.retornos, aggMetrics.followups), color: 'var(--silver-1)' },
              { label: 'REUNIÕES REALIZADAS', val: aggMetrics.realizados, sub: 'conversão geral', pct: pct(aggMetrics.realizados, aggMetrics.leadsCaptados), color: 'var(--green)' },
            ].map(k => (
              <div key={k.label} className="op-kpi-card">
                <div className="op-kpi-top-bar" style={{ background: k.color }} />
                <div className="op-kpi-label">{k.label}</div>
                <div className="op-kpi-val">{k.val}</div>
                <div className="op-kpi-sub">
                  <span>{k.sub}</span>
                  <span className="op-kpi-pct">{k.pct}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Funil + Ranking */}
          <div className="op-bottom-row">
            {/* Funil de Vendas */}
            <div className="op-funil-box">
              <div className="op-section-label">ESTRUTURA</div>
              <div className="op-section-title">Funil de Vendas</div>
              <div className="op-funil">
                {funil.map((step, i) => (
                  <div key={i} className={`op-funil-row${i === funil.length - 1 ? ' last' : ''}`}>
                    <span className="op-funil-roman">{step.roman}</span>
                    <span className="op-funil-label">{step.label}</span>
                    <span className="op-funil-val">{step.valor}</span>
                    {step.pctStr && <span className="op-funil-pct">{step.pctStr}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Ranking */}
            <div className="op-ranking-box">
              <div className="op-section-label">PERFORMANCE</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div className="op-section-title" style={{ margin: 0 }}>Ranking de {rankTipo === 'sdr' ? 'SDRs' : 'Closers'}</div>
                <div className="op-rank-drop" style={{ position: 'relative', marginLeft: 'auto' }}>
                  <button className="op-select" style={{ cursor: 'pointer', padding: '6px 12px' }}
                    onClick={() => setRankDropOpen(o => !o)}>
                    {rankTipo === 'sdr' ? 'Ranking de SDRs' : 'Ranking de Closers'} ▾
                  </button>
                  {rankDropOpen && (
                    <div className="op-drop-menu" onClick={() => setRankDropOpen(false)}>
                      <div className="op-drop-item" onClick={() => setRankTipo('sdr')}>Ranking de SDRs</div>
                      <div className="op-drop-item" onClick={() => setRankTipo('closer')}>Ranking de Closers</div>
                    </div>
                  )}
                </div>
              </div>

              {rankVendedores.length === 0 ? (
                <div style={{ color: 'var(--txt-3)', fontSize: 13, padding: '16px 0' }}>
                  Nenhum {rankTipo === 'sdr' ? 'SDR' : 'closer'} cadastrado.
                </div>
              ) : (
                rankVendedores.map(({ v, m }, i) => {
                  const maxRealiz = rankVendedores[0]?.m.realizados || 1;
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <div key={v.id} className="op-rank-item">
                      <span className="op-rank-medal">{medals[i] ?? ''}</span>
                      <div className="op-rank-avatar">{v.nome.charAt(0).toUpperCase()}</div>
                      <div className="op-rank-info">
                        <div className="op-rank-nome">{v.nome}</div>
                        <div className="op-rank-stats">
                          {m.qualificados} qualif. · {m.agendados} agend. · {m.realizados} realiz.
                        </div>
                        <div className="op-rank-bar-track">
                          <div className="op-rank-bar-fill" style={{ width: `${Math.round(m.realizados / maxRealiz * 100)}%` }} />
                        </div>
                      </div>
                      <div className="op-rank-val">{m.realizados}<span className="op-rank-val-label">REUN. REALIZADAS</span></div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ MEU PAINEL ═══════════════════ */}
      {activeTab === 'meu-painel' && (
        <div className="op-meu-painel">
          {/* Selector */}
          <div className="op-filters">
            <div className="op-filter-label">VISUALIZANDO COMO</div>
            <select className="op-select" value={meuPainelId}
              onChange={e => setMeuPainelId(e.target.value)}>
              {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
            {meuVendedor && (
              <div className="op-greeting">
                {greeting()}, <strong>{meuVendedor.nome}</strong>! Aqui está o seu dia.
              </div>
            )}
          </div>

          {!meuVendedor ? (
            <div className="empty-state">
              <div className="empty-state-title">Nenhum SDR cadastrado</div>
              <div className="empty-state-sub">Adicione vendedores na aba "Time de Vendas".</div>
            </div>
          ) : (
            <>
              {/* KPIs do SDR */}
              {meuMetrics && (
                <div className="op-meu-kpis">
                  {[
                    { label: 'QUALIFICADOS (MÊS)', val: meuMetrics.qualificados, color: 'var(--green)' },
                    { label: 'AGENDAMENTOS (MÊS)', val: meuMetrics.agendados, color: 'var(--blue)' },
                    { label: 'REUNIÕES REALIZADAS', val: meuMetrics.realizados, color: 'var(--silver-1)' },
                    { label: 'FOLLOW-UPS ENVIADOS', val: meuMetrics.followups, color: 'var(--amber)' },
                  ].map(k => (
                    <div key={k.label} className="op-meu-kpi"
                      style={{ borderTop: `3px solid ${k.color}` }}>
                      <div className="op-meu-kpi-val" style={{ color: k.color }}>{k.val}</div>
                      <div className="op-meu-kpi-label">{k.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Grid 2x2 */}
              <div className="op-meu-grid">
                {/* Tarefas */}
                <div className="op-meu-card">
                  <div className="op-meu-card-header">
                    📋 Tarefas pendentes
                    <span className="op-badge-num">{pendentes.length}</span>
                  </div>
                  {atrasadas.length > 0 && (
                    <div className="op-atrasadas-badge">🔴 ATRASADAS ({atrasadas.length})</div>
                  )}
                  <div className="op-tarefa-list">
                    {pendentes.length === 0 && <div className="op-empty-sub">✓ Nenhuma tarefa pendente</div>}
                    {pendentes.map(t => (
                      <div key={t.id} className={`op-tarefa-item${t.prazo && t.prazo < todayStr() ? ' atrasada' : ''}`}>
                        <input type="checkbox" checked={t.concluida} onChange={() => toggleTarefa(t.id)} />
                        <span>{t.texto}</span>
                        {t.prazo && <span className="op-tarefa-prazo">{t.prazo.slice(5).replace('-', '/')}</span>}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <input className="field-input" style={{ flex: 1, fontSize: 12, padding: '6px 8px' }}
                      placeholder="Nova tarefa..." value={novaTarefa} onChange={e => setNovaTarefa(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addTarefa()} />
                    <input className="field-input" type="date" style={{ width: 120, fontSize: 12, padding: '6px 8px' }}
                      value={novaTarefaPrazo} onChange={e => setNovaTarefaPrazo(e.target.value)} />
                    <button className="btn-primary" style={{ padding: '0 10px', fontSize: 13 }} onClick={addTarefa}>+</button>
                  </div>
                </div>

                {/* Contratos pendentes */}
                <div className="op-meu-card">
                  <div className="op-meu-card-header">
                    📄 Contratos pendentes
                    <span className="op-badge-num">0</span>
                  </div>
                  <div className="op-empty-sub">✓ Nenhum contrato pendente</div>
                </div>

                {/* Próximos compromissos */}
                <div className="op-meu-card">
                  <div className="op-meu-card-header">
                    🗓 Próximos compromissos
                    <span className="op-badge-num">{meusComps.length}</span>
                    {meusComps.length > 0 && <button className="btn-ghost op-ver-agenda">Ver agenda →</button>}
                  </div>
                  {meusComps.length === 0 && <div className="op-empty-sub">Nenhum compromisso agendado.</div>}
                  {meusComps.slice(0, 3).map(c => (
                    <div key={c.id} className="op-comp-item">
                      <span>{c.titulo}</span>
                      <span className="op-comp-data">{c.data.slice(5).replace('-','/')} {c.hora}</span>
                    </div>
                  ))}
                  {!showNovoComp ? (
                    <button className="btn-ghost op-add-comp" onClick={() => setShowNovoComp(true)}>+ Novo compromisso</button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                      <input className="field-input" placeholder="Título" style={{ fontSize: 12 }}
                        value={compForm.titulo} onChange={e => setCompForm(f => ({ ...f, titulo: e.target.value }))} />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input className="field-input" type="date" style={{ flex: 1, fontSize: 12 }}
                          value={compForm.data} onChange={e => setCompForm(f => ({ ...f, data: e.target.value }))} />
                        <input className="field-input" type="time" style={{ width: 90, fontSize: 12 }}
                          value={compForm.hora} onChange={e => setCompForm(f => ({ ...f, hora: e.target.value }))} />
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowNovoComp(false)}>Cancelar</button>
                        <button className="btn-primary" style={{ flex: 1 }} onClick={addCompromisso}>Salvar</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Estudo do dia */}
                <div className="op-meu-card">
                  <div className="op-meu-card-header">📚 Estudo do dia</div>
                  {estudoHoje ? (
                    <div>
                      <div className="op-estudo-texto">{estudoHoje.texto}</div>
                      <div className="op-estudo-reset">Reseta às 18h · {hojeMMDD()}</div>
                    </div>
                  ) : (
                    <>
                      {!showEstudoForm ? (
                        <>
                          <div className="op-empty-sub" style={{ fontStyle: 'italic' }}>
                            Você ainda não tem a tarefa "Estudo do dia" — ela é repetível e reseta às 18h.
                          </div>
                          <button className="btn-ghost op-add-comp" onClick={() => setShowEstudoForm(true)}>
                            + Criar tarefa de estudo diário
                          </button>
                        </>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <textarea className="field-input" rows={3}
                            placeholder="O que você vai estudar hoje?"
                            value={estudoTexto} onChange={e => setEstudoTexto(e.target.value)} />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowEstudoForm(false)}>Cancelar</button>
                            <button className="btn-primary" style={{ flex: 1 }} onClick={saveEstudo}>Salvar</button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
